
"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, doc, deleteDoc, orderBy, updateDoc, where } from "firebase/firestore";
import type { NavLink } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link as LinkIcon, Trash, Edit, Plus, Minus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "./ui/skeleton";


const EditLinkForm = ({ link, onUpdateSuccess, closeDialog }: { link: NavLink, onUpdateSuccess: () => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState(link.title);
    const [url, setUrl] = useState(link.url);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();
    const db = getFirebaseFirestore();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const linkRef = doc(db, 'navLinks', link.id);
            await updateDoc(linkRef, { title, url });
            toast({ title: "Link updated!" });
            onUpdateSuccess();
            closeDialog();
        } catch (error) {
            toast({ variant: 'destructive', title: "Update failed", description: "Could not update the link." });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="edit-link-title">Link Title</Label>
                <Input id="edit-link-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-link-url">URL</Label>
                <Input id="edit-link-url" value={url} onChange={(e) => setUrl(e.target.value)} required />
            </div>
            <div className="flex justify-end gap-2 pt-4">
                 <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </div>
        </form>
    );
}

export default function LinkManager() {
    const [links, setLinks] = useState<NavLink[]>([]);
    const [newLink, setNewLink] = useState({ title: '', url: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingLink, setEditingLink] = useState<NavLink | null>(null);
    const { toast } = useToast();
    const db = getFirebaseFirestore();

    const fetchLinks = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "navLinks"), orderBy("order", "asc"));
            const querySnapshot = await getDocs(q);
            const linksList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as NavLink));
            setLinks(linksList);
        } catch (error) {
             console.error("Error fetching links: ", error);
            toast({ 
                variant: 'destructive', 
                title: 'Error fetching links',
                description: 'Could not retrieve navigation links. Please check your Firestore security rules.'
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast, db]);

    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    const handleAddLink = async (e: FormEvent) => {
        e.preventDefault();
        if (!newLink.title.trim() || !newLink.url.trim()) {
            toast({ variant: 'destructive', title: 'Title and URL cannot be empty.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const maxOrder = links.reduce((max, link) => Math.max(max, link.order || 0), -1);
            await addDoc(collection(db, "navLinks"), {
                ...newLink,
                order: maxOrder + 1,
                createdAt: serverTimestamp(),
            });
            setNewLink({ title: '', url: '' });
            toast({ title: 'Link Added' });
            fetchLinks();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error adding link' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteLink = async (linkId: string) => {
        try {
            await deleteDoc(doc(db, "navLinks", linkId));
            toast({ title: 'Link Removed' });
            fetchLinks();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error removing link' });
        }
    };

    const handleUpdateOrder = async (link: NavLink, change: number) => {
        const newOrder = (link.order || 0) + change;
        if (newOrder < 0) return; // Prevent negative order

        const linkRef = doc(db, 'navLinks', link.id);
        
        try {
            // Check if another link already has the target order
            const otherLinkQuery = query(collection(db, "navLinks"), where("order", "==", newOrder));
            const otherLinkSnapshot = await getDocs(otherLinkQuery);

            const batch = updateDoc(linkRef, { order: newOrder });

            // If there's a conflict, swap the orders
            if (!otherLinkSnapshot.empty) {
                const otherLinkRef = otherLinkSnapshot.docs[0].ref;
                await Promise.all([batch, updateDoc(otherLinkRef, { order: link.order || 0 })]);
            } else {
                await batch;
            }

            // Refetch to update UI with correct order
            fetchLinks();

        } catch (error) {
            toast({ variant: 'destructive', title: 'Error updating order' });
            console.error(error);
        }
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Manage Navigation Links</CardTitle>
                <CardDescription>Add or remove links that appear in the main website header.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleAddLink} className="flex flex-col sm:flex-row items-end gap-2 mb-4">
                    <div className="flex-grow w-full space-y-2">
                        <Label htmlFor="link-title">Link Title</Label>
                        <Input id="link-title" placeholder="e.g., Courses" value={newLink.title} onChange={e => setNewLink(prev => ({...prev, title: e.target.value}))} disabled={isSubmitting} />
                    </div>
                    <div className="flex-grow w-full space-y-2">
                        <Label htmlFor="link-url">URL</Label>
                        <Input id="link-url" placeholder="e.g., /courses or https://..." value={newLink.url} onChange={e => setNewLink(prev => ({...prev, url: e.target.value}))} disabled={isSubmitting} />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Link"}
                    </Button>
                </form>
                 <div className="space-y-2 rounded-md border p-2 max-h-96 overflow-y-auto">
                    {isLoading ? (
                        Array.from({length: 2}).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                    ) : links.map(link => (
                        <div key={link.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateOrder(link, -1)}><Plus className="h-4 w-4 rotate-90" /></Button>
                                    <span className="text-sm font-mono">{link.order}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateOrder(link, 1)}><Minus className="h-4 w-4 rotate-90" /></Button>
                                </div>
                                <div>
                                    <p className="font-medium">{link.title}</p>
                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:underline">{link.url}</a>
                                </div>
                            </div>
                             <div className="flex items-center">
                                <Button variant="ghost" size="icon" onClick={() => setEditingLink(link)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon"><Trash className="h-4 w-4 text-destructive" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will permanently delete the link "{link.title}".</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteLink(link.id)}>Continue</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    ))}
                 </div>
            </CardContent>

             <Dialog open={!!editingLink} onOpenChange={(isOpen) => !isOpen && setEditingLink(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Link</DialogTitle>
                        <DialogDescription id="edit-link-desc">
                            Update the title or URL for this navigation link.
                        </DialogDescription>
                    </DialogHeader>
                    {editingLink && (
                        <EditLinkForm 
                            link={editingLink}
                            onUpdateSuccess={fetchLinks}
                            closeDialog={() => setEditingLink(null)}
                        />
                    )}
                </DialogContent>
             </Dialog>
        </Card>
    );
}
