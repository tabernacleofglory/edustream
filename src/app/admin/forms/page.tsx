

"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileQuestion, Users, Edit, Trash2, BarChart2, Lock, Share2, Eye, Download, Combine, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, getDocs, where, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CustomForm, FormFieldConfig } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import Papa from "papaparse";
import { Input } from "@/components/ui/input";

interface Submission {
  id: string;
  data: Record<string, any>;
  submittedAt?: any; // Firestore Timestamp or Date
  createdAt?: any;   // nested path might use createdAt
  createdBy?: string | null;
  _src: "nested" | "top";
}

function mergeSources(nested: Submission[], top: Submission[]) {
  const map = new Map<string, Submission>();
  nested.forEach((s) => map.set(`n:${s.id}`, s));
  top.forEach((s) => map.set(`t:${s.id}`, s));
  return Array.from(map.values());
}

function toMillis(x: any): number {
  if (!x) return -Infinity;
  try {
    if (typeof x.toMillis === "function") return x.toMillis();
    if (typeof x.toDate === "function") return x.toDate().getTime();
    const d = typeof x === "number" ? new Date(x) : new Date(x);
    return d.getTime() || -Infinity;
  } catch {
    return -Infinity;
  }
}

function sortByTimestampDesc(a: Submission, b: Submission) {
  const ta = toMillis(a.submittedAt ?? a.createdAt);
  const tb = toMillis(b.submittedAt ?? b.createdAt);
  return tb - ta;
}

const ResponsesDialog = ({ form, onOpenChange }: { form: CustomForm, onOpenChange: (open: boolean) => void }) => {
    const { toast } = useToast();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!form?.id) return;

        let unsubNested: () => void = () => {};
        setLoading(true);
        setSubmissions([]); // Clear previous submissions

        // "Blank" and "Hybrid" forms store data in a subcollection
        if (form.type === 'blank' || form.type === 'hybrid') {
            const nestedCollectionPath = collection(db, "forms", form.id, "submissions");
            unsubNested = onSnapshot(
                query(nestedCollectionPath, orderBy("submittedAt", "desc")),
                (snapshot) => {
                    const rows: Submission[] = snapshot.docs.map((d) => ({ id: d.id, _src: "nested", ...(d.data() as any) }));
                    setSubmissions(rows);
                    setLoading(false);
                },
                (err) => {
                    console.error("Error fetching nested submissions:", err);
                    setLoading(false);
                }
            );
        } else {
             setLoading(false);
        }

        return () => {
            unsubNested();
        };
    }, [form.id, form.type]);

    const visibleFields = useMemo(() => {
        const fields = form?.fields?.filter((f: any) => f?.visible) ?? [];
        const seen: Record<string, number> = {};
        return fields.map((f: any, i: number) => {
            const rawId = (f.fieldId ?? "").toString().trim();
            const base = rawId || `idx_${i}`;
            const bump = (seen[base] = (seen[base] ?? 0) + 1);
            const _renderKey = bump === 1 ? base : `${base}__${bump}`;
            return { ...f, _renderKey, fieldId: rawId || base };
        });
    }, [form?.fields]);
    
    const sortedSubs = useMemo(() => {
        let filtered = submissions.slice().sort(sortByTimestampDesc);
        if (searchTerm) {
            const lowercasedSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(sub => 
                Object.values(sub.data).some(val => 
                    String(val).toLowerCase().includes(lowercasedSearch)
                )
            );
        }
        return filtered;
    }, [submissions, searchTerm]);


    const formatWhen = (ts?: any, fallback?: any) => {
        const t = ts ?? fallback;
        if (!t) return "N/A";
        try {
            const d = typeof t?.toDate === "function" ? t.toDate() : new Date(t);
            return isNaN(d as unknown as number) ? "N/A" : format(d, "PPP p");
        } catch { return "N/A"; }
    };

    const handleExportCSV = () => {
        if (!sortedSubs.length) {
            toast({ variant: "destructive", title: "No data to export." });
            return;
        }
        const rows = sortedSubs.map((sub) => {
            const row: Record<string, any> = { "Submission Date": formatWhen(sub.submittedAt, sub.createdAt) };
            const submissionData = sub.data.data || sub.data;
            visibleFields.forEach((f: any) => {
                const v = submissionData?.[f.fieldId];
                row[f.label] = v == null ? "" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
            });
            return row;
        });
        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${(form?.title || "form").replace(/\s+/g, "_")}_submissions.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{form.title} - Responses</DialogTitle>
                <DialogDescription>Viewing {sortedSubs.length} submission(s).</DialogDescription>
            </DialogHeader>
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search submissions..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={handleExportCSV} variant="outline" disabled={loading || sortedSubs.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Export as CSV
                </Button>
            </div>
            <ScrollArea className="flex-grow border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Submission Date</TableHead>
                            {visibleFields.map((f: any) => <TableHead key={`h_${f._renderKey}`}>{f.label}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={`sk_${i}`}>
                                    {Array.from({ length: visibleFields.length + 1 }).map((_, j) => (
                                        <TableCell key={`sk_${i}_${j}`}><Skeleton className="h-5 w-full" /></TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : sortedSubs.length ? (
                            sortedSubs.map((sub) => {
                                const submissionData = sub.data?.data || sub.data;
                                return (
                                <TableRow key={`${sub._src}_${sub.id}`}>
                                    <TableCell className="text-xs">{formatWhen(sub.submittedAt, sub.createdAt)}</TableCell>
                                    {visibleFields.map((f: any) => {
                                        const val = submissionData?.[f.fieldId];
                                        const display = val == null ? "N/A" : Array.isArray(val) ? val.join(", ") : typeof val === "object" ? JSON.stringify(val) : String(val);
                                        return <TableCell key={`${sub._src}_${sub.id}_${f._renderKey}`}>{display}</TableCell>;
                                    })}
                                </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={visibleFields.length + 1} className="text-center py-8">
                                    No submissions yet for this form.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </DialogContent>
    );
};


export default function FormsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [viewingResponsesForm, setViewingResponsesForm] = useState<CustomForm | null>(null);

  const canManage = hasPermission('manageForms');
  const canView = hasPermission('viewForms');

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
  

  const handleShareForm = (formId: string, formType: string) => {
    let formUrl = '';
    if (formType === 'userProfile') {
        formUrl = `${window.location.origin}/external/${formId}`;
    } else if (formType === 'blank') {
        formUrl = `${window.location.origin}/external/form/${formId}`;
    } else if (formType === 'hybrid') {
        formUrl = `${window.location.origin}/external/hybrid/${formId}`;
    }

    if(formUrl) {
        navigator.clipboard.writeText(formUrl).then(() => {
            toast({ title: "Link Copied", description: "The public form link has been copied to your clipboard." });
        }).catch(err => {
            toast({ variant: 'destructive', title: "Copy Failed", description: "Could not copy the link." });
        });
    } else {
        toast({ variant: 'destructive', title: "Invalid Form Type", description: "Could not generate a shareable link." });
    }
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

  const getFormBuilderUrl = (form: CustomForm) => {
    if (form.type === 'blank' || form.type === 'hybrid') {
        return `/admin/forms/builder/blank-form?formId=${form.id}&type=${form.type}`;
    }
    return `/admin/forms/builder?formId=${form.id}&type=${form.type}`;
  };

  const getPublicFormUrl = (form: CustomForm) => {
      switch(form.type) {
          case 'userProfile':
              return `/external/${form.id}`;
          case 'blank':
              return `/external/form/${form.id}`;
          case 'hybrid':
              return `/external/hybrid/${form.id}`;
          default:
              return '#';
      }
  }

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
    <>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                    <Link href="/admin/forms/builder?type=userProfile" onClick={() => setIsCreateDialogOpen(false)}>
                       <Card className="cursor-pointer hover:border-primary h-full">
                          <CardHeader>
                              <Users className="h-8 w-8 text-primary mb-2" />
                              <CardTitle>User Profile</CardTitle>
                              <CardDescription>Creates a new user account upon submission.</CardDescription>
                          </CardHeader>
                      </Card>
                    </Link>
                    <Link href="/admin/forms/builder/blank-form" onClick={() => setIsCreateDialogOpen(false)}>
                      <Card className="cursor-pointer hover:border-primary h-full">
                          <CardHeader>
                              <FileQuestion className="h-8 w-8 text-primary mb-2" />
                              <CardTitle>Blank Form</CardTitle>
                              <CardDescription>A simple form that only stores submission data.</CardDescription>
                          </CardHeader>
                      </Card>
                    </Link>
                     <Link href="/admin/forms/builder/blank-form?type=hybrid" onClick={() => setIsCreateDialogOpen(false)}>
                      <Card className="cursor-pointer hover:border-primary h-full">
                          <CardHeader>
                              <Combine className="h-8 w-8 text-primary mb-2" />
                              <CardTitle>Hybrid Form</CardTitle>
                              <CardDescription>Creates a user account and stores submission data.</CardDescription>
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
                              <p className="text-sm text-muted-foreground capitalize">{form.type === 'userProfile' ? 'User Profile' : form.type} Form</p>
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
                                  <Button variant="outline" size="sm" onClick={() => {
                                      if (form.type !== 'userProfile') {
                                          setViewingResponsesForm(form);
                                      }
                                  }} disabled={form.type === 'userProfile'}>
                                    <BarChart2 className="mr-2 h-4 w-4" /> {form.submissionCount || 0} Responses
                                  </Button>
                                  <Button asChild variant="ghost" size="icon">
                                  <Link href={getPublicFormUrl(form)} target="_blank">
                                      <Eye className="h-4 w-4" />
                                  </Link>
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleShareForm(form.id, form.type)}>
                                      <Share2 className="h-4 w-4" />
                                  </Button>
                                  {canManage && (
                                      <>
                                      <Button asChild variant="ghost" size="icon">
                                          <Link href={getFormBuilderUrl(form)}>
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
      </div>
      <Dialog open={!!viewingResponsesForm} onOpenChange={(open) => !open && setViewingResponsesForm(null)}>
        {viewingResponsesForm && <ResponsesDialog form={viewingResponsesForm} onOpenChange={(open) => !open && setViewingResponsesForm(null)} />}
      </Dialog>
    </>
  );
}
