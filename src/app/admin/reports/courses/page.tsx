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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { User, Course, UserProgress as UserProgressType, Enrollment, CourseGroup, OnsiteCompletion, Ladder, Video } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Calendar as CalendarIcon, X as XIcon, Search, ChevronLeft, ChevronRight, Lock, Eye, ArrowUpDown, ListFilter } from "lucide-react";
import Papa from 'papaparse';
import { format, isValid, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { DateRange } from "react-day-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import allLanguagesList from "@/lib/languages.json";

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
    language: string;
}

interface ProgressDetail {
  progress: UserProgressType;
  user: User;
  course: Course;
}

type SortKey = 'user' | 'course' | 'startDate' | 'completionDate';
type SortDirection = 'asc' | 'desc';

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);

  let result = "";
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  if (remainingSeconds > 0 && hours === 0 && minutes === 0) result += `${remainingSeconds}s`;
  return result.trim() || "0s";
}

const cleanNativeName = (name: string) => {
    if (!name) return "";
    const firstPart = name.split(/[;,]/)[0].trim();
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
};

export default function CourseReportsPage() {
  const { user: currentUser, canViewAllCampuses, hasPermission } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allCourseGroups, setAllCourseGroups] = useState<CourseGroup[]>([]);
  const [allLadders, setAllLadders] = useState<Ladder[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [allLanguages, setAllLanguages] = useState<any[]>([]);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [enrollmentReportData, setEnrollmentReportData] = useState<EnrollmentReportData[]>([]);
  const [userProgressDetails, setUserProgressDetails] = useState<UserProgressType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Applied Main Report Filters
  const [selectedCourse, setSelectedCourse] = useState<string | "all">("all");
  const [selectedCampus, setSelectedCampus] = useState<string | "all">("all");
  const [selectedLanguage, setSelectedLanguage] = useState<string | "all">("all");
  const [selectedCompletionType, setSelectedCompletionType] = useState<'all' | 'Online' | 'On-site'>('all');
  const [completionStatusFilter, setCompletionStatusFilter] = useState<'all' | 'completed' | 'in-progress'>('all');
  const [percentageFilter, setPercentageFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) });
  
  // Pending Filter states (for the sheet)
  const [pendingCourse, setPendingCourse] = useState<string | "all">("all");
  const [pendingCampus, setPendingCampus] = useState<string | "all">("all");
  const [pendingLanguage, setPendingLanguage] = useState<string | "all">("all");
  const [pendingCompletionType, setPendingCompletionType] = useState<'all' | 'Online' | 'On-site'>('all');
  const [pendingStatus, setPendingStatus] = useState<'all' | 'completed' | 'in-progress'>('all');
  const [pendingPercentage, setPendingPercentage] = useState<string>('all');
  const [pendingDateRange, setPendingDateRange] = useState<DateRange | undefined>({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) });

  // Detailed Report Section states (remain live)
  const [selectedDetailedCourse, setSelectedDetailedCourse] = useState<string | "all">("all");
  const [selectedDetailedCampus, setSelectedDetailedCampus] = useState<string | "all">("all");
  const [detailedReportDateRange, setDetailedReportDateRange] = useState<DateRange | undefined>();
  const [detailedSearchTerm, setDetailedSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [detailedReportPage, setDetailedReportPage] = useState(1);
  const [detailedReportPageSize, setDetailedReportPageSize] = useState(10);
  
  const [sortConfig, setSortConfig] = useState < { key: SortKey; direction: SortDirection } | null > (null);
  const [selectedProgressDetail, setSelectedProgressDetail] = useState<ProgressDetail | null>(null);

  const { toast } = useToast();
  const db = getFirebaseFirestore();

  const canViewReports = hasPermission('viewReports');

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!canViewReports) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usersSnap, coursesSnap, groupsSnap, laddersSnap, campusesSnap, enrollmentsSnap, progressSnap, onsiteCompletionsSnap, languagesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'courses'), where('status', '==', 'published'))),
        getDocs(collection(db, 'courseGroups')),
        getDocs(query(collection(db, 'courseLevels'), orderBy('order'))),
        getDocs(query(collection(db, 'Campus'), orderBy("Campus Name"))),
        getDocs(query(collection(db, 'enrollments'), orderBy('enrolledAt', 'desc'))),
        getDocs(collection(db, 'userVideoProgress')),
        getDocs(query(collection(db, 'onsiteCompletions'), orderBy('completedAt', 'desc'))),
        getDocs(query(collection(db, 'languages'), where('status', '==', 'published'))),
      ]);

      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      const coursesList = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      const groupsList = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseGroup));
      const laddersList = laddersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder));
      const campusesList = campusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus));
      const enrollmentsList = enrollmentsSnap.docs.map(doc => ({ id: `${doc.data().userId}_${doc.data().courseId}`, ...doc.data() } as Enrollment & { id: string }));
      const progressList = progressSnap.docs.map(doc => doc.data() as UserProgressType);
      const onsiteCompletionsList = onsiteCompletionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnsiteCompletion & { id: string }));
      const languagesList = languagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setAllUsers(usersList);
      setAllCourses(coursesList);
      setAllCourseGroups(groupsList);
      setAllLadders(laddersList);
      setAllCampuses(campusesList);
      setAllLanguages(languagesList);
      setUserProgressDetails(progressList);

      const progressMap = new Map<string, UserProgressType>();
      progressList.forEach(p => progressMap.set(`${p.userId}_${p.courseId}`, p));
      
      const onlineEnrollments: EnrollmentReportData[] = enrollmentsList.map(enrollment => {
        const user = usersList.find(u => u.id === enrollment.userId);
        const course = coursesList.find(c => c.id === enrollment.courseId);
        const progress = progressMap.get(`${enrollment.userId}_${enrollment.courseId}`);
        const totalVideos = course?.videos?.length || 0;
        const completedVideos = progress?.videoProgress?.filter(v => v.completed).length || 0;

        return {
          id: enrollment.id,
          userId: enrollment.userId,
          userName: user?.displayName || 'Unknown User',
          userCampus: user?.campus || 'N/A',
          courseId: enrollment.courseId,
          courseTitle: course?.title || 'Unknown Course',
          enrolledAt: enrollment.enrolledAt.toDate(),
          completedAt: enrollment.completedAt?.toDate() || null,
          totalProgress: totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0,
          completionType: 'Online',
          language: course?.language || 'N/A',
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
          language: course?.language || 'N/A',
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

  const getNativeName = (dbName: string) => {
    const lang = allLanguagesList.find(l => l.name === dbName || l.code === dbName);
    return lang ? cleanNativeName(lang.nativeName) : dbName;
  }

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
        
        const matchesLanguage = selectedLanguage === 'all' || item.language === selectedLanguage;
        const matchesCompletionType = selectedCompletionType === 'all' || item.completionType === selectedCompletionType;
        
        const matchesStatus = completionStatusFilter === 'all' ||
            (completionStatusFilter === 'completed' && !!item.completedAt) ||
            (completionStatusFilter === 'in-progress' && !item.completedAt);
        
        let matchesPercentage = true;
        if (percentageFilter !== 'all') {
            const [min, max] = percentageFilter.split('-').map(Number);
            matchesPercentage = item.totalProgress >= min && item.totalProgress <= max;
        }

        const referenceDate = item.completedAt || item.enrolledAt;
        const matchesDate = !referenceDate || (
            (!dateRange?.from || referenceDate >= startOfDay(dateRange.from)) &&
            (!dateRange?.to || referenceDate <= endOfDay(dateRange.to))
        );

        const matchesSearch = searchTerm === '' ||
            item.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.courseTitle.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesCourse && matchesCampus && matchesLanguage && matchesCompletionType && matchesDate && matchesSearch && matchesStatus && matchesPercentage;
    });
  }, [enrollmentReportData, selectedCourse, selectedCampus, selectedLanguage, selectedCompletionType, dateRange, searchTerm, allCourseGroups, allCampuses, completionStatusFilter, allUsers, canViewAllCampuses, currentUser, percentageFilter]);
  
  const completionCount = useMemo(() => {
    return filteredEnrollmentData.filter(item => item.completedAt).length;
  }, [filteredEnrollmentData]);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCourse !== 'all') count++;
    if (selectedCampus !== 'all') count++;
    if (selectedLanguage !== 'all') count++;
    if (selectedCompletionType !== 'all') count++;
    if (completionStatusFilter !== 'all') count++;
    if (percentageFilter !== 'all') count++;
    if (dateRange?.from || dateRange?.to) count++;
    return count;
  }, [selectedCourse, selectedCampus, selectedLanguage, selectedCompletionType, completionStatusFilter, percentageFilter, dateRange]);

  const handleApplyFilters = () => {
    setSelectedCourse(pendingCourse);
    setSelectedCampus(pendingCampus);
    setSelectedLanguage(pendingLanguage);
    setSelectedCompletionType(pendingCompletionType);
    setCompletionStatusFilter(pendingStatus);
    setPercentageFilter(pendingPercentage);
    setDateRange(pendingDateRange);
  };

  const resetFilters = () => {
    setPendingCourse("all");
    setPendingCampus("all");
    setPendingLanguage("all");
    setPendingCompletionType("all");
    setPendingStatus("all");
    setPendingPercentage("all");
    setPendingDateRange(undefined);
    
    setSelectedCourse("all");
    setSelectedCampus("all");
    setSelectedLanguage("all");
    setSelectedCompletionType("all");
    setCompletionStatusFilter("all");
    setPercentageFilter("all");
    setDateRange(undefined);
    setSearchTerm("");
  };

 const sortedAndFilteredDetailedProgress = useMemo(() => {
    let filtered = [...userProgressDetails];
    
    if (detailedSearchTerm) {
        const lowercasedSearch = detailedSearchTerm.toLowerCase();
        filtered = filtered.filter(item => {
            const user = allUsers.find(u => u.id === item.userId);
            const course = allCourses.find(c => c.id === item.courseId);
            return user?.displayName?.toLowerCase().includes(lowercasedSearch) ||
                   course?.title.toLowerCase().includes(lowercasedSearch);
        });
    }

    if (selectedDetailedCourse !== 'all') {
      filtered = filtered.filter(item => item.courseId === selectedDetailedCourse);
    }
    
    if (selectedDetailedCampus !== 'all') {
        const campus = allCampuses.find(c => c.id === selectedDetailedCampus);
        if (campus) {
             const userIdsInCampus = new Set(allUsers.filter(u => u.campus === campus["Campus Name"]).map(u => u.id));
             filtered = filtered.filter(item => userIdsInCampus.has(item.userId));
        }
    }

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const userA = allUsers.find(u => u.id === a.userId);
        const userB = allUsers.find(u => u.id === b.userId);
        const courseA = allCourses.find(c => c.id === a.courseId);
        const courseB = allCourses.find(c => c.id === b.courseId);

        let valA, valB;
        switch (sortConfig.key) {
          case 'user': valA = userA?.displayName; valB = userB?.displayName; break;
          case 'course': valA = courseA?.title; valB = courseB?.title; break;
          default: valA = ''; valB = '';
        }

        if (valA === undefined || valA === null) valA = sortConfig.direction === 'asc' ? Infinity : -Infinity;
        if (valB === undefined || valB === null) valB = sortConfig.direction === 'asc' ? Infinity : -Infinity;
        
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
      });
    }

    return filtered;
  }, [userProgressDetails, detailedSearchTerm, selectedDetailedCourse, selectedDetailedCampus, allUsers, allCourses, allCampuses, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
    setDetailedReportPage(1);
  }, [selectedCourse, selectedCampus, selectedLanguage, dateRange, searchTerm, rowsPerPage, selectedCompletionType, percentageFilter, detailedSearchTerm, detailedReportDateRange, selectedDetailedCourse, selectedDetailedCampus]);

  const totalPages = Math.ceil(filteredEnrollmentData.length / rowsPerPage);
  const paginatedData = filteredEnrollmentData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const detailedReportTotalPages = Math.ceil(sortedAndFilteredDetailedProgress.length / detailedReportPageSize);
  const currentDetailedReportData = sortedAndFilteredDetailedProgress.slice(
    (detailedReportPage - 1) * detailedReportPageSize,
    (detailedReportPage * detailedReportPageSize)
  );

  const handleExportEnrollmentCSV = async () => {
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
            "Language": item.language,
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
  
  const handleExportDetailedCSV = async () => {
    if (sortedAndFilteredDetailedProgress.length === 0) {
        toast({ variant: 'destructive', title: 'No detailed data to export' });
        return;
    }
    const dataToExport = sortedAndFilteredDetailedProgress.map(item => {
      const user = allUsers.find(u => u.id === item.userId);
      const course = allCourses.find(c => c.id === item.courseId);
      const totalTimeSpent = (item.videoProgress || []).reduce((acc, vp) => acc + (vp.timeSpent || 0), 0);
      return {
          "User": user?.displayName || item.userId,
          "Campus": user?.campus || 'N/A',
          "Course": course?.title || item.courseId,
          "Progress": `${item.totalProgress}%`,
          "Time Spent": formatDuration(totalTimeSpent),
      };
    });
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `detailed_progress_report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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

  if (!isClient) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Course Enrollment Report</CardTitle>
              <CardDescription>
                Found {filteredEnrollmentData.length} enrollments and {completionCount} completions matching your applied filters.
              </CardDescription>
            </div>
            <Button onClick={handleExportEnrollmentCSV} variant="outline" disabled={filteredEnrollmentData.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-4">
             <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search user or course..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10" />
            </div>
            <Sheet onOpenChange={(open) => {
                if (open) {
                    setPendingCourse(selectedCourse);
                    setPendingCampus(selectedCampus);
                    setPendingLanguage(selectedLanguage);
                    setPendingCompletionType(selectedCompletionType);
                    setPendingStatus(completionStatusFilter);
                    setPendingPercentage(percentageFilter);
                    setPendingDateRange(dateRange);
                }
            }}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="relative h-10 w-10 flex-shrink-0">
                        <ListFilter className="h-4 w-4" />
                        {activeFilterCount > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md flex flex-col">
                    <SheetHeader className="mb-6 flex-shrink-0">
                        <SheetTitle>Filter Reports</SheetTitle>
                        <SheetDescription>Adjust filters and click "Apply" to update results.</SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="flex-1 pr-6 -mr-6">
                        <div className="space-y-6 px-1">
                            <div className="space-y-2">
                                <Label>Course or Learning Path</Label>
                                <Select value={pendingCourse} onValueChange={setPendingCourse}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Courses & Paths" />
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
                            </div>

                            <div className="space-y-2">
                                <Label>Campus</Label>
                                <Select value={pendingCampus} onValueChange={setPendingCampus} disabled={!canViewAllCampuses}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Campuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Campuses</SelectItem>
                                    {allCampuses.map((campus) => (
                                    <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Language</Label>
                                <Select value={pendingLanguage} onValueChange={setPendingLanguage}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Languages" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Languages</SelectItem>
                                        {allLanguages.map((lang) => {
                                            const langInfo = allLanguagesList.find(l => l.code === lang.id);
                                            const displayName = langInfo ? cleanNativeName(langInfo.nativeName) : lang.name;
                                            return (
                                                <SelectItem key={lang.id} value={lang.name}>{displayName}</SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Completion Type</Label>
                                <Select value={pendingCompletionType} onValueChange={(value) => setPendingCompletionType(value as 'all' | 'Online' | 'On-site')}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="Online">Online</SelectItem>
                                        <SelectItem value="On-site">On-site</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Completion Status</Label>
                                <Select value={pendingStatus} onValueChange={(value) => setPendingStatus(value as 'all' | 'completed' | 'in-progress')}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="in-progress">In Progress</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Progress Percentage</Label>
                                <Select value={pendingPercentage} onValueChange={setPendingPercentage}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Any Percentage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Any Percentage</SelectItem>
                                        <SelectItem value="0-25">0 - 25%</SelectItem>
                                        <SelectItem value="26-50">26 - 50%</SelectItem>
                                        <SelectItem value="51-75">51 - 75%</SelectItem>
                                        <SelectItem value="76-99">76 - 99%</SelectItem>
                                        <SelectItem value="100-100">100% (Completed)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Date Range (Completion or Enrollment)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">From</span>
                                        <Input
                                            type="date"
                                            value={pendingDateRange?.from ? format(pendingDateRange.from, 'yyyy-MM-dd') : ''}
                                            onChange={(e) => {
                                                const from = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
                                                setPendingDateRange((prev) => ({ ...prev, from }));
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">To</span>
                                        <Input
                                            type="date"
                                            value={pendingDateRange?.to ? format(pendingDateRange.to, 'yyyy-MM-dd') : ''}
                                            onChange={(e) => {
                                                const to = e.target.value ? new Date(e.target.value + 'T23:59:59') : undefined;
                                                setPendingDateRange((prev) => ({ ...prev, to }));
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <SheetFooter className="mt-8 flex flex-col gap-2 flex-shrink-0">
                        <Button variant="outline" className="w-full" onClick={resetFilters}>Reset Filters</Button>
                        <SheetClose asChild>
                            <Button className="w-full" onClick={handleApplyFilters}>Apply Filters</Button>
                        </SheetClose>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
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
                        {item.completedAt ? (
                            <Badge variant="default">Completed ({item.completionType})</Badge>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Progress value={item.totalProgress} className="w-24 h-2" />
                                <span className="text-xs font-semibold">{item.totalProgress}%</span>
                            </div>
                        )}
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
      
      <Card>
        <CardHeader>
          <CardTitle>Detailed Report</CardTitle>
          <CardDescription>User progress and time spent on courses.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <>
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 flex-wrap">
                <div className="relative flex-grow w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." value={detailedSearchTerm} onChange={e => setDetailedSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Select value={selectedDetailedCourse} onValueChange={setSelectedDetailedCourse}><SelectTrigger className="w-full sm:w-auto flex-grow"><SelectValue placeholder="Select Course" /></SelectTrigger><SelectContent><SelectItem value="all">All Courses</SelectItem>{allCourses.map((course) => (<SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>))}</SelectContent></Select>
                <Select value={selectedDetailedCampus} onValueChange={setSelectedDetailedCampus} disabled={!canViewAllCampuses}><SelectTrigger className="w-full sm:w-auto flex-grow"><SelectValue placeholder="Select Campus" /></SelectTrigger><SelectContent><SelectItem value="all">All Campuses</SelectItem>{allCampuses.map((campus) => (
                  <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>
                ))}</SelectContent></Select>
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={detailedReportDateRange?.from ? format(detailedReportDateRange.from, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                            const from = e.target.value ? new Date(e.target.value.replace(/-/g, '/')) : undefined;
                            setDetailedReportDateRange((prev) => ({ ...prev, from }));
                        }}
                        className="w-full sm:w-[150px]"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                        type="date"
                        value={detailedReportDateRange?.to ? format(detailedReportDateRange.to, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                            const to = e.target.value ? new Date(e.target.value.replace(/-/g, '/')) : undefined;
                            setDetailedReportDateRange((prev) => ({ ...prev, to }));
                        }}
                        className="w-full sm:w-[150px]"
                    />
                </div>
                {detailedReportDateRange && <Button variant="ghost" size="icon" onClick={() => setDetailedReportDateRange(undefined)}><XIcon className="h-4 w-4" /></Button>}
                <Button onClick={handleExportDetailedCSV} variant="outline" disabled={!sortedAndFilteredDetailedProgress || sortedAndFilteredDetailedProgress.length === 0} className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" />Export as CSV</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead><Button variant="ghost" onClick={() => handleSort('user')}>User<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead><TableHead><Button variant="ghost" onClick={() => handleSort('course')}>Course<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead><TableHead>Progress</TableHead><TableHead>Videos Watched</TableHead><TableHead>Time Spent</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader>
                  <TableBody>
                      {currentDetailedReportData.map((progress) => {
                        const user = allUsers.find(u => u.id === progress.userId);
                        const course = allCourses.find(c => c.id === progress.courseId);
                        const totalTimeSpent = (progress.videoProgress || []).reduce((acc, vp) => acc + (vp.timeSpent || 0), 0);
                        if (!user || !course) return null;
                        if (totalTimeSpent === 0 && !progress.videoProgress?.some(vp => vp.completed)) return null;
                        
                        const publishedVideoIdsInCourse = new Set((course?.videos || []));
                        const totalVideos = publishedVideoIdsInCourse.size;
                        const completedVideos = (progress.videoProgress || []).filter(vp => vp.completed && publishedVideoIdsInCourse.has(vp.videoId)).length;
                        return (<TableRow key={`${progress.userId}-${progress.courseId}`}><TableCell>({user.campus || 'N/A'}) {user.displayName}</TableCell><TableCell>{course.title}</TableCell><TableCell>{progress.totalProgress}%</TableCell><TableCell>{`${completedVideos} / ${totalVideos}`}</TableCell><TableCell>{formatDuration(totalTimeSpent)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setSelectedProgressDetail({ progress, user, course })}><Eye className="h-4 w-4" /></Button></TableCell></TableRow>);
                      })}
                  </TableBody>
                </Table>
              </div>
              {(!sortedAndFilteredDetailedProgress || sortedAndFilteredDetailedProgress.length === 0) && <p className="text-center p-8 text-muted-foreground">No data available for the selected filters.</p>}
            </>
          )}
        </CardContent>
        {detailedReportTotalPages > 1 && (
          <CardFooter className="flex justify-end items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>Rows per page</span><Select value={`${detailedReportPageSize}`} onValueChange={(value) => { setDetailedReportPageSize(Number(value)); setDetailedReportPage(1);}}><SelectTrigger className="w-[70px]"><SelectValue placeholder={`${detailedReportPageSize}`} /></SelectTrigger><SelectContent>{[10, 25, 50, 100].map(size => (
                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                        ))}</SelectContent></Select></div>
            <span className="text-sm text-muted-foreground">Page {detailedReportPage} of {detailedReportTotalPages}</span>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setDetailedReportPage(prev => Math.max(prev - 1, 1))} disabled={detailedReportPage === 1}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" onClick={() => setDetailedReportPage(prev => Math.min(prev + 1, detailedReportTotalPages))} disabled={detailedReportPage === detailedReportTotalPages}>Next<ChevronRight className="h-4 w-4" /></Button></div>
          </CardFooter>
        )}
      </Card>
      
       <Dialog open={!!selectedProgressDetail} onOpenChange={() => setSelectedProgressDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Progress Details</DialogTitle>
            <DialogDescription>Detailed video progress for {selectedProgressDetail?.user.displayName} in {selectedProgressDetail?.course.title}.</DialogDescription>
          </DialogHeader>
          {selectedProgressDetail && (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Video Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Time Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProgressDetail.course.videos?.map(videoId => {
                    const video = allVideos.find(v => v.id === videoId);
                    const videoProgress = selectedProgressDetail.progress.videoProgress.find(vp => vp.videoId === videoId);
                    return (<TableRow key={videoId}><TableCell>{video?.title || 'Unknown Video'}</TableCell><TableCell>{videoProgress?.completed ? 'Completed' : 'In Progress'}</TableCell><TableCell className="text-right">{formatDuration(videoProgress?.timeSpent || 0)}</TableCell></TableRow>)
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
