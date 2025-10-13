
"use client";

import { useState, useEffect, useCallback, FormEvent, MouseEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, doc, updateDoc, deleteDoc, writeBatch, where } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Megaphone, Upload, Loader2, Edit, Trash, Eye, Image as ImageIcon, Link2, Plus } from "lucide-react";
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import ImageLibrary from "@/components/image-library";
import { Switch } from "@/components/ui/switch";

interface Announcement {
    id: string;
    imageUrl: string;
    description: string;
    buttonText: string;
    buttonUrl: string;
    isActive: boolean;
    createdAt: any;
}

const AnnouncementForm = ({ 
    announcement, 
    onSuccess, 
    closeDialog 
}: { 
    announcement?: Announcement | null, 
    onSuccess: () => void, 
    closeDialog: () => void 
}) => {
    const [description, setDescription] = useState(announcement?.description || '');
    const [buttonText, setButtonText] = useState(announcement?.buttonText || '');
    const [buttonUrl, setButtonUrl] = useState(announcement?.buttonUrl || '');
    const [imageUrl, setImageUrl] = useState(announcement?.imageUrl || '');
    const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!imageUrl || !description || !buttonText || !buttonUrl) {
            toast({ variant: 'destructive', title: 'Please fill all fields' });
            return;
        }
        setIsSubmitting(true);
        
        try {
            const data = {
                imageUrl,
                description,
                buttonText,
                buttonUrl,
                isActive: announcement?.isActive || false, // Preserve active state on edit
                updatedAt: serverTimestamp(),
            };

            if (announcement) {
                // Editing
                const docRef = doc(db, 'announcements', announcement.id);
                await updateDoc(docRef, data);
                toast({ title: "Announcement updated successfully!" });
            } else {
                // Creating
                await addDoc(collection(db, 'announcements'), {
                    ...data,
                    createdAt: serverTimestamp(),
                    creatorId: user?.uid,
                });
                toast({ title: "Announcement created successfully!" });
            }
            
            onSuccess();
            closeDialog();
        } catch (error) {
            console.error("Error saving announcement:", error);
            toast({ variant: 'destructive', title: "Save failed" });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleImageSelect = (image: { url: string }) => {
        setImageUrl(image.url);
        setIsImageLibraryOpen(false);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label>Banner Image</Label>
                <div 
                    className="aspect-video w-full relative bg-muted rounded-lg flex items-center justify-center cursor-pointer border-2 border-dashed hover:border-primary"
                    onClick={() => setIsImageLibraryOpen(true)}
                >
                    {imageUrl ? (
                        <Image src={imageUrl} alt="Announcement Banner" layout="fill" objectFit="cover" className="rounded-lg" />
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <ImageIcon className="mx-auto h-8 w-8" />
                            <p>Select an Image</p>
                        </div>
                    )}
                </div>
                <Dialog open={isImageLibraryOpen} onOpenChange={setIsImageLibraryOpen}>
                     <ImageLibrary onSelectImage={handleImageSelect} selectedImageUrl={imageUrl} />
                </Dialog>
            </div>
            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required disabled={isSubmitting} placeholder="e.g., New course available now! Enroll today." />
            </div>
             <div className="space-y-2">
                <Label htmlFor="buttonText">Button Text</Label>
                <Input id="buttonText" value={buttonText} onChange={e => setButtonText(e.target.value)} required disabled={isSubmitting} placeholder="e.g., Learn More" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="buttonUrl">Button URL</Label>
                <Input id="buttonUrl" value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} required disabled={isSubmitting} placeholder="/courses or https://..." />
            </div>
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={closeDialog} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {announcement ? 'Save Changes' : 'Create Announcement'}
                </Button>
            </DialogFooter>
        </form>
    );
}

export default function AnnouncementsPage() {
  const { hasPermission } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const { toast } = useToast();

  const canManage = hasPermission('manageContent');

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
        const q = query(collection(db, 'announcements'));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
        setAnnouncements(list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to fetch announcements.' });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleSuccess = () => {
    fetchAnnouncements();
    setIsFormOpen(false);
    setEditingAnnouncement(null);
  }
  
  const handleDelete = async (announcement: Announcement) => {
      if (!window.confirm("Are you sure you want to delete this announcement?")) return;
      
      try {
          await deleteDoc(doc(db, 'announcements', announcement.id));
          // Note: This does not delete the image from storage, as it might be used elsewhere.
          setAnnouncements(prev => prev.filter(item => item.id !== announcement.id));
          toast({ title: "Announcement deleted successfully." });
      } catch (error) {
           toast({ variant: 'destructive', title: "Delete failed.", description: "Could not delete the announcement." });
           console.error("Delete error: ", error);
      }
  }

  const handleToggleActive = async (announcement: Announcement, isActive: boolean) => {
    const batch = writeBatch(db);

    // Deactivate all other announcements
    const q = query(collection(db, 'announcements'), where('isActive', '==', true));
    const activeDocs = await getDocs(q);
    activeDocs.forEach(doc => {
        if (doc.id !== announcement.id) {
            batch.update(doc.ref, { isActive: false });
        }
    });

    // Set the new active state for the target announcement
    const docRef = doc(db, 'announcements', announcement.id);
    batch.update(docRef, { isActive });
    
    try {
        await batch.commit();
        toast({ title: "Announcement status updated." });
        fetchAnnouncements(); // Refetch to update UI state
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to update status.' });
        console.error("Error toggling active state: ", error);
    }
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setIsFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Announcements
        </h1>
        <p className="text-muted-foreground">
          Manage promotional announcements for the dashboard.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Announcement Management</CardTitle>
          {canManage && (
             <Button onClick={() => { setEditingAnnouncement(null); setIsFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Create New
            </Button>
          )}
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {loading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                            <Skeleton className="h-20 w-32" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                            <Skeleton className="h-8 w-24" />
                        </div>
                    ))
                ) : announcements.length > 0 ? (
                    announcements.map(item => (
                        <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border p-4">
                            <Image src={item.imageUrl} alt={item.description} width={128} height={72} className="aspect-video object-cover rounded-md" />
                            <div className="flex-1">
                                <p className="font-medium">{item.description}</p>
                                <a href={item.buttonUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
                                    <Link2 className="h-3 w-3" />
                                    {item.buttonText} ({item.buttonUrl})
                                </a>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id={`active-switch-${item.id}`}
                                        checked={item.isActive}
                                        onCheckedChange={(checked) => handleToggleActive(item, checked)}
                                        disabled={!canManage}
                                    />
                                    <Label htmlFor={`active-switch-${item.id}`}>Active</Label>
                                </div>
                               {canManage && (
                                 <>
                                    <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="destructive" onClick={() => handleDelete(item)}>
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                 </>
                               )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-12 flex flex-col items-center">
                        <Megaphone className="h-12 w-12" />
                        <p className="mt-4">No announcements found. Create one to get started.</p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}</DialogTitle>
          </DialogHeader>
          <AnnouncementForm
            announcement={editingAnnouncement}
            onSuccess={handleSuccess}
            closeDialog={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

    