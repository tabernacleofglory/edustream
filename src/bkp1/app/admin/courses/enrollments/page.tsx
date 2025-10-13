
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Users, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Course, User, Enrollment, UserProgress, UserQuizResult } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

const getInitials = (name?: string | null) => (!name ? "U" : name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join(""));

interface DiscrepancyData {
    courseId: string;
    courseName: string;
    enrolledCount: number;
    activityCount: number;
    discrepancyCount: number;
    discrepancyUsers: User[];
}

export default function EnrollmentSyncPage() {
    const [discrepancyData, setDiscrepancyData] = useState<DiscrepancyData[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);
    const [viewingCourse, setViewingCourse] = useState<DiscrepancyData | null>(null);
    const { hasPermission } = useAuth();
    
    const canManageCourses = hasPermission('manageCourses');

    const calculateDiscrepancies = useCallback(async () => {
        setLoading(true);
        try {
            const [coursesSnap, usersSnap, enrollmentsSnap, progressSnap, quizzesSnap] = await Promise.all([
                getDocs(collection(db, 'courses')),
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'enrollments')),
                getDocs(collection(db, 'userVideoProgress')),
                getDocs(collection(db, 'userQuizResults'))
            ]);

            const allCourses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
            const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
            const usersMap = new Map(allUsers.map(u => [u.id, u]));

            const enrollmentsByCourse = new Map<string, Set<string>>();
            enrollmentsSnap.forEach(d => {
                const enrollment = d.data() as Enrollment;
                if (!enrollmentsByCourse.has(enrollment.courseId)) {
                    enrollmentsByCourse.set(enrollment.courseId, new Set());
                }
                enrollmentsByCourse.get(enrollment.courseId)!.add(enrollment.userId);
            });

            const activityByCourse = new Map<string, Set<string>>();
            progressSnap.forEach(d => {
                const progress = d.data() as UserProgress;
                if (!activityByCourse.has(progress.courseId)) {
                    activityByCourse.set(progress.courseId, new Set());
                }
                activityByCourse.get(progress.courseId)!.add(progress.userId);
            });
            quizzesSnap.forEach(d => {
                const result = d.data() as UserQuizResult;
                if (!activityByCourse.has(result.courseId)) {
                    activityByCourse.set(result.courseId, new Set());
                }
                activityByCourse.get(result.courseId)!.add(result.userId);
            });
            
            const results = allCourses.map(course => {
                const enrolledUserIds = enrollmentsByCourse.get(course.id) || new Set();
                const activityUserIds = activityByCourse.get(course.id) || new Set();
                
                const discrepancyUserIds = [...activityUserIds].filter(uid => !enrolledUserIds.has(uid));
                const discrepancyUsers = discrepancyUserIds.map(uid => usersMap.get(uid)).filter(Boolean) as User[];
                
                return {
                    courseId: course.id,
                    courseName: course.title,
                    enrolledCount: enrolledUserIds.size,
                    activityCount: activityUserIds.size,
                    discrepancyCount: discrepancyUserIds.length,
                    discrepancyUsers
                };
            });

            setDiscrepancyData(results);

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Failed to calculate enrollment discrepancies.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (canManageCourses) {
            calculateDiscrepancies();
        } else {
            setLoading(false);
        }
    }, [canManageCourses, calculateDiscrepancies]);

    const handleSync = async (course: DiscrepancyData) => {
        if(course.discrepancyUsers.length === 0) {
            toast({ description: "No users to sync." });
            return;
        }
        setSyncingCourseId(course.courseId);
        try {
            const batch = writeBatch(db);
            const courseRef = doc(db, 'courses', course.courseId);

            course.discrepancyUsers.forEach(user => {
                const enrollmentId = `${user.id}_${course.courseId}`;
                const enrollmentRef = doc(db, 'enrollments', enrollmentId);
                batch.set(enrollmentRef, {
                    userId: user.id,
                    courseId: course.courseId,
                    enrolledAt: serverTimestamp()
                });
            });

            batch.update(courseRef, {
                enrollmentCount: increment(course.discrepancyUsers.length)
            });

            await batch.commit();

            toast({
                title: 'Sync Complete',
                description: `${course.discrepancyUsers.length} users have been enrolled in "${course.courseName}".`
            });
            
            calculateDiscrepancies(); // Refresh data

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: "Sync failed." });
        } finally {
            setSyncingCourseId(null);
        }
    }
    
    if (!canManageCourses) {
        return <p>You do not have permission to view this page.</p>;
    }
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl">Course Enrollment Synchronization</h1>
                <p className="text-muted-foreground">Identify and enroll users who have course activity but no official enrollment record.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Enrollment Status</CardTitle>
                    <CardDescription>Review courses with discrepancies and sync to fix them.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Course Name</TableHead>
                                <TableHead className="text-center">Enrolled Users</TableHead>
                                <TableHead className="text-center">Non-Enrolled Activity</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32 mx-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-10 w-36 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : discrepancyData.map(d => (
                                <TableRow key={d.courseId}>
                                    <TableCell className="font-medium">{d.courseName}</TableCell>
                                    <TableCell className="text-center">{d.enrolledCount}</TableCell>
                                    <TableCell className="text-center">{d.discrepancyCount}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => setViewingCourse(d)} 
                                                disabled={d.discrepancyCount === 0}
                                            >
                                                <Eye className="mr-2 h-4 w-4" /> View
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                onClick={() => handleSync(d)}
                                                disabled={d.discrepancyCount === 0 || syncingCourseId === d.courseId}
                                            >
                                                {syncingCourseId === d.courseId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                                Sync
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            <Dialog open={!!viewingCourse} onOpenChange={() => setViewingCourse(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Non-Enrolled Users for "{viewingCourse?.courseName}"</DialogTitle>
                        <DialogDescription>These users have activity in the course but are not officially enrolled.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-96 my-4">
                        <div className="space-y-2 pr-6">
                            {viewingCourse?.discrepancyUsers.map(user => (
                                <div key={user.id} className="flex items-center gap-3 p-2 border rounded-md">
                                    <Avatar>
                                        <AvatarImage src={user.photoURL || undefined} />
                                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">{user.displayName}</p>
                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={() => setViewingCourse(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

    