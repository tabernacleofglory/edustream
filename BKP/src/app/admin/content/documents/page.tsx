
"use client";

import { useState, useEffect, useCallback, FormEvent, MouseEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Loader2, Edit, Trash, Eye, FileType, File, FileImage } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { User } from "@/lib/types";

interface StoredDocument {
    id: string;
    title: string;
    url: string;
    path: string;
    'File name'?: string;
}

const DocumentUploadForm = ({ user, onUploadSuccess, closeDialog }: { user: User | null, onUploadSuccess: (newDoc: StoredDocument) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState('');
    const [docFile, setDocFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docFile || !title) {
            toast({ variant: 'destructive', title: 'Please fill all fields' });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        
        try {
            const docPath = `contents/documents/${uuidv4()}-${docFile.name}`;
            const storageRef = ref(storage, docPath);
            const uploadTask = uploadBytesResumable(storageRef, docFile);

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
                    const docUrl = await getDownloadURL(uploadTask.snapshot.ref);

                    const firestoreDocRef = await addDoc(collection(db, 'Contents'), {
                        title: title,
                        url: docUrl,
                        path: docPath,
                        'File name': docFile.name,
                        Size: docFile.size,
                        Type: "document",
                        createdAt: serverTimestamp(),
                        uploaderId: user?.uid,
                        uploaderName: user?.displayName,
                    });

                    const newDoc: StoredDocument = { id: firestoreDocRef.id, title, url: docUrl, path: docPath, 'File name': docFile.name };
                    toast({ title: "Document uploaded successfully!" });
                    onUploadSuccess(newDoc);
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
                <Label htmlFor="doc-title">Document Title</Label>
                <Input id="doc-title" value={title} onChange={e => setTitle(e.target.value)} required disabled={isUploading} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="doc-file">Document File</Label>
                <Input id="doc-file" type="file" onChange={e => setDocFile(e.target.files?.[0] || null)} accept=".doc,.docx,.pdf,.txt" required disabled={isUploading} />
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

const DocumentEditForm = ({ document: docItem, onUpdateSuccess, closeDialog }: { document: StoredDocument, onUpdateSuccess: (updatedDoc: StoredDocument) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState(docItem.title);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const docRef = doc(db, 'Contents', docItem.id);
            await updateDoc(docRef, { title });
            toast({ title: "Document updated!" });
            onUpdateSuccess({ ...docItem, title });
            closeDialog();
        } catch (error) {
             toast({ variant: 'destructive', title: "Update failed", description: "Could not update the document details." });
             console.error("Update error: ", error);
        } finally {
            setIsUpdating(false);
        }
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="edit-doc-title">Document Title</Label>
                <Input id="edit-doc-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
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


export default function DocumentsPage() {
  const { user, isCurrentUserAdmin } = useAuth();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<StoredDocument | null>(null);
  const { toast } = useToast();

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
        const q = query(collection(db, 'Contents'), where("Type", "==", "document"));
        const querySnapshot = await getDocs(q);
        const docsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredDocument));
        setDocuments(docsList);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to fetch documents.' });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);
  
  const handleUploadSuccess = (newDoc: StoredDocument) => {
    setDocuments(prev => [newDoc, ...prev]);
    setIsUploadDialogOpen(false);
  }

  const handleUpdateSuccess = (updatedDoc: StoredDocument) => {
      setDocuments(prev => prev.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc));
      setEditingDocument(null);
  }
  
  const handleDelete = async (document: StoredDocument) => {
      if (!window.confirm("Are you sure you want to delete this document? This cannot be undone.")) return;
      
      try {
          const docRef = ref(storage, document.path);
          await deleteObject(docRef);
          await deleteDoc(doc(db, 'Contents', document.id));
          setDocuments(prev => prev.filter(doc => doc.id !== document.id));
          toast({ title: "Document deleted successfully." });
      } catch (error) {
           toast({ variant: 'destructive', title: "Delete failed.", description: "Could not delete the document." });
           console.error("Delete error: ", error);
      }
  }

  const handlePreview = (url: string) => {
    window.open(url, '_blank');
  }

  const handleActionClick = (e: MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  }

  const getFileIcon = (fileName?: string) => {
      if (!fileName) return <File className="h-12 w-12 sm:h-20 sm:w-20 text-muted-foreground" />;
      const extension = fileName.split('.').pop()?.toLowerCase();
      switch(extension) {
          case 'pdf':
              return <FileImage className="h-12 w-12 sm:h-20 sm:w-20 text-red-500" />;
          case 'doc':
          case 'docx':
              return <FileType className="h-12 w-12 sm:h-20 sm:w-20 text-blue-500" />;
          case 'txt':
              return <FileText className="h-12 w-12 sm:h-20 sm:w-20 text-gray-500" />;
          default:
              return <File className="h-12 w-12 sm:h-20 sm:w-20 text-muted-foreground" />;
      }
  }
  
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Documents
        </h1>
        <p className="text-muted-foreground">
          Manage all documents and text files on the platform.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Document Management</CardTitle>
          {isCurrentUserAdmin && (
             <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New Document
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload a new document</DialogTitle>
                        <DialogDescription>
                            The document will be added to the library.
                        </DialogDescription>
                    </DialogHeader>
                    <DocumentUploadForm user={user} onUploadSuccess={handleUploadSuccess} closeDialog={() => setIsUploadDialogOpen(false)} />
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
                ) : documents.length > 0 ? (
                    documents.map(docItem => (
                       <Card key={docItem.id} className="group relative overflow-hidden cursor-pointer" onClick={() => handlePreview(docItem.url)}>
                           <div className="aspect-square w-full flex items-center justify-center bg-muted">
                               {getFileIcon(docItem['File name'])}
                           </div>
                           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2 pr-4">
                                <Button size="icon" variant="secondary" onClick={(e) => handleActionClick(e, () => handlePreview(docItem.url))}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                                <Button size="icon" className="text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500" onClick={(e) => handleActionClick(e, () => setEditingDocument(docItem))}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="destructive" onClick={(e) => handleActionClick(e, () => handleDelete(docItem))}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </div>
                           <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">{docItem.title}</p>
                       </Card>
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-12 flex flex-col items-center">
                        <FileText className="h-12 w-12" />
                        <p className="mt-4">No documents in the library. Upload one to get started.</p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingDocument} onOpenChange={(isOpen) => !isOpen && setEditingDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>Update the details for this document.</DialogDescription>
          </DialogHeader>
          {editingDocument && (
            <DocumentEditForm 
              document={editingDocument} 
              onUpdateSuccess={handleUpdateSuccess} 
              closeDialog={() => setEditingDocument(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
