
"use client";

import { useState, useEffect, useCallback, FormEvent, MouseEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Award, Upload, Loader2, Edit, Trash, Eye, Image as ImageIcon } from "lucide-react";
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/lib/types";
import { Progress } from "@/components/ui/progress";

interface CertificateBackground {
    id: string;
    title: string;
    url: string;
    path: string;
}

const BackgroundUploadForm = ({ user, onUploadSuccess, closeDialog }: { user: User | null, onUploadSuccess: (newCert: CertificateBackground) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!imageFile || !title) {
            toast({ variant: 'destructive', title: 'Please fill all fields' });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        
        try {
            const imagePath = `certificate-backgrounds/${uuidv4()}-${imageFile.name}`;
            const imageRef = ref(storage, imagePath);
            const uploadTask = uploadBytesResumable(imageRef, imageFile);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Upload error:", error);
                    toast({ variant: 'destructive', title: "Upload failed" });
                    setIsUploading(false);
                },
                async () => {
                    const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);

                    const docRef = await addDoc(collection(db, 'certificates'), {
                        title: title,
                        url: imageUrl,
                        path: imagePath,
                        fileName: imageFile.name,
                        size: imageFile.size,
                        createdAt: serverTimestamp(),
                        uploaderId: user?.uid,
                        uploaderName: user?.displayName,
                    });

                    const newCert: CertificateBackground = { id: docRef.id, title, url: imageUrl, path: imagePath };
                    toast({ title: "Certificate background uploaded successfully!" });
                    onUploadSuccess(newCert);
                    closeDialog();
                    setIsUploading(false);
                }
            );
        } catch (error) {
            console.error("Upload error:", error);
            toast({ variant: 'destructive', title: "Upload failed" });
            setIsUploading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="cert-title">Background Title</Label>
                <Input id="cert-title" value={title} onChange={e => setTitle(e.target.value)} required disabled={isUploading} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="cert-file">Background Image</Label>
                <Input id="cert-file" type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} required disabled={isUploading} />
            </div>
            {isUploading && <Progress value={uploadProgress} className="w-full" />}
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={closeDialog} disabled={isUploading}>Cancel</Button>
                <Button type="submit" disabled={isUploading}>
                    {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload'}
                </Button>
            </DialogFooter>
        </form>
    );
}

const BackgroundEditForm = ({ certificate, onUpdateSuccess, closeDialog }: { certificate: CertificateBackground, onUpdateSuccess: (updatedCert: CertificateBackground) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState(certificate.title);
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const certDocRef = doc(db, 'certificates', certificate.id);
            let imageUrl = certificate.url;
            let imagePath = certificate.path;

            if (newImageFile) {
                // Delete old image if it exists
                if (certificate.path) {
                    const oldImageRef = ref(storage, certificate.path);
                    await deleteObject(oldImageRef).catch(err => console.warn("Old image not found, could not delete.", err));
                }

                // Upload new image
                imagePath = `certificate-backgrounds/${uuidv4()}-${newImageFile.name}`;
                const newImageRef = ref(storage, imagePath);
                await uploadBytes(newImageRef, newImageFile);
                imageUrl = await getDownloadURL(newImageRef);
            }

            await updateDoc(certDocRef, { 
                title, 
                url: imageUrl, 
                path: imagePath,
                ...(newImageFile && { fileName: newImageFile.name, size: newImageFile.size })
            });

            toast({ title: "Background updated!" });
            onUpdateSuccess({ ...certificate, title, url: imageUrl, path: imagePath });
            closeDialog();

        } catch (error) {
             toast({ variant: 'destructive', title: "Update failed", description: "Could not update the background details." });
             console.error("Update error: ", error);
        } finally {
            setIsUpdating(false);
        }
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="edit-cert-title">Background Title</Label>
                <Input id="edit-cert-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-cert-file">Replace Background Image (Optional)</Label>
                <Input id="edit-cert-file" type="file" accept="image/*" onChange={e => setNewImageFile(e.target.files?.[0] || null)} />
            </div>
            <DialogFooter>
                 <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </form>
    );
}

export default function CertificateBackgroundsPage() {
  const { user, isCurrentUserAdmin } = useAuth();
  const [backgrounds, setBackgrounds] = useState<CertificateBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingBackground, setEditingBackground] = useState<CertificateBackground | null>(null);
  const [previewBackground, setPreviewBackground] = useState<CertificateBackground | null>(null);
  const { toast } = useToast();

  const fetchBackgrounds = useCallback(async () => {
    setLoading(true);
    try {
        const q = query(collection(db, 'certificates'));
        const querySnapshot = await getDocs(q);
        const certsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CertificateBackground));
        setBackgrounds(certsList);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to fetch certificate backgrounds.' });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchBackgrounds();
  }, [fetchBackgrounds]);
  
  const handleUploadSuccess = (newCert: CertificateBackground) => {
    setBackgrounds(prev => [newCert, ...prev]);
    setIsUploadDialogOpen(false);
  }

  const handleUpdateSuccess = (updatedCert: CertificateBackground) => {
      setBackgrounds(prev => prev.map(cert => cert.id === updatedCert.id ? updatedCert : cert));
      setEditingBackground(null);
  }
  
  const handleDelete = async (certificate: CertificateBackground) => {
      if (!window.confirm("Are you sure you want to delete this background?")) return;
      
      try {
          const imageRef = ref(storage, certificate.path);
          await deleteObject(imageRef);
          await deleteDoc(doc(db, 'certificates', certificate.id));
          setBackgrounds(prev => prev.filter(cert => cert.id !== certificate.id));
          toast({ title: "Background deleted successfully." });
      } catch (error) {
           toast({ variant: 'destructive', title: "Delete failed.", description: "Could not delete the background." });
           console.error("Delete error: ", error);
      }
  }

  const handleActionClick = (e: MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Certificate Backgrounds
        </h1>
        <p className="text-muted-foreground">
          Manage background images for certificates.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Certificate Backgrounds</CardTitle>
          {isCurrentUserAdmin && (
             <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New Background
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload a new background</DialogTitle>
                        <DialogDescription>
                            The background will be available to assign to courses.
                        </DialogDescription>
                    </DialogHeader>
                    <BackgroundUploadForm user={user} onUploadSuccess={handleUploadSuccess} closeDialog={() => setIsUploadDialogOpen(false)} />
                </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-video w-full" />
                    ))
                ) : backgrounds.length > 0 ? (
                    backgrounds.map(cert => (
                        <div key={cert.id} className="group relative aspect-video cursor-pointer" onClick={() => setPreviewBackground(cert)}>
                            <Image src={cert.url || "https://placehold.co/600x400.png"} alt={cert.title || "Certificate background"} fill style={{objectFit:"cover"}} className="rounded-lg" />
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2 pr-4">
                                <Button size="icon" variant="secondary" onClick={(e) => handleActionClick(e, () => setPreviewBackground(cert))}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                                {isCurrentUserAdmin && (
                                    <>
                                        <Button size="icon" className="text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500" onClick={(e) => handleActionClick(e, () => setEditingBackground(cert))}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="destructive" onClick={(e) => handleActionClick(e, () => handleDelete(cert))}>
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                            <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">{cert.title}</p>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-12 flex flex-col items-center">
                        <ImageIcon className="h-12 w-12" />
                        <p className="mt-4">No certificate backgrounds in the library. Upload one to get started.</p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingBackground} onOpenChange={(isOpen) => !isOpen && setEditingBackground(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Background</DialogTitle>
            <DialogDescription>Update the title for this background.</DialogDescription>
          </DialogHeader>
          {editingBackground && (
            <BackgroundEditForm 
              certificate={editingBackground} 
              onUpdateSuccess={handleUpdateSuccess} 
              closeDialog={() => setEditingBackground(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewBackground} onOpenChange={(isOpen) => !isOpen && setPreviewBackground(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewBackground?.title}</DialogTitle>
          </DialogHeader>
          {previewBackground && (
            <div className="relative aspect-video">
              <Image src={previewBackground.url} alt={previewBackground.title || 'Certificate Preview'} fill style={{objectFit:"contain"}} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
