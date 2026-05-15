
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFirebaseFirestore } from "@/lib/firebase";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, query, where, getDocs, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, updateProfile,
  getAuth, signOut, sendPasswordResetEmail,
} from "firebase/auth";
import { v4 as uuidv4 } from "uuid";
import { useDebounce } from "use-debounce";
import allLanguages from "@/lib/languages.json";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileWarning, Loader2, PartyPopper, LogIn, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import type { CustomForm, FormFieldConfig, Ladder } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useI18n } from "@/hooks/use-i18n";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
type SelectOpt = { value: string; label: string; id?: string };

// Inline static option lists
const STATIC_OPTIONS: Record<string, SelectOpt[]> = {
  genders:             [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
  ageRanges:           ["Less than 13","13-17","18-24","25-34","35-44","45-54","55-64","65+"].map(v => ({ value: v, label: v })),
  locationPreferences: [{ value: "Onsite", label: "Onsite" }, { value: "Online", label: "Online" }],
  hpAvailabilityDays:  ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(v => ({ value: v, label: v })),
  maritalStatuses:     ["Single","Married","Divorced","Widowed"].map(v => ({ value: v, label: v })),
  denominations:       ["Apostolic", "Baptist", "Pentecostal", "Protestant", "Catholic", "Evangelical", "Methodist", "Lutheran", "Presbyterian", "Anglican", "Other"].map(v => ({ value: v, label: v })),
  yesNo:               [{ value: "true", label: "Yes" }, { value: "false", label: "No" }],
};

// Fields that are yes/no dropdowns based on fieldId (legacy fallback)
const YES_NO_FIELD_IDS = ["isInHpGroup", "isBaptized"];

const toNativeName = (isoName: string): string => {
  const match = allLanguages.find(l =>
    l.name.toLowerCase() === isoName.toLowerCase()
    || l.name.toLowerCase().startsWith(isoName.split(";")[0].trim().toLowerCase())
  );
  if (!match) return isoName;
  const native = match.nativeName.split(/[;,]/)[0].trim();
  return native.charAt(0).toUpperCase() + native.slice(1);
};
// Fields whose visibility depends on other fields (legacy hard-coded conditional logic)
const CONDITIONAL_FIELDS: Record<string, { dependsOn: string; showWhen: string }> = {
  hpNumber:          { dependsOn: "isInHpGroup", showWhen: "true" },
  facilitatorName:   { dependsOn: "isInHpGroup", showWhen: "true" },
  hpAvailabilityDay: { dependsOn: "isInHpGroup", showWhen: "true" },
  hpAvailabilityTime:{ dependsOn: "isInHpGroup", showWhen: "true" },
  denomination:      { dependsOn: "isBaptized",  showWhen: "true" },
};

// ─── DynamicForm ──────────────────────────────────────────────────────────────
const DynamicForm = ({ formConfig }: { formConfig: CustomForm }) => {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [selectOptions, setSelectOptions] = useState<Record<string, SelectOpt[]>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [ladders, setLadders] = useState<Ladder[]>([]);

  // ── Secondary Firebase auth instance (avoids logging admin out) ──
  const secondaryAuth = useMemo(() => {
    const name = "secondaryFormApp";
    const existing = getApps().find(a => a.name === name);
    return getAuth(existing ?? initializeApp(getApp().options, name));
  }, []);

  // ── Build Zod validation dynamically from field config ──
  const validationSchema = useMemo(() => {
    const shape = formConfig.fields.reduce((acc, field) => {
      if (!field.visible) return acc;

      let schema: z.ZodTypeAny;
      if (field.fieldId === "email") {
        schema = field.required
          ? z.string().min(1, "Email is required.").email("Please enter a valid email address.")
          : z.string().email("Please enter a valid email address.").optional().or(z.literal(""));
      } else if (field.fieldId === "password") {
        schema = field.required
          ? z.string().min(6, "Password must be at least 6 characters.")
          : z.string().optional();
      } else if (field.required) {
        schema = z.string().min(1, `${field.label} is required.`);
      } else {
        schema = z.string().optional().or(z.literal(""));
      }

      acc[field.fieldId] = schema;
      return acc;
    }, {} as Record<string, z.ZodTypeAny>);

    return z.object(shape).superRefine((data: any, ctx) => {
      // HP group conditional requirements
      const hpField = formConfig.fields.find(f => f.fieldId === "isInHpGroup");
      if (hpField?.visible && data.isInHpGroup === "true") {
        ["hpNumber", "facilitatorName"].forEach(fid => {
          const fc = formConfig.fields.find(f => f.fieldId === fid);
          if (fc?.visible && fc.required && !data[fid]) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fc.label} is required.`, path: [fid] });
          }
        });
      }
      // Baptism conditional
      const bField = formConfig.fields.find(f => f.fieldId === "isBaptized");
      if (bField?.visible && data.isBaptized === "true") {
        const denField = formConfig.fields.find(f => f.fieldId === "denomination");
        if (denField?.visible && denField.required && !data.denomination) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Denomination is required.", path: ["denomination"] });
        }
      }
    });
  }, [formConfig.fields]);

  const form = useForm({ resolver: zodResolver(validationSchema) });
  const watchedData = form.watch();
  const [debouncedData] = useDebounce(watchedData, 1000);

  // ── Draft persistence ──
  useEffect(() => {
    try {
      const draft = localStorage.getItem(`form-draft-${formConfig.id}`);
      if (draft) form.reset(JSON.parse(draft));
    } catch { /* ignore */ }
  }, [formConfig.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(`form-draft-${formConfig.id}`, JSON.stringify(debouncedData));
  }, [debouncedData, formConfig.id]);

  // ── Load dynamic select options from Firestore ──
  useEffect(() => {
    if (!formConfig.fields.length) return;
    const db = getFirebaseFirestore();

    const fetchOptions = async () => {
      const opts: Record<string, SelectOpt[]> = {};
      const laddersSnap = await getDocs(query(collection(db, "courseLevels"), orderBy("order")));
      const laddersData = laddersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ladder));
      setLadders(laddersData);

      for (const field of formConfig.fields) {
        if (!field.visible) continue;
        const { fieldId, dataSource, dataSourceOptions } = field as any;

        // Static built-in sources
        if (dataSource && STATIC_OPTIONS[dataSource]) {
          opts[fieldId] = STATIC_OPTIONS[dataSource];
          continue;
        }
        // Manual options
        if (dataSource === "manual" && f.options) {
          opts[fieldId] = f.options.map(o => ({ value: o, label: o }));
          continue;
        }
        // Yes/No legacy fields
        if (YES_NO_FIELD_IDS.includes(fieldId) && !dataSource) {
          opts[fieldId] = STATIC_OPTIONS.yesNo;
          continue;
        }

        // Firestore-backed sources
        if (dataSource === "campuses") {
          const snap = await getDocs(query(collection(db, "Campus"), orderBy("Campus Name")));
          let items: SelectOpt[] = snap.docs.map(d => ({ id: d.id, value: d.data()["Campus Name"], label: d.data()["Campus Name"] }));
          items = items.filter(c => c.label !== "App Campus");
          // Apply filter if configured
          if (dataSourceOptions?.campuses?.length) {
            items = items.filter(c => dataSourceOptions.campuses.includes((c as any).id));
          }
          opts[fieldId] = items;
        } else if (dataSource === "ladders" || fieldId === "classLadderId") {
          let items: SelectOpt[] = laddersData.map(l => ({ id: l.id, value: l.id, label: l.name }));
          if (dataSourceOptions?.ladders?.length) {
            items = items.filter(l => dataSourceOptions.ladders.includes((l as any).id));
          }
          opts[fieldId] = items;
        } else if (dataSource === "languages") {
          const snap = await getDocs(query(collection(db, "languages"), where("status", "==", "published")));
          opts[fieldId] = snap.docs.map(d => {
            const name = d.data().name as string;
            return { value: name, label: toNativeName(name) };
          });
        } else if (dataSource === "ministries") {
          const snap = await getDocs(query(collection(db, "ministries"), orderBy("name")));
          opts[fieldId] = snap.docs.map(d => ({ value: d.data().name, label: d.data().name }));
        } else if (dataSource === "charges") {
          const snap = await getDocs(query(collection(db, "charges"), orderBy("name")));
          opts[fieldId] = snap.docs.map(d => ({ value: d.data().name, label: d.data().name }));
        }
      }
      setSelectOptions(opts);
      setLoadingOptions(false);
    };

    fetchOptions().catch(err => {
      console.error("Failed to fetch form options:", err);
      setLoadingOptions(false);
    });
  }, [formConfig.fields]);

  // ── Submit: create Firebase Auth user + Firestore user doc ──
  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const db = getFirebaseFirestore();
      const password = data.password?.trim() || `${uuidv4()}A!`;
      const rawEmail = data.email?.trim() || "";
      const providedRealEmail = rawEmail && !rawEmail.endsWith("@tg.admin");
      const finalEmail = rawEmail || `user${Date.now()}@tg.admin`;

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, password);
      const user = userCredential.user;
      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      await updateProfile(user, { displayName: fullName });

      // Resolve class ladder
      let ladderId = data.classLadderId;
      let ladderName = "New Member";
      if (ladderId) {
        const found = ladders.find(l => l.id === ladderId);
        if (found) ladderName = found.name;
      } else {
        const defaultSnap = await getDocs(query(collection(db, "courseLevels"), orderBy("order"), limit(1)));
        if (!defaultSnap.empty) {
          ladderId = defaultSnap.docs[0].id;
          ladderName = defaultSnap.docs[0].data().name;
        }
      }

      // Build user document — start with base fields
      const newUser: Record<string, any> = {
        uid: user.uid,
        id: user.uid,
        email: finalEmail,
        displayName: fullName,
        role: "user",
        createdAt: serverTimestamp(),
        classLadderId: ladderId,
        classLadder: ladderName,
        createdFromFormId: formConfig.id,
      };

      // Map all visible fields to user doc
      formConfig.fields.forEach(field => {
        if (!field.visible) return;
        const val = data[field.fieldId];
        if (val === undefined) return;
        if (field.fieldId === "classLadderId") return; // already handled
        // Coerce boolean-string fields
        if (field.fieldId === "isInHpGroup") { newUser.isInHpGroup = val === "true"; return; }
        if (field.fieldId === "isBaptized")  { newUser.isBaptized  = val === "true"; return; }
        newUser[field.fieldId] = val;
      });

      await setDoc(doc(db, "users", user.uid), newUser);
      await updateDoc(doc(db, "forms", formConfig.id), { submissionCount: increment(1) });
      localStorage.removeItem(`form-draft-${formConfig.id}`);

      // Send password setup email if real email provided
      if (providedRealEmail) {
        try {
          await sendPasswordResetEmail(secondaryAuth, rawEmail);
          toast({ title: "Registration Successful!", description: "A password setup email has been sent to you." });
        } catch {
          toast({ title: "Registration Successful!", description: "Account created. Use 'Forgot Password' on the login page to set your password." });
        }
      } else {
        toast({ title: "Registration Successful!", description: "Your account has been created." });
      }

      await signOut(secondaryAuth);
      setSubmissionSuccess(true);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.code === "auth/email-already-in-use"
          ? "This email is already registered. Please use the login page."
          : error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render individual field ──
  const renderField = (field: FormFieldConfig) => {
    const { fieldId, label, required } = field;
    const fieldType = (field as any).type as string | undefined;
    const dataSource = (field as any).dataSource as string | undefined;
    const formError = form.formState.errors[fieldId];

    // Conditional visibility (HP group / baptism logic)
    const cond = CONDITIONAL_FIELDS[fieldId];
    if (cond) {
      const parentVal = form.watch(cond.dependsOn as any);
      if (parentVal !== cond.showWhen) return null;
    }

    const opts = selectOptions[fieldId] || [];
    const isSelectLike = ["select", "multiple-choice", "multiple-select"].includes(fieldType || "");
    // Legacy: yes/no fields
    const isYesNo = YES_NO_FIELD_IDS.includes(fieldId) && (!fieldType || fieldType === "select");

    const renderInput = () => {
      // Phone
      if (fieldType === "phone" || (fieldId === "phoneNumber" && !fieldType)) {
        return (
          <Controller
            name={fieldId as any}
            control={form.control}
            render={({ field: ctrl }) => (
              <PhoneInput
                id={fieldId}
                international
                defaultCountry="US"
                {...ctrl}
                value={ctrl.value || undefined}
                className="PhoneInputInput"
              />
            )}
          />
        );
      }
      // Time input
      if (fieldId === "hpAvailabilityTime" && (!fieldType || fieldType === "text")) {
        return <Input id={fieldId} type="time" step={900} {...form.register(fieldId as any)} />;
      }
      // Textarea
      if (fieldType === "textarea" || fieldType === "address") {
        return <Textarea id={fieldId} {...form.register(fieldId as any)} />;
      }
      // Date
      if (fieldType === "date") {
        return <Input id={fieldId} type="date" {...form.register(fieldId as any)} />;
      }
      // Yes/No select (legacy)
      if (isYesNo) {
        return (
          <Controller name={fieldId as any} control={form.control} render={({ field: ctrl }) => (
            <Select onValueChange={ctrl.onChange} value={ctrl.value}>
              <SelectTrigger id={fieldId}><SelectValue placeholder="Select an option" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          )} />
        );
      }
      // Dropdown select
      if (fieldType === "select" || (isSelectLike && fieldType !== "multiple-choice" && fieldType !== "multiple-select")) {
        return (
          <Controller name={fieldId as any} control={form.control} render={({ field: ctrl }) => (
            <Select onValueChange={ctrl.onChange} value={ctrl.value} disabled={loadingOptions}>
              <SelectTrigger id={fieldId}><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
              <SelectContent>
                {opts.map((opt, i) => <SelectItem key={`${opt.value}-${i}`} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
        );
      }
      // Radio (multiple-choice)
      if (fieldType === "multiple-choice") {
        return (
          <Controller name={fieldId as any} control={form.control} render={({ field: ctrl }) => (
            <RadioGroup onValueChange={ctrl.onChange} value={ctrl.value} className="space-y-1">
              {opts.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <RadioGroupItem value={o.value} id={`${fieldId}-${i}`} />
                  <Label htmlFor={`${fieldId}-${i}`}>{o.label}</Label>
                </div>
              ))}
            </RadioGroup>
          )} />
        );
      }
      // Multiple-select (checkboxes)
      if (fieldType === "multiple-select") {
        return (
          <Controller name={fieldId as any} control={form.control} render={({ field: ctrl }) => {
            const selected: string[] = Array.isArray(ctrl.value) ? ctrl.value : [];
            return (
              <div className="space-y-1">
                {opts.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox
                      id={`${fieldId}-${i}`}
                      checked={selected.includes(o.value)}
                      onCheckedChange={c => {
                        const next = c ? [...selected, o.value] : selected.filter(v => v !== o.value);
                        ctrl.onChange(next);
                      }}
                    />
                    <Label htmlFor={`${fieldId}-${i}`}>{o.label}</Label>
                  </div>
                ))}
              </div>
            );
          }} />
        );
      }
      // Default: text / email / password
      const inputType = fieldId === "email" || fieldType === "email" ? "email"
        : fieldId === "password" || fieldType === "password" ? "password"
        : "text";
      return <Input id={fieldId} type={inputType} {...form.register(fieldId as any)} />;
    };

    return (
      <div key={fieldId} className="space-y-2">
        <Label htmlFor={fieldId}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {renderInput()}
        {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
      </div>
    );
  };

  if (submissionSuccess) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <PartyPopper className="mx-auto h-12 w-12 text-green-500" />
          <CardTitle className="text-2xl">Registration Complete!</CardTitle>
          <CardDescription>You can now add another member or proceed to the login page.</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-4">
          <Button className="w-full" onClick={() => window.location.reload()}>
            <UserPlus className="mr-2 h-4 w-4" /> Add New Member
          </Button>
          <Button variant="link" asChild>
            <Link href="/login"><LogIn className="mr-2 h-4 w-4" /> Proceed to Login</Link>
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
        <CardContent className="space-y-4">
          {loadingOptions ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            formConfig.fields.filter(f => f.visible).map(renderField)
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting || loadingOptions}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Registration
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

// ─── Page wrapper: loads form config ─────────────────────────────────────────
export default function PublicFormPage() {
  const params = useParams();
  const formId = params.formId as string;
  const [formConfig, setFormConfig] = useState<CustomForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) { setError("Form ID is missing."); setLoading(false); return; }
    const db = getFirebaseFirestore();
    getDoc(doc(db, "forms", formId))
      .then(snap => {
        if (!snap.exists()) { setError("This form does not exist."); return; }
        const data = snap.data() as any;
        if (data.type !== "userProfile") {
          setError("This form type is not supported for public registration.");
          return;
        }
        if (data.public !== true) {
          setError("This form is not public or is no longer accepting submissions.");
          return;
        }
        setFormConfig({ id: snap.id, ...data } as CustomForm);
      })
      .catch(() => setError("You don't have permission to view this form."))
      .finally(() => setLoading(false));
  }, [formId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
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

  if (!formConfig) return null;

  return (
    <div className="flex items-center justify-center p-4">
      <DynamicForm formConfig={formConfig} />
    </div>
  );
}
