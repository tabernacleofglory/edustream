
"use client";

import { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { ScrollArea } from './ui/scroll-area';
import { v4 as uuidv4 } from "uuid";
import type { User } from "@/lib/types";

interface StoredImage {
    id: string;
    title: string;
    url: string;
}

interface ImageLibraryProps {
    onSelectImage: (image: StoredImage) => void;
    selectedImageUrl?: string | null;
}

const ImageUploadForm = ({ user, onUploadSuccess, closeDialog }: { user: User | null, onUploadSuccess: (newImage: StoredImage) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { toast } = useToast();

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setImageFile(file);
        if (file) {
            // Extract filename without extension and set it as title
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

                    const newImage: StoredImage = { id: docRef.id, title, url: imageUrl };
                    toast({ title: "Image uploaded successfully!" });
                    onUploadSuccess(newImage);
                    closeDialog();
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
                <Label htmlFor="image-file">Image File</Label>
                <Input id="image-file" type="file" accept="image/*" onChange={handleFileChange} required disabled={isUploading} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="image-title">Image Title</Label>
                <Input id="image-title" value={title} onChange={e => setTitle(e.target.value)} required disabled={isUploading} />
            </div>
             {isUploading && <Progress value={uploadProgress} className="w-full" />}
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={closeDialog} disabled={isUploading}>Cancel</Button>
                <Button type="submit" disabled={isUploading}>
                    Upload
                </Button>
            </DialogFooter>
        </form>
    );
}

const ImageLibrary = ({ onSelectImage, selectedImageUrl }: ImageLibraryProps) => {
    const [images, setImages] = useState<StoredImage[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

    const fetchImages = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'Contents'), where("Type", "==", "image"));
            const querySnapshot = await getDocs(q);
            const imageList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredImage));
            setImages(imageList);
        } catch (error) {
            console.error("Failed to fetch images:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchImages();
    }, [fetchImages]);
    
    const handleUploadSuccess = (newImage: StoredImage) => {
        setImages(prev => [newImage, ...prev]);
        setIsUploadDialogOpen(false);
    };

    return (
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2">
                <DialogTitle>Image Library</DialogTitle>
                <DialogDescription>Select an image or upload a new one.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow px-6">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 py-4">
                    {loading ? (
                        Array.from({ length: 12 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-square w-full" />
                        ))
                    ) : (
                        images.map((image) => (
                            <div
                                key={image.id}
                                className="group relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 border-transparent hover:border-primary"
                                onClick={() => onSelectImage(image)}
                            >
                                <Image src={image.url} alt={image.title} fill style={{objectFit:"cover"}} className="transition-transform group-hover:scale-105" />
                                {selectedImageUrl === image.url && (
                                    <div className="absolute inset-0 bg-primary/70 flex items-center justify-center">
                                        <CheckCircle className="h-8 w-8 text-white" />
                                    </div>
                                )}
                                <div className={cn(
                                    "absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate transition-opacity",
                                    selectedImageUrl === image.url ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                )}>
                                    {image.title}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
             <DialogFooter className="p-6 border-t flex justify-end">
                <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Upload New
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
            </DialogFooter>
        </DialogContent>
    );
};

export default ImageLibrary;
