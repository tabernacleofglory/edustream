
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFirebaseFirestore } from "@/lib/firebase";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  addDoc
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { v4 as uuidv4 } from "uuid";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileWarning, Loader2, PartyPopper, LogIn, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomForm, FormFieldConfig, User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

const DynamicForm = ({ formConfig }: { formConfig: CustomForm }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [db] = useState(() => getFirebaseFirestore());

  const [selectOptions, setSelectOptions] = useState<{ [key: string]: any[] }>({});
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Secondary app/auth for account creation without affecting primary auth state.
  const secondaryAuth = useMemo(() => {
    const secondaryAppName = "secondaryFormAppHybrid";
    let secondaryApp = getApps().find((app) => app.name === secondaryAppName);
    if (!secondaryApp) {
      const mainAppConfig = getApp().options;
      secondaryApp = initializeApp(mainAppConfig, secondaryAppName);
    }
    return getAuth(secondaryApp);
  }, []);

  const validationSchema = useMemo(() => {
    const shape = formConfig.fields.reduce((acc, field) => {
      if (field.visible) {
        let schema: z.ZodType<any>;
        const isEmailRequired = formConfig.fields.find(f => f.fieldId === 'email')?.required;

        if (field.fieldId === "email") {
          schema = z.string().email("Please enter a valid email address.").optional().or(z.literal(""));
          if(isEmailRequired) {
            schema = z.string().min(1, 'Email is required.').email("Please enter a valid email address.");
          }
        } else if (field.fieldId === "password") {
          if (field.required) {
            schema = z.string().min(6, "Password must be at least 6 characters.");
          } else {
            schema = z.string().optional();
          }
        } else if (field.type === 'multiple-select' && field.required) {
            schema = z.array(z.string()).min(1, `${field.label} is required.`);
        } else if (!field.required) {
          schema = z.any().optional();
        } else {
          schema = z.string().min(1, `${field.label} is required.`);
        }

        acc[field.fieldId] = schema;
      }
      return acc;
    }, {} as Record<string, z.ZodType<any>>);

    return z.object(shape);
  }, [formConfig.fields]);

  const form = useForm({
    resolver: zodResolver(validationSchema),
  });

  useEffect(() => {
    const fetchOptions = async () => {
      const options: { [key: string]: any[] } = {};
      const selectFields = formConfig.fields.filter(f => f.visible && f.dataSource && f.dataSource !== 'manual');
      
      for (const field of selectFields) {
          if (field.dataSource === 'campuses') {
               const campusSnap = await getDocs(query(collection(db, "Campus"), orderBy("Campus Name")));
               options[field.fieldId] = campusSnap.docs.map((d) => ({ value: d.data()["Campus Name"], label: d.data()["Campus Name"] }));
          }
      }
      setSelectOptions(options);
      setLoadingOptions(false);
    };
    fetchOptions();
  }, [db, formConfig.fields]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
        const password = data.password || `${uuidv4()}A!`;
        const providedRealEmail = data.email && !data.email.endsWith('@tg.admin');

        let finalEmail = data.email;
        if (!finalEmail) {
            const campusName = data.campus ? data.campus.toLowerCase().replace(/\s+/g, '') : 'user';
            finalEmail = `${campusName}${Date.now()}@tg.admin`;
        }

        // Create user
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, password);
        const user = userCredential.user;

        const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
        await updateProfile(user, { displayName: fullName });

        // Save user document
        const defaultLadderSnap = await getDocs(query(collection(db, "courseLevels"), orderBy("order"), limit(1)));
        const defaultLadder = !defaultLadderSnap.empty ? { id: defaultLadderSnap.docs[0].id, name: defaultLadderSnap.docs[0].data().name } : null;

        const newUser: Partial<User> = {
            uid: user.uid,
            id: user.uid,
            email: finalEmail,
            displayName: fullName,
            role: "user",
            createdAt: serverTimestamp(),
            classLadderId: defaultLadder?.id || null,
            classLadder: defaultLadder?.name || null,
            createdFromFormId: formConfig.id,
        };
        formConfig.fields.forEach((field) => {
            if (field.visible && data[field.fieldId] !== undefined) {
                (newUser as any)[field.fieldId] = data[field.fieldId];
            }
        });
        await setDoc(doc(db, "users", user.uid), newUser);

        // Save form submission
        const submissionRef = collection(db, "forms", formConfig.id, "submissions");
        await addDoc(submissionRef, {
            data,
            submittedAt: serverTimestamp(),
            createdBy: user.uid,
        });

        // Increment submission count
        await updateDoc(doc(db, "forms", formConfig.id), { submissionCount: increment(1) });
        
        if (providedRealEmail) {
            await sendPasswordResetEmail(secondaryAuth, data.email);
        }
        await signOut(secondaryAuth);
        
        setSubmissionSuccess(true);
        toast({
            title: "Registration Successful!",
            description: "Your account has been created and your submission received. A password setup email has been sent if you provided a valid email.",
        });

    } catch (error: any) {
      console.error("Hybrid form submission error:", error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.code === "auth/email-already-in-use" ? "This email is already in use." : error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormFieldConfig) => {
    const { fieldId, label, required, type = 'text', options: manualOptions, dataSource } = field;
    const formError = form.formState.errors[fieldId];

    switch(type) {
        case 'select': {
            const currentOptions = dataSource === 'campuses' ? selectOptions[fieldId] : manualOptions?.map(o => ({ value: o, label: o }));
            return (
                 <div key={field.id} className="space-y-2">
                    <Label htmlFor={fieldId}>{label} {required && <span className="text-destructive">*</span>}</Label>
                    <Controller name={fieldId as any} control={form.control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={loadingOptions}>
                            <SelectTrigger id={fieldId}><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
                            <SelectContent>
                                {(currentOptions || []).map((opt: any, index: number) => (
                                    <SelectItem key={`${opt.value}-${index}`} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )} />
                    {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
                </div>
            );
        }
        case 'textarea':
            return (
                <div key={field.id} className="space-y-2 md:col-span-2">
                    <Label htmlFor={fieldId}>{label} {required && <span className="text-destructive">*</span>}</Label>
                    <Textarea id={fieldId} {...form.register(fieldId as any)} />
                    {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
                </div>
            );
        case 'multiple-choice': {
            const currentOptions = dataSource === 'campuses' ? selectOptions[fieldId] : manualOptions?.map(o => ({ value: o, label: o }));
            return (
                <div key={field.id} className="space-y-2 md:col-span-2">
                    <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
                    <Controller name={fieldId as any} control={form.control} render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-1">
                             {(currentOptions || []).map((opt: any, index: number) => (
                                <div key={`${opt.value}-${index}`} className="flex items-center space-x-2">
                                    <RadioGroupItem value={opt.value} id={`${fieldId}-${index}`} />
                                    <Label htmlFor={`${fieldId}-${index}`}>{opt.label}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    )} />
                    {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
                </div>
            )
        }
        case 'multiple-select': {
            const currentOptions = dataSource === 'campuses' ? selectOptions[fieldId] : manualOptions?.map(o => ({ value: o, label: o }));
            return (
                 <div key={field.id} className="space-y-2 md:col-span-2">
                    <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
                    <Controller name={fieldId as any} control={form.control} render={({ field }) => (
                        <div className="space-y-1">
                             {(currentOptions || []).map((opt: any, index: number) => (
                                <div key={`${opt.value}-${index}`} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`${fieldId}-${index}`}
                                        checked={field.value?.includes(opt.value)}
                                        onCheckedChange={(checked) => {
                                            const current = field.value || [];
                                            return checked ? field.onChange([...current, opt.value]) : field.onChange(current.filter((v: string) => v !== opt.value))
                                        }}
                                    />
                                    <Label htmlFor={`${fieldId}-${index}`}>{opt.label}</Label>
                                </div>
                             ))}
                        </div>
                    )} />
                    {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
                </div>
            )
        }
         case 'phone':
            return (
                <div key={field.id} className="space-y-2">
                    <Label htmlFor={fieldId}>{label} {required && <span className="text-destructive">*</span>}</Label>
                    <Controller name={fieldId as any} control={form.control} render={({ field }) => (
                        <PhoneInput id={fieldId} international defaultCountry="US" {...field} value={field.value || undefined} className="PhoneInputInput" />
                    )} />
                    {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
                </div>
            );
        default:
            return (
                <div key={field.id} className="space-y-2">
                    <Label htmlFor={fieldId}>{label} {required && <span className="text-destructive">*</span>}</Label>
                    <Input
                    id={fieldId}
                    type={type === "email" ? "email" : type === "password" ? "password" : "text"}
                    {...form.register(fieldId as any)}
                    />
                    {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
                </div>
            );
    }
  };

  if (submissionSuccess) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <PartyPopper className="mx-auto h-12 w-12 text-green-500" />
          <CardTitle className="text-2xl">Submission Received!</CardTitle>
          <CardDescription>
            Thank you for your submission. Your account has also been created.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-4">
          <Button className="w-full" onClick={() => window.location.reload()}>
            <UserPlus className="mr-2 h-4 w-4" />
            Submit Another Response
          </Button>
          <Button variant="link" asChild>
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" />
              Proceed to Login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle>{formConfig.title}</CardTitle>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loadingOptions ? (
            <Skeleton className="h-48 w-full md:col-span-2" />
          ) : (
            formConfig.fields.filter((f) => f.visible).map(renderField)
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting || loadingOptions}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default function PublicHybridFormPage() {
  const params = useParams();
  const formId = params.formId as string;
  const [formConfig, setFormConfig] = useState<CustomForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getFirebaseFirestore();

  useEffect(() => {
    if (!formId) {
      setError("Form ID is missing.");
      setLoading(false);
      return;
    }

    const fetchFormConfig = async () => {
      try {
        const formDocRef = doc(db, "forms", formId);
        const docSnap = await getDoc(formDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Omit<CustomForm, "id"> & { public?: boolean; type?: string };
          if (data.type !== "hybrid") {
            setError("This form is not available at this URL.");
            setLoading(false);
            return;
          }
          if (data.public !== true) {
            setError("This form is not public or is no longer accepting submissions.");
            setLoading(false);
            return;
          }
          setFormConfig({ id: docSnap.id, ...(data as any) });
        } else {
          setError("This form does not exist.");
        }
      } catch (e: any) {
        setError("You don't have permission to view this form.");
      } finally {
        setLoading(false);
      }
    };
    fetchFormConfig();
  }, [formId, db]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4">
        <Alert variant="destructive" className="w-full max-w-lg">
          <FileWarning className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!formConfig) {
    return (
      <div className="flex items-center justify-center p-4">
        <Alert className="w-full max-w-lg">
          <FileWarning className="h-4 w-4" />
          <AlertTitle>No Form Found</AlertTitle>
          <AlertDescription>
            The requested form could not be loaded.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <DynamicForm formConfig={formConfig} />
    </div>
  );
}
