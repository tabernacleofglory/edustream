
"use client";

import { useState, useEffect, useCallback, FormEvent, ChangeEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Award, Upload, Loader2, Edit, Trash, Eye, AlertTriangle } from "lucide-react";
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface StoredLogo {
    id: string;
    title: string;
    url: string;
    path: string;
}

const LogoUploadForm = ({ user, onUploadSuccess, closeDialog }: { user: User | null, onUploadSuccess: (newLogo: StoredLogo) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { toast } = useToast();

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (file) {
            const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
            if (!validTypes.includes(file.type)) {
                toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a PNG, JPG, or SVG file.' });
                return;
            }
            setLogoFile(file);
            const fileName = file.name;
            const lastDot = fileName.lastIndexOf('.');
            const titleWithoutExtension = lastDot > -1 ? fileName.substring(0, lastDot) : fileName;
            setTitle(titleWithoutExtension);
        } else {
            setTitle('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!logoFile || !title) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a logo file and provide a title.' });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const logoPath = `contents/logos/${uuidv4()}-${logoFile.name}`;
            const storageRef = ref(storage, logoPath);
            const uploadTask = uploadBytesResumable(storageRef, logoFile);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Upload error:", error);
                    toast({ variant: 'destructive', title: "Upload Failed", description: `An error occurred: ${error.code}. Please try again.` });
                    setIsUploading(false);
                },
                async () => {
                    const logoUrl = await getDownloadURL(uploadTask.snapshot.ref);

                    const docRef = await addDoc(collection(db, 'Contents'), {
                        title: title,
                        url: logoUrl,
                        path: logoPath,
                        'File name': logoFile.name,
                        Size: logoFile.size,
                        Type: "logo",
                        createdAt: serverTimestamp(),
                        uploaderId: user?.uid,
                        uploaderName: user?.displayName,
                    });

                    const newLogo: StoredLogo = { id: docRef.id, title, url: logoUrl, path: logoPath };
                    toast({ title: "Logo uploaded successfully!" });
                    onUploadSuccess(newLogo);
                    closeDialog();
                }
            );
        } catch (error) {
            console.error("Upload error:", error);
            toast({ variant: 'destructive', title: "Upload Failed", description: "An unexpected error occurred while saving the logo." });
            setIsUploading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="logo-file">Logo File (PNG, JPG, SVG)</Label>
                <Input id="logo-file" type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={handleFileChange} required disabled={isUploading} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="logo-title">Logo Title</Label>
                <Input id="logo-title" value={title} onChange={e => setTitle(e.target.value)} required disabled={isUploading} />
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

const LogoEditForm = ({ logo, onUpdateSuccess, closeDialog }: { logo: StoredLogo, onUpdateSuccess: (updatedLogo: StoredLogo) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState(logo.title);
    const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const logoDocRef = doc(db, 'Contents', logo.id);
            let logoUrl = logo.url;
            let logoPath = logo.path;

            if (newLogoFile) {
                const oldLogoRef = ref(storage, logo.path);
                try {
                   await deleteObject(oldLogoRef)
                } catch(err: any) {
                    if (err.code !== 'storage/object-not-found') {
                        throw err;
                    }
                    console.warn("Old logo file not found, continuing with upload.");
                }

                logoPath = `contents/logos/${uuidv4()}-${newLogoFile.name}`;
                const newLogoRef = ref(storage, logoPath);
                await uploadBytes(newLogoRef, newLogoFile);
                logoUrl = await getDownloadURL(newLogoRef);
            }

            await updateDoc(logoDocRef, { title, url: logoUrl, path: logoPath });

            toast({ title: "Logo updated successfully!" });
            onUpdateSuccess({ ...logo, title, url: logoUrl, path: logoPath });
            closeDialog();

        } catch (error: any) {
             toast({ variant: "destructive", title: "Update Failed", description: error.message || "An unexpected error occurred." });
             console.error("Update error: ", error);
        } finally {
            setIsUpdating(false);
        }
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="edit-logo-title">Logo Title</Label>
                <Input id="edit-logo-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
             <div className="space-y-2">
                <Label htmlFor="edit-logo-file">Replace Logo (Optional)</Label>
                <Input id="edit-logo-file" type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={e => setNewLogoFile(e.target.files?.[0] || null)} />
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


export default function LogosPage() {
  const { user, hasPermission } = useAuth();
  const [logos, setLogos] = useState<StoredLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingLogo, setEditingLogo] = useState<StoredLogo | null>(null);
  const [previewLogo, setPreviewLogo] = useState<StoredLogo | null>(null);
  const { toast } = useToast();
  
  const canManageContent = hasPermission('manageContent');

  const fetchLogos = useCallback(async () => {
    setLoading(true);
    try {
        const q = query(collection(db, 'Contents'), where("Type", "==", "logo"));
        const querySnapshot = await getDocs(q);
        const logosList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredLogo));
        setLogos(logosList);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Failed to Fetch Logos', description: error.message });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [toast, db]);
  
  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);
  
  const handleUploadSuccess = (newLogo: StoredLogo) => {
    setLogos(prev => [newLogo, ...prev].sort((a,b) => a.title.localeCompare(b.title)));
    setIsUploadDialogOpen(false);
  }

  const handleUpdateSuccess = (updatedLogo: StoredLogo) => {
      setLogos(prev => prev.map(img => img.id === updatedLogo.id ? updatedLogo : img));
      setEditingLogo(null);
  }
  
  const handleDelete = async (logo: StoredLogo) => {
      if (!window.confirm(`Are you sure you want to delete "${logo.title}"? This cannot be undone.`)) return;
      
      try {
          const logoRef = ref(storage, logo.path);
          try {
              await deleteObject(logoRef);
          } catch (error: any) {
              if (error.code !== 'storage/object-not-found') {
                  throw error; 
              }
              console.warn(`Logo file at path ${logo.path} not found in Storage. It might have been deleted manually.`);
          }

          await deleteDoc(doc(db, 'Contents', logo.id));

          setLogos(prev => prev.filter(img => img.id !== logo.id));
          toast({ title: "Logo deleted successfully." });
      } catch (error: any) {
           toast({ variant: 'destructive', title: "Delete Failed", description: error.message || "Could not delete the logo." });
           console.error("Delete error: ", error);
      }
  }

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Logos
        </h1>
        <p className="text-muted-foreground">
          Manage logos for certificates and branding.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Logo Management</CardTitle>
          {canManageContent && (
             <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New Logo
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload a new logo</DialogTitle>
                        <DialogDescription>
                            The logo will be added to the library for use in certificates.
                        </DialogDescription>
                    </DialogHeader>
                    <LogoUploadForm user={user} onUploadSuccess={handleUploadSuccess} closeDialog={() => setIsUploadDialogOpen(false)} />
                </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
            {!canManageContent && !loading && (
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>You do not have permission to manage content.</AlertDescription>
                </Alert>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square w-full" />
                    ))
                ) : logos.length > 0 ? (
                    logos.map((logo) => (
                        <div key={logo.id} className="group relative aspect-square cursor-pointer" onClick={() => setPreviewLogo(logo)}>
                            <Image src={logo.url} alt={logo.title} fill style={{objectFit:"contain"}} className="rounded-lg p-2 bg-muted" />
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2 pr-4">
                                <Button size="icon" variant="secondary" onClick={(e) => handleActionClick(e, () => setPreviewLogo(logo))}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                                {canManageContent && (
                                    <>
                                        <Button size="icon" className="text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500" onClick={(e) => handleActionClick(e, () => setEditingLogo(logo))}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="destructive" onClick={(e) => handleActionClick(e, () => handleDelete(logo))}>
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                            <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">{logo.title}</p>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-12 flex flex-col items-center">
                        <Award className="h-12 w-12" />
                        <p className="mt-4">No logos in the library. Upload one to get started.</p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingLogo} onOpenChange={(isOpen) => !isOpen && setEditingLogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Logo</DialogTitle>
            <DialogDescription>Update the details for this logo.</DialogDescription>
          </DialogHeader>
          {editingLogo && canManageContent && (
            <LogoEditForm 
              logo={editingLogo} 
              onUpdateSuccess={handleUpdateSuccess} 
              closeDialog={() => setEditingLogo(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewLogo} onOpenChange={(isOpen) => !isOpen && setPreviewLogo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{previewLogo?.title}</DialogTitle>
          </DialogHeader>
          {previewLogo && (
            <div className="relative aspect-square">
              <Image src={previewLogo.url} alt={previewLogo.title} fill style={{objectFit:"contain"}} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
