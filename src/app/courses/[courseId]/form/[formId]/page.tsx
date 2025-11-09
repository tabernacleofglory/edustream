
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { CustomForm } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import PublicBlankForm from "@/components/public-blank-form";
import Link from 'next/link';
import { Button } from '@/components/ui/button';


export default function InCourseFormPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { courseId, formId } = params as { courseId: string; formId: string };
    const videoId = searchParams.get('videoId');
    const { user, loading: authLoading } = useAuth();
    
    const [formConfig, setFormConfig] = useState<CustomForm | null>(null);
    const [submission, setSubmission] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchFormData = async () => {
            setLoading(true);
            try {
                // Fetch form configuration
                const formDocRef = doc(db, "forms", formId);
                const formSnap = await getDoc(formDocRef);
                if (formSnap.exists()) {
                    setFormConfig({ id: formSnap.id, ...formSnap.data() } as CustomForm);
                } else {
                    // Form not found, redirect
                    router.push(`/courses/${courseId}`);
                    return;
                }

                // Fetch existing submission for this user and course
                const submissionQuery = query(
                    collection(db, "forms", formId, "submissions"),
                    where("userId", "==", user.uid),
                    where("courseId", "==", courseId)
                );
                const submissionSnap = await getDocs(submissionQuery);
                if (!submissionSnap.empty) {
                    setSubmission({id: submissionSnap.docs[0].id, ...submissionSnap.docs[0].data()});
                }
            } catch (error) {
                console.error("Error fetching form data:", error);
                router.push(`/courses/${courseId}`);
            } finally {
                setLoading(false);
            }
        };

        fetchFormData();
    }, [authLoading, user, courseId, formId, router, db]);

    const handleFormComplete = () => {
        // After successful submission, you might want to redirect
        // or show a success message before redirecting.
        const backUrl = videoId ? `/courses/${courseId}/video/${videoId}` : `/courses/${courseId}`;
        router.push(backUrl);
    };

    const backUrl = videoId ? `/courses/${courseId}/video/${videoId}` : `/courses/${courseId}`;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!formConfig) {
        // Handle case where form doesn't exist
        return <p>Form not found.</p>;
    }
    
    return (
        <div className="min-h-screen bg-muted/40 p-4 md:p-8 flex items-center justify-center">
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
