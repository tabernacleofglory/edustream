"use client";

import { useState, useCallback } from "react";
import Certificate from "@/components/certificate";
import type { Course, SiteSettings } from "@/lib/types";
import { Button } from "./ui/button";
import { Printer, Download, FileDown, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useAuth } from "@/hooks/use-auth";
import { getFirebaseStorage, getFirebaseFirestore } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface CertificatePrintProps {
    userName: string;
    course: Course;
    completionDate: string | null;
    templateUrl?: string;
    logoUrl?: string;
    settings: SiteSettings | null;
}

export default function CertificatePrint({ userName, course, completionDate, templateUrl, logoUrl, settings }: CertificatePrintProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEmailing, setIsEmailing] = useState(false);
    const [email, setEmail] = useState(user?.email || "");
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [hasPdf, setHasPdf] = useState(false);
    const db = getFirebaseFirestore();
    const storage = getFirebaseStorage();

    const captureCertificate = useCallback(async (): Promise<HTMLCanvasElement> => {
        const element = document.querySelector(".certificate-print-area") as HTMLElement;
        if (!element) throw new Error("Certificate element not found");
        return html2canvas(element, {
            allowTaint: true,
            useCORS: true,
            scale: 2,
        });
    }, []);

    const generatePdfBlob = useCallback(async (): Promise<Blob> => {
        const canvas = await captureCertificate();
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("l", "mm", [297, 210]);
        pdf.addImage(imgData, "PNG", 0, 0, 297, 210);
        return pdf.output("blob");
    }, [captureCertificate]);

    const uploadPdfToStorage = useCallback(async (pdfBlob: Blob): Promise<string> => {
        if (!user) throw new Error("User not authenticated");
        const path = `certificates/${user.uid}/${course.id}.pdf`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, pdfBlob);
        return getDownloadURL(storageRef);
    }, [user, course.id, storage]);

    const saveCertificateRecord = useCallback(async (pdfUrl: string) => {
        await addDoc(collection(db, "certificates"), {
            userId: user?.uid || "",
            userName,
            courseId: course.id,
            courseTitle: course.title,
            pdfUrl,
            completionDate,
            createdAt: serverTimestamp(),
        });
    }, [user?.uid, userName, course.id, course.title, completionDate, db]);

    const handleGenerateAndDownloadPdf = useCallback(async () => {
        setIsGenerating(true);
        try {
            const pdfBlob = await generatePdfBlob();
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement("a");
            link.download = `${userName}-${course.title}-certificate.pdf`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            toast({ title: "PDF downloaded!", description: "Your certificate has been saved as a PDF." });
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ variant: "destructive", title: "Failed to generate PDF." });
        } finally {
            setIsGenerating(false);
        }
    }, [generatePdfBlob, userName, course.title, toast]);

    const handleSavePdf = useCallback(async () => {
        setIsGenerating(true);
        try {
            const pdfBlob = await generatePdfBlob();
            const url = await uploadPdfToStorage(pdfBlob);
            setPdfUrl(url);
            setHasPdf(true);
            await saveCertificateRecord(url);
            toast({ title: "Certificate saved!", description: "Your PDF is now available in your certificates." });
        } catch (error) {
            console.error("Error saving PDF:", error);
            toast({ variant: "destructive", title: "Failed to save certificate." });
        } finally {
            setIsGenerating(false);
        }
    }, [generatePdfBlob, uploadPdfToStorage, saveCertificateRecord, toast]);

    const handleDownloadPdf = useCallback(async () => {
        if (hasPdf && pdfUrl) {
            window.open(pdfUrl, "_blank");
        } else {
            await handleGenerateAndDownloadPdf();
        }
    }, [hasPdf, pdfUrl, handleGenerateAndDownloadPdf]);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    const handleDownloadImage = useCallback(async () => {
        setIsGenerating(true);
        try {
            const canvas = await captureCertificate();
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = `${userName}-${course.title}-certificate.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("Error generating image:", error);
            toast({ variant: "destructive", title: "Failed to download image." });
        } finally {
            setIsGenerating(false);
        }
    }, [captureCertificate, userName, course.title, toast]);

    const handleEmailCertificate = useCallback(async () => {
        if (!email) {
            toast({ variant: "destructive", title: "Please enter a valid email address." });
            return;
        }
        setIsEmailing(true);
        try {
            // Generate PDF + upload if not already saved
            let finalPdfUrl = pdfUrl;
            if (!finalPdfUrl) {
                const pdfBlob = await generatePdfBlob();
                finalPdfUrl = await uploadPdfToStorage(pdfBlob);
                setPdfUrl(finalPdfUrl);
                setHasPdf(true);
                await saveCertificateRecord(finalPdfUrl);
            }

            // Capture canvas for email embed
            const canvas = await captureCertificate();
            const imgData = canvas.toDataURL("image/png");

            const certificateUrl = `${window.location.origin}/certificate/${course.id}`;

            await addDoc(collection(db, "mail"), {
                to: [email],
                message: {
                    subject: `Your Certificate for ${course.title}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h1 style="color: #1e40af;">Congratulations, ${userName}!</h1>
                            <p style="font-size: 16px; color: #333;">
                                You have successfully completed the course: <strong>${course.title}</strong>.
                            </p>
                            <div style="margin: 20px 0; text-align: center;">
                                <img src="${imgData}" alt="Certificate" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />
                            </div>
                            <p style="margin: 20px 0;">
                                <a href="${finalPdfUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">Download PDF</a>
                                <a href="${certificateUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6b7280; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Online</a>
                            </p>
                            <p style="color: #666; font-size: 14px;">Thank you for your dedication and hard work!</p>
                        </div>
                    `,
                },
            });

            toast({ title: "Email sent!", description: `Certificate PDF has been sent to ${email}.` });
            setIsEmailDialogOpen(false);
        } catch (error) {
            console.error("Error sending certificate email:", error);
            toast({ variant: "destructive", title: "Failed to send email." });
        } finally {
            setIsEmailing(false);
        }
    }, [email, toast, pdfUrl, generatePdfBlob, uploadPdfToStorage, saveCertificateRecord, captureCertificate, course.id, course.title, db, userName]);

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="w-full bg-white shadow-lg max-w-4xl certificate-print-area">
                <Certificate
                    userName={userName}
                    courseName={course.title}
                    completionDate={completionDate}
                    templateUrl={templateUrl}
                    logoUrl={logoUrl}
                    settings={settings}
                />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button onClick={handleDownloadPdf} disabled={isGenerating} size="lg">
                    {isGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                    )}
                    {hasPdf ? "Open PDF" : "Download PDF"}
                </Button>

                {!hasPdf && (
                    <Button onClick={handleSavePdf} disabled={isGenerating} variant="outline">
                        {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Save to My Certificates
                    </Button>
                )}

                <Button onClick={handleDownloadImage} variant="outline" disabled={isGenerating}>
                    <Download className="mr-2 h-4 w-4" />
                    Download as Image
                </Button>

                <Button onClick={handlePrint} variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>

                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <Mail className="mr-2 h-4 w-4" />
                            Email Certificate
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Email Your Certificate</DialogTitle>
                            <DialogDescription>
                                Your certificate PDF will be attached. Enter the email address to send it to.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-2">
                            <Label htmlFor="email-input">Recipient Email</Label>
                            <Input
                                id="email-input"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter email address"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setIsEmailDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleEmailCertificate} disabled={isEmailing}>
                                {isEmailing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Send Email
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
