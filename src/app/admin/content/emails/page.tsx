"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Plus, Edit, Trash2, Mail, Eye, Bold, Italic, List, Loader2, Code2, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomForm } from "@/lib/types";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: any;
}

const PLACEHOLDERS = [
  { label: "Full Name / Nom Complet", value: "{{userName}}" },
  { label: "First Name / Prénom", value: "{{firstName}}" },
  { label: "Last Name / Nom", value: "{{lastName}}" },
  { label: "Email / Email", value: "{{email}}" },
  { label: "Phone / Téléphone", value: "{{phoneNumber}}" },
  { label: "Campus", value: "{{campus}}" },
  { label: "HP Number / Numéro HP", value: "{{hpNumber}}" },
  { label: "HP Facilitator / Facilitateur HP", value: "{{facilitatorName}}" },
  { label: "Ladder / Echelle", value: "{{classLadder}}" },
  { label: "Ministry / Ministère", value: "{{ministry}}" },
  { label: "Charge", value: "{{charge}}" },
];

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
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchForms = async () => {
        try {
            const q = query(collection(db, "forms"), orderBy("title"));
            const snap = await getDocs(q);
            setForms(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomForm)));
        } catch (e) {
            console.error("Error fetching forms:", e);
        }
    };
    fetchForms();
  }, []);

  const selectedForm = forms.find(f => f.id === selectedFormId);

  const applyMarkdown = (syntax: 'bold' | 'italic' | 'list') => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let newText;
    switch(syntax) {
        case 'bold':
            newText = `**${selectedText}**`;
            break;
        case 'italic':
            newText = `*${selectedText}*`;
            break;
        case 'list':
            newText = `\n- ${selectedText.replace(/\n/g, '\n- ')}`;
            break;
    }

    const updatedValue = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
    setBody(updatedValue);
    textarea.focus();
  };

  const insertPlaceholder = (value: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updatedValue = body.substring(0, start) + value + body.substring(end);
    setBody(updatedValue);
    
    // Focus back and set cursor position after the placeholder
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + value.length, start + value.length);
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, subject, body });
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      <ScrollArea className="flex-grow pr-6 -mr-6">
        <div className="space-y-4">
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

          <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
            <div className="space-y-2">
                <Label>User Profile Placeholders</Label>
                <div className="flex flex-wrap gap-2">
                    {PLACEHOLDERS.map((ph) => (
                        <Button 
                            key={ph.value}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs bg-background"
                            onClick={() => insertPlaceholder(ph.value)}
                        >
                            <Code2 className="mr-1 h-3 w-3" />
                            {ph.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <Label>Form Field Placeholders</Label>
                <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a form to see its fields..." />
                    </SelectTrigger>
                    <SelectContent>
                        {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
                    </SelectContent>
                </Select>
                {selectedForm && (
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                        <Button 
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs bg-primary/10 border-primary/20 text-primary"
                            onClick={() => insertPlaceholder(`{{formTitle:${selectedForm.id}}}`)}
                        >
                            <FileText className="mr-1 h-3 w-3" />
                            Form Name / Nom du Formulaire: {selectedForm.title}
                        </Button>
                        {selectedForm.fields.map(field => (
                            <Button 
                                key={field.fieldId}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs bg-background"
                                onClick={() => insertPlaceholder(`{{form:${selectedForm.id}:${field.fieldId}}}`)}
                            >
                                <FileText className="mr-1 h-3 w-3" />
                                {field.label}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground">Click a tag to insert it into the message body. These will be replaced with real data when the email is sent.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Body (Markdown supported)</Label>
            <Card>
                <div className="p-2 border-b flex gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => applyMarkdown('bold')}><Bold className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => applyMarkdown('italic')}><Italic className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => applyMarkdown('list')}><List className="h-4 w-4" /></Button>
                </div>
                <Textarea
                    id="body"
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    placeholder="Hello {{userName}}, ..."
                    className="border-0 focus-visible:ring-0 shadow-none min-h-[200px]"
                />
                <div className="p-4 border-t bg-muted/50">
                    <Label className="text-xs">Preview</Label>
                    <div className="prose dark:prose-invert prose-sm max-w-full prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{body}</ReactMarkdown>
                    </div>
                </div>
            </Card>
          </div>
        </div>
      </ScrollArea>
      <DialogFooter className="pt-6 border-t mt-6 flex-shrink-0">
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
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <CardTitle>All Templates</CardTitle>
                <CardDescription>Manage reusable message layouts with dynamic user and form placeholders.</CardDescription>
            </div>
            {canManage && (
                <Button onClick={() => handleOpenForm(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Template
                </Button>
            )}
          </div>
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
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
            </DialogHeader>
            <TemplateForm template={editingTemplate} onSave={handleSave} onClose={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!previewingTemplate} onOpenChange={() => setPreviewingTemplate(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            {previewingTemplate && (
                <>
                <DialogHeader>
                    <DialogTitle>{previewingTemplate.name}</DialogTitle>
                    <DialogDescription>Subject: {previewingTemplate.subject}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 p-4 border rounded-md">
                    <div className="prose dark:prose-invert prose-sm max-w-full prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{previewingTemplate.body}</ReactMarkdown>
                    </div>
                </ScrollArea>
                </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
