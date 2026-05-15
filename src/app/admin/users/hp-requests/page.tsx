
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import type { User, EmailTemplate, EmailLayoutSettings } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Mail, Loader2, Calendar as CalendarIcon, Filter, X as XIcon, Lock, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import Papa from "papaparse";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { marked } from "marked";
import { wrapInEmailLayout } from "@/lib/email-utils";

interface HPRequest extends User {
    createdAt: { seconds: number; nanoseconds: number; };
}

export default function HPRequestsPage() {
    const [requests, setRequests] = useState<HPRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessingEmail, setIsProcessingEmail] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<{from?: Date, to?: Date} | undefined>();
    const { user: currentUser, hasPermission, loading: authLoading, canViewAllCampuses } = useAuth();
    const { toast } = useToast();
    const tableRef = useRef(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [usersPerPage, setUsersPerPage] = useState(25);
    const [selectedCampus, setSelectedCampus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [emailLayout, setEmailLayout] = useState<EmailLayoutSettings | null>(null);
    const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<HPRequest | null>(null);
    const [templateSearchTerm, setTemplateSearchTerm] = useState('');
    const [templateViewState, setTemplateViewState] = useState<'list' | 'preview'>('list');
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

    const canManage = hasPermission('manageHpRequests');

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const usersRef = collection(db, "users");
            const q = query(
                usersRef,
                where("isInHpGroup", "in", [false, null])
            );
            const querySnapshot = await getDocs(q);
            
            const requestList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as HPRequest));
            
            // Sort combined list by date
            requestList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            setRequests(requestList);
        } catch (error) {
            console.error("Error fetching HP requests:", error);
            toast({ variant: 'destructive', title: 'Failed to fetch requests.' });
        } finally {
            setLoading(false);
        }
    }, [toast, db]);

    const fetchData = useCallback(async () => {
        try {
            const [templatesSnap, layoutSnap] = await Promise.all([
                getDocs(query(collection(db, "emailTemplates"), orderBy("name"))),
                getDoc(doc(db, "siteSettings", "emailLayout")),
            ]);

            setTemplates(templatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as EmailTemplate)));
            if (layoutSnap.exists()) setEmailLayout(layoutSnap.data() as EmailLayoutSettings);
        } catch (error) {
            console.error("Error fetching supplemental data:", error);
        }
    }, [db]);

    useEffect(() => {
        if (!authLoading && canManage) {
            fetchRequests();
            fetchData();
        } else if (!authLoading && !canManage) {
            setLoading(false);
        }
    }, [canManage, authLoading, fetchRequests, fetchData]);

    const allCampuses = useMemo(() => {
        const campusSet = new Set(requests.map(u => u.campus).filter(Boolean));
        return Array.from(campusSet).sort();
    }, [requests]);

    const filteredRequests = useMemo(() => {
        return requests.filter(request => {
            const matchesDate = 
                (!dateRange?.from || (request.createdAt && new Date(request.createdAt.seconds * 1000) >= startOfDay(dateRange.from))) &&
                (!dateRange?.to || (request.createdAt && new Date(request.createdAt.seconds * 1000) <= endOfDay(dateRange.to)));
            
            let matchesCampus = true;
            if (!canViewAllCampuses) {
                matchesCampus = request.campus === currentUser?.campus;
            } else if (selectedCampus !== 'all') {
                matchesCampus = request.campus === selectedCampus;
            }
            
            const lowercasedSearch = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                request.firstName?.toLowerCase().includes(lowercasedSearch) ||
                request.lastName?.toLowerCase().includes(lowercasedSearch) ||
                request.email?.toLowerCase().includes(lowercasedSearch);

            return matchesDate && matchesCampus && matchesSearch;
        });
    }, [dateRange, requests, selectedCampus, searchTerm, canViewAllCampuses, currentUser]);

    const totalPages = Math.ceil(filteredRequests.length / usersPerPage);
    const paginatedRequests = filteredRequests.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCampus, usersPerPage, dateRange, searchTerm]);


    const sendFollowUpEmail = (request: HPRequest) => {
        if (!request.email) {
            toast({ variant: 'destructive', title: 'User has no email address.' });
            return;
        }
        setSelectedRequest(request);
        setTemplateViewState('list');
        setSelectedTemplate(null);
        setIsTemplateDialogOpen(true);
    };

    const handleSelectTemplate = (template: EmailTemplate) => {
        setSelectedTemplate(template);
        setTemplateViewState('preview');
    };

    const confirmSendFollowUp = async () => {
        if (!selectedRequest || !selectedTemplate) return;

        setIsProcessingEmail(selectedRequest.id);
        setIsTemplateDialogOpen(false);
        
        try {
            let subject = selectedTemplate.subject || '';
            let body = selectedTemplate.body || '';

            const placeholders: Record<string, any> = {
                userName: selectedRequest.displayName || selectedRequest.firstName || 'User',
                firstName: selectedRequest.firstName || '',
                lastName: selectedRequest.lastName || '',
                email: selectedRequest.email || '',
                phoneNumber: selectedRequest.phoneNumber || '',
                campus: selectedRequest.campus || '',
                hpNumber: selectedRequest.hpNumber || '',
                facilitatorName: selectedRequest.facilitatorName || '',
                classLadder: selectedRequest.classLadder || '',
                ministry: selectedRequest.ministry || '',
                charge: selectedRequest.charge || '',
            };

            Object.entries(placeholders).forEach(([key, val]) => {
                const regex = new RegExp(`{{${key}}}`, "g");
                subject = subject.replace(regex, String(val ?? ''));
                body = body.replace(regex, String(val ?? ''));
            });

            const htmlContent = marked.parse(body, { breaks: true });
            
            let finalHtml = `<div style="font-family:sans-serif;line-height:1.5;color:#2d3748;max-width:600px;margin:0 auto;">${htmlContent}</div>`;
            if (emailLayout) {
                finalHtml = wrapInEmailLayout(htmlContent as string, emailLayout);
            }

            await addDoc(collection(db, 'mail'), {
                to: [selectedRequest.email],
                message: {
                    subject: subject,
                    html: finalHtml,
                },
                templateId: selectedTemplate.id,
                userId: selectedRequest.id,
                createdAt: serverTimestamp(),
            });

            toast({ title: "Follow-up email queued successfully." });
        } catch (error) {
            console.error("Error queueing follow-up email:", error);
            toast({ variant: 'destructive', title: "Failed to queue email." });
        } finally {
            setIsProcessingEmail(null);
            setSelectedRequest(null);
            setSelectedTemplate(null);
        }
    };
    
    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.text("HP Placement Requests", 14, 16);
        autoTable(doc, {
            head: [['First Name', 'Last Name', 'Email', 'Campus', 'Phone', 'Gender', 'Age Range', 'Availability', 'Date Requested']],
            body: filteredRequests.map(r => [
                r.firstName || '',
                r.lastName || '',
                r.email || '',
                r.campus || 'N/A',
                r.phoneNumber || 'N/A',
                r.gender || 'N/A',
                r.ageRange || 'N/A',
                `${r.hpAvailabilityDay || ''} at ${r.hpAvailabilityTime || ''}`,
                r.createdAt ? format(new Date(r.createdAt.seconds * 1000), 'PPP') : 'N/A'
            ]),
            startY: 20
        });
        doc.save('hp_requests.pdf');
    };

    const handleExportCSV = () => {
        const data = filteredRequests.map(r => ({
            'First Name': r.firstName || '',
            'Last Name': r.lastName || '',
            Email: r.email || '',
            Campus: r.campus || 'N/A',
            'Phone Number': r.phoneNumber || 'N/A',
            Gender: r.gender || 'N/A',
            'Age Range': r.ageRange || 'N/A',
            'HP Number': r.hpNumber || 'N/A',
            'Facilitator': r.facilitatorName || 'N/A',
            Language: r.language || 'N/A',
            Charge: r.charge || 'N/A',
            'Availability Day': r.hpAvailabilityDay || '',
            'Availability Time': r.hpAvailabilityTime || '',
            'Date Requested': r.createdAt ? format(new Date(r.createdAt.seconds * 1000), 'yyyy-MM-dd') : 'N/A'
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'hp_requests.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (authLoading) return <p>Loading...</p>;

    if (!canManage) {
        return (
            <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>You do not have permission to manage HP requests.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl">
                    HP Placement Requests
                </h1>
                <p className="text-muted-foreground">
                    Review and follow up with users who need to be placed in a prayer group.
                </p>
            </div>
            <Card ref={tableRef}>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Pending Requests</CardTitle>
                            <CardDescription>{filteredRequests.length} requests showing.</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative flex-grow">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search name or email..."
                                    className="pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                             <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={!canViewAllCampuses}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder="Filter by campus" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Campuses</SelectItem>
                                    {allCampuses.map(campus => (
                                        <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    value={dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                                    onChange={(e) => {
                                        const from = e.target.value ? new Date(e.target.value.replace(/-/g, '/')) : undefined;
                                        setDateRange((prev) => ({ ...prev, from }));
                                    }}
                                    className="w-full sm:w-[150px]"
                                />
                                <span className="text-muted-foreground">-</span>
                                <Input
                                    type="date"
                                    value={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                                    onChange={(e) => {
                                        const to = e.target.value ? new Date(e.target.value.replace(/-/g, '/')) : undefined;
                                        setDateRange((prev) => ({ ...prev, to }));
                                    }}
                                    className="w-full sm:w-[150px]"
                                />
                            </div>
                            {dateRange && <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}><XIcon className="h-4 w-4" /></Button>}
                            <Button variant="outline" onClick={handleExportCSV}><Download className="mr-2 h-4 w-4" /> CSV</Button>
                            <Button variant="outline" onClick={handleExportPDF}><Download className="mr-2 h-4 w-4" /> PDF</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>First Name</TableHead>
                                    <TableHead>Last Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Campus</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Gender</TableHead>
                                    <TableHead>Age</TableHead>
                                    <TableHead>Availability</TableHead>
                                    <TableHead>Date Requested</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={10}><Skeleton className="h-8 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : paginatedRequests.length > 0 ? (
                                    paginatedRequests.map(request => (
                                        <TableRow key={request.id}>
                                            <TableCell className="font-medium">{request.firstName}</TableCell>
                                            <TableCell className="font-medium">{request.lastName}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{request.email}</TableCell>
                                            <TableCell>{request.campus}</TableCell>
                                            <TableCell className="capitalize">{request.language || 'N/A'}</TableCell>
                                            <TableCell>{request.phoneNumber || 'N/A'}</TableCell>
                                            <TableCell>{request.gender || 'N/A'}</TableCell>
                                            <TableCell>{request.ageRange || 'N/A'}</TableCell>
                                            <TableCell>{request.hpAvailabilityDay} at {request.hpAvailabilityTime}</TableCell>
                                            <TableCell>{request.createdAt ? format(new Date(request.createdAt.seconds * 1000), 'PPP') : 'N/A'}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => sendFollowUpEmail(request)} disabled={isProcessingEmail === request.id}>
                                                    {isProcessingEmail === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                                    Send Follow-up
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                                            No pending requests found for the selected filters.
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
                            <Select value={`${usersPerPage}`} onValueChange={value => setUsersPerPage(Number(value))}>
                                <SelectTrigger className="w-[70px]">
                                    <SelectValue placeholder={`${usersPerPage}`} />
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

            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {templateViewState === 'list' ? 'Select Email Template' : 'Preview Follow-up Email'}
                        </DialogTitle>
                        <DialogDescription>
                            {templateViewState === 'list' 
                                ? `Choose a template to send to ${selectedRequest?.displayName || selectedRequest?.email}.`
                                : `Review the email before sending to ${selectedRequest?.displayName || selectedRequest?.email}.`
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {templateViewState === 'list' ? (
                        <div className="space-y-4 py-4">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search templates..."
                                    className="pl-8"
                                    value={templateSearchTerm}
                                    onChange={(e) => setTemplateSearchTerm(e.target.value)}
                                />
                            </div>

                            <ScrollArea className="h-[300px] border rounded-md p-2">
                                <div className="grid gap-2">
                                    {templates
                                        .filter(t => t.name.toLowerCase().includes(templateSearchTerm.toLowerCase()))
                                        .map(template => (
                                            <Button
                                                key={template.id}
                                                variant="outline"
                                                className="justify-start h-auto py-3 px-4 flex flex-col items-start gap-1"
                                                onClick={() => handleSelectTemplate(template)}
                                            >
                                                <span className="font-semibold">{template.name}</span>
                                                <span className="text-xs text-muted-foreground line-clamp-1">{template.subject}</span>
                                            </Button>
                                        ))}
                                    {templates.filter(t => t.name.toLowerCase().includes(templateSearchTerm.toLowerCase())).length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground italic">
                                            No templates found matching "{templateSearchTerm}"
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    ) : (
                        <div className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Subject</Label>
                                <div className="p-3 border rounded-md bg-muted/30 font-medium">
                                    {(() => {
                                        let sub = selectedTemplate?.subject || '';
                                        const placeholders = {
                                            userName: selectedRequest?.displayName || selectedRequest?.firstName || 'User',
                                            firstName: selectedRequest?.firstName || '',
                                            lastName: selectedRequest?.lastName || '',
                                        };
                                        Object.entries(placeholders).forEach(([key, val]) => {
                                            const regex = new RegExp(`{{${key}}}`, "g");
                                            sub = sub.replace(regex, String(val ?? ''));
                                        });
                                        return sub;
                                    })()}
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Message Preview</Label>
                                <ScrollArea className="h-[300px] border rounded-md p-6 bg-white dark:bg-slate-950">
                                    <div 
                                        className="prose dark:prose-invert prose-sm max-w-full"
                                        dangerouslySetInnerHTML={{ 
                                            __html: (() => {
                                                let body = selectedTemplate?.body || '';
                                                const placeholders = {
                                                    userName: selectedRequest?.displayName || selectedRequest?.firstName || 'User',
                                                    firstName: selectedRequest?.firstName || '',
                                                    lastName: selectedRequest?.lastName || '',
                                                    email: selectedRequest?.email || '',
                                                    campus: selectedRequest?.campus || '',
                                                    hpNumber: selectedRequest?.hpNumber || '',
                                                    facilitatorName: selectedRequest?.facilitatorName || '',
                                                };
                                                Object.entries(placeholders).forEach(([key, val]) => {
                                                    const regex = new RegExp(`{{${key}}}`, "g");
                                                    body = body.replace(regex, String(val ?? ''));
                                                });
                                                return marked.parse(body, { breaks: true });
                                            })()
                                        }} 
                                    />
                                </ScrollArea>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
                        {templateViewState === 'preview' ? (
                            <>
                                <Button variant="ghost" onClick={() => setTemplateViewState('list')}>
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Back to List
                                </Button>
                                <Button onClick={confirmSendFollowUp} disabled={!!isProcessingEmail}>
                                    {isProcessingEmail === selectedRequest?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                    Send Message Now
                                </Button>
                            </>
                        ) : (
                            <Button variant="ghost" className="ml-auto" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
