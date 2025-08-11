
"use client";

import { useRef } from "react";
import Certificate from "@/components/certificate";
import type { Course } from "@/lib/types";
import { useReactToPrint } from "react-to-print";
import { Button } from "./ui/button";
import { Printer, Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

interface CertificatePrintProps {
    userName: string;
    course: Course;
}

export default function CertificatePrint({ userName, course }: CertificatePrintProps) {
    const certificateRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const handlePrint = useReactToPrint({
        content: () => certificateRef.current,
        documentTitle: `${userName} - ${course.title} Certificate`,
    });
    
    const handleDownload = async () => {
        const certificateElement = certificateRef.current;
        if (!certificateElement) return;

        try {
            const canvas = await html2canvas(certificateElement, {
                scale: 3,
                useCORS: true,
                backgroundColor: null,
            });

            const link = document.createElement('a');
            link.download = `${userName}-${course.title}-certificate.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

        } catch (error) {
            console.error("Error generating image:", error);
            toast({ variant: 'destructive', title: 'Failed to download certificate image.' });
        }
    };


    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="w-full bg-white shadow-lg max-w-4xl">
                <div ref={certificateRef}>
                    <Certificate
                        userName={userName}
                        courseName={course.title}
                        completionDate={course.completedAt}
                        templateUrl={course.certificateTemplateUrl}
                        logoUrl={course.logoUrl}
                    />
                </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print / Save as PDF
                </Button>
                <Button onClick={handleDownload} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download as Image
                </Button>
            </div>
        </div>
    );
}
