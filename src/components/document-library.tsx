
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getFirebaseFirestore, getFirebaseStorage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useDropzone } from 'react-dropzone';
import { Check, UploadCloud, X, Edit, FileText, FileType, FileImage, File as FileIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Label } from './ui/label';

interface Document {
    id: string;
    title: string;
    url: string;
    "File name": string;
    createdAt: any;
}

interface DocumentLibraryProps {
    onSelectDocuments: (docs: Document[]) => void;
    initialSelectedDocs: {id?: string}[];
}

interface UploadProgress {
    fileName: string;
    progress: number;
}

export default function DocumentLibrary({ onSelectDocuments, initialSelectedDocs }: DocumentLibraryProps) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedDocs, setSelectedDocs] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState<Document | null>(null);
    const [newTitle, setNewTitle] = useState("");
    const { toast } = useToast();
    const { user } = useAuth();
    const db = getFirebaseFirestore();
    const storage = getFirebaseStorage();
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setIsLoading(true);
        const q = query(
            collection(db, 'Contents'),
            where('Type', '==', 'document'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as Document));
            setDocuments(docData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db]);
    
    useEffect(() => {
        if (initialSelectedDocs && documents.length > 0) {
            const initialSelection = documents.filter(d => initialSelectedDocs.some(is => is.id === d.id));
            setSelectedDocs(initialSelection);
        }
    }, [initialSelectedDocs, documents]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Authentication Error' });
            return;
        }

        for (const file of acceptedFiles) {
            const fileName = file.name;
            const title = fileName.substring(0, fileName.lastIndexOf('.'));
            setUploadProgress(prev => [...prev, { fileName, progress: 0 }]);
            
            const storageRef = ref(storage, `documents/${user.uid}/${fileName}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(prev => prev.map(p => p.fileName === fileName ? { ...p, progress } : p));
                },
                (error) => {
                     toast({ variant: 'destructive', title: `Upload Failed for ${fileName}` });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    await addDoc(collection(db, 'Contents'), {
                        title: title,
                        "File name": fileName,
                        url: downloadURL,
                        Type: 'document',
                        createdAt: serverTimestamp(),
                        creatorId: user.uid,
                    });
                     setUploadProgress(prev => prev.filter(p => p.fileName !== fileName));
                }
            );
        }
        setIsUploadDialogOpen(false);
    }, [user, storage, db, toast]);
    
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'], 'application/msword': ['.doc', '.docx'], 'text/plain': ['.txt'] }});
    
    const toggleSelection = (doc: Document) => {
        setSelectedDocs(prev =>
            prev.some(d => d.id === doc.id)
                ? prev.filter(d => d.id !== doc.id)
                : [...prev, doc]
        );
    };
    
    const filteredDocs = useMemo(() => {
        if (!searchTerm) return documents;
        return documents.filter(doc =>
            doc.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [documents, searchTerm]);

    const handleConfirmSelection = () => {
        onSelectDocuments(selectedDocs);
    };

    const handleEdit = (doc: Document) => {
        setIsEditing(doc);
        setNewTitle(doc.title);
    };

    const handleUpdateTitle = async () => {
        if (!isEditing || !newTitle.trim()) return;
        const docRef = doc(db, 'Contents', isEditing.id);
        await updateDoc(docRef, { title: newTitle.trim() });
        toast({ title: "Document renamed" });
        setIsEditing(null);
        setNewTitle("");
    };

    const handleDelete = async (docId: string) => {
        if (window.confirm("Are you sure you want to delete this document?")) {
            await deleteDoc(doc(db, 'Contents', docId));
            toast({ title: "Document deleted" });
        }
    };
    
    const getFileIcon = (fileName?: string) => {
      if (!fileName) return <FileIcon className="h-8 w-8 text-muted-foreground" />;
      const extension = fileName.split('.').pop()?.toLowerCase();
      switch(extension) {
          case 'pdf': return <FileImage className="h-8 w-8 text-red-500" />;
          case 'doc': case 'docx': return <FileType className="h-8 w-8 text-blue-500" />;
          case 'txt': return <FileText className="h-8 w-8 text-gray-500" />;
          default: return <FileIcon className="h-8 w-8 text-muted-foreground" />;
      }
    }

    return (
        <>
            <DialogHeader className="p-6 pb-0">
                <DialogTitle>Document Library</DialogTitle>
                <DialogDescription>Select documents to attach to the course.</DialogDescription>
            </DialogHeader>
            <div className="px-6">
                <Input placeholder="Search documents..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <ScrollArea className="flex-grow p-6">
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {isLoading ? <p>Loading...</p> : filteredDocs.map(docItem => {
                        const isSelected = selectedDocs.some(d => d.id === docItem.id);
                        return (
                            <Card
                                key={docItem.id}
                                className={`group relative overflow-hidden transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                            >
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 aspect-square" onClick={() => toggleSelection(docItem)}>
                                    {getFileIcon(docItem['File name'])}
                                    <p className="font-semibold text-sm truncate w-full">{docItem.title}</p>
                                </CardContent>
                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(docItem)}><Edit className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(docItem.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                                {isSelected && (
                                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </ScrollArea>
            <div className="p-6 border-t flex justify-between items-center">
                <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline"><UploadCloud className="mr-2 h-4 w-4" /> Upload New</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Upload Documents</DialogTitle>
                        </DialogHeader>
                        <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer ${isDragActive ? 'border-primary' : ''}`}>
                            <input {...getInputProps()} />
                            <p>Drag 'n' drop some files here, or click to select files</p>
                        </div>
                        {uploadProgress.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {uploadProgress.map(up => (
                                    <div key={up.fileName}><p>{up.fileName}</p><Progress value={up.progress} /></div>
                                ))}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
                <Button onClick={handleConfirmSelection}>Confirm Selection ({selectedDocs.length})</Button>
            </div>
            {isEditing && (
                <Dialog open={!!isEditing} onOpenChange={() => setIsEditing(null)}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Rename Document</DialogTitle></DialogHeader>
                        <div className="py-4 space-y-2">
                            <Label htmlFor="new-title">New Title</Label>
                            <Input id="new-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditing(null)}>Cancel</Button>
                            <Button onClick={handleUpdateTitle}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
