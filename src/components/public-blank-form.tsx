"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFirebaseFirestore, getFirebaseAuth } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from 'use-debounce';
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithEmailAndPassword,
} from "firebase/auth";

import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PartyPopper, User as UserIcon, LogIn } from "lucide-react";
import type { CustomForm, FormFieldConfig, Ladder } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

type Opt = { value: string; label: string };

const toStr = (x: unknown, fb = "") => (x == null ? fb : typeof x === "string" ? x : String(x));

const normalizeOptions = (src?: unknown): Opt[] =>
  Array.isArray(src)
    ? src
        .map((s) => toStr(s).trim())
        .filter(Boolean)
        .map((s) => ({ value: s, label: s }))
    : [];

interface PublicBlankFormProps {
    formConfig: CustomForm;
    courseId?: string; // Optional, for in-course forms
    existingSubmission?: any;
    onFormComplete?: () => void;
}

const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase();
};


const UserInfoCard = () => {
    const { user, loading, checkAndCreateUserDoc } = useAuth();
    const [ladders, setLadders] = useState<Ladder[]>([]);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const db = getFirebaseFirestore();

    useEffect(() => {
        const fetchLadders = async () => {
            const q = query(collection(db, "courseLevels"), orderBy("order"));
            const snapshot = await getDocs(q);
            setLadders(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Ladder)));
        };
        fetchLadders();
    }, [db]);

    const handleGoogleLogin = async () => {
        const auth = getFirebaseAuth();
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            await checkAndCreateUserDoc(result.user);
            setIsLoginOpen(false);
        } catch (error) {
            console.error("Google login failed:", error);
        }
    };
    
    if (loading) {
        return <Skeleton className="h-24 w-full" />
    }

    if (!user) {
        return (
            <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-2">Already have an account?</p>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <LogIn className="mr-2 h-4 w-4"/>
                                Sign In to Pre-fill
                            </Button>
                        </DialogTrigger>
                    </CardContent>
                </Card>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sign In</DialogTitle>
                        <DialogDescription>Sign in to your account to pre-fill your information.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Button onClick={handleGoogleLogin} className="w-full">
                            Sign in with Google
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }
    
    const userLadder = ladders.find(l => l.id === user.classLadderId);

    return (
        <Card>
            <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-16 w-16">
                    <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
                    <AvatarFallback className="text-xl">{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                    <p className="font-semibold text-lg">{user.displayName}</p>
                    <p className="text-sm text-muted-foreground">{userLadder?.name || user.role}</p>
                    <p className="text-xs text-muted-foreground font-mono">{user.uid}</p>
                </div>
            </CardContent>
        </Card>
    )
}

export default function PublicBlankForm({ formConfig, courseId, existingSubmission, onFormComplete }: PublicBlankFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [selectOptions, setSelectOptions] = useState<Record<string, Opt[]>>({});
  const db = getFirebaseFirestore();
  const { user } = useAuth();

  const validationSchema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const f of formConfig.fields) {
      const c = f as any;
      if (!c.visible) continue;
      const label = c.label || c.fieldId;
      const type = c.type as string | undefined;

      // Check conditional logic to determine if the field is active
      const isActive = (formValues: any) => {
        if (!formValues) return true; // Assume active during initial validation setup
        if (!c.conditionalLogic || !c.conditionalLogic.fieldId) {
          return true; // No condition, so it's active
        }
        const { fieldId, operator, value } = c.conditionalLogic;
        const targetValue = formValues[fieldId];
        switch(operator) {
            case 'is': return targetValue === value;
            case 'isNot': return targetValue !== value;
            case 'isNotEmpty': return !!targetValue;
            case 'contains': return String(targetValue || '').includes(String(value));
            case 'doesNotContain': return !String(targetValue || '').includes(String(value));
            default: return true;
        }
      };

      let schema: z.ZodTypeAny;

      if (type === "email") {
        schema = z.string().email("Invalid email address.").optional().or(z.literal(""));
        if (c.required) {
          schema = z.string().min(1, `${label} is required.`).email("Invalid email address.");
        }
      } else if (type === "multiple-select") {
         schema = z.array(z.string());
         if (c.required) {
             schema = schema.min(1, `${label} is required.`);
         } else {
             schema = schema.optional();
         }
      } else {
        schema = z.any().optional();
        if (c.required) {
           schema = z.string().min(1, `${label} is required.`);
        }
      }

      // Wrap with a transform to make it optional if not active
      shape[c.fieldId] = z.lazy(() => 
        z.any().transform((_, ctx) => {
            if (isActive(ctx.parent as any)) {
                return schema.parse(_);
            }
            return _;
        })
      );
    }
    return z.object(shape);
  }, [formConfig.fields]);


  const defaultValues = useMemo(() => {
    const dv: Record<string, any> = {};
    for (const f of formConfig.fields) {
      if (!(f as any).visible) continue;
      const type = (f as any).type as string | undefined;
      dv[(f as any).fieldId] = type === "multiple-select" ? [] : "";
    }
    return dv;
  }, [formConfig.fields]);

  const form = useForm({ resolver: zodResolver(validationSchema), defaultValues });

  const watchedData = form.watch();
  const [debouncedData] = useDebounce(watchedData, 1000);

  useEffect(() => {
    if (user) {
        // Pre-fill form with user data for linked fields
        formConfig.fields.forEach(field => {
            const castField = field as any;
            if (castField.userProfileField && (user as any)[castField.userProfileField]) {
                form.setValue(castField.fieldId, (user as any)[castField.userProfileField]);
            }
        });
    } else if (!existingSubmission) {
        const savedDraft = localStorage.getItem(`form-draft-${formConfig.id}`);
        if (savedDraft) {
            try {
                form.reset(JSON.parse(savedDraft));
            } catch (e) {
                console.error("Failed to parse form draft", e);
            }
        }
    }

    if (existingSubmission) {
        form.reset(existingSubmission.data);
    }
  }, [formConfig.id, form, user, formConfig.fields, existingSubmission]);

  useEffect(() => {
    // Don't save draft if user is logged in or editing
    if (!user && !existingSubmission) {
        localStorage.setItem(`form-draft-${formConfig.id}`, JSON.stringify(debouncedData));
    }
  }, [debouncedData, formConfig.id, user, existingSubmission]);

  useEffect(() => {
    const load = async () => {
      const options: Record<string, Opt[]> = {};
      const dynamicFields = formConfig.fields.filter((f: any) => f.visible && f.dataSource && f.dataSource !== "manual");
      const customFieldGroupsSnap = await getDocs(query(collection(db, "customFields"), orderBy("name")));
      const customFieldGroups = customFieldGroupsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

      for (const f of dynamicFields as any[]) {
        const ds = String(f.dataSource || "");
        let collectionName = "";
        let fieldName = "name";
        let orderByField = "name";
        let useWhere = false;

        const customField = customFieldGroups.find(g => g.id === ds);

        if (customField) {
            const subFieldsSnap = await getDocs(query(collection(db, "customFields", customField.id, "options"), orderBy("name")));
            options[f.fieldId] = subFieldsSnap.docs.map(d => ({ value: d.data().name, label: d.data().name }));
            continue;
        }

        switch (ds) {
          case "campuses": collectionName = "Campus"; fieldName = "Campus Name"; orderByField="Campus Name"; break;
          case "ladders": collectionName = "courseLevels"; orderByField = "order"; break;
          case "ministries": collectionName = "ministries"; break;
          case "charges": collectionName = "charges"; break;
          case "roles": collectionName = "roles"; break;
          case "languages": collectionName = "languages"; useWhere = true; break;
        }
        
        if (collectionName) {
            let q;
            if (useWhere) {
                 q = query(collection(db, collectionName), where("status", "==", "published"), orderBy(orderByField));
            } else {
                 q = query(collection(db, collectionName), orderBy(orderByField));
            }
            const snap = await getDocs(q);
            options[f.fieldId] = snap.docs.map((d) => ({ value: d.data()[fieldName], label: d.data()[fieldName] }));
        } else if (ds === 'genders') {
            options[f.fieldId] = [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }];
        } else if (ds === 'ageRanges') {
            options[f.fieldId] = ["Less than 13", "13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"].map(o => ({ value: o, label: o }));
        } else if (ds === 'locationPreferences') {
            options[f.fieldId] = ["Onsite", "Online"].map(o => ({ value: o, label: o }));
        } else if (ds === 'hpAvailabilityDays') {
            options[f.fieldId] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(o => ({ value: o, label: o }));
        } else if (ds === 'maritalStatuses') {
            options[f.fieldId] = ["Single", "Married", "Divorced", "Widowed"].map(o => ({ value: o, label: o }));
        }
      }

      setSelectOptions(options);
      setLoadingOptions(false);
    };
    load();
  }, [formConfig.fields, db]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const payload: any = {
        data,
        submittedAt: serverTimestamp(),
        formId: formConfig.id,
      };
      if (user?.uid) {
        payload.userId = user.uid;
      }
      if (courseId) {
          payload.courseId = courseId;
      }

      const submissionRef = collection(db, "forms", formConfig.id, "submissions");
      await addDoc(submissionRef, payload);

      // If a logged-in user submits, update their profile
      if (user?.uid) {
        const userProfileUpdates: Record<string, any> = {};
        formConfig.fields.forEach(field => {
            const castField = field as any;
            if (castField.userProfileField && data[castField.fieldId] !== undefined) {
                userProfileUpdates[castField.userProfileField] = data[castField.fieldId];
            }
        });
        if (Object.keys(userProfileUpdates).length > 0) {
            await updateDoc(doc(db, 'users', user.uid), userProfileUpdates);
        }
      }

      setSubmissionSuccess(true);
      if (!user) {
        localStorage.removeItem(`form-draft-${formConfig.id}`);
      }
      
      try {
        await runTransaction(db, async (tx) => {
          const formRef = doc(db, "forms", formConfig.id);
          const snap = await tx.get(formRef);
          const curr = (snap.exists() && typeof snap.data()?.submissionCount === "number"
            ? snap.data()!.submissionCount
            : 0) as number;
          tx.update(formRef, { submissionCount: curr + 1 });
        });
      } catch (bumpErr) {
        console.warn("Submission saved, but failed to bump submissionCount", bumpErr);
      }
      
      onFormComplete?.();

    } catch (e) {
      console.error(e);
       toast({ variant: 'destructive', title: 'Submission Failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (cfg: FormFieldConfig) => {
    const c = cfg as any;

    // Conditional Logic Check
    if (c.conditionalLogic && c.conditionalLogic.fieldId) {
      const { fieldId, operator, value } = c.conditionalLogic;
      const targetValue = watchedData[fieldId];
      let shouldShow = true;
      switch (operator) {
        case "is":
          shouldShow = targetValue === value;
          break;
        case "isNot":
          shouldShow = targetValue !== value;
          break;
        case "isNotEmpty":
          shouldShow = !!targetValue;
          break;
        case "contains":
          shouldShow = String(targetValue || "").includes(String(value));
          break;
        case "doesNotContain":
          shouldShow = !String(targetValue || "").includes(String(value));
          break;
      }
      if (!shouldShow) return null;
    }

    const fieldId: string = c.fieldId;
    const required: boolean = !!c.required;
    const type: string = String(c.type || "text");
    const label: string = c.label || "";
    const dataSource: string | undefined = c.dataSource ? String(c.dataSource) : undefined;
    const err = (form.formState.errors as any)[fieldId];

    const getOptions = () => {
      if (dataSource && dataSource !== "manual" && selectOptions[fieldId]) {
        return selectOptions[fieldId];
      }
      return normalizeOptions(c.options);
    };

    const opts = getOptions();
    
    const fieldComponent = () => {
        switch (type) {
        case "select":
            return (
                <Controller
                name={fieldId as any}
                control={form.control}
                render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingOptions}>
                    <SelectTrigger id={fieldId}>
                        <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {opts.map((opt: any, index: number) => (
                        <SelectItem key={`${opt.value}-${index}`} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                )}
                />
            );

        case "multiple-choice":
            return (
                <Controller
                name={fieldId as any}
                control={form.control}
                render={({ field }) => (
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-1">
                    {opts.map((o, i) => {
                        const id = `${fieldId}-${i}`;
                        return (
                        <div key={`${o.value}-${i}`} className="flex items-center gap-2">
                            <RadioGroupItem value={o.value} id={id} />
                            <Label htmlFor={id}>{o.label}</Label>
                        </div>
                        );
                    })}
                    </RadioGroup>
                )}
                />
            );

        case "multiple-select":
            return (
                <Controller
                name={fieldId as any}
                control={form.control}
                render={({ field }) => {
                    const selected: string[] = Array.isArray(field.value) ? field.value : [];
                    return (
                    <div className="space-y-1">
                        {opts.map((o, i) => {
                        const id = `${fieldId}-${i}`;
                        const checked = selected.includes(o.value);
                        return (
                            <div key={`${o.value}-${i}`} className="flex items-center gap-2">
                            <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={(c) => {
                                const yes = c === true;
                                const curr = Array.isArray(field.value) ? field.value : [];
                                field.onChange(yes ? [...curr, o.value] : curr.filter((v: string) => v !== o.value));
                                }}
                            />
                            <Label htmlFor={id}>{o.label}</Label>
                            </div>
                        );
                        })}
                    </div>
                    );
                }}
                />
            );

        case "textarea":
        case "address":
            return <Textarea id={fieldId} {...form.register(fieldId as any)} />;

        case "phone":
            return (
                <Controller
                name={fieldId as any}
                control={form.control}
                render={({ field }) => (
                    <PhoneInput
                    id={fieldId}
                    international
                    defaultCountry="US"
                    {...field}
                    value={field.value ?? undefined}
                    className="PhoneInputInput"
                    />
                )}
                />
            );
        
        case "date":
            return <Input id={fieldId} type="date" {...form.register(fieldId as any)} />;

        case "password":
            return <Input id={fieldId} type="password" {...form.register(fieldId as any)} />;

        default: {
            const inputType =
            type === "email" ? "email" :
            type === "url" ? "url" :
            type === "password" ? "password" :
            type === "file" || type === "image" || type === "audio" ? "file" :
            "text";

            const acceptProps =
            type === "image" ? { accept: "image/*" } :
            type === "audio" ? { accept: "audio/*" } :
            {};

            return <Input id={fieldId} type={inputType} {...form.register(fieldId as any)} {...acceptProps} />;
        }
        }
    }
    
    const isFullWidth = ['textarea', 'address', 'multiple-select', 'multiple-choice'].includes(type);

    return (
        <div className={`space-y-2 ${isFullWidth ? 'md:col-span-2' : ''}`} key={fieldId}>
             <Label htmlFor={fieldId}>
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
            {fieldComponent()}
            {err && <p className="text-sm text-destructive">{String(err.message)}</p>}
        </div>
    );
  };

  if (submissionSuccess) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <PartyPopper className="mx-auto h-12 w-12 text-green-500" />
          <CardTitle className="text-2xl">Submission Received!</CardTitle>
          <CardDescription>Thank you for your submission.</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-4">
          <Button className="w-full" onClick={() => window.location.reload()}>
            Submit Another Response
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-4">
        <UserInfoCard />
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{formConfig.title}</CardTitle>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loadingOptions ? (
                <Skeleton className="h-48 w-full md:col-span-2" />
              ) : (
                formConfig.fields.map(renderField)
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting || loadingOptions || !!existingSubmission}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {existingSubmission ? "Already Submitted" : "Submit"}
              </Button>
            </CardFooter>
          </form>
        </Card>
    </div>
  );
};
