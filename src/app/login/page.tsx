
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { 
    GoogleAuthProvider, 
    sendSignInLinkToEmail, 
    isSignInWithEmailLink, 
    signInWithEmailLink,
    signInWithPopup,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
} from "firebase/auth";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp } from "firebase/firestore";

const getDefaultLadderId = async (db: any): Promise<{id: string, name: string} | null> => {
    const laddersRef = collection(db, "courseLevels");
    const q = query(laddersRef, where("name", "==", "New Member"), where("category", "==", "membership"));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, name: doc.data().name };
    }
    // Fallback if "New Member" doesn't exist
    const fallbackQuery = query(laddersRef, orderBy("order"), limit(1));
    const fallbackSnapshot = await getDocs(fallbackQuery);
    if(!fallbackSnapshot.empty) {
        const doc = fallbackSnapshot.docs[0];
        return { id: doc.id, name: doc.data().name };
    }
    return null;
}

export default function LoginPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [loginMethod, setLoginMethod] = useState<'code' | 'password'>('code');
    const [codeSent, setCodeSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resetEmail, setResetEmail] = useState("");
    const [isResetting, setIsResetting] = useState(false);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

    const auth = getFirebaseAuth();
    const db = getFirebaseFirestore();
    
    const checkAndCreateUserDoc = useCallback(async (user: any) => {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            const defaultLadder = await getDefaultLadderId(db);
            await setDoc(userDocRef, {
                uid: user.uid,
                id: user.uid,
                displayName: user.displayName || user.email?.split('@')[0],
                fullName: user.displayName || user.email?.split('@')[0],
                email: user.email,
                photoURL: user.photoURL,
                role: 'user',
                charge: 'App User',
                membershipStatus: 'Active',
                classLadderId: defaultLadder?.id || null,
                classLadder: defaultLadder?.name || 'New Member',
                createdAt: serverTimestamp(),
            });
            return true; // Indicates new user
        }
        return false; // Indicates existing user
    }, [db]);


    useEffect(() => {
        const handleSignInWithLink = async () => {
            if (isSignInWithEmailLink(auth, window.location.href)) {
                let emailFromStorage = window.localStorage.getItem('emailForSignIn');
                if (!emailFromStorage) {
                    emailFromStorage = window.prompt('Please provide your email for confirmation');
                }
                if (emailFromStorage) {
                    setIsLoading(true);
                    try {
                        const result = await signInWithEmailLink(auth, emailFromStorage, window.location.href);
                        window.localStorage.removeItem('emailForSignIn');
                        
                        await checkAndCreateUserDoc(result.user);
                        
                        router.push('/dashboard');
                        router.refresh();
                    } catch (error) {
                        setError("The sign-in link is invalid or has expired.");
                    } finally {
                        setIsLoading(false);
                    }
                }
            }
        };
        handleSignInWithLink();
    }, [auth, router, db, checkAndCreateUserDoc]);


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || isGoogleLoading) return;
        setIsLoading(true);
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
             router.push('/dashboard');
             router.refresh();
        } catch (error: any) {
             switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setError("Invalid email or password. Please check your credentials and try again.");
                    break;
                default:
                    setError("An unexpected error occurred. Please try again later.");
                    break;
            }
        } finally {
            setIsLoading(false);
        }
    };


    const handleSendCode = async () => {
        if (!email) {
            setError("Please enter your email address.");
            return;
        }
        setIsLoading(true);
        setError(null);
        const actionCodeSettings = {
            url: window.location.origin + '/login',
            handleCodeInApp: true,
        };
        try {
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            window.localStorage.setItem('emailForSignIn', email);
            toast({
                title: "Check your email",
                description: `A sign-in link has been sent to ${email}.`,
            });
            setCodeSent(true);
        } catch (error: any) {
             setError("Failed to send sign-in link. Please check the email address and try again.");
        } finally {
            setIsLoading(false);
        }
    }
    
    const handleGoogleLogin = async () => {
        if (isLoading || isGoogleLoading) return;
        setIsGoogleLoading(true);
        setError(null);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const isNewUser = await checkAndCreateUserDoc(result.user);

            if (isNewUser) {
                toast({ title: "Welcome!", description: "Your account has been created." });
            } else {
                 toast({ title: "Welcome back!" });
            }

            router.push('/dashboard');
            router.refresh();
        } catch (error: any) {
            setError(error.message);
            toast({
                variant: "destructive",
                title: "Authentication Error",
                description: error.message
            });
        } finally {
             setIsGoogleLoading(false);
        }
    }
    
    const handlePasswordReset = async () => {
        if (!resetEmail) {
            toast({ variant: 'destructive', title: 'Please enter your email address.' });
            return;
        }
        setIsResetting(true);
        try {
            await sendPasswordResetEmail(auth, resetEmail);
            toast({
                title: 'Password Reset Email Sent',
                description: `If an account exists for ${resetEmail}, you will receive a password reset link.`,
            });
            setIsResetDialogOpen(false);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to send password reset email. Please try again.',
            });
        } finally {
            setIsResetting(false);
        }
    };


  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-headline">Welcome Back</CardTitle>
          <CardDescription>
            {isGoogleLoading ? 'Signing you in...' : 
            loginMethod === 'code' && !codeSent ? 'Enter your email to get a sign-in link.' :
            loginMethod === 'code' && codeSent ? 'A sign-in link has been sent to your email.' :
            'Enter your credentials to access your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {loginMethod === 'code' && (
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email-code">Email</Label>
                        <Input id="email-code" type="email" placeholder="m@example.com" required value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} disabled={isLoading || isGoogleLoading || codeSent} />
                    </div>
                     {error && (
                        <Alert variant="destructive" className="p-2">
                           <AlertDescription className="text-center text-sm">{error}</AlertDescription>
                        </Alert>
                    )}
                     <Button onClick={handleSendCode} className="w-full" disabled={isLoading || isGoogleLoading || codeSent}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {codeSent ? 'Link Sent' : 'Send Sign-in Link'}
                    </Button>
                    {codeSent && <p className="text-center text-sm text-muted-foreground">Please check your email and click the link to sign in.</p>}
                </div>
            )}
            
            {loginMethod === 'password' && (
                <form onSubmit={handleLogin} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} disabled={isLoading || isGoogleLoading} />
                    </div>
                    <div className="grid gap-2">
                        <div className="flex items-center">
                            <Label htmlFor="password">Password</Label>
                            <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="link" type="button" className="ml-auto inline-block text-sm underline">
                                        Forgot your password?
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Reset Password</DialogTitle>
                                        <DialogDescription>
                                            Enter your email address and we will send you a link to reset your password.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2">
                                        <Label htmlFor="reset-email">Email</Label>
                                        <Input id="reset-email" type="email" placeholder="m@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="secondary" onClick={() => setIsResetDialogOpen(false)}>Cancel</Button>
                                        <Button onClick={handlePasswordReset} disabled={isResetting}>
                                            {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Send Reset Link
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <Input id="password" type="password" required value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} disabled={isLoading || isGoogleLoading} />
                    </div>
                    {error && (
                        <Alert variant="destructive" className="p-2">
                           <AlertDescription className="text-center text-sm">
                            {error}
                            </AlertDescription>
                        </Alert>
                    )}
                    <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Log in
                    </Button>
                </form>
            )}

            <div className="text-center text-sm">
                <Button variant="link" onClick={() => { setLoginMethod(loginMethod === 'password' ? 'code' : 'password'); setError(null); }} disabled={isLoading || isGoogleLoading}>
                    {loginMethod === 'password' ? 'Sign in with a link instead' : 'Sign in with password instead'}
                </Button>
            </div>


            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                    </span>
                </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isLoading || isGoogleLoading}>
              {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login with Google
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
