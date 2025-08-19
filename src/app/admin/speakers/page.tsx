
"use client";

import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, doc, updateDoc, deleteDoc, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Edit, Trash, UploadCloud, UserRound } from "lucide-react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import type { Speaker } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const SpeakerForm = ({
  speaker,
  onSuccess,
  closeDialog,
}: {
  speaker?: Speaker;
  onSuccess: () => void;
  closeDialog: () => void;
}) => {
  const [name, setName] = useState(speaker?.name || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(speaker?.photoURL || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Speaker name is required.' });
      return;
    }
    if (!speaker && !photoFile) {
        toast({ variant: 'destructive', title: 'Speaker photo is required for a new speaker.' });
        return;
    }

    setIsSubmitting(true);
    try {
      let photoURL = speaker?.photoURL || '';
      
      if (photoFile) {
        if (speaker?.photoURL) {
          const oldPhotoRef = ref(storage, speaker.photoURL);
          await deleteObject(oldPhotoRef).catch(err => console.warn("Old photo not found, could not delete.", err));
        }
        const filePath = `speakers/${uuidv4()}-${photoFile.name}`;
        const newPhotoRef = ref(storage, filePath);
        await uploadBytesResumable(newPhotoRef, photoFile);
        photoURL = await getDownloadURL(newPhotoRef);
      }

      if (speaker) {
        const speakerRef = doc(db, 'speakers', speaker.id);
        await updateDoc(speakerRef, { name, photoURL });
        toast({ title: 'Speaker updated successfully!' });
      } else {
        await addDoc(collection(db, 'speakers'), {
          name,
          photoURL,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Speaker added successfully!' });
      }
      onSuccess();
      closeDialog();

    } catch (error) {
      console.error('Error saving speaker:', error);
      toast({ variant: 'destructive', title: 'Failed to save speaker.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="speaker-name">Speaker Name</Label>
        <Input id="speaker-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="speaker-photo">Speaker Photo</Label>
        {photoPreview && <Image src={photoPreview} alt="Speaker preview" width={80} height={80} className="rounded-full object-cover" />}
        <Input id="speaker-photo" type="file" accept="image/*" onChange={handleFileChange} disabled={isSubmitting} />
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={closeDialog} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {speaker ? 'Save Changes' : 'Add Speaker'}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default function SpeakersPage() {
  const { hasPermission } = useAuth();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const { toast } = useToast();

  const fetchSpeakers = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'speakers'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const speakerList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Speaker));
      setSpeakers(speakerList);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to fetch speakers.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSpeakers();
  }, [fetchSpeakers]);

  const handleDelete = async (speaker: Speaker) => {
    try {
      if (speaker.photoURL) {
        const photoRef = ref(storage, speaker.photoURL);
        await deleteObject(photoRef).catch(err => console.warn('Old photo not found, could not delete.', err));
      }
      await deleteDoc(doc(db, 'speakers', speaker.id));
      toast({ title: 'Speaker deleted successfully.' });
      fetchSpeakers();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to delete speaker.' });
    }
  };

  const handleOpenForm = (speaker?: Speaker) => {
    setEditingSpeaker(speaker || null);
    setIsFormOpen(true);
  };
  
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">Content - Speakers</h1>
        <p className="text-muted-foreground">Manage course speakers and their profiles.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Speakers</CardTitle>
          {hasPermission('manageContent') && (
            <Button onClick={() => handleOpenForm()}>
              <Plus className="mr-2 h-4 w-4" /> Add New Speaker
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))
            ) : speakers.length > 0 ? (
              speakers.map(speaker => (
                <div key={speaker.id} className="group relative flex items-center gap-4 rounded-lg border p-4">
                  <Image src={speaker.photoURL} alt={speaker.name} width={64} height={64} className="rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="font-semibold">{speaker.name}</p>
                    {hasPermission('manageContent') && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleOpenForm(speaker)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="destructive" className="h-7 w-7">
                              <Trash className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This action will permanently delete {speaker.name}.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(speaker)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-muted-foreground py-12 flex flex-col items-center">
                <UserRound className="h-12 w-12" />
                <p className="mt-4">No speakers found. Add one to get started.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSpeaker ? 'Edit Speaker' : 'Add New Speaker'}</DialogTitle>
          </DialogHeader>
          <SpeakerForm 
            speaker={editingSpeaker || undefined} 
            onSuccess={() => {
              setIsFormOpen(false);
              fetchSpeakers();
            }}
            closeDialog={() => setIsFormOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
