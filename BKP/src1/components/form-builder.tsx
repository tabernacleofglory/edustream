

"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { CustomForm } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

const fieldConfigSchema = z.object({
  fieldId: z.string(),
  label: z.string(),
  visible: z.boolean(),
  required: z.boolean(),
});

const formBuilderSchema = z.object({
  title: z.string().min(1, 'Form title is required.'),
  type: z.enum(['userProfile', 'custom']),
  fields: z.array(fieldConfigSchema),
  public: z.boolean().default(false),
  submissionCount: z.number().default(0),
});

type FormBuilderValues = z.infer<typeof formBuilderSchema>;

const USER_PROFILE_FIELDS: Omit<z.infer<typeof fieldConfigSchema>, 'visible' | 'required'>[] = [
    { fieldId: 'firstName', label: 'First Name' },
    { fieldId: 'lastName', label: 'Last Name' },
    { fieldId: 'email', label: 'Email Address' },
    { fieldId: 'password', label: 'Password' },
    { fieldId: 'phoneNumber', label: 'Phone Number' },
    { fieldId: 'gender', label: 'Gender' },
    { fieldId: 'ageRange', label: 'Age Range' },
    { fieldId: 'campus', label: 'Campus' },
    { fieldId: 'language', label: 'Preferred Language' },
    { fieldId: 'locationPreference', label: 'Location Preference' },
    { fieldId: 'isInHpGroup', label: 'Are you in a Prayer Group (HP)?' },
    { fieldId: 'hpNumber', label: 'HP Number' },
    { fieldId: 'facilitatorName', label: "Facilitator's Name" },
    { fieldId: 'hpAvailabilityDay', label: 'HP Availability Day' },
    { fieldId: 'hpAvailabilityTime', label: 'HP Availability Time' },
];

const getInitialFields = (formType: 'userProfile' | 'custom') => {
    if (formType === 'userProfile') {
        return USER_PROFILE_FIELDS.map(field => {
            const isRequired = ['firstName', 'lastName', 'email', 'password'].includes(field.fieldId);
            return { ...field, visible: true, required: isRequired };
        });
    }
    return [];
}

interface FormBuilderProps {
    formType: 'userProfile' | 'custom' | null;
    formId?: string | null;
}

export default function FormBuilder({ formType, formId }: FormBuilderProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingForm, setLoadingForm] = useState(!!formId);

    const form = useForm<FormBuilderValues>({
        resolver: zodResolver(formBuilderSchema),
        defaultValues: async () => {
            if (formId) {
                const docRef = doc(db, 'forms', formId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setLoadingForm(false);
                    return docSnap.data() as FormBuilderValues;
                }
            }
            setLoadingForm(false);
            return {
                title: formType === 'userProfile' ? 'New User Registration' : 'New Form',
                type: formType || 'custom',
                fields: formType ? getInitialFields(formType) : [],
                public: false,
                submissionCount: 0,
            }
        }
    });

    const { control, register, handleSubmit, formState: { errors } } = form;

    const { fields } = useFieldArray({
        control,
        name: "fields"
    });

    const onSubmit = async (data: FormBuilderValues) => {
        setIsSubmitting(true);
        try {
            if (formId) {
                 await updateDoc(doc(db, "forms", formId), {
                     ...data,
                     updatedAt: serverTimestamp(),
                 });
                 toast({ title: 'Form Updated', description: `Your "${data.title}" form has been saved.` });
            } else {
                await addDoc(collection(db, 'forms'), {
                    ...data,
                    submissionCount: 0,
                    public: false, // Forms are private by default
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'Form Created', description: `Your "${data.title}" form has been saved.` });
            }
            router.push('/admin/forms');
        } catch (error) {
            console.error("Error creating/updating form:", error);
            toast({ variant: 'destructive', title: 'Failed to save form.' });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    if (loadingForm) {
        return <Skeleton className="h-96 w-full" />
    }
    
    if (form.getValues('type') === 'custom' && !formId) {
         router.replace('/admin/forms/builder/blank-form?type=custom');
         return null;
    }


    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
                <CardHeader>
                    <div className="space-y-1">
                        <Label htmlFor="title" className="text-sm font-medium">Form Title</Label>
                        <Input
                            id="title"
                            className="text-2xl font-bold h-auto p-0 border-none focus-visible:ring-0 shadow-none"
                            {...register('title')}
                        />
                        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fields.map((field, index) => {
                            const isLocked = ['password'].includes(field.fieldId);
                            return (
                                <div key={field.id} className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">{field.label}</Label>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id={`visible-${index}`}
                                                {...register(`fields.${index}.visible`)}
                                                checked={form.watch(`fields.${index}.visible`)}
                                                onCheckedChange={(checked) => form.setValue(`fields.${index}.visible`, checked, { shouldDirty: true })}
                                                disabled={isLocked}
                                            />
                                            <Label htmlFor={`visible-${index}`}>Visible</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id={`required-${index}`}
                                                {...register(`fields.${index}.required`)}
                                                checked={form.watch(`fields.${index}.required`)}
                                                onCheckedChange={(checked) => form.setValue(`fields.${index}.required`, checked, { shouldDirty: true })}
                                                disabled={isLocked}
                                            />
                                            <Label htmlFor={`required-${index}`}>Required</Label>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Form
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
