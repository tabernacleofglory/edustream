
"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Mail, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: any;
}

const TemplateForm = ({
  template,
  onSave,
  onClose,
}: {
  template?: EmailTemplate | null;
  onSave: (data: Partial<EmailTemplate>) => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState(template?.name || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, subject, body });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Template Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Course Completion"
          required
        />
        <p className="text-xs text-muted-foreground">For internal identification.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject">Email Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g., Congratulations on completing your course!"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Email Body (HTML supported)</Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="<p>Hello {{userName}},</p>"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Save Template</Button>
      </DialogFooter>
    </form>
  );
};

export default function EmailTemplatesPage() {
  const { hasPermission } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<EmailTemplate | null>(null);
  const { toast } = useToast();

  const canManage = hasPermission("manageContent");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "emailTemplates"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as EmailTemplate)
      );
      setTemplates(list);
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to fetch templates." });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (canManage) {
      fetchTemplates();
    } else {
        setLoading(false);
    }
  }, [canManage, fetchTemplates]);

  const handleSave = async (data: Partial<EmailTemplate>) => {
    if (!canManage) return;

    try {
      if (editingTemplate) {
        // Update
        const docRef = doc(db, "emailTemplates", editingTemplate.id);
        await updateDoc(docRef, data);
        toast({ title: "Template updated successfully!" });
      } else {
        // Create
        await addDoc(collection(db, "emailTemplates"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Template created successfully!" });
      }
      fetchTemplates();
      setIsFormOpen(false);
      setEditingTemplate(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to save template." });
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!canManage) return;

    try {
      await deleteDoc(doc(db, "emailTemplates", templateId));
      toast({ title: "Template deleted." });
      fetchTemplates();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete template.",
      });
    }
  };
  
  const handleOpenForm = (template: EmailTemplate | null) => {
      setEditingTemplate(template);
      setIsFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Email Templates
        </h1>
        <p className="text-muted-foreground">
          Create and manage reusable email templates.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Templates</CardTitle>
          {canManage && (
            <Button onClick={() => handleOpenForm(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Template
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            {loading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : templates.length > 0 ? (
              <div className="divide-y">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 flex justify-between items-center hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-semibold">{template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Subject: {template.subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="ghost" size="icon" onClick={() => setPreviewingTemplate(template)}>
                          <Eye className="h-4 w-4" />
                       </Button>
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenForm(template)}
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
                                  Are you sure?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the template "
                                  {template.name}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(template.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <Mail className="h-12 w-12" />
                <p className="mt-4">No email templates created yet.</p>
                <Button variant="link" onClick={() => handleOpenForm(null)}>
                  Create one now
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
            </DialogHeader>
            <TemplateForm template={editingTemplate} onSave={handleSave} onClose={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!previewingTemplate} onOpenChange={() => setPreviewingTemplate(null)}>
        <DialogContent className="max-w-2xl">
            {previewingTemplate && (
                <>
                <DialogHeader>
                    <DialogTitle>{previewingTemplate.name}</DialogTitle>
                    <DialogDescription>Subject: {previewingTemplate.subject}</DialogDescription>
                </DialogHeader>
                <div className="border rounded-md p-4 max-h-[60vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: previewingTemplate.body }} />
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

