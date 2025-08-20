
"use client";

import { useRef, forwardRef } from "react";
import Certificate from "@/components/certificate";
import type { Course } from "@/lib/types";
import { useReactToPrint } from "react-to-print";
import { Button } from "./ui/button";
import { Printer, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { toPng } from 'html-to-image';


interface CertificatePrintProps {
    userName: string;
    course: Course;
}

// Create a new component that is a simple button and forwards the ref
// This is necessary because useReactToPrint uses findDOMNode, which can have issues with functional components and hooks.
// Wrapping it this way provides a stable node for the library to reference.
const PrintButton = forwardRef<HTMLButtonElement, { onClick: () => void }>(({ onClick }, ref) => {
    return (
        <Button onClick={onClick} ref={ref}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Save as PDF
        </Button>
    );
});
PrintButton.displayName = "PrintButton";


export default function CertificatePrint({ userName, course }: CertificatePrintProps) {
    const certificateRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const printRef = useRef<HTMLButtonElement>(null);

    const handlePrint = useReactToPrint({
        content: () => certificateRef.current,
        documentTitle: `${userName} - ${course.title} Certificate`,
        trigger: () => printRef.current,
    });
    
     const handleDownload = async () => {
        const certificateElement = certificateRef.current;
        if (!certificateElement) return;

        try {
            const dataUrl = await toPng(certificateElement, { 
                cacheBust: true,
                style: {
                     fontFamily: "'Inter', sans-serif",
                }
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
                <PrintButton ref={printRef} onClick={handlePrint} />
                <Button onClick={handleDownload} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download as Image
                </Button>
            </div>
        </div>
    );
}
