

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import FormBuilder from "@/components/form-builder";
import { useRouter } from 'next/navigation';
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function FormBuilderPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const formType = searchParams.get('type') as 'userProfile' | 'custom' | 'hybrid' | null;
    const formId = searchParams.get('formId');
    
    useEffect(() => {
        if (!formId) return;
        const docRef = doc(db, 'forms', formId);
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists() && (docSnap.data().type === 'custom' || docSnap.data().type === 'hybrid')) {
                router.replace(`/admin/forms/builder/blank-form?formId=${formId}&type=${docSnap.data().type}`);
            }
        })
    }, [formId, router]);


    if (!formType && !formId) {
        return (
            <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Invalid Form Type</AlertTitle>
                <AlertDescription>No form type was specified. Please go back and select a form type to create.</AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-8">
             <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl capitalize">
                  {formId ? 'Edit Form' : `${formType === 'userProfile' ? 'User Profile' : 'Custom'} Form Builder`}
                </h1>
                <p className="text-muted-foreground">
                    Configure the fields and settings for your form.
                </p>
            </div>
            <FormBuilder formType={formType} formId={formId} />
        </div>
    )
}


export default function FormBuilderPage() {
    return (
        <Suspense fallback={<div>Loading form builder...</div>}>
            <FormBuilderPageContent />
        </Suspense>
    )
}
