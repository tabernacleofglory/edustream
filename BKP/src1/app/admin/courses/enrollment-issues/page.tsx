
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, RefreshCw, BookCopy, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Course, User, UserProgress, UserQuizResult, CourseGroup } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';

const getInitials = (name?: string | null) => (!name ? "U" : name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join(""));

interface DiscrepancyUser extends User {
    lastActivity: Date;
    activityType: 'video' | 'quiz';
}

interface DiscrepancyData {
    courseId: string;
    courseName: string;
    enrolledCount: number;
    activityCount: number;
    discrepancyCount: number;
    discrepancyUsers: DiscrepancyUser[];
}

export default function EnrollmentIssuesPage() {
    const [discrepancyData, setDiscrepancyData] = useState<DiscrepancyData[]>([]);
    const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [syncingCourseId, setSyncingCourseId] = useState<string | null>(null);
    const [viewingDiscrepancyCourse, setViewingDiscrepancyCourse] = useState<DiscrepancyData | null>(null);
    const { hasPermission } = useAuth();
    
    const canManageCourses = hasPermission('manageCourses');

    const calculateDiscrepancies = useCallback(async () => {
        setLoading(true);
        try {
            const [coursesSnap, usersSnap, enrollmentsSnap, progressSnap, quizzesSnap, courseGroupsSnap] = await Promise.all([
                getDocs(query(collection(db, 'courses'), where('status', '==', 'published'))),
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'enrollments')),
                getDocs(collection(db, 'userVideoProgress')),
                getDocs(collection(db, 'userQuizResults')),
                getDocs(collection(db, 'courseGroups')),
            ]);

            const allCourses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
            const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
            const allEnrollments = enrollmentsSnap.docs.map(d => d.data() as Enrollment);
            const allCourseGroups = courseGroupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CourseGroup));
            setCourseGroups(allCourseGroups);

            const usersMap = new Map(allUsers.map(u => [u.id, u]));
            
            const enrollmentsByCourse = new Map<string, Set<string>>();
            allEnrollments.forEach(e => {
                if (!enrollmentsByCourse.has(e.courseId)) {
                    enrollmentsByCourse.set(e.courseId, new Set());
                }
                enrollmentsByCourse.get(e.courseId)!.add(e.userId);
            });
            
            type ActivityDetails = { lastActivity: Date, activityType: 'video' | 'quiz' };
            const activityByCourse = new Map<string, Map<string, ActivityDetails>>();

            progressSnap.forEach(d => {
                const progress = d.data() as UserProgress;
                if (!activityByCourse.has(progress.courseId)) activityByCourse.set(progress.courseId, new Map());
                const activityDate = (progress as any).updatedAt?.toDate();
                if (activityDate) {
                    const existing = activityByCourse.get(progress.courseId)!.get(progress.userId);
                    if (!existing || activityDate > existing.lastActivity) {
                        activityByCourse.get(progress.courseId)!.set(progress.userId, { lastActivity: activityDate, activityType: 'video' });
                    }
                }
            });
            quizzesSnap.forEach(d => {
                const result = d.data() as UserQuizResult;
                if (!activityByCourse.has(result.courseId)) activityByCourse.set(result.courseId, new Map());
                 const activityDate = (result as any).attemptedAt?.toDate();
                 if (activityDate) {
                    const existing = activityByCourse.get(result.courseId)!.get(result.userId);
                    if (!existing || activityDate > existing.lastActivity) {
                        activityByCourse.get(result.courseId)!.set(result.userId, { lastActivity: activityDate, activityType: 'quiz' });
                    }
                }
            });
            
            const discrepancyResults = allCourses.map(course => {
                const enrolledUserIds = enrollmentsByCourse.get(course.id) || new Set();
                const activityUserMap = activityByCourse.get(course.id) || new Map();
                
                const discrepancyUsers: DiscrepancyUser[] = [];
                activityUserMap.forEach((details, userId) => {
                    if (!enrolledUserIds.has(userId)) {
                        const user = usersMap.get(userId);
                        if (user) discrepancyUsers.push({ ...user, ...details });
                    }
                });
                
                return {
                    courseId: course.id,
                    courseName: course.title,
                    enrolledCount: course.enrollmentCount || 0,
                    activityCount: activityUserMap.size,
                    discrepancyCount: discrepancyUsers.length,
                    discrepancyUsers: discrepancyUsers.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()),
                };
            });

            setDiscrepancyData(discrepancyResults);

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Failed to calculate enrollment discrepancies.' });
        } finally {
            setLoading(false);
        }
    }, [toast, db]);

    const groupedDiscrepancyData = useMemo(() => {
        const groups: { [key: string]: DiscrepancyData[] } = {};
        const uncategorized: DiscrepancyData[] = [];
        
        const courseToGroupMap = new Map<string, string[]>();
        courseGroups.forEach(group => {
            group.courseIds.forEach(courseId => {
                if (!courseToGroupMap.has(courseId)) courseToGroupMap.set(courseId, []);
                courseToGroupMap.get(courseId)!.push(group.title);
            });
        });

        discrepancyData.forEach(course => {
            const groupTitles = courseToGroupMap.get(course.courseId);
            if (groupTitles && groupTitles.length > 0) {
                groupTitles.forEach(title => {
                    if (!groups[title]) groups[title] = [];
                    groups[title].push(course);
                });
            } else {
                uncategorized.push(course);
            }
        });

        const groupedArray = Object.entries(groups).map(([title, courses]) => ({
            title,
            courses
        }));

        if (uncategorized.length > 0) {
            groupedArray.push({ title: 'Uncategorized', courses: uncategorized });
        }

        return groupedArray;

    }, [discrepancyData, courseGroups]);

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
    };
    
    if (!canManageCourses) {
        return <p>You do not have permission to view this page.</p>;
    }
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl">Enrollment Issues</h1>
                <p className="text-muted-foreground">Identify and fix enrollment issues, such as users with activity but no enrollment record.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Non-Enrolled Users with Activity</CardTitle>
                    <CardDescription>Review courses where users have activity (e.g., watched a video) but are not officially enrolled.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-48 w-full" />
                    ) : (
                        <div className="space-y-6">
                            {groupedDiscrepancyData.map(group => (
                                <div key={group.title}>
                                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><BookCopy className="h-5 w-5" />{group.title}</h3>
                                    <div className="border rounded-lg overflow-hidden">
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
                                                {group.courses.map(d => (
                                                    <TableRow key={d.courseId}>
                                                        <TableCell className="font-medium">{d.courseName}</TableCell>
                                                        <TableCell className="text-center">{d.enrolledCount}</TableCell>
                                                        <TableCell className="text-center">{d.discrepancyCount}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    onClick={() => setViewingDiscrepancyCourse(d)} 
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
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <Dialog open={!!viewingDiscrepancyCourse} onOpenChange={() => setViewingDiscrepancyCourse(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Non-Enrolled Users for "{viewingDiscrepancyCourse?.courseName}"</DialogTitle>
                        <DialogDescription>These users have activity in the course but are not officially enrolled.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-96 my-4">
                        <div className="space-y-2 pr-6">
                            {viewingDiscrepancyCourse?.discrepancyUsers.map(user => (
                                <div key={user.id} className="flex items-center gap-3 p-2 border rounded-md">
                                    <Avatar>
                                        <AvatarImage src={user.photoURL || undefined} />
                                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                                    </Avatar>
                                    <div className='flex-1'>
                                        <p className="font-medium">{user.displayName}</p>
                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold capitalize">
                                            {user.activityType === 'video' ? 'Watched video' : 'Attempted quiz'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(user.lastActivity, { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={() => setViewingDiscrepancyCourse(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

