

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileQuestion, Users, Edit, Trash2, BarChart2, Lock, Share2, Eye, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, getDocs, where, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CustomForm, User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import Papa from 'papaparse';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const ViewResponsesDialog = ({ form, users }: { form: CustomForm, users: User[] }) => {
    const { toast } = useToast();
    
    const handleDownloadCSV = () => {
        if (users.length === 0) {
            toast({ variant: 'destructive', title: 'No responses to export.' });
            return;
        }

        const dataToExport = users.map(user => {
            const row: Record<string, any> = {};
            form.fields.forEach(field => {
                if (field.visible) {
                    row[field.label] = (user as any)[field.fieldId] || '';
                }
            });
            return row;
        });

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${form.title.replace(/\s+/g, '_')}_submissions.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Form Responses: {form.title}</DialogTitle>
                <DialogDescription>
                    Viewing {users.length} submission(s).
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                 <ScrollArea className="h-96 border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {form.fields.filter(f => f.visible).map(field => (
                                    <TableHead key={field.fieldId}>{field.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length > 0 ? (
                                users.map(user => (
                                    <TableRow key={user.id}>
                                        {form.fields.filter(f => f.visible).map(field => (
                                            <TableCell key={field.fieldId}>{(user as any)[field.fieldId] || 'N/A'}</TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={form.fields.filter(f => f.visible).length} className="text-center">
                                        No submissions yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
             <DialogFooter>
                <Button variant="outline" onClick={handleDownloadCSV}>
                    <Download className="mr-2 h-4 w-4" /> Download CSV
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

export default function FormsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [viewingResponsesForm, setViewingResponsesForm] = useState<CustomForm | null>(null);
  const [formSubmissions, setFormSubmissions] = useState<User[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const canManage = hasPermission('manageForms');
  const canView = hasPermission('viewForms');
  const canDownload = hasPermission('downloadFormSubmissions');

  useEffect(() => {
    if (!canView) {
        setLoading(false);
        return;
    }
    const q = query(collection(db, "forms"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setForms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomForm)));
        setLoading(false);
    });
    return () => unsubscribe();
  }, [canView]);
  
  useEffect(() => {
    if (viewingResponsesForm) {
        setLoadingSubmissions(true);
        const fetchSubmissions = async () => {
            const usersQuery = query(collection(db, 'users'), where('createdFromFormId', '==', viewingResponsesForm.id));
            const snapshot = await getDocs(usersQuery);
            setFormSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
            setLoadingSubmissions(false);
        }
        fetchSubmissions();
    }
  }, [viewingResponsesForm]);

  const handleShareForm = (formId: string) => {
    const formUrl = `${window.location.origin}/external/${formId}`;
    navigator.clipboard.writeText(formUrl).then(() => {
        toast({ title: "Link Copied", description: "The public form link has been copied to your clipboard." });
    }).catch(err => {
        toast({ variant: 'destructive', title: "Copy Failed", description: "Could not copy the link." });
    });
  };
  
  const handleDeleteForm = async () => {
    if (!deletingFormId) return;
    try {
        await deleteDoc(doc(db, "forms", deletingFormId));
        toast({ title: 'Form Deleted', description: 'The form has been successfully deleted.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete the form.' });
    } finally {
        setDeletingFormId(null);
    }
  }

  const handleStatusChange = async (form: CustomForm, isPublic: boolean) => {
    const formDocRef = doc(db, 'forms', form.id);
    try {
        await updateDoc(formDocRef, { public: isPublic });
        toast({ title: 'Status updated', description: `Form is now ${isPublic ? 'public' : 'private'}.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update the form status.' });
    }
  };

  if (!canView) {
    return (
      <Alert variant="destructive">
        <Lock className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view this page.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Form Management
        </h1>
        <p className="text-muted-foreground">
          Create, manage, and view responses for external forms.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Forms</CardTitle>
          {canManage && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Create New Form
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Select Form Type</DialogTitle>
                  <DialogDescription>
                    Choose a template to get started or create a form from scratch.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  <Link href="/admin/forms/builder?type=userProfile" onClick={() => setIsCreateDialogOpen(false)}>
                    <Card className="cursor-pointer hover:border-primary h-full">
                        <CardHeader>
                            <Users className="h-8 w-8 text-primary mb-2" />
                            <CardTitle>User Profile</CardTitle>
                            <CardDescription>A pre-built form for new user registration.</CardDescription>
                        </CardHeader>
                    </Card>
                  </Link>
                   <Link href="/admin/forms/builder?type=blank" onClick={() => setIsCreateDialogOpen(false)}>
                    <Card className="cursor-pointer hover:border-primary h-full">
                        <CardHeader>
                            <FileQuestion className="h-8 w-8 text-primary mb-2" />
                            <CardTitle>Blank Form</CardTitle>
                            <CardDescription>Start with a blank canvas to build any form.</CardDescription>
                        </CardHeader>
                    </Card>
                  </Link>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
           {loading ? (
             <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
             </div>
           ) : forms.length > 0 ? (
            <div className="border rounded-lg">
                {forms.map(form => (
                    <div key={form.id} className="flex items-center justify-between p-4 border-b last:border-b-0">
                        <div>
                            <p className="font-semibold">{form.title}</p>
                            <p className="text-sm text-muted-foreground capitalize">{form.type} Form</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id={`public-switch-${form.id}`}
                                    checked={form.public}
                                    onCheckedChange={(checked) => handleStatusChange(form, checked)}
                                    disabled={!canManage}
                                />
                                <Label htmlFor={`public-switch-${form.id}`}>{form.public ? 'Public' : 'Private'}</Label>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="sm" onClick={() => setViewingResponsesForm(form)}>
                                    <BarChart2 className="mr-2 h-4 w-4" /> {form.submissionCount || 0} Responses
                                </Button>
                                <Button asChild variant="ghost" size="icon">
                                <Link href={`/external/${form.id}`} target="_blank">
                                    <Eye className="h-4 w-4" />
                                </Link>
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleShareForm(form.id)}>
                                    <Share2 className="h-4 w-4" />
                                </Button>
                                {canManage && (
                                    <>
                                    <Button asChild variant="ghost" size="icon">
                                        <Link href={`/admin/forms/builder?formId=${form.id}`}>
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete the form "{form.title}".</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => setDeletingFormId(form.id)}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
           ) : (
                <div className="border-2 border-dashed rounded-lg text-center p-12 text-muted-foreground">
                    <FileQuestion className="h-12 w-12 mx-auto" />
                    <p className="mt-4">No forms have been created yet.</p>
                    {canManage && (
                    <Button variant="link" onClick={() => setIsCreateDialogOpen(true)}>Create one now</Button>
                    )}
                </div>
           )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingFormId} onOpenChange={(open) => !open && setDeletingFormId(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to delete this form? This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingFormId(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteForm}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingResponsesForm} onOpenChange={() => setViewingResponsesForm(null)}>
        {viewingResponsesForm && <ViewResponsesDialog form={viewingResponsesForm} users={formSubmissions} />}
      </Dialog>
    </div>
  );
}
