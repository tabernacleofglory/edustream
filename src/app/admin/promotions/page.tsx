
"use client";

import { useState, useEffect, useCallback } from "react";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import type { PromotionRequest } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Loader2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function PromotionRequestsPage() {
    const [requests, setRequests] = useState<PromotionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const { user, hasPermission } = useAuth();
    const { toast } = useToast();
    const db = getFirebaseFirestore();

    const canManagePromotions = hasPermission('managePromotions');

    useEffect(() => {
        if (!canManagePromotions) {
            setLoading(false);
            return;
        }

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
    }, [canManagePromotions, db, toast]);

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
                    <CardTitle>Pending Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
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
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
                                    </TableRow>
                                ))
                            ) : requests.length > 0 ? (
                                requests.map(request => (
                                    <TableRow key={request.id}>
                                        <TableCell>
                                            <div className="font-medium">{request.userName}</div>
                                            <div className="text-sm text-muted-foreground">{request.userEmail}</div>
                                        </TableCell>
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
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                        No pending promotion requests.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
