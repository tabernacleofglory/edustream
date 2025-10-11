
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { 
    createUserWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup, 
    updateProfile,
} from "firebase/auth";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp } from "firebase/firestore";
import LanguageSwitcher from "@/components/language-switcher";

const getDefaultLadderId = async (db: any): Promise<{id: string, name: string} | null> => {
    const laddersRef = collection(db, "courseLevels");
    // Attempt to find a ladder specifically named "New Member" with a category of "membership"
    const q = query(laddersRef, where("name", "==", "New Member"), where("category", "==", "membership"), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, name: doc.data().name };
    }
    // Fallback: If "New Member" doesn't exist, get the ladder with the lowest order number.
    const fallbackQuery = query(laddersRef, orderBy("order"), limit(1));
    const fallbackSnapshot = await getDocs(fallbackQuery);
    if(!fallbackSnapshot.empty) {
        const doc = fallbackSnapshot.docs[0];
        return { id: doc.id, name: doc.data().name };
    }
    return null;
}

export default function SignupPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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


    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || isGoogleLoading) return;
        setIsLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            const generatedDisplayName = email.split('@')[0];

            await updateProfile(user, {
                displayName: generatedDisplayName,
            });

            await checkAndCreateUserDoc(user);
            
            toast({
                title: "Account Created!",
                description: "Welcome! Please complete your profile.",
            });
             router.push('/settings');
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Sign-up Failed",
                description: error.code === 'auth/email-already-in-use' ? 'This email is already associated with an account.' : error.message,
            });
        } finally {
            setIsLoading(false);
        }
    }
    
    const handleGoogleSignup = async () => {
        if (isLoading || isGoogleLoading) return;
        setIsGoogleLoading(true);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const isNewUser = await checkAndCreateUserDoc(user);

            if (isNewUser) {
                 toast({
                    title: "Account Created!",
                    description: "Welcome! Please complete your profile.",
                });
                 router.push('/settings');
            } else {
                 toast({
                    title: "Signed In!",
                    description: "Welcome back!",
                });
                 router.push('/dashboard');
            }

        } catch (error: any) {
             toast({
                variant: "destructive",
                title: "Google Sign-up Failed",
                description: error.message,
            });
        } finally {
             setIsGoogleLoading(false);
        }
    }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-headline">Create an Account</CardTitle>
           <CardDescription>
             {isGoogleLoading ? 'Creating your account...' : 'Start your learning journey'}
           </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex justify-center">
                <LanguageSwitcher />
            </div>
            <form onSubmit={handleSignup} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading || isGoogleLoading} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading || isGoogleLoading} />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create account
                </Button>
            </form>
          </div>
            <div className="relative mt-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                    </span>
                </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={handleGoogleSignup} disabled={isLoading || isGoogleLoading}>
              {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign up with Google
            </Button>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
