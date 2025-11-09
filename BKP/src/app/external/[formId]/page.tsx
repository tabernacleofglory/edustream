
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
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { v4 as uuidv4 } from "uuid";
import { useDebounce } from 'use-debounce';

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

import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface StoredItem {
  id: string;
  name: string;
}

interface Campus {
  id: string;
  "Campus Name": string;
}

const DynamicForm = ({ formConfig }: { formConfig: CustomForm }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [db] = useState(() => getFirebaseFirestore());

  const [selectOptions, setSelectOptions] = useState<{ [key: string]: any[] }>(
    {}
  );
  const [loadingOptions, setLoadingOptions] = useState(true);

  const secondaryAuth = useMemo(() => {
    const secondaryAppName = "secondaryFormApp";
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
          if (isEmailRequired) {
            schema = z.string().min(1, "Email is required.").email("Please enter a valid email address.");
          }
        } else if (field.fieldId === "password") {
          schema = field.required
            ? z.string().min(6, "Password must be at least 6 characters.")
            : z.string().optional();
        } else if (!field.required) {
          schema = z.string().optional().or(z.literal(""));
        } else {
          schema = z.string().min(1, `${field.label} is required.`);
        }

        acc[field.fieldId] = schema;
      }
      return acc;
    }, {} as Record<string, z.ZodType<any>>);

    return z.object(shape).superRefine((data, ctx) => {
        const isInHpGroupField = formConfig.fields.find((f) => f.fieldId === "isInHpGroup");
        if (isInHpGroupField?.visible && data.isInHpGroup === "true") {
            const hpNumberRequired = formConfig.fields.find((f) => f.fieldId === "hpNumber")?.required;
            if (hpNumberRequired && !data.hpNumber) {
                 ctx.addIssue({ code: z.ZodIssueCode.custom, message: "HP Number is required if you are in a prayer group.", path: ["hpNumber"] });
            }
            const facilitatorNameRequired = formConfig.fields.find((f) => f.fieldId === "facilitatorName")?.required;
            if (facilitatorNameRequired && !data.facilitatorName) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Facilitator's Name is required if you are in a prayer group.", path: ["facilitatorName"] });
            }
        }

        const isBaptizedField = formConfig.fields.find((f) => f.fieldId === "isBaptized");
        if (isBaptizedField?.visible && data.isBaptized === "true") {
            const denominationRequired = formConfig.fields.find((f) => f.fieldId === "denomination")?.required;
            if (denominationRequired && !data.denomination) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Denomination is required if you are baptized.", path: ["denomination"] });
            }
        }
    });
  }, [formConfig.fields]);

  const form = useForm({
    resolver: zodResolver(validationSchema),
  });

  const watchedData = form.watch();
  const [debouncedData] = useDebounce(watchedData, 1000);

  useEffect(() => {
    const savedDraft = localStorage.getItem(`form-draft-${formConfig.id}`);
    if (savedDraft) {
        try {
            form.reset(JSON.parse(savedDraft));
        } catch(e) {
            console.error("Failed to parse form draft", e);
        }
    }
  }, [formConfig.id, form]);

  useEffect(() => {
    localStorage.setItem(`form-draft-${formConfig.id}`, JSON.stringify(debouncedData));
  }, [debouncedData, formConfig.id]);

  useEffect(() => {
    const fetchOptions = async () => {
      const options: { [key: string]: any[] } = {};

      if (formConfig.fields.find((f) => f.fieldId === "campus" && f.visible)) {
        const campusSnap = await getDocs(
          query(collection(db, "Campus"), orderBy("Campus Name"))
        );
        const campusOptions = campusSnap.docs
          .map((d) => ({
            value: d.data()["Campus Name"],
            label: d.data()["Campus Name"],
          }))
          .filter((c) => c.label !== "App Campus");
        options["campus"] = campusOptions;
      }

      if (formConfig.fields.find((f) => f.fieldId === "language" && f.visible)) {
        const langSnap = await getDocs(
          query(collection(db, "languages"), where("status", "==", "published"))
        );
        options["language"] = langSnap.docs.map((d) => ({
          value: d.data().name,
          label: d.data().name,
        }));
      }

      options["gender"] = [
        { value: "Male", label: "Male" },
        { value: "Female", label: "Female" },
      ];
      options["ageRange"] = [
        { value: "Less than 13", label: "Less than 13" },
        { value: "13-17", label: "13-17" },
        { value: "18-24", label: "18-24" },
        { value: "25-34", label: "25-34" },
        { value: "35-44", label: "35-44" },
        { value: "45-54", label: "45-54" },
        { value: "55-64", label: "55-64" },
        { value: "65+", label: "65+" },
      ];
      options["locationPreference"] = [
        { value: "Onsite", label: "Onsite" },
        { value: "Online", label: "Online" },
      ];
      options["hpAvailabilityDay"] = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ].map((d) => ({ value: d, label: d }));

      options["denomination"] = [
        "Apostolic", "Baptist", "Pentecostal", "Protestant", "Catholic", "Evangelical",
        "Methodist", "Lutheran", "Presbyterian", "Anglican", "Other"
      ].map(d => ({ value: d, label: d }));

      setSelectOptions(options);
      setLoadingOptions(false);
    };
    fetchOptions();
  }, [db, formConfig.fields]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const password = data.password || `${uuidv4()}A!`;
      const providedRealEmail = data.email && !String(data.email).endsWith("@tg.admin");

      let finalEmail = data.email;
      if (!finalEmail || finalEmail.trim() === '') {
        finalEmail = `user${Date.now()}@tg.admin`;
      }
      
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        finalEmail,
        password
      );
      const user = userCredential.user;

      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      await updateProfile(user, { displayName: fullName });

      const defaultLadderSnap = await getDocs(
        query(collection(db, "courseLevels"), orderBy("order"), limit(1))
      );
      const defaultLadder = !defaultLadderSnap.empty
        ? {
            id: defaultLadderSnap.docs[0].id,
            name: defaultLadderSnap.docs[0].data().name,
          }
        : null;

      const newUser: Partial<User> = {
        uid: user.uid,
        id: user.uid,
        email: finalEmail,
        displayName: fullName,
        role: "user",
        createdAt: serverTimestamp(),
        classLadderId: defaultLadder?.id || null,
        classLadder: defaultLadder?.name || null,
        isInHpGroup: data.isInHpGroup === "true",
        isBaptized: data.isBaptized === "true",
        createdFromFormId: formConfig.id,
      };

      formConfig.fields.forEach((field) => {
        if (field.visible && data[field.fieldId] !== undefined) {
          (newUser as any)[field.fieldId] = data[field.fieldId];
        }
      });

      await setDoc(doc(db, "users", user.uid), newUser);
      await updateDoc(doc(db, "forms", formConfig.id), {
        submissionCount: increment(1),
      });

      localStorage.removeItem(`form-draft-${formConfig.id}`);

      if (providedRealEmail) {
        try {
          await sendPasswordResetEmail(secondaryAuth, data.email);
          toast({
            title: "Registration Successful!",
            description: "Your account has been created. A password setup email has been sent to you.",
          });
        } catch {
          toast({
            title: "Registration Successful!",
            description:
              "Your account was created, but we couldn't send the password setup email. Please use the 'Forgot Password' link on the login page.",
          });
        }
      } else {
        toast({
          title: "Registration Successful!",
          description: "Your account has been created.",
        });
      }

      await signOut(secondaryAuth);
      setSubmissionSuccess(true);
    } catch (error: any) {
      console.error("User creation error:", error);
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description:
          error.code === "auth/email-already-in-use"
            ? "This email is already in use."
            : error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormFieldConfig) => {
    const { fieldId, label, required } = field;
    const formError = form.formState.errors[fieldId];

    const isHpField = ["hpNumber", "facilitatorName"].includes(fieldId);
    const isAvailabilityField = ["hpAvailabilityDay", "hpAvailabilityTime"].includes(fieldId);
    const isInHpGroupValue = form.watch("isInHpGroup");
    
    const isDenominationField = fieldId === "denomination";
    const isBaptizedValue = form.watch("isBaptized");

    if (isHpField && isInHpGroupValue !== "true") return null;
    if (isAvailabilityField && isInHpGroupValue !== "false") return null;
    if (isDenominationField && isBaptizedValue !== "true") return null;

    if (
      [
        "gender", "ageRange", "campus", "language", "locationPreference",
        "hpAvailabilityDay", "denomination"
      ].includes(fieldId)
    ) {
      return (
        <div key={fieldId} className="space-y-2">
          <Label htmlFor={fieldId}>
            {label} {required && <span className="text-destructive">*</span>}
          </Label>
          <Controller
            name={fieldId as any}
            control={form.control}
            render={({ field }) => (
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={loadingOptions}
              >
                <SelectTrigger id={fieldId}>
                  <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {(selectOptions[fieldId] || []).map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
        </div>
      );
    }

    if (["isInHpGroup", "isBaptized"].includes(fieldId)) {
        return (
            <div key={fieldId} className="space-y-2">
                <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
                <Controller
                    name={fieldId as any}
                    control={form.control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">Yes</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
                 {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
            </div>
        )
    }

    if (fieldId === "phoneNumber") {
      return (
        <div key={fieldId} className="space-y-2">
          <Label htmlFor={fieldId}>
            {label} {required && <span className="text-destructive">*</span>}
          </Label>
          <Controller
            name="phoneNumber"
            control={form.control}
            render={({ field }) => (
              <PhoneInput
                id="phoneNumber"
                international
                defaultCountry="US"
                {...field}
                value={field.value || undefined}
                className="PhoneInputInput"
              />
            )}
          />
          {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
        </div>
      );
    }

    if (fieldId === "hpAvailabilityTime") {
      return (
        <div key={fieldId} className="space-y-2">
          <Label htmlFor={fieldId}>
            {label} {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={fieldId}
            type="time"
            step={900}
            {...form.register(fieldId as any)}
          />
          {formError && <p className="text-sm text-destructive">{formError.message as string}</p>}
        </div>
      );
    }

    return (
      <div key={fieldId} className="space-y-2">
        <Label htmlFor={fieldId}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id={fieldId}
          type={
            fieldId === "email" ? "email" : fieldId === "password" ? "password" : "text"
          }
          {...form.register(fieldId as any)}
        />
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
          <CardDescription>
            You can now add another member or proceed to the login page.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-4">
          <Button className="w-full" onClick={() => window.location.reload()}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add New Member
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
        <CardContent className="space-y-4">
          {loadingOptions ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            formConfig.fields.filter((f) => f.visible).map(renderField)
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

export default function PublicFormPage() {
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
          if (data.type !== "userProfile") {
            setError("This form type is not supported for public registration.");
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
