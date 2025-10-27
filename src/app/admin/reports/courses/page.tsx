
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { User, Course, UserProgress, Enrollment, CourseGroup, OnsiteCompletion, Ladder } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Calendar as CalendarIcon, X as XIcon, Search, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import Papa from 'papaparse';
import { format, isValid, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface Campus {
  id: string;
  "Campus Name": string;
}

interface EnrollmentReportData {
    id: string;
    userId: string;
    userName: string;
    userCampus: string;
    courseId: string;
    courseTitle: string;
    enrolledAt?: Date;
    completedAt?: Date | null;
    totalProgress: number;
    completionType: 'Online' | 'On-site';
}

export default function CourseReportsPage() {
  const { user: currentUser, canViewAllCampuses, hasPermission } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allCourseGroups, setAllCourseGroups] = useState<CourseGroup[]>([]);
  const [allLadders, setAllLadders] = useState<Ladder[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [enrollmentReportData, setEnrollmentReportData] = useState<EnrollmentReportData[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCourse, setSelectedCourse] = useState<string | "all">("all");
  const [selectedCampus, setSelectedCampus] = useState<string | "all">("all");
  const [selectedCompletionType, setSelectedCompletionType] = useState<'all' | 'Online' | 'On-site'>('all');
  const [completionStatusFilter, setCompletionStatusFilter] = useState<'all' | 'completed' | 'in-progress'>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  const canViewReports = hasPermission('viewReports');

  const fetchAllData = useCallback(async () => {
    if (!canViewReports) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usersSnap, coursesSnap, groupsSnap, laddersSnap, campusesSnap, enrollmentsSnap, progressSnap, onsiteCompletionsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'courses'), where('status', '==', 'published'))),
        getDocs(collection(db, 'courseGroups')),
        getDocs(query(collection(db, 'courseLevels'), orderBy('order'))),
        getDocs(query(collection(db, 'Campus'), orderBy("Campus Name"))),
        getDocs(query(collection(db, 'enrollments'), orderBy('enrolledAt', 'desc'))),
        getDocs(collection(db, 'userVideoProgress')),
        getDocs(query(collection(db, 'onsiteCompletions'), orderBy('completedAt', 'desc')))
      ]);

      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      const coursesList = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      const groupsList = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseGroup));
      const laddersList = laddersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder));
      const campusesList = campusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus));
      const enrollmentsList = enrollmentsSnap.docs.map(doc => ({ id: `${doc.data().userId}_${doc.data().courseId}`, ...doc.data() } as Enrollment & { id: string }));
      const progressList = progressSnap.docs.map(doc => doc.data() as UserProgress);
      const onsiteCompletionsList = onsiteCompletionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnsiteCompletion & { id: string }));

      setAllUsers(usersList);
      setAllCourses(coursesList);
      setAllCourseGroups(groupsList);
      setAllLadders(laddersList);
      setAllCampuses(campusesList);

      const progressMap = new Map(progressList.map(p => [`${p.userId}_${p.courseId}`, p.totalProgress]));

      const onlineEnrollments: EnrollmentReportData[] = enrollmentsList.map(enrollment => {
        const user = usersList.find(u => u.id === enrollment.userId);
        const course = coursesList.find(c => c.id === enrollment.courseId);
        return {
          id: enrollment.id,
          userId: enrollment.userId,
          userName: user?.displayName || 'Unknown User',
          userCampus: user?.campus || 'N/A',
          courseId: enrollment.courseId,
          courseTitle: course?.title || 'Unknown Course',
          enrolledAt: enrollment.enrolledAt.toDate(),
          completedAt: enrollment.completedAt?.toDate(),
          totalProgress: progressMap.get(`${enrollment.userId}_${enrollment.courseId}`) || 0,
          completionType: 'Online',
        };
      });

      const onsiteCompletions: EnrollmentReportData[] = onsiteCompletionsList.map(completion => {
        const user = usersList.find(u => u.id === completion.userId);
        const course = coursesList.find(c => c.id === completion.courseId);
        return {
          id: completion.id,
          userId: completion.userId,
          userName: user?.displayName || completion.userName,
          userCampus: user?.campus || completion.userCampus,
          courseId: completion.courseId,
          courseTitle: course?.title || completion.courseName,
          enrolledAt: user?.createdAt?.toDate(),
          completedAt: completion.completedAt.toDate(),
          totalProgress: 100, 
          completionType: 'On-site',
        };
      });

      const combinedData = [...onlineEnrollments, ...onsiteCompletions].sort((a,b) => (b.completedAt?.getTime() || b.enrolledAt?.getTime() || 0) - (a.completedAt?.getTime() || a.enrolledAt?.getTime() || 0));
      
      setEnrollmentReportData(combinedData);

    } catch (error) {
      console.error("Failed to fetch course report data:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load report data.' });
    } finally {
      setLoading(false);
    }
  }, [db, toast, canViewReports]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const filteredEnrollmentData = useMemo(() => {
    return enrollmentReportData.filter(item => {
        const matchesCourse = selectedCourse === 'all' || 
            (selectedCourse.startsWith('group_')
                ? allCourseGroups.find(g => `group_${g.id}` === selectedCourse)?.courseIds.includes(item.courseId)
                : item.courseId === selectedCourse);

        const userForReport = allUsers.find(u => u.id === item.userId);
        const userCampus = userForReport?.campus || item.userCampus;
        
        let matchesCampus = true;
        if (!canViewAllCampuses) {
            matchesCampus = userCampus === currentUser?.campus;
        } else if (selectedCampus !== 'all') {
            const campusData = allCampuses.find(c => c.id === selectedCampus);
            matchesCampus = userCampus === campusData?.["Campus Name"];
        }
        
        const matchesCompletionType = selectedCompletionType === 'all' || item.completionType === selectedCompletionType;
        
        const matchesStatus = completionStatusFilter === 'all' ||
            (completionStatusFilter === 'completed' && !!item.completedAt) ||
            (completionStatusFilter === 'in-progress' && !item.completedAt);

        const referenceDate = item.completedAt || item.enrolledAt;
        const matchesDate = !referenceDate || (
            (!dateRange?.from || referenceDate >= startOfDay(dateRange.from)) &&
            (!dateRange?.to || referenceDate <= endOfDay(dateRange.to))
        );

        const matchesSearch = searchTerm === '' ||
            item.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.courseTitle.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesCourse && matchesCampus && matchesCompletionType && matchesDate && matchesSearch && matchesStatus;
    });
  }, [enrollmentReportData, selectedCourse, selectedCampus, selectedCompletionType, dateRange, searchTerm, allCourseGroups, allCampuses, completionStatusFilter, allUsers, canViewAllCampuses, currentUser]);
  
  const completionCount = useMemo(() => {
    return filteredEnrollmentData.filter(item => item.completedAt).length;
  }, [filteredEnrollmentData]);
  
 const learningPathSummary = useMemo(() => {
    const allUsersWhoCompletedAPath = new Set<string>();

    const summary = allCourseGroups.map(group => {
        const courseIdsInGroup = new Set(group.courseIds);
        const usersInPath = new Set<string>();
        enrollmentReportData.forEach(e => {
            if (courseIdsInGroup.has(e.courseId)) {
                usersInPath.add(e.userId);
            }
        });

        let fullyCompletedUsers = 0;
        let onSiteCompletions = 0;
        let onlineCompletions = 0;

        usersInPath.forEach(userId => {
            const user = allUsers.find(u => u.id === userId);
            if (!user) return;

            const coursesRequiredForUser = allCourses.filter(c => 
                courseIdsInGroup.has(c.id) && c.language === user.language
            );
            
            if (coursesRequiredForUser.length > 0) {
                const userCompletedCourses = new Map<string, 'Online' | 'On-site'>();
                enrollmentReportData
                    .filter(e => e.userId === userId && e.completedAt)
                    .forEach(e => {
                        userCompletedCourses.set(e.courseId, e.completionType);
                    });

                if (coursesRequiredForUser.every(c => userCompletedCourses.has(c.id))) {
                    fullyCompletedUsers++;
                    allUsersWhoCompletedAPath.add(userId);
                    
                    const completionTypesInPath = coursesRequiredForUser.map(c => userCompletedCourses.get(c.id));
                    if (completionTypesInPath.some(type => type === 'On-site')) {
                        onSiteCompletions++;
                    } else {
                        onlineCompletions++;
                    }
                }
            }
        });

        return {
            title: group.title,
            fullyCompletedUsers,
            onSiteCompletions,
            onlineCompletions,
        };
    });

    const grandTotal = summary.reduce((acc, group) => {
        acc.fullyCompletedUsers += group.fullyCompletedUsers;
        acc.onSiteCompletions += group.onSiteCompletions;
        acc.onlineCompletions += group.onlineCompletions;
        return acc;
    }, { fullyCompletedUsers: 0, onSiteCompletions: 0, onlineCompletions: 0 });

    grandTotal.fullyCompletedUsers = allUsersWhoCompletedAPath.size;

    return { summary, grandTotal };
}, [allCourseGroups, enrollmentReportData, allCourses, allUsers]);


  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCourse, selectedCampus, dateRange, searchTerm, rowsPerPage, selectedCompletionType, completionStatusFilter]);

  const totalPages = Math.ceil(filteredEnrollmentData.length / rowsPerPage);
  const paginatedData = filteredEnrollmentData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleExportCSV = async () => {
    if (filteredEnrollmentData.length === 0) {
      toast({ variant: 'destructive', title: 'No data to export' });
      return;
    }
    const dataToExport = filteredEnrollmentData.map(item => {
        const user = allUsers.find(u => u.id === item.userId);
        return {
            "First Name": user?.firstName || '',
            "Last Name": user?.lastName || '',
            "Email": user?.email || '',
            "Phone Number": user?.phoneNumber || '',
            "HP Number": user?.hpNumber || '',
            "Facilitator": user?.facilitatorName || '',
            "Campus": item.userCampus,
            "Course": item.courseTitle,
            "Enrollment Date": item.enrolledAt && isValid(item.enrolledAt) ? format(item.enrolledAt, 'yyyy-MM-dd HH:mm') : 'N/A',
            "Completion Date": item.completedAt && isValid(item.completedAt) ? format(item.completedAt, 'yyyy-MM-dd HH:mm') : 'In Progress',
            "Status": item.completedAt ? 'Completed' : 'In Progress',
            "Completion Type": item.completionType,
        }
    });
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "course_enrollment_report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (!canViewReports) {
      return (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>You do not have permission to view reports.</AlertDescription>
          </Alert>
      );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Summary Report</CardTitle>
          <CardDescription>A brief overview of your learning paths.</CardDescription>
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : (
                 <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Learning Path</TableHead>
                                <TableHead className="text-center">On-site Completions</TableHead>
                                <TableHead className="text-center">Online Completions</TableHead>
                                <TableHead className="text-center">Total Completed Users</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {learningPathSummary.summary.map(item => (
                                <TableRow key={item.title}>
                                    <TableCell className="font-medium">{item.title}</TableCell>
                                    <TableCell className="text-center">{item.onSiteCompletions}</TableCell>
                                    <TableCell className="text-center">{item.onlineCompletions}</TableCell>
                                    <TableCell className="text-center">{item.fullyCompletedUsers}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="font-bold bg-muted/50">
                                <TableCell>Grand Total (Unique Users)</TableCell>
                                <TableCell className="text-center">{learningPathSummary.grandTotal.onSiteCompletions}</TableCell>
                                <TableCell className="text-center">{learningPathSummary.grandTotal.onlineCompletions}</TableCell>
                                <TableCell className="text-center">{learningPathSummary.grandTotal.fullyCompletedUsers}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Course Enrollment Report</CardTitle>
              <CardDescription>
                Found {filteredEnrollmentData.length} enrollments and {completionCount} completions matching your filters.
              </CardDescription>
            </div>
            <Button onClick={handleExportCSV} variant="outline" disabled={filteredEnrollmentData.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 flex-wrap">
             <div className="relative flex-grow w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search user or course..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select Course or Learning Path" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses & Paths</SelectItem>
                <SelectGroup>
                  <SelectLabel>Learning Paths</SelectLabel>
                  {allCourseGroups.map((group) => (
                    <SelectItem key={group.id} value={`group_${group.id}`}>{group.title}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Courses</SelectLabel>
                  {allCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={!canViewAllCampuses}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select Campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campuses</SelectItem>
                {allCampuses.map((campus) => (
                  <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCompletionType} onValueChange={(value) => setSelectedCompletionType(value as 'all' | 'Online' | 'On-site')}>
                <SelectTrigger className="w-full sm:w-auto flex-grow">
                    <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="On-site">On-site</SelectItem>
                </SelectContent>
            </Select>
            <Select value={completionStatusFilter} onValueChange={(value) => setCompletionStatusFilter(value as 'all' | 'completed' | 'in-progress')}>
                <SelectTrigger className="w-full sm:w-auto flex-grow">
                    <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date-enrollment" variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Filter by date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
            {dateRange && <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}><XIcon className="h-4 w-4" /></Button>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Enrollment Date</TableHead>
                  <TableHead>Completion Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: rowsPerPage }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  paginatedData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.userName}</TableCell>
                      <TableCell>{item.userCampus}</TableCell>
                      <TableCell>{item.courseTitle}</TableCell>
                      <TableCell>{item.enrolledAt && isValid(item.enrolledAt) ? format(item.enrolledAt, 'MMM d, yyyy') : 'N/A'}</TableCell>
                      <TableCell>{item.completedAt && isValid(item.completedAt) ? format(item.completedAt, 'MMM d, yyyy') : 'In Progress'}</TableCell>
                      <TableCell>
                        <Badge variant={item.completedAt ? "default" : "outline"}>
                            {item.completedAt ? `Completed (${item.completionType})` : 'In Progress'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredEnrollmentData.length === 0 && !loading && (
            <div className="text-center p-8 text-muted-foreground">
              No enrollment data found for the selected filters.
            </div>
          )}
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
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
