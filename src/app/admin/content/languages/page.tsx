
"use client";

import { useState, useEffect, useCallback, FormEvent, MouseEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, doc, updateDoc, deleteDoc, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Languages, Upload, Loader2, Edit, Trash, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


interface StoredLanguage {
    id: string;
    name: string;
    status: 'published' | 'private';
    createdAt?: { seconds: number; nanoseconds: number; };
}

export default function LanguagesPage() {
  const { hasPermission } = useAuth();
  const [languages, setLanguages] = useState<StoredLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newLanguage, setNewLanguage] = useState('');
  const [editingLanguage, setEditingLanguage] = useState<StoredLanguage | null>(null);
  const [editedName, setEditedName] = useState("");
  const { toast } = useToast();

  const canManage = hasPermission('manageContent');

  const fetchLanguages = useCallback(async () => {
    setLoading(true);
    try {
        const q = query(collection(db, 'languages'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredLanguage));
        setLanguages(list);

        // Pre-populate if empty
        if (list.length === 0 && canManage) {
            const defaultLanguages = [
                { name: 'English', status: 'published' },
                { name: 'Spanish', status: 'published' },
                { name: 'French', status: 'published' },
                { name: 'Creole', status: 'private' },
            ];
            const batch = defaultLanguages.map(lang => 
                addDoc(collection(db, 'languages'), { ...lang, createdAt: serverTimestamp() })
            );
            await Promise.all(batch);
            fetchLanguages(); // Refetch after populating
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to fetch languages.' });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [toast, canManage]);
  
  useEffect(() => {
    fetchLanguages();
  }, [fetchLanguages]);

  const handleAddLanguage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newLanguage.trim()) return;
    setIsSubmitting(true);
    try {
        await addDoc(collection(db, 'languages'), {
            name: newLanguage,
            status: 'private',
            createdAt: serverTimestamp(),
        });
        setNewLanguage('');
        toast({ title: 'Language added successfully.' });
        fetchLanguages();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to add language.' });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const handleDelete = async (lang: StoredLanguage) => {
      try {
          await deleteDoc(doc(db, 'languages', lang.id));
          setLanguages(prev => prev.filter(item => item.id !== lang.id));
          toast({ title: "Language deleted successfully." });
      } catch (error) {
           toast({ variant: 'destructive', title: "Delete failed.", description: "Could not delete the language." });
           console.error("Delete error: ", error);
      }
  }

  const handleStatusChange = async (lang: StoredLanguage, newStatus: boolean) => {
    const status = newStatus ? 'published' : 'private';
    try {
        const langDocRef = doc(db, 'languages', lang.id);
        await updateDoc(langDocRef, { status });
        toast({ title: `"${lang.name}" status changed to ${status}` });
        setLanguages(prevLangs => prevLangs.map(l => l.id === lang.id ? { ...l, status } : l));
    } catch (error) {
        toast({ variant: 'destructive', title: 'Status update failed' });
        console.error("Status update error: ", error);
    }
  };

  const handleEditClick = (lang: StoredLanguage) => {
      setEditingLanguage(lang);
      setEditedName(lang.name);
  };
  
  const handleUpdateLanguage = async () => {
    if (!editingLanguage || !editedName.trim()) return;
    setIsSubmitting(true);
    try {
        const langDocRef = doc(db, 'languages', editingLanguage.id);
        await updateDoc(langDocRef, { name: editedName });
        toast({ title: "Language updated!" });
        setEditingLanguage(null);
        fetchLanguages();
    } catch (error) {
        toast({ variant: 'destructive', title: "Update failed." });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Languages
        </h1>
        <p className="text-muted-foreground">
          Manage languages available for courses and user profiles.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className='flex-1'>
                <CardTitle>Language Management</CardTitle>
                <CardDescription>Add new languages and toggle their visibility for users.</CardDescription>
            </div>
          {canManage && (
             <form onSubmit={handleAddLanguage} className='flex items-end gap-2 w-full sm:w-auto'>
                <div className='flex-1 space-y-1'>
                    <Label htmlFor="new-lang" className='sr-only'>New Language</Label>
                    <Input 
                        id="new-lang" 
                        placeholder="e.g., Portuguese"
                        value={newLanguage}
                        onChange={(e) => setNewLanguage(e.target.value)}
                        disabled={isSubmitting}
                    />
                </div>
                <Button type="submit" disabled={isSubmitting || !newLanguage.trim()}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Plus className="h-4 w-4" />
                </Button>
            </form>
          )}
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                            <Skeleton className="h-5 w-32" />
                            <div className="flex-1" />
                            <Skeleton className="h-8 w-24" />
                        </div>
                    ))
                ) : languages.length > 0 ? (
                    languages.map(item => (
                        <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border p-4">
                            <p className="flex-1 font-medium">{item.name}</p>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id={`status-switch-${item.id}`}
                                        checked={item.status === 'published'}
                                        onCheckedChange={(checked) => handleStatusChange(item, checked)}
                                        disabled={!canManage}
                                    />
                                    <Label htmlFor={`status-switch-${item.id}`}>{item.status === 'published' ? 'Published' : 'Private'}</Label>
                                </div>
                               {canManage && (
                                 <>
                                    <Button size="icon" variant="ghost" onClick={() => handleEditClick(item)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button size="icon" variant="destructive" onClick={(e) => e.stopPropagation()}>
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete the language "{item.name}".</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(item)}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                 </>
                               )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-12 flex flex-col items-center">
                        <Languages className="h-12 w-12" />
                        <p className="mt-4">No languages found. Add one to get started.</p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>
      
      <Dialog open={!!editingLanguage} onOpenChange={() => setEditingLanguage(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Language</DialogTitle>
                <DialogDescription>
                    Change the name of the language.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-language-name">Language Name</Label>
                    <Input 
                        id="edit-language-name" 
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        disabled={isSubmitting}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setEditingLanguage(null)}>Cancel</Button>
                <Button onClick={handleUpdateLanguage} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
