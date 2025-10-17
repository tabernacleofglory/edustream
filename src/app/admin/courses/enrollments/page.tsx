
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, writeBatch, serverTimestamp, increment, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Users, RefreshCw, BookCopy, AlertTriangle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Course, User, Enrollment, UserProgress, UserQuizResult, CourseGroup, OnsiteCompletion } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';


const getInitials = (name?: string | null) => (!name ? "U" : name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join(""));

interface ActiveUser {
    userId: string;
    userName: string;
    userEmail?: string | null;
    photoURL?: string | null;
    enrollments: { courseId: string; courseTitle: string }[];
    completedCourses: { courseId: string; courseTitle: string }[];
}

interface PathActivityData {
    pathId: string;
    pathName: string;
    activeUsers: ActiveUser[];
}

const PaginatedUserTable = ({ pathData, onUserView }: { pathData: PathActivityData, onUserView: (user: ActiveUser) => void }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [usersPerPage, setUsersPerPage] = useState(5);
    
    const totalPages = Math.ceil(pathData.activeUsers.length / usersPerPage);
    const paginatedUsers = pathData.activeUsers.slice(
        (currentPage - 1) * usersPerPage,
        currentPage * usersPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [usersPerPage, pathData.activeUsers]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><BookCopy className="h-5 w-5" />{pathData.pathName}</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="border rounded-lg overflow-hidden">
                    <Table>
                         <TableHeader>
                            <TableRow>
                                <TableHead>Members</TableHead>
                                <TableHead className="text-center">Enrolled Courses</TableHead>
                                <TableHead className="text-center">Completed Courses</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedUsers.map(user => (
                                <TableRow key={user.userId}>
                                    <TableCell className="font-medium">{user.userName}</TableCell>
                                    <TableCell className="text-center">{user.enrollments.length}</TableCell>
                                    <TableCell className="text-center">{user.completedCourses.length}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => onUserView(user)}>
                                            <Eye className="mr-2 h-4 w-4" /> View Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
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
                                {[5, 10, 20].map(size => (
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
    );
};


export default function EnrollmentSyncPage() {
    const [pathActivityData, setPathActivityData] = useState<PathActivityData[]>([]);
    const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [viewingUser, setViewingUser] = useState<ActiveUser | null>(null);
    const [userProgress, setUserProgress] = useState<Record<string, number>>({});
    const [onsiteCompletions, setOnsiteCompletions] = useState<OnsiteCompletion[]>([]);
    const { hasPermission } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    
    const canManageCourses = hasPermission('manageCourses');

    const calculateActivity = useCallback(async () => {
        setLoading(true);
        try {
            const [coursesSnap, usersSnap, enrollmentsSnap, courseGroupsSnap, onsiteCompletionsSnap] = await Promise.all([
                getDocs(query(collection(db, 'courses'), where('status', '==', 'published'))),
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'enrollments')),
                getDocs(collection(db, 'courseGroups')),
                getDocs(collection(db, 'onsiteCompletions')),
            ]);

            const allCourses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
            const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
            const allEnrollments = enrollmentsSnap.docs.map(d => d.data() as Enrollment);
            const allCourseGroups = courseGroupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CourseGroup));
            const allOnsiteCompletions = onsiteCompletionsSnap.docs.map(d => d.data() as OnsiteCompletion);
            setCourseGroups(allCourseGroups);

            const usersMap = new Map(allUsers.map(u => [u.id, u]));
            const coursesMap = new Map(allCourses.map(c => [c.id, c]));
            
            const enrollmentsByUser = new Map<string, Enrollment[]>();
            allEnrollments.forEach(e => {
                if (!enrollmentsByUser.has(e.userId)) enrollmentsByUser.set(e.userId, []);
                enrollmentsByUser.get(e.userId)!.push(e);
            });
            
            const onsiteCompletionsByUser = new Map<string, OnsiteCompletion[]>();
            allOnsiteCompletions.forEach(oc => {
                if (!onsiteCompletionsByUser.has(oc.userId)) onsiteCompletionsByUser.set(oc.userId, []);
                onsiteCompletionsByUser.get(oc.userId)!.push(oc);
            });

            const allActiveUserIds = new Set([...enrollmentsByUser.keys(), ...onsiteCompletionsByUser.keys()]);
            
            const activityByPath = new Map<string, ActiveUser[]>();

            allCourseGroups.forEach(group => {
                const usersInPath: ActiveUser[] = [];
                allActiveUserIds.forEach(userId => {
                    const userEnrollments = enrollmentsByUser.get(userId) || [];
                    const userOnsiteCompletions = onsiteCompletionsByUser.get(userId) || [];
                    
                    const enrolledInPath = userEnrollments.filter(e => group.courseIds.includes(e.courseId));
                    const onsiteInPath = userOnsiteCompletions.filter(oc => group.courseIds.includes(oc.courseId));
                    
                    if (enrolledInPath.length > 0 || onsiteInPath.length > 0) {
                        const user = usersMap.get(userId);
                        if (user) {
                           usersInPath.push({
                                userId: user.id,
                                userName: user.displayName || 'Unknown',
                                userEmail: user.email,
                                photoURL: user.photoURL,
                                enrollments: enrolledInPath.map(e => ({
                                    courseId: e.courseId,
                                    courseTitle: coursesMap.get(e.courseId)?.title || 'Unknown Course'
                                })),
                                completedCourses: (enrollmentsByUser.get(userId) || [])
                                    .filter(e => e.completedAt)
                                    .map(e => ({
                                        courseId: e.courseId,
                                        courseTitle: coursesMap.get(e.courseId)?.title || 'Unknown Course'
                                    }))
                           });
                        }
                    }
                });
                if(usersInPath.length > 0) {
                     activityByPath.set(group.id, usersInPath);
                }
            });
            
            const activityResults: PathActivityData[] = allCourseGroups
                .filter(group => activityByPath.has(group.id))
                .map(group => ({
                    pathId: group.id,
                    pathName: group.title,
                    activeUsers: activityByPath.get(group.id)!
                }));
            setPathActivityData(activityResults);

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Failed to calculate user activity.' });
        } finally {
            setLoading(false);
        }
    }, [toast, db]);

    const filteredPathData = useMemo(() => {
        if (!searchTerm) {
            return pathActivityData;
        }
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        
        return pathActivityData
            .map(pathData => {
                const filteredUsers = pathData.activeUsers.filter(user => 
                    user.userName.toLowerCase().includes(lowercasedSearchTerm)
                );
                return { ...pathData, activeUsers: filteredUsers };
            })
            .filter(pathData => pathData.activeUsers.length > 0);
    }, [pathActivityData, searchTerm]);


    useEffect(() => {
        if (canManageCourses) {
            calculateActivity();
        } else {
            setLoading(false);
        }
    }, [canManageCourses, calculateActivity]);
    
    useEffect(() => {
        const fetchUserData = async () => {
            if (!viewingUser) return;
            // Fetch progress
            const userProgressQuery = query(collection(db, 'userVideoProgress'), where('userId', '==', viewingUser.userId));
            const progressSnap = await getDocs(userProgressQuery);
            const progressData: Record<string, number> = {};
            progressSnap.forEach(doc => {
                const data = doc.data() as UserProgress;
                progressData[data.courseId] = data.totalProgress;
            });
            setUserProgress(progressData);
            
            // Fetch onsite completions
            const onsiteQuery = query(collection(db, 'onsiteCompletions'), where('userId', '==', viewingUser.userId));
            const onsiteSnap = await getDocs(onsiteQuery);
            setOnsiteCompletions(onsiteSnap.docs.map(d => d.data() as OnsiteCompletion));
        };
        fetchUserData();
    }, [viewingUser, db]);
    
    if (!canManageCourses) {
        return <p>You do not have permission to view this page.</p>;
    }
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl">User Activity Report</h1>
                <p className="text-muted-foreground">View all users with enrollments or on-site attendance, grouped by learning path.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Active Users by Learning Path</CardTitle>
                    <CardDescription>A list of all users who are currently enrolled or have completed courses within each path.</CardDescription>
                     <div className="relative pt-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by user name..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                 <CardContent>
                    {loading ? (
                        <Skeleton className="h-48 w-full" />
                    ) : filteredPathData.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                            {searchTerm ? "No users match your search." : "No active users found."}
                        </p>
                    ) : (
                        <div className="space-y-6">
                            {filteredPathData.map(pathData => (
                                <PaginatedUserTable key={pathData.pathId} pathData={pathData} onUserView={setViewingUser} />
                            ))}
                        </div>
                    )}
                 </CardContent>
            </Card>

             <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>User Enrollment Details</DialogTitle>
                         {viewingUser && (
                             <DialogDescription>Viewing details for {viewingUser.userName}.</DialogDescription>
                         )}
                    </DialogHeader>
                     {viewingUser && (
                        <div className="py-4 space-y-6">
                             <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={viewingUser.photoURL || undefined} />
                                    <AvatarFallback>{getInitials(viewingUser.userName)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-lg font-semibold">{viewingUser.userName}</h3>
                                    <p className="text-sm text-muted-foreground">{viewingUser.userEmail}</p>
                                </div>
                             </div>
                             <div>
                                <h4 className="font-semibold text-md mb-2">Concurrently Enrolled Courses</h4>
                                <div className="space-y-3">
                                    {viewingUser.enrollments.map(e => (
                                        <div key={e.courseId}>
                                            <div className="flex justify-between items-center text-sm">
                                                <span>{e.courseTitle}</span>
                                                <span className="font-medium">{userProgress[e.courseId] || 0}%</span>
                                            </div>
                                            <Progress value={userProgress[e.courseId] || 0} className="h-2 mt-1" />
                                        </div>
                                    ))}
                                </div>
                             </div>
                              <div>
                                <h4 className="font-semibold text-md mb-2">Completed Courses</h4>
                                {viewingUser.completedCourses.length > 0 ? (
                                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                        {viewingUser.completedCourses.map(c => (
                                            <li key={c.courseId}>{c.courseTitle}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No completed courses in this path.</p>
                                )}
                             </div>
                             <div>
                                <h4 className="font-semibold text-md mb-2">On-site Completions</h4>
                                {onsiteCompletions.length > 0 ? (
                                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                        {onsiteCompletions.map(c => (
                                            <li key={c.id}>{c.courseName}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No on-site completions recorded.</p>
                                )}
                             </div>
                        </div>
                     )}
                     <DialogFooter>
                        <Button variant="secondary" onClick={() => setViewingUser(null)}>Close</Button>
                        <Button asChild>
                            <Link href={`/admin/users/${viewingUser?.userId}`}>Go to User Profile</Link>
                        </Button>
                     </DialogFooter>
                </DialogContent>
             </Dialog>
        </div>
    );
}

    