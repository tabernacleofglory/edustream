

"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, doc, getDoc, writeBatch, updateDoc, where, increment } from "firebase/firestore";
import Link from "next/link";
import Papa from "papaparse";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, ArrowLeft, Download, Search, ChevronLeft, ChevronRight, Trash2, UserCog, Link as LinkIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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


import type { CustomForm, FormFieldConfig } from "@/lib/types";

interface Submission {
  id: string;
  data: Record<string, any>;
  submittedAt?: any;
  createdAt?: any;
  userId?: string;
  createdBy?: string | null;
}

function formatWhen(ts?: any, fallback?: any) {
  const t = ts ?? fallback;
  if (!t) return "N/A";
  try {
    const d = typeof t?.toDate === "function" ? t.toDate() : new Date(t);
    return isNaN(d as unknown as number) ? "N/A" : format(d, "PPP p");
  } catch {
    return "N/A";
  }
}

function FormResponsesComponent() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as string;
  const { toast } = useToast();

  const [form, setForm] = useState<CustomForm | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);


  useEffect(() => {
    if (!formId) {
        setLoading(false);
        return;
    };

    const formRef = doc(db, "forms", formId);
    const unsubForm = onSnapshot(formRef, (docSnap) => {
        if (docSnap.exists()) {
            setForm({ id: docSnap.id, ...docSnap.data() } as CustomForm);
        } else {
            toast({ variant: 'destructive', title: 'Form not found.' });
            setForm(null);
        }
    });

    const submissionsRef = collection(db, "forms", formId, "submissions");
    const submissionsQuery = query(submissionsRef, orderBy("submittedAt", "desc"));
    const unsubSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
        const rows: Submission[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setSubmissions(rows);
        setTotalSubmissions(snapshot.size); // Use real-time size
        setLoading(false);
    }, (err) => {
        console.error("Error fetching submissions:", err);
        setLoading(false);
    });

    return () => {
        unsubForm();
        unsubSubmissions();
    };
  }, [formId, toast]);

  const visibleFields = useMemo(() => {
    const fields = form?.fields?.filter((f: any) => f?.visible) ?? [];
    return fields;
  }, [form?.fields]);
  
  const sortedSubs = useMemo(() => {
    let filtered = submissions;
    if (searchTerm) {
        const lowercasedSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(sub => 
            Object.values(sub.data).some(val => 
                String(val).toLowerCase().includes(lowercasedSearch)
            )
        );
    }
    return filtered.sort((a,b) => (b.submittedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0) - (a.submittedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0));
  }, [submissions, searchTerm]);
  
  const totalPages = Math.ceil(sortedSubs.length / rowsPerPage);
  const paginatedData = sortedSubs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleExportCSV = () => {
    if (!sortedSubs.length) {
        toast({ variant: "destructive", title: "No data to export." });
        return;
    }
    const rows = sortedSubs.map((sub) => {
        const row: Record<string, any> = { "Submission Date": formatWhen(sub.submittedAt, sub.createdAt) };
        visibleFields.forEach((f: any) => {
            const val = sub.data?.[f.fieldId];
            row[f.label] = val == null ? "" : Array.isArray(val) ? val.join(", ") : typeof val === "object" ? JSON.stringify(val) : String(val);
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
  
  const handleDeleteSelected = async () => {
    if (selectedSubmissionIds.length === 0) {
        toast({ variant: 'destructive', title: 'No records selected' });
        return;
    }

    const batch = writeBatch(db);
    selectedSubmissionIds.forEach(resultId => {
        const docRef = doc(db, 'forms', formId, 'submissions', resultId);
        batch.delete(docRef);
    });

    // Also decrement the submission count on the parent form document
    const formRef = doc(db, 'forms', formId);
    batch.update(formRef, { submissionCount: increment(-selectedSubmissionIds.length) });

    try {
        await batch.commit();
        toast({ title: `${selectedSubmissionIds.length} records deleted successfully` });
        setSelectedSubmissionIds([]);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to delete records' });
    }
  };

  const handleUpdateSelectedProfiles = async () => {
    if (selectedSubmissionIds.length === 0) {
      toast({ variant: "destructive", title: "No records selected." });
      return;
    }

    const submissionsToUpdate = submissions.filter(s => selectedSubmissionIds.includes(s.id) && s.userId);
    if (submissionsToUpdate.length === 0) {
      toast({ title: "No linked user profiles to update." });
      return;
    }

    const batch = writeBatch(db);
    let updatedProfileCount = 0;

    submissionsToUpdate.forEach(submission => {
      const userProfileUpdates: Record<string, any> = {};
      form?.fields.forEach(field => {
        const castField = field as any;
        if (castField.userProfileField && submission.data[castField.fieldId] !== undefined) {
          userProfileUpdates[castField.userProfileField] = submission.data[castField.fieldId];
        }
      });

      if (Object.keys(userProfileUpdates).length > 0) {
        const userRef = doc(db, "users", submission.userId!);
        batch.update(userRef, userProfileUpdates);
        updatedProfileCount++;
      }
    });

    if (updatedProfileCount === 0) {
      toast({ title: "No linked fields found in selected submissions." });
      return;
    }
    
    try {
      await batch.commit();
      toast({
        title: "Profiles Updated",
        description: `${updatedProfileCount} user profile(s) have been updated successfully.`,
      });
      setSelectedSubmissionIds([]);
    } catch (error: any) {
      console.error("Error updating profiles:", error);
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    }
  };

  
  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Form Not Found</CardTitle>
          <CardDescription>The form you are looking for does not exist or has been deleted.</CardDescription>
        </CardHeader>
        <CardContent>
             <Button asChild variant="outline"><Link href="/admin/forms">Go Back to Forms</Link></Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
        <div>
            <Button variant="outline" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Forms
            </Button>
            <h1 className="font-headline text-3xl font-bold md:text-4xl">
                {form.title} - Responses
            </h1>
            <p className="text-muted-foreground">
                Viewing all {totalSubmissions} submissions for this form.
            </p>
        </div>
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search submissions..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                     <div className="flex items-center gap-2">
                        {selectedSubmissionIds.length > 0 && (
                           <>
                            <Button variant="outline" onClick={handleUpdateSelectedProfiles}>
                                <UserCog className="mr-2 h-4 w-4" />
                                Update Profiles ({selectedSubmissionIds.length})
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete ({selectedSubmissionIds.length})
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete {selectedSubmissionIds.length} submission(s).
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteSelected}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                           </>
                        )}
                        <Button onClick={handleExportCSV} variant="outline" disabled={loading || sortedSubs.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Export as CSV
                        </Button>
                     </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                     <Checkbox
                                        checked={selectedSubmissionIds.length > 0 && selectedSubmissionIds.length === paginatedData.length}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedSubmissionIds(paginatedData.map(s => s.id));
                                            } else {
                                                setSelectedSubmissionIds([]);
                                            }
                                        }}
                                        aria-label="Select all on page"
                                     />
                                </TableHead>
                                <TableHead>Submission Date</TableHead>
                                <TableHead>User ID</TableHead>
                                {visibleFields.map((f: any, index: number) => (
                                    <TableHead key={`${f.fieldId}-${index}`}>
                                        <div className="flex items-center gap-2">
                                            {f.label}
                                            {f.userProfileField && <LinkIcon className="h-3 w-3 text-muted-foreground" />}
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={`sk_${i}`}>
                                        {Array.from({ length: visibleFields.length + 3 }).map((_, j) => (
                                            <TableCell key={`sk_cell_${i}_${j}`}><Skeleton className="h-5 w-full" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : paginatedData.length ? (
                                paginatedData.map((sub) => {
                                    const isSelected = selectedSubmissionIds.includes(sub.id);
                                    return (
                                    <TableRow key={sub.id} data-state={isSelected ? "selected" : undefined}>
                                         <TableCell>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => {
                                                    setSelectedSubmissionIds(prev =>
                                                        isSelected ? prev.filter(id => id !== sub.id) : [...prev, sub.id]
                                                    );
                                                }}
                                                aria-label={`Select submission ${sub.id}`}
                                            />
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{formatWhen(sub.submittedAt, sub.createdAt)}</TableCell>
                                        <TableCell className="text-xs font-mono">{sub.userId || 'N/A'}</TableCell>
                                        {visibleFields.map((f: any, index: number) => {
                                            const val = sub.data?.[f.fieldId];
                                            const display = val == null ? "N/A" : Array.isArray(val) ? val.join(", ") : typeof val === "object" ? JSON.stringify(val) : String(val);
                                            return <TableCell key={`${sub.id}_${f.fieldId}-${index}`}>{display}</TableCell>;
                                        })}
                                    </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={visibleFields.length + 3} className="text-center py-8">
                                        No submissions found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            {totalPages > 1 && (
                 <CardFooter className="flex justify-end items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Rows per page</span>
                        <Select value={`${rowsPerPage}`} onValueChange={value => setRowsPerPage(Number(value))}>
                            <SelectTrigger className="w-[70px]">
                                <SelectValue placeholder={`${rowsPerPage}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 25, 50, 100].map(size => (
                                    <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardFooter>
            )}
        </Card>
    </div>
  )
}

export default function FormResponsesPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <FormResponsesComponent />
        </Suspense>
    );
}

