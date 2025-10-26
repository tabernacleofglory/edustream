
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import FormBuilder from "@/components/form-builder";

function FormBuilderPageContent() {
    const searchParams = useSearchParams();
    const formType = searchParams.get('type') as 'userProfile' | 'blank' | null;
    const formId = searchParams.get('formId');

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
                  {formId ? 'Edit Form' : `${formType === 'userProfile' ? 'User Profile' : 'Blank'} Form Builder`}
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
