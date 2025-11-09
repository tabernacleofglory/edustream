
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileWarning, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import type { CustomForm } from "@/lib/types";
import PublicBlankForm from "@/components/public-blank-form";

const toStr = (x: unknown, fb = "") => (x == null ? fb : typeof x === "string" ? x : String(x));

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
          fields: Array.isArray(data.fields) ? data.fields : [],
          type: data.type,
          public: !!data.public,
        } as CustomForm;
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
          <AlertDescription>The requested form could not be loaded.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <PublicBlankForm formConfig={formConfig} />
    </div>
  );
}
