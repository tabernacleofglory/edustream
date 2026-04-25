
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { User, Course, Enrollment, UserProgress } from "@/lib/types";

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Loader2, Search, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import Link from 'next/link';
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from 'lucide-react';

interface InProgressEnrollment {
  enrollmentId: string;
  user: User;
  course: Course;
  enrolledAt: Date;
  progress: number;
}

interface Campus {
  id: string;
  "Campus Name": string;
}

export default function OnlineCompletionsPage() {
  const db = getFirebaseFirestore();
  const { hasPermission, canViewAllCampuses, user: currentUser } = useAuth();
  const { toast } = useToast();

  const [inProgressEnrollments, setInProgressEnrollments] = useState<InProgressEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtering and Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampus, setSelectedCampus] = useState("all");
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const canManage = hasPermission('manageOnlineCompletions');

  const fetchData = useCallback(async () => {
    if (!canManage) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
        const [usersSnap, coursesSnap, enrollmentsSnap, progressSnap, campusesSnap] = await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(query(collection(db, "courses"), where('status', '==', 'published'))),
            getDocs(query(collection(db, "enrollments"), where('completedAt', '==', null))),
            getDocs(collection(db, "userVideoProgress")),
            getDocs(query(collection(db, "Campus"), orderBy("Campus Name"))),
        ]);

        const usersMap = new Map(usersSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as User]));
        const coursesMap = new Map(coursesSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Course]));
        const progressMap = new Map(progressSnap.docs.map(d => [`${d.data().userId}_${d.data().courseId}`, d.data() as UserProgress]));
        setAllCampuses(campusesSnap.docs.map(d => ({id: d.id, ...d.data()} as Campus)));
        
        const enrollments = enrollmentsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Enrollment & { id: string }))
            .map(enrollment => {
                const user = usersMap.get(enrollment.userId);
                const course = coursesMap.get(enrollment.courseId);
                if (!user || !course) return null;

                const progressData = progressMap.get(`${user.id}_${course.id}`);
                const progress = progressData?.totalProgress || 0;

                return {
                    enrollmentId: enrollment.id,
                    user,
                    course,
                    enrolledAt: (enrollment.enrolledAt as any).toDate(),
                    progress,
                };
            })
            .filter((item): item is InProgressEnrollment => item !== null);

        setInProgressEnrollments(enrollments);
    } catch (e) {
        console.error("Failed to fetch in-progress enrollments:", e);
        toast({ variant: "destructive", title: "Failed to load data." });
    } finally {
        setLoading(false);
    }
  }, [db, toast, canManage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredEnrollments = useMemo(() => {
    return inProgressEnrollments.filter(item => {
        const user = item.user;
        const course = item.course;
        
        const lowercasedSearch = searchTerm.toLowerCase();
        const matchesSearch = searchTerm === '' ||
            user.displayName?.toLowerCase().includes(lowercasedSearch) ||
            user.email?.toLowerCase().includes(lowercasedSearch) ||
            course.title.toLowerCase().includes(lowercasedSearch);
        
        let matchesCampus = true;
        if (!canViewAllCampuses) {
            matchesCampus = user.campus === currentUser?.campus;
        } else if (selectedCampus !== 'all') {
             const campus = allCampuses.find(c => c.id === selectedCampus);
             matchesCampus = user.campus === campus?.["Campus Name"];
        }
        
        return matchesSearch && matchesCampus;
    });
  }, [inProgressEnrollments, searchTerm, selectedCampus, canViewAllCampuses, currentUser, allCampuses]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCampus, rowsPerPage]);

  const totalPages = Math.ceil(filteredEnrollments.length / rowsPerPage);
  const paginatedEnrollments = filteredEnrollments.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  if (!canManage) {
    return (
      <Alert variant="destructive">
        <Lock className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view this page.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">In-Progress Enrollments</h1>
        <p className="text-muted-foreground">View all users who are currently enrolled in a course but have not yet completed it.</p>
      </div>

      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                 <div>
                    <CardTitle>Active Enrollments</CardTitle>
                    <CardDescription>{filteredEnrollments.length} records found.</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search..." 
                            className="pl-8" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                     <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={!canViewAllCampuses}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Filter by campus" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Campuses</SelectItem>
                            {allCampuses.map(campus => (
                                <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Campus</TableHead>
                            <TableHead>Enrolled On</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                                </TableRow>
                            ))
                        ) : paginatedEnrollments.length > 0 ? (
                             paginatedEnrollments.map(({ enrollmentId, user, course, enrolledAt, progress }) => (
                                <TableRow key={enrollmentId}>
                                    <TableCell className="font-medium">{user.displayName || user.email}</TableCell>
                                    <TableCell>{course.title}</TableCell>
                                    <TableCell>{user.campus || 'N/A'}</TableCell>
                                    <TableCell>{format(enrolledAt, 'PPP')}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Progress value={progress} className="w-24 h-2" />
                                            <span>{progress}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="ghost" size="icon">
                                            <Link href={`/admin/users/${user.id}`}>
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                                    No active enrollments found.
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
                    <Select value={`${rowsPerPage}`} onValueChange={val => setRowsPerPage(Number(val))}>
                        <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {[10, 25, 50, 100].map(size => (
                                <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                        Next <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
         )}
      </Card>
    </div>
  );
}
