
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Edit, Trash2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";

interface Documentation {
  id: string;
  title: string;
  content: string;
  createdAt: Timestamp;
}

export default function DocumentationPage() {
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const [documents, setDocuments] = useState<Documentation[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [editingDoc, setEditingDoc] = useState<Documentation | null>(null);
  const [viewingDoc, setViewingDoc] = useState<Documentation | null>(null);
  
  const [isDocEditorOpen, setDocEditorOpen] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const q = query(
        collection(db, "documentation"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const docsList = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Documentation)
      );
      setDocuments(docsList);
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch documentation.",
      });
    } finally {
      setLoadingDocs(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);
  
  const resetForm = () => {
    setEditingDoc(null);
    setDocTitle("");
    setDocContent("");
  };

  const handleOpenNewDocEditor = () => {
    resetForm();
    setDocEditorOpen(true);
  };

  const handleOpenEditDocEditor = (doc: Documentation) => {
    resetForm();
    setEditingDoc(doc);
    setDocTitle(doc.title);
    setDocContent(doc.content)
    setDocEditorOpen(true);
  };

  const handleSaveDocument = async () => {
    if (!docTitle.trim() || !docContent.trim()) {
      toast({ variant: "destructive", title: "Title and content are required." });
      return;
    }
    setIsSaving(true);
    try {
      if (editingDoc) {
        const docRef = doc(db, "documentation", editingDoc.id);
        await updateDoc(docRef, {
          title: docTitle,
          content: docContent,
        });
        toast({ title: "Document Updated" });
      } else {
        await addDoc(collection(db, "documentation"), {
          title: docTitle,
          content: docContent,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Document Saved" });
      }
      setDocEditorOpen(false);
      resetForm();
      await fetchDocuments();
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save document.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await deleteDoc(doc(db, "documentation", docId));
      toast({ title: "Document Deleted" });
      await fetchDocuments();
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not delete document.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Documentation
        </h1>
        <p className="text-muted-foreground">
          Create, edit, and manage documentation pages.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Documents</CardTitle>
          <Button onClick={handleOpenNewDocEditor}>
            <Plus className="mr-2 h-4 w-4" />
            Add New
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            {loadingDocs ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : documents.length > 0 ? (
              <div className="divide-y">
                {documents.map((docItem) => (
                  <div
                    key={docItem.id}
                    className="p-4 flex justify-between items-center hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-semibold">{docItem.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Created on{" "}
                        {docItem.createdAt
                          ? new Date(
                              docItem.createdAt.seconds * 1000
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingDoc(docItem)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditDocEditor(docItem)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Are you absolutely sure?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will
                              permanently delete the document titled "
                              {docItem.title}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDocument(docItem.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <p>No documents have been created yet.</p>
                <Button variant="link" onClick={handleOpenNewDocEditor}>
                  Create one now
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
        <DialogContent className="max-w-4xl">
            {viewingDoc && (
                <>
                <DialogHeader>
                    <DialogTitle>{viewingDoc.title}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[70vh] p-1">
                    <article className="prose dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {viewingDoc.content}
                        </ReactMarkdown>
                    </article>
                </ScrollArea>
                </>
            )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDocEditorOpen} onOpenChange={setDocEditorOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingDoc ? 'Edit Document' : 'Create New Document'}
            </DialogTitle>
             <DialogDescription>
              Use Markdown to format your content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="doc-title">Title</Label>
                <Input
                id="doc-title"
                placeholder="Enter document title"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="doc-content">Content (Markdown)</Label>
                <Textarea
                    id="doc-content"
                    placeholder="Start writing your document here..."
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    className="min-h-[300px]"
                />
            </div>
          </div>
           <DialogFooter>
            <Button variant="secondary" onClick={() => setDocEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDocument} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
