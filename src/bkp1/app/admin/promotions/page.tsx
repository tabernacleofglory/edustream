
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, serverTimestamp, getDocs } from "firebase/firestore";
import type { PromotionRequest, User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Loader2, X, Download, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Papa from "papaparse";
import { Input } from "@/components/ui/input";


export default function PromotionRequestsPage() {
    const [requests, setRequests] = useState<PromotionRequest[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const { user, hasPermission, isCurrentUserAdmin } = useAuth();
    const { toast } = useToast();
    const db = getFirebaseFirestore();

    const [selectedCampus, setSelectedCampus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [usersPerPage, setUsersPerPage] = useState(10);

    const canManagePromotions = hasPermission('managePromotions');
    const isModerator = user?.role === 'moderator';

    const fetchUsers = useCallback(async () => {
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setUsers(usersList);
        } catch (e) {
            console.error("Error fetching users:", e);
            toast({ variant: 'destructive', title: 'Failed to fetch user data.'});
        }
    }, [db, toast]);

    useEffect(() => {
        if (!canManagePromotions) {
            setLoading(false);
            return;
        }

        fetchUsers();

        const q = query(
            collection(db, "promotionRequests"),
            where("status", "==", "pending"),
            orderBy("requestedAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requestList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as PromotionRequest));
            setRequests(requestList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching promotion requests:", error);
            toast({ variant: 'destructive', title: 'Failed to fetch requests.' });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [canManagePromotions, db, toast, fetchUsers]);

    // If moderator, automatically set their campus and disable the filter
    useEffect(() => {
        if (isModerator && user?.campus) {
            setSelectedCampus(user.campus);
        }
    }, [isModerator, user]);
    
    const usersMap = useMemo(() => {
        return new Map(users.map(u => [u.id, u]));
    }, [users]);
    
    const allCampuses = useMemo(() => {
        const campusSet = new Set(users.map(u => u.campus).filter(Boolean));
        return Array.from(campusSet).sort();
    }, [users]);
    
    const filteredRequests = useMemo(() => {
        return requests.filter(request => {
            const userForRequest = usersMap.get(request.userId);
            const matchesCampus = selectedCampus === 'all' || (userForRequest && userForRequest.campus === selectedCampus);
            
            const lowercasedSearch = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                request.userName?.toLowerCase().includes(lowercasedSearch) ||
                request.userEmail?.toLowerCase().includes(lowercasedSearch);

            return matchesCampus && matchesSearch;
        });
    }, [requests, usersMap, selectedCampus, searchTerm]);

    const totalPages = Math.ceil(filteredRequests.length / usersPerPage);
    const paginatedRequests = filteredRequests.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCampus, usersPerPage, searchTerm]);


    const handlePromotionDecision = async (request: PromotionRequest, decision: 'approved' | 'rejected') => {
        if (!user) return;
        setIsProcessing(request.id);
        try {
            const batch = writeBatch(db);
            
            const requestRef = doc(db, "promotionRequests", request.id);
            batch.update(requestRef, {
                status: decision,
                resolvedAt: serverTimestamp(),
                resolverId: user.uid,
            });

            if (decision === 'approved') {
                const userRef = doc(db, "users", request.userId);
                batch.update(userRef, {
                    classLadderId: request.requestedLadderId,
                    classLadder: request.requestedLadderName,
                });
            }

            await batch.commit();
            toast({ title: `Request ${decision}.` });

        } catch (error) {
            console.error("Error processing promotion:", error);
            toast({ variant: "destructive", title: "Failed to process promotion." });
        } finally {
            setIsProcessing(null);
        }
    };
    
    const handleExportCSV = () => {
        const dataToExport = filteredRequests.map(request => {
            const userForRequest = usersMap.get(request.userId);
            return {
                "User Name": request.userName,
                "Email": request.userEmail,
                "Campus": userForRequest?.campus || 'N/A',
                "Current Ladder": request.currentLadderName,
                "Requested Ladder": request.requestedLadderName,
                "Requested At": request.requestedAt ? format(request.requestedAt.toDate(), 'PPP p') : 'N/A',
            };
        });
        
        if (dataToExport.length === 0) {
            toast({ variant: 'destructive', title: 'No data to export.' });
            return;
        }

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `promotion_requests_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!canManagePromotions) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>You do not have permission to manage promotion requests.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl">
                    Promotion Requests
                </h1>
                <p className="text-muted-foreground">
                    Review and approve or reject user promotion requests.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <CardTitle>Pending Requests</CardTitle>
                            <CardDescription>{filteredRequests.length} requests found.</CardDescription>
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
                            <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={isModerator}>
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
                            <Button onClick={handleExportCSV} variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Campus</TableHead>
                                <TableHead>Current Ladder</TableHead>
                                <TableHead>Requested Ladder</TableHead>
                                <TableHead>Requested At</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                                    </TableRow>
                                ))
                            ) : paginatedRequests.length > 0 ? (
                                paginatedRequests.map(request => (
                                    <TableRow key={request.id}>
                                        <TableCell>
                                            <div className="font-medium">{request.userName}</div>
                                            <div className="text-sm text-muted-foreground">{request.userEmail}</div>
                                        </TableCell>
                                         <TableCell>{usersMap.get(request.userId)?.campus || 'N/A'}</TableCell>
                                        <TableCell>{request.currentLadderName}</TableCell>
                                        <TableCell>{request.requestedLadderName}</TableCell>
                                        <TableCell>
                                            {request.requestedAt ? formatDistanceToNow(request.requestedAt.toDate(), { addSuffix: true }) : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isProcessing === request.id ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <div className="flex gap-2 justify-end">
                                                    <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handlePromotionDecision(request, 'rejected')}>
                                                        <X className="mr-2 h-4 w-4" /> Reject
                                                    </Button>
                                                    <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => handlePromotionDecision(request, 'approved')}>
                                                        <Check className="mr-2 h-4 w-4" /> Approve
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                        No pending promotion requests.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
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
        </div>
    );
}
