
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc, collectionGroup, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { CustomForm } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import PublicBlankForm from "@/components/public-blank-form";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePathname } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getFirebaseFunctions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";


export default function InCourseFormPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const { courseId, formId } = params as { courseId: string; formId: string };
    const videoId = searchParams.get('videoId');
    const { user, loading: authLoading } = useAuth();
    
    const [formConfig, setFormConfig] = useState<CustomForm | null>(null);
    const [submission, setSubmission] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;
        
        const fetchFormData = async () => {
            setLoading(true);
            setError(null);
            try {
                const formDocRef = doc(db, "forms", formId);
                const formSnap = await getDoc(formDocRef);
                if (formSnap.exists()) {
                    const formConfigData = { id: formSnap.id, ...formSnap.data() } as CustomForm;
                    setFormConfig(formConfigData);
                    
                    if (formConfigData.autoSignup && !user) {
                        const redirectUrl = encodeURIComponent(`${pathname}?${searchParams.toString()}`);
                        router.push(`/login?redirect=${redirectUrl}`);
                        return;
                    }
                    
                    if (user) {
                        const submissionQuery = query(
                            collectionGroup(db, "submissions"),
                            where("formId", "==", formId),
                            where("userId", "==", user.uid),
                            where("courseId", "==", courseId)
                        );
                        const submissionSnap = await getDocs(submissionQuery);
                        if (!submissionSnap.empty) {
                            setSubmission({id: submissionSnap.docs[0].id, ...submissionSnap.docs[0].data()});
                        }
                    }

                } else {
                    setError("This form does not exist or has been deleted.");
                }
            } catch (error: any) {
                console.error("Error fetching form data:", error);
                setError(error.message || "An unexpected error occurred while loading the form.");
            } finally {
                setLoading(false);
            }
        };

        fetchFormData();
    }, [authLoading, user, courseId, formId, router, db, pathname, searchParams]);

    const handleFormComplete = async (submissionId: string) => {
        if (formConfig?.autoSignup || formConfig?.emailConfirmationEnabled) {
            try {
                const functions = getFirebaseFunctions();
                const processFormSubmission = httpsCallable(functions, 'processFormSubmission');
                await processFormSubmission({ formId: formConfig.id, submissionId });
            } catch (error) {
                console.error("Error calling processFormSubmission function:", error);
            }
        }
        const backUrl = videoId ? `/courses/${courseId}/video/${videoId}` : `/dashboard`;
        router.push(backUrl);
    };

    const backUrl = videoId ? `/courses/${courseId}/video/${videoId}` : `/dashboard`;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="min-h-screen bg-muted/40 p-4 md:p-8 flex items-center justify-center">
                <div className="w-full max-w-lg space-y-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error Loading Form</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/dashboard">Return to Dashboard</Link>
                    </Button>
                </div>
            </div>
        )
    }
    
    if (!formConfig) return null;
    
    return (
        <div className="min-h-screen bg-muted/40 p-4 md:p-8 flex flex-col items-center">
            <div className="w-full max-w-lg">
                <Button asChild variant="outline" className="mb-4">
                    <Link href={backUrl}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Course
                    </Link>
                </Button>
                 <PublicBlankForm
                    formConfig={formConfig}
                    courseId={courseId}
                    existingSubmission={submission}
                    onFormComplete={handleFormComplete}
                />
            </div>
        </div>
    );
}
