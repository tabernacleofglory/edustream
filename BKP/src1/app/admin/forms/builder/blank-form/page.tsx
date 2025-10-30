

"use client";

import { useState, useEffect, Suspense } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, X, Combine, Link, File, FileText, ImageIcon, Music } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Form } from "@/components/ui/form";
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";


const formFieldSchema = z.object({
  id: z.string().default(() => uuidv4()),
  label: z.string().min(1, "Label is required"),
  type: z.enum([
    "text", "email", "phone", "textarea", "select", "multiple-choice", 
    "multiple-select", "password", "url", "file", "image", "audio"
  ]),
  options: z.array(z.string()).optional(),
  dataSource: z.enum([
      "manual", "campuses", "genders", "ageRanges", "languages", 
      "locationPreferences", "hpAvailabilityDays", "maritalStatuses", 
      "ministries", "ladders", "charges", "roles"
  ]).optional().default("manual"),
  required: z.boolean().default(false),
  visible: z.boolean().default(true),
  fieldId: z.string().min(1, "Field ID is required").optional(), // Making optional to auto-generate
});

const formBuilderSchema = z.object({
  title: z.string().min(3, "Form title is required"),
  fields: z.array(formFieldSchema).min(1, "At least one field is required"),
  type: z.enum(['custom', 'hybrid']).default('custom'),
});

type FormBuilderValues = z.infer<typeof formBuilderSchema>;

function BlankFormBuilder() {
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const formId = searchParams.get('formId');
    const formType = searchParams.get('type') as 'custom' | null;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingForm, setLoadingForm] = useState(!!formId);

    const form = useForm<FormBuilderValues>({
        resolver: zodResolver(formBuilderSchema),
        defaultValues: {
            title: '',
            fields: [],
            type: formType || 'custom',
        },
    });

    useEffect(() => {
        const fetchForm = async () => {
            if (formId) {
                const docRef = doc(db, 'forms', formId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    form.reset({
                        title: data.title,
                        fields: data.fields || [],
                        type: data.type || 'custom',
                    });
                } else {
                    toast({ variant: 'destructive', title: 'Form not found' });
                    router.push('/admin/forms');
                }
            } else {
                 form.reset({
                    title: 'Untitled Form',
                    fields: [{ id: uuidv4(), label: 'First Field', type: 'text', dataSource: 'manual', required: false, visible: true, fieldId: 'firstField' }],
                    type: formType || 'custom',
                });
            }
            setLoadingForm(false);
        };
        fetchForm();
    }, [formId, form, router, toast, formType]);

    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "fields",
    });

    const onSubmit = async (data: FormBuilderValues) => {
        setIsSubmitting(true);
        try {
            const formDataWithFieldIds = {
                ...data,
                fields: data.fields.map(field => ({
                    ...field,
                    fieldId: field.fieldId || field.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || uuidv4()
                })),
            };

            if (formId) {
                await updateDoc(doc(db, 'forms', formId), {
                    ...formDataWithFieldIds,
                    updatedAt: serverTimestamp(),
                });
                toast({ title: "Form Updated", description: `The "${data.title}" form has been saved.` });
            } else {
                await addDoc(collection(db, 'forms'), {
                    ...formDataWithFieldIds,
                    submissionCount: 0,
                    public: false,
                    createdAt: serverTimestamp(),
                });
                toast({ title: "Form Created", description: `The "${data.title}" form has been saved.` });
            }
            router.push('/admin/forms');
        } catch (error) {
            console.error("Error creating/updating form:", error);
            toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const addOption = (fieldIndex: number) => {
        const currentOptions = form.getValues(`fields.${fieldIndex}.options`) || [];
        form.setValue(`fields.${fieldIndex}.options`, [...currentOptions, '']);
    }

    const removeOption = (fieldIndex: number, optionIndex: number) => {
        const currentOptions = form.getValues(`fields.${fieldIndex}.options`) || [];
        currentOptions.splice(optionIndex, 1);
        form.setValue(`fields.${fieldIndex}.options`, currentOptions);
    }
    
    const handleQuestionTypeChange = (value: any, index: number) => {
        const currentField = form.getValues(`fields.${index}`);
        const newFieldData: any = {
            ...currentField,
            type: value,
        };
        
        if (["select", "multiple-choice", "multiple-select"].includes(value) && !currentField.options) {
             newFieldData.options = ['', ''];
             newFieldData.dataSource = 'manual';
        } else if (!["select", "multiple-choice", "multiple-select"].includes(value)) {
            delete newFieldData.dataSource;
        }

        update(index, newFieldData);
    };

    if (loadingForm) {
        return (
            <div className="space-y-8">
                <div>
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-5 w-1/2 mt-2" />
                </div>
                 <Skeleton className="h-[400px] w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
             <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl flex items-center gap-2">
                  {formId ? 'Edit Form' : 'Custom Form Builder'}
                </h1>
                <p className="text-muted-foreground">
                    {formId ? 'Edit your custom form.' : `Create a new custom form.`}
                </p>
            </div>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                     <div className="space-y-2">
                        <Label htmlFor="form-title">Form Title</Label>
                        <Input id="form-title" {...form.register('title')} placeholder="e.g., Contact Us" />
                        {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
                    </div>

                    <ScrollArea className="h-96 pr-4 -mr-4 border p-4 rounded-md">
                        <div className="space-y-4">
                            {fields.map((field, index) => {
                                const fieldType = form.watch(`fields.${index}.type`);
                                const dataSource = form.watch(`fields.${index}.dataSource`);
                                const showOptions = ["select", "multiple-choice", "multiple-select"].includes(fieldType);
                                return (
                                <Card key={field.id} className="p-4">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1 pr-4">
                                            <Label htmlFor={`fields.${index}.label`}>Field Label</Label>
                                            <Input id={`fields.${index}.label`} {...form.register(`fields.${index}.label`)} placeholder={`Field ${index + 1}`} />
                                            {form.formState.errors.fields?.[index]?.label && <p className="text-sm text-destructive">{form.formState.errors.fields?.[index]?.label?.message}</p>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Select onValueChange={(value: any) => handleQuestionTypeChange(value, index)} defaultValue={field.type}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Field Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="text">Text</SelectItem>
                                                    <SelectItem value="email">Email</SelectItem>
                                                    <SelectItem value="password">Password</SelectItem>
                                                    <SelectItem value="phone">Phone</SelectItem>
                                                    <SelectItem value="textarea">Text Area</SelectItem>
                                                    <SelectItem value="select">Dropdown</SelectItem>
                                                    <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                                                    <SelectItem value="multiple-select">Checkboxes</SelectItem>
                                                    <SelectItem value="url"><div className="flex items-center gap-2"><Link className="h-4 w-4" /> URL</div></SelectItem>
                                                    <SelectItem value="file"><div className="flex items-center gap-2"><File className="h-4 w-4" /> File</div></SelectItem>
                                                    <SelectItem value="image"><div className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Image</div></SelectItem>
                                                    <SelectItem value="audio"><div className="flex items-center gap-2"><Music className="h-4 w-4" /> Audio</div></SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>

                                    {fieldType === 'phone' && (
                                        <Controller
                                            name={`fields.${index}.id` as any} 
                                            control={form.control}
                                            render={({ field: phoneField }) => (
                                                <PhoneInput
                                                    international
                                                    defaultCountry="US"
                                                    placeholder="Enter phone number"
                                                    className="PhoneInputInput"
                                                />
                                            )}
                                        />
                                    )}
                                    
                                     {showOptions && (
                                        <div className="space-y-2 mt-4 pl-2 border-l-2">
                                             <div className="space-y-2">
                                                <Label>Option Source</Label>
                                                <Controller
                                                    name={`fields.${index}.dataSource`}
                                                    control={form.control}
                                                    render={({ field: dsField }) => (
                                                        <Select onValueChange={dsField.onChange} value={dsField.value}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select option source" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="manual">Manual Entry</SelectItem>
                                                                <SelectItem value="campuses">Campuses</SelectItem>
                                                                <SelectItem value="genders">Genders</SelectItem>
                                                                <SelectItem value="ageRanges">Age Ranges</SelectItem>
                                                                <SelectItem value="languages">Languages</SelectItem>
                                                                <SelectItem value="locationPreferences">Location Preferences</SelectItem>
                                                                <SelectItem value="hpAvailabilityDays">HP Availability Days</SelectItem>
                                                                <SelectItem value="maritalStatuses">Marital Statuses</SelectItem>
                                                                <SelectItem value="ministries">Ministries</SelectItem>
                                                                <SelectItem value="ladders">Ladders</SelectItem>
                                                                <SelectItem value="charges">Charges</SelectItem>
                                                                <SelectItem value="roles">Roles</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </div>

                                            {dataSource === 'manual' && (
                                                <div className="space-y-2 pt-2">
                                                    <Label>Options</Label>
                                                    {(form.watch(`fields.${index}.options`) || []).map((_, optIndex) => (
                                                        <div key={optIndex} className="flex items-center gap-2">
                                                            <Input {...form.register(`fields.${index}.options.${optIndex}`)} placeholder={`Option ${optIndex + 1}`} />
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index, optIndex)}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    <Button type="button" variant="outline" size="sm" onClick={() => addOption(index)}>
                                                        <Plus className="mr-2 h-4 w-4" /> Add Option
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center space-x-2 mt-4">
                                        <Switch
                                            id={`required-${index}`}
                                            checked={form.watch(`fields.${index}.required`)}
                                            onCheckedChange={(checked) => form.setValue(`fields.${index}.required`, checked, { shouldDirty: true })}
                                        />
                                        <Label htmlFor={`required-${index}`}>Required</Label>
                                    </div>
                                </Card>
                            )})}
                        </div>
                    </ScrollArea>
                    <div className="flex justify-between">
                        <Button type="button" variant="secondary" onClick={() => append({ id: uuidv4(), label: '', type: 'text', dataSource: 'manual', required: false, visible: true, fieldId: '' })}>
                            <Plus className="mr-2 h-4 w-4" /> Add Field
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {formId ? 'Save Changes' : 'Create Form'}
                        </Button>
                    </div>
                     {form.formState.errors.fields && <p className="text-sm text-destructive">{form.formState.errors.fields.message || form.formState.errors.fields.root?.message}</p>}
                </form>
            </Form>
        </div>
    );
}

export default function BlankFormBuilderPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <BlankFormBuilder />
        </Suspense>
    );
}
