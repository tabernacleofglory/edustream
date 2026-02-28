
"use client";

import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore, getFirebaseAuth, getFirebaseFunctions } from "@/lib/firebase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileWarning, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import type { CustomForm } from "@/lib/types";
import PublicBlankForm from "@/components/public-blank-form";
import { httpsCallable } from 'firebase/functions';
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";

const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase();
};

const UserInfoCard = () => {
    const { user, loading, checkAndCreateUserDoc } = useAuth();
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    
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
    
    return (
        <Card>
            <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-16 w-16">
                    <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
                    <AvatarFallback className="text-xl">{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                    <p className="font-semibold text-lg">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{user.uid}</p>
                </div>
            </CardContent>
        </Card>
    )
}


export default function PublicBlankFormPage() {
  const params = useParams();
  const formId = params.formId as string;
  const [formConfig, setFormConfig] = useState<CustomForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getFirebaseFirestore();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const run = async () => {
      try {
        if (!formId) {
          setError("Form ID is missing.");
          setLoading(false);
          return;
        }
        const ref = doc(db, "forms", formId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setError("This form does not exist.");
          setLoading(false);
          return;
        }
        const data = snap.data() as any;
        if (data.type !== "custom" && data.type !== "hybrid") {
          setError("This form is not available at this URL.");
          setLoading(false);
          return;
        }

        if (data.autoSignup && !authLoading && !user) {
            router.push(`/login?redirect=${pathname}`);
            return;
        }

        if (data.public !== true) {
          setError("This form is not public or is no longer accepting submissions.");
          setLoading(false);
          return;
        }
        const cfg: CustomForm = {
          id: snap.id,
          title: data.title,
          fields: Array.isArray(data.fields) ? data.fields : [],
          type: data.type,
          public: !!data.public,
          autoSignup: !!data.autoSignup,
          emailConfirmationEnabled: !!data.emailConfirmationEnabled,
        } as CustomForm;
        setFormConfig(cfg);
      } catch (e: any) {
        setError("You don't have permission to view this form.");
      } finally {
        setLoading(false);
      }
    };
    if (!authLoading) {
        run();
    }
  }, [formId, db, authLoading, user, router, pathname]);

  const handleFormComplete = async (submissionId: string) => {
    if (formConfig?.autoSignup || formConfig?.emailConfirmationEnabled) {
        try {
            const functions = getFirebaseFunctions();
            const processFormSubmission = httpsCallable(functions, 'processFormSubmission');
            await processFormSubmission({ formId: formConfig.id, submissionId });
        } catch (error) {
            console.error("Error calling processFormSubmission function:", error);
        }
    }
  };

  if (loading || authLoading) {
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
        <PublicBlankForm formConfig={formConfig} onFormComplete={handleFormComplete} />
    </div>
  );
}
