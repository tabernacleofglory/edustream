
"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, doc, updateDoc, deleteDoc, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Church, Loader2, Edit, Trash, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface StoredMinistry {
    id: string;
    name: string;
}

export default function MinistriesPage() {
  const { hasPermission } = useAuth();
  const [ministries, setMinistries] = useState<StoredMinistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMinistry, setNewMinistry] = useState('');
  const [editingMinistry, setEditingMinistry] = useState<StoredMinistry | null>(null);
  const [editedName, setEditedName] = useState("");
  const { toast } = useToast();

  const canManage = hasPermission('manageContent');

  const fetchMinistries = useCallback(async () => {
    setLoading(true);
    try {
        const q = query(collection(db, 'ministries'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredMinistry));
        setMinistries(list);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to fetch ministries.' });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchMinistries();
  }, [fetchMinistries]);

  const handleAddMinistry = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMinistry.trim()) return;
    setIsSubmitting(true);
    try {
        await addDoc(collection(db, 'ministries'), {
            name: newMinistry,
            createdAt: serverTimestamp(),
        });
        setNewMinistry('');
        toast({ title: 'Ministry added successfully.' });
        fetchMinistries();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to add ministry.' });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const handleDelete = async (ministry: StoredMinistry) => {
      try {
          await deleteDoc(doc(db, 'ministries', ministry.id));
          setMinistries(prev => prev.filter(item => item.id !== ministry.id));
          toast({ title: "Ministry deleted successfully." });
      } catch (error) {
           toast({ variant: 'destructive', title: "Delete failed.", description: "Could not delete the ministry." });
           console.error("Delete error: ", error);
      }
  }

  const handleEditClick = (ministry: StoredMinistry) => {
      setEditingMinistry(ministry);
      setEditedName(ministry.name);
  };
  
  const handleUpdateMinistry = async () => {
    if (!editingMinistry || !editedName.trim()) return;
    setIsSubmitting(true);
    try {
        const ministryDocRef = doc(db, 'ministries', editingMinistry.id);
        await updateDoc(ministryDocRef, { name: editedName });
        toast({ title: "Ministry updated!" });
        setEditingMinistry(null);
        fetchMinistries();
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
          Content Library - Ministries
        </h1>
        <p className="text-muted-foreground">
          Manage ministries available for user profiles.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className='flex-1'>
                <CardTitle>Ministry Management</CardTitle>
                <CardDescription>Add new ministries for users to select from.</CardDescription>
            </div>
          {canManage && (
             <form onSubmit={handleAddMinistry} className='flex items-end gap-2 w-full sm:w-auto'>
                <div className='flex-1 space-y-1'>
                    <Label htmlFor="new-ministry" className='sr-only'>New Ministry</Label>
                    <Input 
                        id="new-ministry" 
                        placeholder="e.g., Usher"
                        value={newMinistry}
                        onChange={(e) => setNewMinistry(e.target.value)}
                        disabled={isSubmitting}
                    />
                </div>
                <Button type="submit" disabled={isSubmitting || !newMinistry.trim()}>
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
                ) : ministries.length > 0 ? (
                    ministries.map(item => (
                        <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border p-4">
                            <p className="flex-1 font-medium">{item.name}</p>
                            <div className="flex items-center gap-2">
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
                                                <AlertDialogDescription>This will permanently delete the ministry "{item.name}".</AlertDialogDescription>
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
                        <Church className="h-12 w-12" />
                        <p className="mt-4">No ministries found. Add one to get started.</p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>
      
      <Dialog open={!!editingMinistry} onOpenChange={() => setEditingMinistry(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Ministry</DialogTitle>
                <DialogDescription>
                    Change the name of the ministry.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-ministry-name">Ministry Name</Label>
                    <Input 
                        id="edit-ministry-name" 
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        disabled={isSubmitting}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setEditingMinistry(null)}>Cancel</Button>
                <Button onClick={handleUpdateMinistry} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
