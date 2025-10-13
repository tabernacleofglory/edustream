
"use client";

import { useState, useEffect, useCallback, FormEvent, MouseEvent } from "react";
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
import { Image as ImageIcon, Upload, Loader2, Edit, Trash, Eye } from "lucide-react";
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/lib/types";
import { Progress } from "@/components/ui/progress";

interface StoredImage {
    id: string;
    title: string;
    url: string;
    path: string;
}

const ImageUploadForm = ({ user, onUploadSuccess, closeDialog }: { user: User | null, onUploadSuccess: (newImage: StoredImage) => void, closeDialog: () => void }) => {
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
            const imagePath = `contents/images/${uuidv4()}-${imageFile.name}`;
            const storageRef = ref(storage, imagePath);
            const uploadTask = uploadBytesResumable(storageRef, imageFile);

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

                    const docRef = await addDoc(collection(db, 'Contents'), {
                        title: title,
                        url: imageUrl,
                        path: imagePath,
                        'File name': imageFile.name,
                        Size: imageFile.size,
                        Type: "image",
                        createdAt: serverTimestamp(),
                        uploaderId: user?.uid,
                        uploaderName: user?.displayName,
                    });

                    const newImage: StoredImage = { id: docRef.id, title, url: imageUrl, path: imagePath };
                    toast({ title: "Image uploaded successfully!" });
                    onUploadSuccess(newImage);
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
                <Label htmlFor="image-title">Image Title</Label>
                <Input id="image-title" value={title} onChange={e => setTitle(e.target.value)} required disabled={isUploading} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="image-file">Image File</Label>
                <Input id="image-file" type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} required disabled={isUploading} />
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

const ImageEditForm = ({ image, onUpdateSuccess, closeDialog }: { image: StoredImage, onUpdateSuccess: (updatedImage: StoredImage) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState(image.title);
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const imageDocRef = doc(db, 'Contents', image.id);
            let imageUrl = image.url;
            let imagePath = image.path;

            if (newImageFile) {
                // Delete old image
                const oldImageRef = ref(storage, image.path);
                await deleteObject(oldImageRef).catch(err => console.warn("Old image not found, could not delete.", err));

                // Upload new image
                imagePath = `contents/images/${uuidv4()}-${newImageFile.name}`;
                const newImageRef = ref(storage, imagePath);
                await uploadBytes(newImageRef, newImageFile);
                imageUrl = await getDownloadURL(newImageRef);
            }

            await updateDoc(imageDocRef, { title, url: imageUrl, path: imagePath });

            toast({ title: "Image updated!" });
            onUpdateSuccess({ ...image, title, url: imageUrl, path: imagePath });
            closeDialog();

        } catch (error) {
             toast({ variant: 'destructive', title: "Update failed", description: "Could not update the image details." });
             console.error("Update error: ", error);
        } finally {
            setIsUpdating(false);
        }
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="edit-image-title">Image Title</Label>
                <Input id="edit-image-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
             <div className="space-y-2">
                <Label htmlFor="edit-image-file">Replace Image (Optional)</Label>
                <Input id="edit-image-file" type="file" accept="image/*" onChange={e => setNewImageFile(e.target.files?.[0] || null)} />
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


export default function ImagesPage() {
  const { user, isCurrentUserAdmin } = useAuth();
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<StoredImage | null>(null);
  const [previewImage, setPreviewImage] = useState<StoredImage | null>(null);
  const { toast } = useToast();

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
        const q = query(collection(db, 'Contents'), where("Type", "==", "image"));
        const querySnapshot = await getDocs(q);
        const imagesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredImage));
        setImages(imagesList);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to fetch images.' });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchImages();
  }, [fetchImages]);
  
  const handleUploadSuccess = (newImage: StoredImage) => {
    setImages(prev => [newImage, ...prev]);
    setIsUploadDialogOpen(false);
  }

  const handleUpdateSuccess = (updatedImage: StoredImage) => {
      setImages(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img));
      setEditingImage(null);
  }
  
  const handleDelete = async (image: StoredImage) => {
      if (!window.confirm("Are you sure you want to delete this image? This cannot be undone.")) return;
      
      try {
          // Delete from storage
          const imageRef = ref(storage, image.path);
          await deleteObject(imageRef);

          // Delete from firestore
          await deleteDoc(doc(db, 'Contents', image.id));

          setImages(prev => prev.filter(img => img.id !== image.id));
          toast({ title: "Image deleted successfully." });
      } catch (error) {
           toast({ variant: 'destructive', title: "Delete failed.", description: "Could not delete the image." });
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
          Content Library - Images
        </h1>
        <p className="text-muted-foreground">
          Manage all images on the platform.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Image Management</CardTitle>
          {isCurrentUserAdmin && (
             <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New Image
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload a new image</DialogTitle>
                        <DialogDescription>
                            The image will be added to the library.
                        </DialogDescription>
                    </DialogHeader>
                    <ImageUploadForm user={user} onUploadSuccess={handleUploadSuccess} closeDialog={() => setIsUploadDialogOpen(false)} />
                </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square w-full" />
                    ))
                ) : images.length > 0 ? (
                    images.map(image => (
                        <div key={image.id} className="group relative aspect-square cursor-pointer" onClick={() => setPreviewImage(image)}>
                            <Image src={image.url} alt={image.title} fill style={{objectFit:"cover"}} className="rounded-lg" />
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2 pr-4">
                                <Button size="icon" variant="secondary" onClick={(e) => handleActionClick(e, () => setPreviewImage(image))}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                                {isCurrentUserAdmin && (
                                    <>
                                        <Button size="icon" className="text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500" onClick={(e) => handleActionClick(e, () => setEditingImage(image))}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="destructive" onClick={(e) => handleActionClick(e, () => handleDelete(image))}>
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                            <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">{image.title}</p>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-12 flex flex-col items-center">
                        <ImageIcon className="h-12 w-12" />
                        <p className="mt-4">No images in the library. Upload one to get started.</p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingImage} onOpenChange={(isOpen) => !isOpen && setEditingImage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
            <DialogDescription>Update the details for this image.</DialogDescription>
          </DialogHeader>
          {editingImage && (
            <ImageEditForm 
              image={editingImage} 
              onUpdateSuccess={handleUpdateSuccess} 
              closeDialog={() => setEditingImage(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(isOpen) => !isOpen && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewImage?.title}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative aspect-video">
              <Image src={previewImage.url} alt={previewImage.title} fill style={{objectFit:"contain"}} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
