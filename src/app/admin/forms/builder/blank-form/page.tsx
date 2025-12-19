

"use client";

import { useState, useEffect, Suspense } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, X, Combine, Link as LinkIconLucide, File, FileText, ImageIcon, Music, MapPin, Calendar, List, GitBranch, User as UserIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Form, FormField, FormControl, FormLabel, FormMessage } from "@/components/ui/form";
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
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


type Opt = { value: string, label: string };

const conditionalLogicSchema = z.object({
  fieldId: z.string().min(1, "You must select a field to base the condition on."),
  operator: z.enum(['is', 'isNot', 'contains', 'doesNotContain', 'isNotEmpty']),
  value: z.string().optional(), // Optional for 'isNotEmpty'
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
});

type FormBuilderValues = z.infer<typeof formBuilderSchema>;

const USER_PROFILE_FIELD_OPTIONS = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phoneNumber', label: 'Phone Number' },
  { value: 'gender', label: 'Gender' },
  { value: 'ageRange', label: 'Age Range' },
  { value: 'maritalStatus', label: 'Marital Status' },
  { value: 'isBaptized', label: 'Is Baptized?' },
  { value: 'denomination', label: 'Denomination' },
  { value: 'campus', label: 'Campus' },
  { value: 'language', label: 'Language' },
  { value: 'locationPreference', label: 'Location Preference' },
  { value: 'isInHpGroup', label: 'Is in HP Group?' },
  { value: 'hpNumber', label: 'HP Number' },
  { value: 'facilitatorName', label: "Facilitator's Name" },
  { value: 'hpAvailabilityDay', label: 'HP Availability Day' },
  { value: 'hpAvailabilityTime', label: 'HP Availability Time' },
  { value: 'ministry', label: 'Ministry' },
  { value: 'charge', label: 'Charge' },
  { value: 'bio', label: 'Bio' },
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
        <div className="sticky top-8">
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

    const form = useForm<FormBuilderValues>({
        resolver: zodResolver(formBuilderSchema),
        defaultValues: {
            title: '',
            fields: [],
            type: formType || 'custom',
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
                options[name] = snap.docs.map(d => ({ value: d.data()[field], label: d.data()[field] }));
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
                    fields: [{ id: uuidv4(), label: 'First Field', type: 'text', dataSource: 'manual', required: false, visible: true, fieldId: 'first_field' }],
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
                    <h1 className="font-headline text-3xl font-bold md:text-4xl flex items-center gap-2">
                    {formId ? 'Edit Form' : 'Custom Form Builder'}
                    </h1>
                    <p className="text-muted-foreground">
                        Create a new custom form to collect data.
                    </p>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="form-title">Form Title</Label>
                            <Input id="form-title" {...form.register('title')} placeholder="e.g., Contact Us" />
                            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
                        </div>

                        <ScrollArea className="h-[calc(100vh-25rem)] pr-4 -mr-4 border p-4 rounded-md">
                            <div className="space-y-4">
                                {fields.map((field, index) => {
                                    const fieldType = form.watch(`fields.${index}.type`);
                                    const dataSource = form.watch(`fields.${index}.dataSource`);
                                    const showOptions = ["select", "multiple-choice", "multiple-select"].includes(fieldType);
                                    const conditionalLogic = form.watch(`fields.${index}.conditionalLogic`);
                                    const userProfileField = form.watch(`fields.${index}.userProfileField`);
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
                                                        <SelectItem value="date"><div className="flex items-center gap-2"><Calendar className="h-4 w-4" />Date</div></SelectItem>
                                                        <SelectItem value="address"><div className="flex items-center gap-2"><MapPin className="h-4 w-4" />Address</div></SelectItem>
                                                        <SelectItem value="select">Dropdown</SelectItem>
                                                        <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                                                        <SelectItem value="multiple-select">Checkboxes</SelectItem>
                                                        <SelectItem value="url"><div className="flex items-center gap-2"><LinkIconLucide className="h-4 w-4" /> URL</div></SelectItem>
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
                                        <div className="flex items-center space-x-4 mt-4">
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id={`required-${index}`}
                                                    checked={form.watch(`fields.${index}.required`)}
                                                    onCheckedChange={(checked) => form.setValue(`fields.${index}.required`, checked, { shouldDirty: true })}
                                                />
                                                <Label htmlFor={`required-${index}`}>Required</Label>
                                            </div>
                                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingCondition({ fieldIndex: index })}>
                                                <GitBranch className="mr-2 h-4 w-4" />
                                                Show If...
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingUserFieldLink({ fieldIndex: index })}>
                                                <UserIcon className="mr-2 h-4 w-4" />
                                                Link Field
                                            </Button>
                                        </div>
                                         {conditionalLogic && (
                                            <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md mt-2">
                                                Show if <span className="font-semibold">{fields.find(f => f.fieldId === conditionalLogic.fieldId)?.label || conditionalLogic.fieldId}</span> is "{conditionalLogic.value}"
                                            </div>
                                        )}
                                         {userProfileField && (
                                            <div className="text-xs text-muted-foreground p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md mt-2">
                                                Linked to User Profile field: <span className="font-semibold">{USER_PROFILE_FIELD_OPTIONS.find(f => f.value === userProfileField)?.label || userProfileField}</span>
                                            </div>
                                        )}
                                    </Card>
                                )})}
                            </div>
                        </ScrollArea>
                        <div className="flex justify-between">
                            <Button type="button" variant="secondary" onClick={() => append({ id: uuidv4(), label: `New Field ${fields.length + 1}`, type: 'text', dataSource: 'manual', required: false, visible: true, fieldId: `new_field_${fields.length + 1}` })}>
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
            <div className="hidden lg:block lg:col-span-1">
                <MobilePreview form={form} dynamicOptions={dynamicOptions} />
            </div>

            {editingCondition && (
                <Dialog open={!!editingCondition} onOpenChange={() => setEditingCondition(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Set Conditional Logic</DialogTitle>
                            <DialogDescription>Show or hide this field based on another field's value.</DialogDescription>
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
                                        placeholder="Enter the value to check against"
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="destructive" onClick={() => form.setValue(`fields.${editingCondition!.fieldIndex}.conditionalLogic`, undefined)}>Remove Logic</Button>
                            <Button onClick={() => setEditingCondition(null)}>Done</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {editingUserFieldLink && (
                <Dialog open={!!editingUserFieldLink} onOpenChange={() => setEditingUserFieldLink(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Link to User Profile Field</DialogTitle>
                            <DialogDescription>Select a user profile field to update with the data from this form field upon submission.</DialogDescription>
                        </DialogHeader>
                         <div className="space-y-4 py-4">
                             <Controller
                                name={`fields.${editingUserFieldLink.fieldIndex}.userProfileField`}
                                control={form.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a user profile field..." />
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
                        <DialogFooter>
                            <Button variant="destructive" onClick={() => form.setValue(`fields.${editingUserFieldLink!.fieldIndex}.userProfileField`, undefined)}>Remove Link</Button>
                            <Button onClick={() => setEditingUserFieldLink(null)}>Done</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
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
