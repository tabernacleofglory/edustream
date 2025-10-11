
"use client";

import { useRef, useState } from "react";
import Certificate from "@/components/certificate";
import type { Course } from "@/lib/types";
import { Button } from "./ui/button";
import { Printer, Download, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toPng } from 'html-to-image';
import { useAuth } from "@/hooks/use-auth";
import { getFunctions, httpsCallable } from "firebase/functions";
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
}

export default function CertificatePrint({ userName, course }: CertificatePrintProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isEmailing, setIsEmailing] = useState(false);
    const [email, setEmail] = useState(user?.email || '');
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

    const handlePrint = () => {
        window.print();
    };
    
     const handleDownload = async () => {
        const certificateElement = document.querySelector('.certificate-print-area') as HTMLElement;
        if (!certificateElement) return;

        try {
            const dataUrl = await toPng(certificateElement, { 
                cacheBust: true,
                fetchRequestInit: {
                    mode: 'cors',
                    credentials: 'omit',
                },
            });
            const link = document.createElement('a');
            link.download = `${userName}-${course.title}-certificate.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("Error generating image:", error);
            toast({ variant: 'destructive', title: 'Failed to download certificate image.' });
        }
    };
    
    const handleEmailCertificate = async () => {
        if (!email) {
            toast({ variant: 'destructive', title: 'Please enter a valid email address.' });
            return;
        }
        setIsEmailing(true);
        try {
            const functions = getFunctions();
            const sendCertificateEmail = httpsCallable(functions, 'sendCertificateEmail');
            const certificateUrl = `${window.location.origin}/certificate/${course.id}`;
            
            const result = await sendCertificateEmail({
                email,
                userName,
                courseName: course.title,
                certificateUrl,
            });

            if ((result.data as any).success) {
                toast({ title: 'Email Sent!', description: `Certificate sent to ${email}.` });
                setIsEmailDialogOpen(false);
            } else {
                throw new Error('Function returned an error.');
            }
        } catch (error) {
            console.error('Error sending certificate email:', error);
            toast({ variant: 'destructive', title: 'Failed to send email.' });
        } finally {
            setIsEmailing(false);
        }
    };


    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="w-full bg-white shadow-lg max-w-4xl certificate-print-area">
                <Certificate
                    userName={userName}
                    courseName={course.title}
                    completionDate={course.completedAt}
                    templateUrl={course.certificateTemplateUrl}
                    logoUrl={course.logoUrl}
                />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print / Save as PDF
                </Button>
                <Button onClick={handleDownload} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download as Image
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
                                Enter the email address you'd like to send this certificate to.
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
