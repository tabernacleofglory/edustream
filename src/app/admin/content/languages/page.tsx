
"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, doc, updateDoc, deleteDoc, orderBy, setDoc } from "firebase/firestore";
import allLanguages from "@/lib/languages.json";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

interface StoredLanguage {
    id: string; // The two-letter language code (e.g., "en")
    name: string; // The full name (e.g., "English")
    status: 'published' | 'private';
}

export default function LanguagesPage() {
  const { hasPermission } = useAuth();
  const [storedLanguages, setStoredLanguages] = useState<StoredLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const canManage = hasPermission('manageContent');

  const fetchStoredLanguages = useCallback(async () => {
    setLoading(true);
    try {
        const q = query(collection(db, 'languages'));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StoredLanguage));
        setStoredLanguages(list);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to fetch language settings.' });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (canManage) {
        fetchStoredLanguages();
    } else {
        setLoading(false);
    }
  }, [canManage, fetchStoredLanguages]);

  const handleStatusChange = async (language: { code: string; name: string }, isPublished: boolean) => {
    const status = isPublished ? 'published' : 'private';
    const langDocRef = doc(db, 'languages', language.code);

    try {
        await updateDoc(langDocRef, { status });
        toast({ title: `"${language.name}" status changed to ${status}.` });
        fetchStoredLanguages(); // Refresh state from DB
    } catch (error) {
        // If the document doesn't exist, create it.
        if ((error as any).code === 'not-found' && isPublished) {
             await setDoc(langDocRef, { name: language.name, status: 'published' });
             toast({ title: `"${language.name}" has been published.` });
             fetchStoredLanguages();
        } else {
            toast({ variant: 'destructive', title: 'Status update failed.' });
            console.error("Status update error: ", error);
        }
    }
  };
  
  const filteredLanguages = allLanguages.filter(lang => 
    lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Languages
        </h1>
        <p className="text-muted-foreground">
          Activate languages to make them available throughout the platform.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
            <CardTitle>Language Management</CardTitle>
            <CardDescription>Only "Published" languages will be visible to users.</CardDescription>
            <div className="pt-2">
                <Input 
                    placeholder="Search languages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </CardHeader>
        <CardContent>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                            <Skeleton className="h-5 w-48" />
                            <div className="flex-1" />
                            <Skeleton className="h-6 w-24" />
                        </div>
                    ))
                ) : (
                    filteredLanguages.map(lang => {
                        const storedLang = storedLanguages.find(sl => sl.id === lang.code);
                        const isPublished = storedLang?.status === 'published';
                        
                        return (
                            <div key={lang.code} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                                <div>
                                    <p className="font-medium">{lang.name}</p>
                                    <p className="text-sm text-muted-foreground">{lang.nativeName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id={`status-switch-${lang.code}`}
                                        checked={isPublished}
                                        onCheckedChange={(checked) => handleStatusChange(lang, checked)}
                                        disabled={!canManage}
                                    />
                                    <Label htmlFor={`status-switch-${lang.code}`}>{isPublished ? 'Published' : 'Draft'}</Label>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
