"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc, query, orderBy, where, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, Plus, Trash2, X, Combine, Link as LinkIconLucide, File, FileText, ImageIcon, Music, MapPin, Calendar, List, GitBranch, User as UserIcon, ChevronsUpDown, ArrowUp, ArrowDown, Settings2, Info, Copy, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Form, FormControl, FormItem, FormLabel, FormMessage, FormField, FormDescription } from "@/components/ui/form";
import 'react-phone-number-input/style.css';
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from 'use-debounce';

interface EmailTemplate {
  id: string;
  name: string;
}

type Opt = { value: string; label: string };

const conditionalLogicSchema = z.object({
  fieldId: z.string().min(1, "You must select a field to base the condition on."),
  operator: z.enum(['is', 'isNot', 'contains', 'doesNotContain', 'isNotEmpty']),
  value: z.string().optional(),
});

const formFieldSchema = z.object({
  id: z.string().default(() => uuidv4()),
  label: z.string().min(1, "Label is required"),
  type: z.enum([
    "text", "email", "phone", "textarea", "select", "multiple-choice", 
    "multiple-select", "password", "url", "file", "image", "audio", "address", "date"
  ]),
  options: z.array(z.string()).optional(),
  dataSource: z.string().optional().default("manual"),
  dataSourceOptions: z.object({
      ladders: z.array(z.string()).optional(),
      campuses: z.array(z.string()).optional(),
  }).optional(),
  required: z.boolean().default(false),
  visible: z.boolean().default(true),
  fieldId: z.string().min(1, "Field ID is required"),
  conditionalLogic: conditionalLogicSchema.optional(),
  userProfileField: z.string().optional(),
});

const formBuilderSchema = z.object({
  title: z.string().min(3, "Form title is required"),
  fields: z.array(formFieldSchema).min(1, "At least one field is required"),
  type: z.enum(['custom', 'hybrid']).default('custom'),
  autoSignup: z.boolean().default(false),
  emailConfirmationEnabled: z.boolean().default(false),
  emailTemplateId: z.string().optional(),
});

type FormBuilderValues = z.infer<typeof formBuilderSchema>;

const USER_PROFILE_FIELD_OPTIONS = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'password', label: 'Password' },
  { value: 'phoneNumber', label: 'Phone Number' },
  { value: 'gender', label: 'Gender' },
  { value: 'ageRange', label: 'Age Range' },
  { value: 'maritalStatus', label: 'Marital Status' },
  { value: 'isBaptized', label: 'Are you baptized?' },
  { value: 'denomination', label: 'Denomination' },
  { value: 'campus', label: 'Campus' },
  { value: 'language', label: 'Preferred Language' },
  { value: 'locationPreference', label: 'Location Preference' },
  { value: 'isInHpGroup', label: 'Are you in a Prayer Group (HP)?' },
  { value: 'hpNumber', label: 'HP Number' },
  { value: 'facilitatorName', label: "Facilitator's Name" },
  { value: 'hpAvailabilityDay', label: 'HP Availability Day' },
  { value: 'hpAvailabilityTime', label: 'HP Availability Time' },
  { value: 'ministry', label: 'Ministry' },
  { value: 'charge', label: 'Charge' },
  { value: 'bio', label: 'Bio' },
  { value: 'classLadderId', label: 'Class Ladder' },
];

function MobilePreview({ form, dynamicOptions }: { form: any, dynamicOptions: Record<string, Opt[]> }) {
    const watchedFields = form.watch('fields');
    const watchedTitle = form.watch('title');
    const formValues = form.watch();

    const getOptionsForField = (field: any) => {
        if (field.dataSource === 'manual') {
            return (field.options || []).map((opt: string) => ({ value: opt, label: opt }));
        }
        return dynamicOptions[field.dataSource] || [];
    }

    const checkConditionalLogic = (field: any) => {
        if (!field.conditionalLogic || !field.conditionalLogic.fieldId) {
            return true;
        }

        const { fieldId, operator, value } = field.conditionalLogic;
        const targetValue = formValues.fields.find((f: any) => f.fieldId === fieldId)?.value;
        
        switch(operator) {
            case 'is': return targetValue === value;
            case 'isNot': return targetValue !== value;
            case 'isNotEmpty': return !!targetValue;
            case 'contains': return String(targetValue || '').includes(String(value));
            case 'doesNotContain': return !String(targetValue || '').includes(String(value));
            default: return true;
        }
    };

    return (
        <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
            <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute"></div>
            <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[72px] rounded-s-lg"></div>
            <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[124px] rounded-s-lg"></div>
            <div className="h-[64px] w-[3px] bg-gray-800 absolute -end-[17px] top-[142px] rounded-e-lg"></div>
            <div className="rounded-[2rem] overflow-hidden w-full h-full bg-background">
                <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                        <h2 className="text-xl font-bold text-center">{watchedTitle}</h2>
                        {watchedFields.map((field: any, index: number) => {
                            if (!field.visible || !checkConditionalLogic(field)) return null;

                            return (
                                <div key={index} className="space-y-1">
                                    <Label>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
                                    {field.type === 'textarea' || field.type === 'address' ? <Textarea placeholder={field.label} /> :
                                     field.type === 'select' ? (
                                        <Select>
                                            <SelectTrigger>
                                                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                                            </SelectTrigger>
                                             <SelectContent>
                                                {getOptionsForField(field).filter((opt: Opt) => opt.value).map((opt: Opt, i: number) => (
                                                    <SelectItem key={`${opt.value}-${i}`} value={opt.value}>{opt.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                     ) : field.type === 'multiple-choice' ? (
                                         <RadioGroup>
                                             {getOptionsForField(field).filter((opt: Opt) => opt.value).map((opt: Opt, i: number) => (
                                                 <div key={`${opt.value}-${i}`} className="flex items-center space-x-2">
                                                     <RadioGroupItem value={opt.value} id={`${field.id}-preview-${i}`} />
                                                     <Label htmlFor={`${field.id}-preview-${i}`}>{opt.label}</Label>
                                                 </div>
                                             ))}
                                         </RadioGroup>
                                     ) : field.type === 'multiple-select' ? (
                                         <div>
                                             {getOptionsForField(field).filter((opt: Opt) => opt.value).map((opt: Opt, i: number) => (
                                                 <div key={`${opt.value}-${i}`} className="flex items-center space-x-2">
                                                     <Checkbox id={`${field.id}-preview-${i}`} />
                                                     <Label htmlFor={`${field.id}-preview-${i}`}>{opt.label}</Label>
                                                 </div>
                                             ))}
                                         </div>
                                     ) : field.type === 'date' ? (
                                         <Input type="date" />
                                     ) :
                                    <Input type={field.type} placeholder={field.label} />}
                                </div>
                            )
                        })}
                         <Button className="w-full" disabled>Submit</Button>
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}

function BlankFormBuilder() {
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const formId = searchParams.get('formId');
    const formType = searchParams.get('type') as 'custom' | 'hybrid' | null;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingForm, setLoadingForm] = useState(!!formId);
    const [dynamicOptions, setDynamicOptions] = useState<Record<string, Opt[]>>({});
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [editingCondition, setEditingCondition] = useState<{ fieldIndex: number } | null>(null);
    const [editingUserFieldLink, setEditingUserFieldLink] = useState<{ fieldIndex: number } | null>(null);

    const [customFieldGroups, setCustomFieldGroups] = useState<{ id: string; name: string }[]>([]);
    const [allLadders, setAllLadders] = useState<any[]>([]);
    const [allCampuses, setAllCampuses] = useState<any[]>([]);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);

    const form = useForm<FormBuilderValues>({
        resolver: zodResolver(formBuilderSchema),
        defaultValues: {
            title: '',
            fields: [],
            type: formType || 'custom',
            autoSignup: false,
            emailConfirmationEnabled: false,
            emailTemplateId: '',
        },
    });

    useEffect(() => {
        const fetchOptions = async () => {
            const options: Record<string, Opt[]> = {};
            const collectionsToFetch = [
                { name: "campuses", collection: "Campus", field: "Campus Name", orderByField: "Campus Name" },
                { name: "languages", collection: "languages", field: "name", orderByField: "name", useWhere: true },
                { name: "ministries", collection: "ministries", field: "name", orderByField: "name" },
                { name: "ladders", collection: "courseLevels", field: "name", orderByField: "order" },
                { name: "charges", collection: "charges", field: "name", orderByField: "name" },
                { name: "roles", collection: "roles", field: "name", orderByField: "name" },
            ];
            
            for (const { name, collection: coll, field, orderByField, useWhere } of collectionsToFetch) {
                let q;
                if (useWhere) {
                    q = query(collection(db, coll), where("status", "==", "published"), orderBy(orderByField));
                } else {
                    q = query(collection(db, coll), orderBy(orderByField));
                }
                const snap = await getDocs(q);
                let data;
                if (name === 'ladders') {
                    data = snap.docs.map(d => ({ value: d.id, label: d.data()[field], id: d.id }));
                } else {
                    data = snap.docs.map(d => ({ value: d.data()[field], label: d.data()[field], id: d.id }));
                }
                options[name] = data;
                if(name === 'ladders') {
                    setAllLadders(data);
                }
                if (name === 'campuses') {
                    setAllCampuses(data);
                }
            }

            const customFieldsSnap = await getDocs(query(collection(db, "customFields"), orderBy("name")));
            const customFieldGroupsData = customFieldsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
            setCustomFieldGroups(customFieldGroupsData);

            for(const group of customFieldGroupsData) {
                const subFieldsSnap = await getDocs(query(collection(db, "customFields", group.id, "options"), orderBy("name")));
                options[group.id] = subFieldsSnap.docs.map(d => ({ value: d.data().name, label: d.data().name }));
            }

            options["genders"] = [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }];
            options["ageRanges"] = ["Less than 13", "13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"].map(o => ({ value: o, label: o }));
            options["locationPreferences"] = ["Onsite", "Online"].map(o => ({ value: o, label: o }));
            options["hpAvailabilityDays"] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(o => ({ value: o, label: o }));
            options["maritalStatuses"] = ["Single", "Married", "Divorced", "Widowed"].map(o => ({ value: o, label: o }));

            setDynamicOptions(options);
            setLoadingOptions(false);
        }
        fetchOptions();
    }, [db]);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const q = query(collection(db, "emailTemplates"), orderBy("name"));
                const snap = await getDocs(q);
                setEmailTemplates(snap.docs.map(d => ({ id: d.id, name: d.data().name } as EmailTemplate)));
            } catch (e) {
                console.error("Error fetching email templates:", e);
            }
        };
        fetchTemplates();
    }, [db]);

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
                        autoSignup: data.autoSignup || false,
                        emailConfirmationEnabled: data.emailConfirmationEnabled || false,
                        emailTemplateId: data.emailTemplateId || '',
                    });
                } else {
                    toast({ variant: 'destructive', title: 'Form not found' });
                    router.push('/admin/forms');
                }
            } else {
                 form.reset({
                    title: 'Untitled Form',
                    fields: [{ id: uuidv4(), label: 'First Field', type: 'text', dataSource: 'manual', required: false, visible: true, fieldId: `field_${uuidv4()}` }],
                    type: formType || 'custom',
                    autoSignup: false,
                    emailConfirmationEnabled: false,
                    emailTemplateId: '',
                });
            }
            setLoadingForm(false);
        };
        fetchForm();
    }, [formId, form, router, toast, formType]);

    const { fields, append, remove, update, move } = useFieldArray({
        control: form.control,
        name: "fields",
    });

    const onSubmit = async (data: FormBuilderValues) => {
        setIsSubmitting(true);
        try {
             const formDataWithFieldIds = {
                ...data,
                fields: data.fields.map((field, index) => {
                    const fieldId = field.fieldId || field.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `field_${index}`;
                    return {
                        ...field,
                        fieldId: fieldId
                    };
                })
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

    const handleDuplicateForm = async () => {
        const data = form.getValues();
        setIsSubmitting(true);
        try {
             const formDataWithFieldIds = {
                ...data,
                fields: data.fields.map((field, index) => {
                    const fieldId = field.fieldId || field.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `field_${index}`;
                    return {
                        ...field,
                        fieldId: fieldId
                    };
                })
            };

            const docRef = await addDoc(collection(db, 'forms'), {
                ...formDataWithFieldIds,
                title: `${data.title} (Copy)`,
                submissionCount: 0,
                public: false,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Form Copied", description: `A new copy of "${data.title}" has been created.` });
            router.push(`/admin/forms/builder/blank-form?formId=${docRef.id}&type=${data.type}`);
        } catch (error) {
            console.error("Error copying form:", error);
            toast({ variant: 'destructive', title: 'Copy Failed' });
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
             <div className="lg:col-span-2 space-y-8">
                <div>
                    <Button variant="ghost" onClick={() => router.push('/admin/forms')} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Forms
                    </Button>
                    <h1 className="font-headline text-3xl font-bold md:text-4xl">
                        {form.watch('title') || 'Untitled Form'}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs font-normal">
                            {formId ? 'Edit Custom Form' : 'Custom Form Builder'}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                            Configure fields and behavioral settings for your custom form.
                        </p>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        
                        <Card>
                            <CardHeader className="sticky top-0 z-20 bg-background border-b shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Form Fields</CardTitle>
                                        <CardDescription>Define the data you want to collect.</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={handleDuplicateForm} disabled={isSubmitting}>
                                            <Copy className="mr-2 h-4 w-4" /> Copy Form
                                        </Button>
                                        <Button type="button" onClick={() => {
                                            const newId = uuidv4();
                                            append({ id: newId, label: `New Field ${fields.length + 1}`, type: 'text', dataSource: 'manual', required: false, visible: true, fieldId: `field_${newId}` })
                                        }}>
                                            <Plus className="mr-2 h-4 w-4" /> Add Field
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12"></TableHead>
                                            <TableHead>Field Details</TableHead>
                                            <TableHead>Input Type</TableHead>
                                            <TableHead>Configuration</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => {
                                            const fieldType = form.watch(`fields.${index}.type`);
                                            const dataSource = form.watch(`fields.${index}.dataSource`);
                                            const showOptions = ["select", "multiple-choice", "multiple-select"].includes(fieldType);
                                            const conditionalLogic = form.watch(`fields.${index}.conditionalLogic`);
                                            const userProfileField = form.watch(`fields.${index}.userProfileField`);
                                            
                                            return (
                                                <TableRow key={field.id} className="group">
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(index, index - 1)} disabled={index === 0}>
                                                                <ArrowUp className="h-3 w-3" />
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(index, index + 1)} disabled={index === fields.length - 1}>
                                                                <ArrowDown className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="min-w-[200px]">
                                                        <div className="space-y-1">
                                                            <Input 
                                                                {...form.register(`fields.${index}.label`)} 
                                                                placeholder="Label"
                                                                className="h-8 font-medium"
                                                            />
                                                            <p className="text-[10px] font-mono text-muted-foreground ml-1">ID: {form.watch(`fields.${index}.fieldId`)}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select onValueChange={(value: any) => handleQuestionTypeChange(value, index)} value={fieldType}>
                                                            <SelectTrigger className="h-8 w-[140px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="text">Text</SelectItem>
                                                                <SelectItem value="email">Email</SelectItem>
                                                                <SelectItem value="password">Password</SelectItem>
                                                                <SelectItem value="phone">Phone</SelectItem>
                                                                <SelectItem value="textarea">Text Area</SelectItem>
                                                                <SelectItem value="date">Date</SelectItem>
                                                                <SelectItem value="address">Address</SelectItem>
                                                                <SelectItem value="select">Dropdown</SelectItem>
                                                                <SelectItem value="multiple-choice">Radio Buttons</SelectItem>
                                                                <SelectItem value="multiple-select">Checkboxes</SelectItem>
                                                                <SelectItem value="url">URL</SelectItem>
                                                                <SelectItem value="file">File</SelectItem>
                                                                <SelectItem value="image">Image</SelectItem>
                                                                <SelectItem value="audio">Audio</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {showOptions && (
                                                            <Button variant="link" size="sm" className="h-6 text-[10px] mt-1 p-0" onClick={() => {
                                                                const current = form.getValues(`fields.${index}`);
                                                                update(index, { ...current, _showDataSource: !(current as any)._showDataSource });
                                                            }}>
                                                                Configure Options
                                                            </Button>
                                                        )}
                                                        {(form.watch(`fields.${index}`) as any)._showDataSource && (
                                                            <div className="mt-2 space-y-2 bg-muted/50 p-2 rounded-md">
                                                                <Label className="text-[10px] uppercase">Data Source</Label>
                                                                <Select onValueChange={(v) => form.setValue(`fields.${index}.dataSource`, v)} value={dataSource}>
                                                                    <SelectTrigger className="h-7 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="manual">Manual Entry</SelectItem>
                                                                        {customFieldGroups.map(group => (
                                                                            <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                                                                        ))}
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
                                                                {dataSource === 'manual' && (
                                                                    <div className="space-y-1">
                                                                        {(form.watch(`fields.${index}.options`) || []).map((_, optIndex) => (
                                                                            <div key={optIndex} className="flex items-center gap-1">
                                                                                <Input {...form.register(`fields.${index}.options.${optIndex}`)} className="h-6 text-xs" />
                                                                                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeOption(index, optIndex)}>
                                                                                    <X className="h-3 w-3" />
                                                                                </Button>
                                                                            </div>
                                                                        ))}
                                                                        <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] w-full" onClick={() => addOption(index)}>
                                                                            <Plus className="mr-1 h-3 w-3" /> Add Option
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            type="button" 
                                                                            variant={form.watch(`fields.${index}.required`) ? "default" : "outline"} 
                                                                            size="icon" 
                                                                            className="h-7 w-7"
                                                                            onClick={() => form.setValue(`fields.${index}.required`, !form.watch(`fields.${index}.required`))}
                                                                        >
                                                                            <span className="text-[10px] font-bold">R</span>
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent><p>Required Field</p></TooltipContent>
                                                                </Tooltip>

                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            type="button" 
                                                                            variant={conditionalLogic ? "default" : "outline"} 
                                                                            size="icon" 
                                                                            className="h-7 w-7"
                                                                            onClick={() => setEditingCondition({ fieldIndex: index })}
                                                                        >
                                                                            <GitBranch className="h-3 w-3" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent><p>Conditional Visibility</p></TooltipContent>
                                                                </Tooltip>

                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            type="button" 
                                                                            variant={userProfileField ? "default" : "outline"} 
                                                                            size="icon" 
                                                                            className="h-7 w-7"
                                                                            onClick={() => setEditingUserFieldLink({ fieldIndex: index })}
                                                                        >
                                                                            <UserIcon className="h-3 w-3" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent><p>Link to User Profile</p></TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                        {conditionalLogic && <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[150px]">Show if logic set</p>}
                                                        {userProfileField && <p className="text-[10px] text-primary mt-1 truncate max-w-[150px]">Linked to Profile</p>}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Form Settings</CardTitle>
                                <CardDescription>Configure access controls and automation.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium w-1/3">Form Title</TableCell>
                                            <TableCell>
                                                <Input {...form.register('title')} placeholder="e.g., Annual Conference Registration" />
                                                {form.formState.errors.title && <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Authentication</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={form.watch('autoSignup')}
                                                        onCheckedChange={(checked) => form.setValue('autoSignup', checked)}
                                                    />
                                                    <Label className="text-xs">Require Login to access this form</Label>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Automation</TableCell>
                                            <TableCell className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={form.watch('emailConfirmationEnabled')}
                                                        onCheckedChange={(checked) => form.setValue('emailConfirmationEnabled', checked)}
                                                    />
                                                    <Label className="text-xs">Send automated confirmation email</Label>
                                                </div>
                                                {form.watch('emailConfirmationEnabled') && (
                                                    <div className="pl-8 pt-2">
                                                        <Select 
                                                            onValueChange={(v) => form.setValue('emailTemplateId', v)} 
                                                            value={form.watch('emailTemplateId')}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select email template..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {emailTemplates.map(t => (
                                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                            <CardFooter className="bg-muted/20 border-t p-4 flex justify-end">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {formId ? 'Update Form' : 'Create Form'}
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </Form>
            </div>

            <div className="hidden lg:block lg:col-span-1 sticky top-24">
                <MobilePreview form={form} dynamicOptions={dynamicOptions} />
            </div>

            {editingCondition && (
                <Dialog open={!!editingCondition} onOpenChange={() => setEditingCondition(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Conditional Visibility</DialogTitle>
                            <DialogDescription>Only show this field if another field matches your criteria.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>When field...</Label>
                                 <Controller
                                    name={`fields.${editingCondition.fieldIndex}.conditionalLogic.fieldId`}
                                    control={form.control}
                                    defaultValue=""
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a field..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fields.filter((_, i) => i < editingCondition.fieldIndex).map(f => (
                                                    <SelectItem key={f.fieldId} value={f.fieldId}>{f.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                             <div className="space-y-2">
                                <Label>Operator</Label>
                                <Controller
                                    name={`fields.${editingCondition.fieldIndex}.conditionalLogic.operator`}
                                    control={form.control}
                                    defaultValue="is"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="is">Is equal to</SelectItem>
                                                <SelectItem value="isNot">Is not equal to</SelectItem>
                                                <SelectItem value="isNotEmpty">Is not empty</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                            {form.watch(`fields.${editingCondition.fieldIndex}.conditionalLogic.operator`) !== 'isNotEmpty' && (
                                <div className="space-y-2">
                                    <Label>Value</Label>
                                    <Input
                                        {...form.register(`fields.${editingCondition.fieldIndex}.conditionalLogic.value`)}
                                        placeholder="Value to match"
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="ghost" onClick={() => {
                                form.setValue(`fields.${editingCondition!.fieldIndex}.conditionalLogic`, undefined);
                                setEditingCondition(null);
                            }}>Clear Logic</Button>
                            <Button onClick={() => setEditingCondition(null)}>Apply</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {editingUserFieldLink && (
                <Dialog open={!!editingUserFieldLink} onOpenChange={() => setEditingUserFieldLink(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>User Profile Linking</DialogTitle>
                            <DialogDescription>Map this form field to a standard profile field. Data will be saved to the student's profile upon submission.</DialogDescription>
                        </DialogHeader>
                         <div className="space-y-4 py-4">
                             <Controller
                                name={`fields.${editingUserFieldLink.fieldIndex}.userProfileField`}
                                control={form.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select profile field..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {USER_PROFILE_FIELD_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="ghost" onClick={() => {
                                form.setValue(`fields.${editingUserFieldLink!.fieldIndex}.userProfileField`, undefined);
                                setEditingUserFieldLink(null);
                            }}>Remove Link</Button>
                            <Button onClick={() => setEditingUserFieldLink(null)}>Apply Link</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

export default function BlankFormBuilderPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8" /></div>}>
            <BlankFormBuilder />
        </Suspense>
    );
}
