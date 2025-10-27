

"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFirebaseFirestore } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
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
import { FileWarning, Loader2, PartyPopper, ImageIcon, Music, File as FileIcon, FileText, FileType } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomForm, FormFieldConfig } from "@/lib/types";

type Opt = { value: string; label: string };

const toStr = (x: unknown, fb = "") =>
  x == null ? fb : typeof x === "string" ? x : String(x);

const normalizeOptions = (src?: unknown): Opt[] =>
  Array.isArray(src)
    ? src
        .map((s) => toStr(s).trim())
        .filter(Boolean)
        .map((s) => ({ value: s, label: s }))
    : [];

const DynamicForm = ({ formConfig }: { formConfig: CustomForm }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [selectOptions, setSelectOptions] = useState<Record<string, Opt[]>>({});
  const db = getFirebaseFirestore();

  const validationSchema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const f of formConfig.fields) {
      if (!f.visible) continue;
      const label = f.label || f.fieldId;
      if (f.required) {
        if (f.type === "email") {
          shape[f.fieldId] = z.string().min(1, `${label} is required.`).email("Invalid email address.");
        } else if (f.type === "multiple-select") {
          shape[f.fieldId] = z.array(z.string()).min(1, `${label} is required.`);
        } else {
          shape[f.fieldId] = z.string().min(1, `${label} is required.`);
        }
      } else {
        shape[f.fieldId] = f.type === "multiple-select" ? z.array(z.string()).optional() : z.any().optional();
      }
    }
    return z.object(shape);
  }, [formConfig.fields]);

  const defaultValues = useMemo(() => {
    const dv: Record<string, any> = {};
    for (const f of formConfig.fields) {
      if (!f.visible) continue;
      dv[f.fieldId] = f.type === "multiple-select" ? [] : "";
    }
    return dv;
  }, [formConfig.fields]);

  const form = useForm({ resolver: zodResolver(validationSchema), defaultValues });

  useEffect(() => {
    const load = async () => {
      const options: Record<string, Opt[]> = {};
      const dynamicFields = formConfig.fields.filter(
        (f) => f.visible && f.dataSource && f.dataSource !== "manual"
      );
      for (const f of dynamicFields) {
        if (f.dataSource === "campuses") {
          const snap = await getDocs(query(collection(db, "Campus"), orderBy("Campus Name")));
          options[f.fieldId] = snap.docs
            .map((d) => toStr(d.data()?.["Campus Name"]).trim())
            .filter(Boolean)
            .map((name) => ({ value: name, label: name }));
        } else if (f.dataSource) {
            let collectionName = '';
            switch(f.dataSource) {
                case 'ladders': collectionName = 'courseLevels'; break;
                case 'ministries': collectionName = 'ministries'; break;
                case 'charges': collectionName = 'charges'; break;
                case 'roles': collectionName = 'roles'; break;
            }
            if (collectionName) {
                const snap = await getDocs(query(collection(db, collectionName), orderBy("name")));
                options[f.fieldId] = snap.docs.map(d => ({ value: d.data().name, label: d.data().name }));
            } else if (f.dataSource === 'languages') {
                 const snap = await getDocs(query(collection(db, 'languages'), where('status', '==', 'published')));
                 options[f.fieldId] = snap.docs.map(d => ({ value: d.data().name, label: d.data().name }));
            }
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
      const submissionRef = collection(db, "forms", formConfig.id, "submissions");
      await addDoc(submissionRef, {
        data,
        submittedAt: serverTimestamp(),
        createdBy: null, // public
      });
      await updateDoc(doc(db, "forms", formConfig.id), { submissionCount: increment(1) });
      setSubmissionSuccess(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (cfg: FormFieldConfig) => {
    if (!cfg.visible) return null;
    const { fieldId, required, type, options, dataSource } = cfg;
    const label = cfg.label || ''; 
    const err = (form.formState.errors as any)[fieldId];

    const getOptions = () => {
      if (dataSource && dataSource !== 'manual' && selectOptions[fieldId]) {
        return selectOptions[fieldId];
      }
      return normalizeOptions(options);
    };
    
    const opts = getOptions();

    switch (type) {
      case "select":
        return (
          <div className="space-y-2">
            <Label htmlFor={fieldId}>{label} {required && <span className="text-destructive">*</span>}</Label>
            <Controller name={fieldId as any} control={form.control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={loadingOptions}>
                    <SelectTrigger id={fieldId}><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>
                        {opts.map((opt: any, index: number) => (
                            <SelectItem key={`${opt.value}-${index}`} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )} />
            {err && <p className="text-sm text-destructive">{String(err.message)}</p>}
          </div>
        );

      case "multiple-choice":
        return (
          <div className="space-y-2 md:col-span-2">
            <Label>
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
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
            {err && <p className="text-sm text-destructive">{String(err.message)}</p>}
          </div>
        );

      case "multiple-select":
        return (
          <div className="space-y-2 md:col-span-2">
            <Label>
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
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
            {err && <p className="text-sm text-destructive">{String(err.message)}</p>}
          </div>
        );

      case "textarea":
        return (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={fieldId}>
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
            <Textarea id={fieldId} {...form.register(fieldId as any)} />
            {err && <p className="text-sm text-destructive">{String(err.message)}</p>}
          </div>
        );

      case "phone":
        return (
          <div className="space-y-2">
            <Label htmlFor={fieldId}>
              {label || 'Phone Number'} {required && <span className="text-destructive">*</span>}
            </Label>
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
            {err && <p className="text-sm text-destructive">{String(err.message)}</p>}
          </div>
        );

      case "password":
        return (
          <div className="space-y-2">
            <Label htmlFor={fieldId}>
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
            <Input id={fieldId} type="password" {...form.register(fieldId as any)} />
            {err && <p className="text-sm text-destructive">{String(err.message)}</p>}
          </div>
        );

      case "email":
      case "text":
      case "url":
      case "file":
      case "image":
      case "audio":
      default:
        let inputType: string;
        switch(type) {
            case 'email': inputType = 'email'; break;
            case 'url': inputType = 'url'; break;
            case 'file': inputType = 'file'; break;
            case 'image': inputType = 'file'; break;
            case 'audio': inputType = 'file'; break;
            default: inputType = 'text';
        }
        let acceptTypes = {};
        if (type === 'image') acceptTypes = { accept: "image/*" };
        if (type === 'audio') acceptTypes = { accept: "audio/*" };

        return (
          <div className="space-y-2">
            <Label htmlFor={fieldId}>
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
            <Input id={fieldId} type={inputType} {...form.register(fieldId as any)} {...acceptTypes} />
            {err && <p className="text-sm text-destructive">{String(err.message)}</p>}
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
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle>{formConfig.title}</CardTitle>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loadingOptions ? (
            <Skeleton className="h-48 w-full md:col-span-2" />
          ) : (
            formConfig.fields.filter((f) => f.visible).map(field => (
                <div key={field.id || field.fieldId}>{renderField(field)}</div>
            ))
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

export default function PublicBlankFormPage() {
  const params = useParams();
  const formId = params.formId as string;
  const [formConfig, setFormConfig] = useState<CustomForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getFirebaseFirestore();

  useEffect(() => {
    const run = async () => {
      try {
        if (!formId) {
          setError("Form ID is missing.");
          return;
        }
        const ref = doc(db, "forms", formId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setError("This form does not exist.");
          return;
        }
        const data = snap.data() as any;
        if (data.type !== "custom" && data.type !== "hybrid") {
          setError("This form is not available at this URL.");
          return;
        }
        if (data.public !== true) {
          setError("This form is not public or is no longer accepting submissions.");
          return;
        }
        const cfg: CustomForm = {
          id: snap.id,
          title: toStr(data.title, "Untitled Form"),
          description: toStr(data.description, ""),
          fields: Array.isArray(data.fields) ? (data.fields as FormFieldConfig[]) : [],
          type: data.type,
          public: !!data.public,
        };
        setFormConfig(cfg);
      } catch (e: any) {
        setError("You don't have permission to view this form.");
      } finally {
        setLoading(false);
      }
    };
    run();
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
