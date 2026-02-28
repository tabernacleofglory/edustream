
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { collection, getDocs, query, where, getCountFromServer, documentId, orderBy, collectionGroup, limit } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { User, Course, UserProgress as UserProgressType, Video, Enrollment, Post, Quiz, UserQuizResult, QuizQuestion, CourseGroup, OnsiteCompletion, Ladder } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Download, ArrowUpDown, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X as XIcon, RefreshCw, BookCopy, FileQuestion, Users as UsersIcon, Home, Award, UserPlus, Loader2, BarChart3, CheckCircle2 } from "lucide-react";
import Papa from 'papaparse';
import { format, isValid, startOfDay, endOfDay, subDays, isSameDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface Campus {
  id: string;
  "Campus Name": string;
}

interface QuizPerformanceSummary {
    quizId: string;
    quizTitle: string;
    totalAttempts: number;
    uniqueAttempts: number;
    passCount: number;
    failCount: number;
}

interface ProgressDetail {
  progress: UserProgressType;
  user: User;
  course: Course;
}

type SortKey = 'user' | 'course' | 'startDate' | 'completionDate';
type SortDirection = 'asc' | 'desc';

const engagementChartConfig = {
  count: {
    label: "Activities",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const breakdownChartConfig = {
  value: {
    label: "Activities",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const completionChartConfig = {
  count: {
    label: "Completions",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig;

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

const ClickToLoad = ({ onFetch, title }: { onFetch: () => void, title: string }) => (
  <div className="flex items-center justify-center h-full min-h-[300px]">
    <Button onClick={onFetch} variant="outline">
      <RefreshCw className="mr-2 h-4 w-4" />
      Load {title}
    </Button>
  </div>
);


export default function AnalyticsDashboard() {
  const { user: currentUser, canViewAllCampuses } = useAuth();
  const isMobile = useIsMobile();
  
  // Data states
  const [userProgressData, setUserProgressData] = useState<(UserProgressType & { enrollment?: Enrollment })[] | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allCourseGroups, setAllCourseGroups] = useState<CourseGroup[]>([]);
  const [allLadders, setAllLadders] = useState<Ladder[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [quizPerformanceSummary, setQuizPerformanceSummary] = useState<QuizPerformanceSummary[] | null>(null);
  const [summaryStats, setSummaryStats] = useState<{ totalEnrollments: number, totalHpRequests: number } | null>(null);
  const [engagementData, setEngagementData] = useState<{ date: string, count: number, breakdown: { name: string, value: number }[] }[]>([]);
  const [completionData, setCompletionData] = useState<{ category: string, count: number, breakdown: { ladders: any[], courses: any[] } }[]>([]);
  const [selectedDayBreakdown, setSelectedDayBreakdown] = useState<any | null>(null);
  const [selectedCategoryBreakdown, setSelectedCategoryBreakdown] = useState<any | null>(null);


  // Loading states
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  
  const [selectedProgressDetail, setSelectedProgressDetail] = useState<ProgressDetail | null>(null);
  const [sortConfig, setSortConfig] = useState < { key: SortKey; direction: SortDirection } | null > (null);

  // Filters
  const [selectedUser, setSelectedUser] = useState<string | "all">("all");
  const [selectedCourse, setSelectedCourse] = useState<string | "all">("all");
  const [selectedCampus, setSelectedCampus] = useState<string | "all">("all");
  const [dateRange, setDateRange] = useState < DateRange | undefined > ();

  // Pagination
  const [detailedReportPage, setDetailedReportPage] = useState(1);
  const [detailedReportPageSize, setDetailedReportPageSize] = useState(10);
  const [quizPerformancePage, setQuizPerformancePage] = useState(1);
  const [quizPerformancePageSize, setQuizPerformancePageSize] = useState(10);
  
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchBaseData = useCallback(async () => {
    if (allUsers.length > 0) return;
    setLoading(true);
    try {
        const usersCollection = collection(db, 'users');
        const coursesCollection = query(collection(db, 'courses'), where('status', '==', 'published'));
        const courseGroupsCollection = collection(db, 'courseGroups');
        const laddersCollection = collection(db, 'courseLevels');
        const videosCollection = query(collection(db, 'Contents'), where("Type", "in", ["video", "youtube", "googledrive"]));
        const quizzesCollection = collection(db, 'quizzes');
        const campusesCollection = collection(db, 'Campus');
        
        const [usersSnapshot, coursesSnapshot, courseGroupsSnapshot, laddersSnapshot, videosSnapshot, quizzesSnapshot, campusesSnapshot] = await Promise.all([
            getDocs(usersCollection),
            getDocs(coursesCollection),
            getDocs(courseGroupsCollection),
            getDocs(laddersCollection),
            getDocs(videosCollection),
            getDocs(quizzesCollection),
            getDocs(campusesCollection),
        ]);

        setAllUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        setAllCourses(coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
        setAllCourseGroups(courseGroupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseGroup)));
        setAllLadders(laddersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder)));
        setAllVideos(videosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video)));
        setAllQuizzes(quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));
        setAllCampuses(campusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus)));
    } catch (error) {
        console.error("Error fetching base data:", error);
        toast({ variant: 'destructive', title: 'Failed to load essential data.' });
    } finally {
        setLoading(false);
    }
  }, [allUsers.length, db, toast]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  const fetchSummaryData = useCallback(async () => {
    if (allUsers.length === 0 || allCourses.length === 0) {
      return;
    }
  
    // 1. Total Enrollments
    const totalEnrollments = allCourses.reduce((sum, course) => sum + (course.enrollmentCount || 0), 0);
  
    // 2. Total HP Requests
    const hpRequestingUsers = allUsers.filter(
      (u) => (u.isInHpGroup === false || u.isInHpGroup === undefined || u.isInHpGroup === null) && u.hpAvailabilityDay
    );
    const totalHpRequests = hpRequestingUsers.length;
  
    setSummaryStats({
      totalEnrollments,
      totalHpRequests
    });

    // 3. Engagement Data (Last 7 days)
    const sevenDaysAgo = subDays(new Date(), 7);
    const engagementQuery = query(
        collection(db, 'userVideoProgress'),
        where('updatedAt', '>=', sevenDaysAgo),
        orderBy('updatedAt', 'desc'),
        limit(1000)
    );
    const engagementSnap = await getDocs(engagementQuery);
    const activityMap: Record<string, { count: number, courses: Record<string, number> }> = {};
    
    // Initialize last 7 days
    for (let i = 0; i < 7; i++) {
        const dateStr = format(subDays(new Date(), i), 'MMM dd');
        activityMap[dateStr] = { count: 0, courses: {} };
    }

    engagementSnap.forEach(doc => {
        const data = doc.data();
        if (data.updatedAt) {
            const dateStr = format(data.updatedAt.toDate(), 'MMM dd');
            if (activityMap[dateStr] !== undefined) {
                activityMap[dateStr].count += 1;
                const course = allCourses.find(c => c.id === data.courseId);
                const title = course?.title || "Unknown Course";
                activityMap[dateStr].courses[title] = (activityMap[dateStr].courses[title] || 0) + 1;
            }
        }
    });

    const engagementChartData = Object.entries(activityMap)
        .map(([date, data]) => ({ 
            date, 
            count: data.count,
            breakdown: Object.entries(data.courses)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
        }))
        .reverse();
    
    setEngagementData(engagementChartData);

    // 4. Completion Data by Category
    const completionsQuery = query(
        collection(db, 'enrollments'),
        where('completedAt', '!=', null)
    );
    const completionsSnap = await getDocs(completionsQuery);
    const categoryMap: Record<string, { 
        count: number, 
        ladders: Record<string, number>, 
        courses: Record<string, number> 
    }> = {};

    completionsSnap.forEach(doc => {
        const data = doc.data();
        const course = allCourses.find(c => c.id === data.courseId);
        if (course && course.Category) {
            const categories = Array.isArray(course.Category) ? course.Category : [course.Category];
            categories.forEach(cat => {
                if (!categoryMap[cat]) {
                    categoryMap[cat] = { count: 0, ladders: {}, courses: {} };
                }
                categoryMap[cat].count += 1;
                
                // Track Course
                categoryMap[cat].courses[course.title] = (categoryMap[cat].courses[course.title] || 0) + 1;
                
                // Track Ladder
                const ladderIds = course.ladderIds || [];
                ladderIds.forEach(lId => {
                    const ladder = allLadders.find(l => l.id === lId);
                    const ladderName = ladder ? ladder.name : "Uncategorized";
                    categoryMap[cat].ladders[ladderName] = (categoryMap[cat].ladders[ladderName] || 0) + 1;
                });
            });
        }
    });

    const completionChartData = Object.entries(categoryMap)
        .map(([category, data]) => ({ 
            category, 
            count: data.count,
            breakdown: {
                ladders: Object.entries(data.ladders).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
                courses: Object.entries(data.courses).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
            }
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 categories

    setCompletionData(completionChartData);

  }, [allUsers, allCourses, allLadders, db]);

  useEffect(() => {
    if (!loading) {
      fetchSummaryData();
    }
  }, [loading, fetchSummaryData]);

  const fetchQuizPerformance = useCallback(async () => {
    if (allQuizzes.length === 0) await fetchBaseData();
    const quizResultsList = (await getDocs(collection(db, 'userQuizResults'))).docs.map(doc => doc.data() as UserQuizResult);
    const quizPerformance = allQuizzes.map(quiz => {
        const resultsForQuiz = quizResultsList.filter(r => r.quizId === quiz.id);
        const totalAttempts = resultsForQuiz.length;
        const uniqueAttempts = new Set(resultsForQuiz.map(r => r.userId)).size;
        const passCount = resultsForQuiz.filter(r => r.passed).length;
        return {
            quizId: quiz.id,
            quizTitle: quiz.title,
            totalAttempts: totalAttempts,
            uniqueAttempts: uniqueAttempts,
            passCount: passCount,
            failCount: totalAttempts - passCount,
        };
    });
    setQuizPerformanceSummary(quizPerformance.filter(q => q.totalAttempts > 0));
  }, [allQuizzes, db, fetchBaseData]);

  const fetchProgressData = useCallback(async () => {
    if (allUsers.length === 0) await fetchBaseData();
    try {
        const [progressSnapshot, enrollmentSnapshot] = await Promise.all([
            getDocs(collection(db, 'userVideoProgress')),
            getDocs(collection(db, 'enrollments')),
        ]);
        
        const enrollmentsMap = new Map(enrollmentSnapshot.docs.map(doc => [`${doc.data().userId}_${doc.data().courseId}`, doc.data() as Enrollment]));

        const progressList = progressSnapshot.docs.map(doc => {
            const data = doc.data() as Omit < UserProgressType, 'totalProgress' > ;
            const course = allCourses.find(c => c.id === data.courseId);
            const publishedVideoIdsInCourse = new Set((course?.videos || []).filter(vid => allVideos.some(v => v.id === vid && v.status === 'published')));
            const totalVideos = publishedVideoIdsInCourse.size;
            const completedCount = data.videoProgress?.filter(vp => vp.completed && publishedVideoIdsInCourse.has(vp.videoId)).length || 0;
            const totalProgress = totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;
            const enrollment = enrollmentsMap.get(`${data.userId}_${data.courseId}`);
            return { ...data, totalProgress, enrollment };
        });
        
        setUserProgressData(progressList);
    } catch (error) {
        console.error("Error fetching progress data:", error);
    }
}, [db, allCourses, allVideos, allUsers, fetchBaseData]);

  const sortedAndFilteredProgress = useMemo(() => {
    if (!userProgressData) return [];

    let filtered = userProgressData.filter(p => {
        let userMatches = true;
        if (selectedUser !== 'all') {
            userMatches = p.userId === selectedUser;
        }

        const courseIdsToFilter = new Set<string>();
        if (selectedCourse.startsWith('group_')) {
            const groupId = selectedCourse.replace('group_', '');
            const group = allCourseGroups.find(g => g.id === groupId);
            group?.courseIds.forEach(id => courseIdsToFilter.add(id));
        } else if (selectedCourse !== 'all') {
            courseIdsToFilter.add(selectedCourse);
        }
        const courseMatches = courseIdsToFilter.size === 0 || courseIdsToFilter.has(p.courseId);

        let campusMatches = true;
        if (!canViewAllCampuses) {
            const userCampusName = currentUser?.campus;
            if (userCampusName) {
                const userIdsInCampus = new Set(allUsers.filter(u => u.campus === userCampusName).map(u => u.id));
                campusMatches = userIdsInCampus.has(p.userId);
            }
        } else if (selectedCampus !== 'all') {
            const campus = allCampuses.find(c => c.id === selectedCampus);
            if (campus) {
                const userIdsInCampus = new Set(allUsers.filter(u => u.campus === campus["Campus Name"]).map(u => u.id));
                campusMatches = userIdsInCampus.has(p.userId);
            }
        }
        return userMatches && courseMatches && campusMatches;
    });

    if (dateRange?.from) {
      const start = startOfDay(dateRange.from);
      filtered = filtered.filter(p => p.enrollment?.enrolledAt && p.enrollment.enrolledAt.toDate() >= start);
    }

    if (dateRange?.to) {
      const end = endOfDay(dateRange.to);
      filtered = filtered.filter(p => p.enrollment?.completedAt && p.enrollment.completedAt.toDate() <= end);
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
          case 'startDate': valA = a.enrollment?.enrolledAt?.seconds || 0; valB = b.enrollment?.enrolledAt?.seconds || 0; break;
          case 'completionDate': valA = a.enrollment?.completedAt?.seconds || 0; valB = b.enrollment?.completedAt?.seconds || 0; break;
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
  }, [userProgressData, sortConfig, allUsers, allCourses, dateRange, selectedUser, selectedCourse, selectedCampus, allCourseGroups, canViewAllCampuses, currentUser]);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleExportDetailedReportCSV = () => {
    if (!sortedAndFilteredProgress || sortedAndFilteredProgress.length === 0) return;
    const dataToExport = sortedAndFilteredProgress.flatMap(progress => {
        const user = allUsers.find(u => u.id === progress.userId);
        const course = allCourses.find(c => c.id === progress.courseId);
        if (!user || !course || !course.videos) return [];
        return (progress.videoProgress || []).filter(vp => vp.timeSpent > 0 || vp.completed).map(videoProgress => {
            const video = allVideos.find(v => v.id === videoProgress.videoId);
            const startDate = progress.enrollment?.enrolledAt?.toDate ? format(progress.enrollment.enrolledAt.toDate(), 'yyyy-MM-dd') : 'N/A';
            const completionDate = progress.enrollment?.completedAt?.toDate ? format(progress.enrollment.completedAt.toDate(), 'yyyy-MM-dd') : 'N/A';
            return {
                "User": user.displayName,
                "Campus": user.campus || 'N/A',
                "Course": course.title,
                "Video Title": video?.title || 'N/A',
                "Status": videoProgress.completed ? "Completed" : "In Progress",
                "Time Spent": formatDuration(videoProgress.timeSpent || 0),
                "Start Date": startDate,
                "Completion Date": completionDate,
            };
        });
    });
    if (dataToExport.length === 0) {
      toast({ variant: 'destructive', title: 'No data with progress to export.' });
      return;
    }
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `detailed_progress_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const detailedReportTotalPages = Math.ceil((sortedAndFilteredProgress || []).length / detailedReportPageSize);
  const currentDetailedReportData = sortedAndFilteredProgress?.slice(
    (detailedReportPage - 1) * detailedReportPageSize,
    (detailedReportPage * detailedReportPageSize)
  ) || [];

  const quizPerformanceTotalPages = Math.ceil((quizPerformanceSummary || []).length / quizPerformancePageSize);
  const currentQuizPerformanceData = quizPerformanceSummary?.slice(
      (quizPerformancePage - 1) * quizPerformancePageSize,
      quizPerformancePage * quizPerformancePageSize
  ) || [];
  
  if (!isClient) return null;


  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytics Dashboard</CardTitle>
        <CardDescription>An overview of platform activity.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="course_reports">Course Reports</TabsTrigger>
            <TabsTrigger value="quiz_reports">Quiz Reports</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="mt-6">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {!summaryStats ? (
                  <>
                      <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                              <UsersIcon className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent><div className="h-8 flex items-center"><Loader2 className="h-6 w-6 animate-spin" /></div></CardContent>
                      </Card>
                      <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Pending HP Requests</CardTitle>
                              <UserPlus className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent><div className="h-8 flex items-center"><Loader2 className="h-6 w-6 animate-spin" /></div></CardContent>
                      </Card>
                  </>
                ) : (
                  <>
                      <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                              <UsersIcon className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent><div className="text-2xl font-bold">{summaryStats.totalEnrollments}</div></CardContent>
                      </Card>
                      <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Pending HP Requests</CardTitle>
                              <UserPlus className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent><div className="text-2xl font-bold">{summaryStats.totalHpRequests}</div></CardContent>
                      </Card>
                  </>
                )}
            </div>

            {/* Visual Analytics Section */}
            <div className="grid gap-4 mt-6 grid-cols-1 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            User Engagement
                        </CardTitle>
                        <CardDescription>Course activities over the last 7 days. Click bars for details.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {loading || engagementData.length === 0 ? (
                            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/10">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <ChartContainer config={engagementChartConfig} className="h-full w-full">
                                <BarChart data={engagementData}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        tickMargin={10}
                                        axisLine={false}
                                        fontSize={isMobile ? 10 : 12}
                                    />
                                    <YAxis hide />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[4, 4, 0, 0]}
                                        className="cursor-pointer"
                                        onClick={(data) => {
                                            if (data && data.activePayload && data.activePayload[0]) {
                                                setSelectedDayBreakdown(data.activePayload[0].payload);
                                            } else if (data && data.date) {
                                                setSelectedDayBreakdown(data);
                                            }
                                        }}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            Completion Rates
                        </CardTitle>
                        <CardDescription>Total completions by course category. Click for details.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {loading || completionData.length === 0 ? (
                            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/10">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <ChartContainer config={completionChartConfig} className="h-full w-full">
                                <BarChart data={completionData} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="category"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
                                        axisLine={false}
                                        fontSize={isMobile ? 10 : 12}
                                        width={isMobile ? 70 : 100}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[0, 4, 4, 0]}
                                        className="cursor-pointer"
                                        onClick={(data) => {
                                            if (data && data.activePayload && data.activePayload[0]) {
                                                setSelectedCategoryBreakdown(data.activePayload[0].payload);
                                            } else if (data && data.category) {
                                                setSelectedCategoryBreakdown(data);
                                            }
                                        }}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="course_reports" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Detailed Course Report</CardTitle>
                    <CardDescription>User progress and time spent on courses.</CardDescription>
                </CardHeader>
                <CardContent>
                    {userProgressData === null ? <ClickToLoad onFetch={fetchProgressData} title="Course Report" /> : (
                        <>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-4 flex-wrap">
                                <Select value={selectedUser} onValueChange={setSelectedUser}><SelectTrigger className="w-full sm:w-auto flex-grow"><SelectValue placeholder="Select User" /></SelectTrigger><SelectContent><SelectItem value="all">All Users</SelectItem>{allUsers.map((user) => (<SelectItem key={user.id} value={user.id}>{user.displayName}</SelectItem>))}</SelectContent></Select>
                                <Select value={selectedCourse} onValueChange={setSelectedCourse}><SelectTrigger className="w-full sm:w-auto flex-grow"><SelectValue placeholder="Select Course/Path" /></SelectTrigger><SelectContent><SelectItem value="all">All Courses & Paths</SelectItem><SelectGroup><SelectLabel>Learning Paths</SelectLabel>{allCourseGroups.map((group) => (<SelectItem key={group.id} value={`group_${group.id}`}>{group.title}</SelectItem>))}</SelectGroup><SelectGroup><SelectLabel>Courses</SelectLabel>{allCourses.map((course) => (<SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>))}</SelectGroup></SelectContent></Select>
                                <Select value={selectedCampus} onValueChange={setSelectedCampus}><SelectTrigger className="w-full sm:w-auto flex-grow"><SelectValue placeholder="Select Campus" /></SelectTrigger><SelectContent><SelectItem value="all">All Campuses</SelectItem>{allCampuses.map((campus) => (<SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>))}</SelectContent></Select>
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
                                <Button onClick={handleExportDetailedReportCSV} variant="outline" disabled={!sortedAndFilteredProgress || sortedAndFilteredProgress.length === 0} className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
                            </div>
                            <Table>
                                <TableHeader><TableRow><TableHead><Button variant="ghost" onClick={() => handleSort('user')}>User<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead><TableHead className="hidden md:table-cell"><Button variant="ghost" onClick={() => handleSort('course')}>Course<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead><TableHead>Progress</TableHead><TableHead className="hidden sm:table-cell">Time Spent</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {currentDetailedReportData.map((progress) => {
                                        const user = allUsers.find(u => u.id === progress.userId);
                                        const course = allCourses.find(c => c.id === progress.courseId);
                                        if (!user || !course) return null;
                                        const totalTimeSpent = (progress.videoProgress || []).reduce((acc, vp) => acc + (vp.timeSpent || 0), 0);
                                        if (totalTimeSpent === 0 && !progress.videoProgress?.some(vp => vp.completed)) return null;
                                        return (<TableRow key={`${progress.userId}-${progress.courseId}`}><TableCell><div className="flex flex-col"><span className="font-medium text-xs md:text-sm">{user.displayName}</span><span className="text-[10px] text-muted-foreground md:hidden">{course.title}</span><span className="text-[10px] text-muted-foreground">({user.campus || 'N/A'})</span></div></TableCell><TableCell className="hidden md:table-cell">{course.title}</TableCell><TableCell>{progress.totalProgress}%</TableCell><TableCell className="hidden sm:table-cell">{formatDuration(totalTimeSpent)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setSelectedProgressDetail({ progress, user, course })}><Eye className="h-4 w-4" /></Button></TableCell></TableRow>);
                                    })}
                                </TableBody>
                            </Table>
                        </>
                    )}
                </CardContent>
                 {detailedReportTotalPages > 1 && (
                    <CardFooter className="flex justify-end items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground"><span>Rows per page</span><Select value={`${detailedReportPageSize}`} onValueChange={(value) => { setDetailedReportPageSize(Number(value)); setDetailedReportPage(1); }}><SelectTrigger className="w-[70px]"><SelectValue placeholder={`${detailedReportPageSize}`} /></SelectTrigger><SelectContent>{[10, 25, 50].map(size => (
                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                        ))}</SelectContent></Select></div>
                        <span className="text-xs sm:text-sm text-muted-foreground">Page {detailedReportPage} of {detailedReportTotalPages}</span>
                        <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setDetailedReportPage(prev => Math.max(prev - 1, 1))} disabled={detailedReportPage === 1}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => setDetailedReportPage(prev => Math.min(prev + 1, detailedReportTotalPages))} disabled={detailedReportPage === detailedReportTotalPages}><ChevronRight className="h-4 w-4" /></Button></div>
                    </CardFooter>
                )}
            </Card>
          </TabsContent>

          <TabsContent value="quiz_reports" className="mt-6">
             <Card>
                <CardHeader>
                <CardTitle>Quiz Performance Summary</CardTitle>
                <CardDescription>A summary of attempts and pass/fail rates for each quiz.</CardDescription>
                </CardHeader>
                <CardContent>
                {quizPerformanceSummary === null ? <ClickToLoad onFetch={fetchQuizPerformance} title="Quiz Performance" /> : (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader><TableRow><TableHead>Quiz Title</TableHead><TableHead className="text-center">Attempts</TableHead><TableHead className="text-center hidden sm:table-cell">Unique Users</TableHead><TableHead className="text-center">Passes</TableHead><TableHead className="text-center">Fails</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {currentQuizPerformanceData.length > 0 ? (
                                    currentQuizPerformanceData.map(item => (<TableRow key={item.quizId}><TableCell className="font-medium text-xs md:text-sm">{item.quizTitle}</TableCell><TableCell className="text-center">{item.totalAttempts}</TableCell><TableCell className="text-center hidden sm:table-cell">{item.uniqueAttempts}</TableCell><TableCell className="text-center text-green-600">{item.passCount}</TableCell><TableCell className="text-center text-red-600">{item.failCount}</TableCell></TableRow>))
                                ) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground p-8">No quiz attempts recorded yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                )}
                </CardContent>
                {quizPerformanceSummary && quizPerformanceTotalPages > 1 && (
                    <CardFooter className="flex justify-end items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground"><span>Rows per page</span><Select value={`${quizPerformancePageSize}`} onValueChange={(value) => { setQuizPerformancePageSize(Number(value)); setQuizPerformancePage(1); }}><SelectTrigger className="w-[70px]"><SelectValue placeholder={`${quizPerformancePageSize}`} /></SelectTrigger><SelectContent>{[10, 25, 50].map(size => (
                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                        ))}</SelectContent></Select></div>
                        <span className="text-xs sm:text-sm text-muted-foreground">Page {quizPerformancePage} of {quizPerformanceTotalPages}</span>
                        <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setQuizPerformancePage(prev => Math.max(prev - 1, 1))} disabled={quizPerformancePage === 1}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => setQuizPerformancePage(prev => Math.min(prev + 1, quizPerformanceTotalPages))} disabled={quizPerformancePage === quizPerformanceTotalPages}><ChevronRight className="h-4 w-4" /></Button></div>
                    </CardFooter>
                )}
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={!!selectedDayBreakdown} onOpenChange={() => setSelectedDayBreakdown(null)}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full">
            <DialogHeader>
                <DialogTitle>Activity Breakdown - {selectedDayBreakdown?.date}</DialogTitle>
                <DialogDescription>
                    Courses engaged with on this day.
                </DialogDescription>
            </DialogHeader>
            <div className="h-[300px] mt-4">
                {selectedDayBreakdown && (
                    <ChartContainer config={breakdownChartConfig} className="h-full w-full">
                        <BarChart data={selectedDayBreakdown.breakdown} layout="vertical">
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tickLine={false}
                                tickMargin={5}
                                axisLine={false}
                                fontSize={isMobile ? 8 : 10}
                                width={isMobile ? 100 : 150}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar
                                dataKey="value"
                                fill="var(--color-value)"
                                radius={[0, 4, 4, 0]}
                            />
                        </BarChart>
                    </ChartContainer>
                )}
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCategoryBreakdown} onOpenChange={() => setSelectedCategoryBreakdown(null)}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full">
            <DialogHeader>
                <DialogTitle>Completion Breakdown - {selectedCategoryBreakdown?.category}</DialogTitle>
                <DialogDescription>
                    Ladders and Courses completed within this category.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        By Ladder
                    </h4>
                    <div className="h-[250px]">
                        {selectedCategoryBreakdown && (
                            <ChartContainer config={breakdownChartConfig} className="h-full w-full">
                                <BarChart data={selectedCategoryBreakdown.breakdown.ladders} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
                                        axisLine={false}
                                        fontSize={isMobile ? 8 : 10}
                                        width={isMobile ? 80 : 120}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="value"
                                        fill="var(--color-value)"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </div>
                </div>
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                        <BookCopy className="h-4 w-4 text-primary" />
                        By Course
                    </h4>
                    <div className="h-[250px]">
                        {selectedCategoryBreakdown && (
                            <ChartContainer config={breakdownChartConfig} className="h-full w-full">
                                <BarChart data={selectedCategoryBreakdown.breakdown.courses} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
                                        axisLine={false}
                                        fontSize={isMobile ? 8 : 10}
                                        width={isMobile ? 80 : 120}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="value"
                                        fill="var(--color-value)"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </div>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProgressDetail} onOpenChange={() => setSelectedProgressDetail(null)}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Progress Details</DialogTitle>
            <DialogDescription>Detailed video progress for {selectedProgressDetail?.user.displayName} in {selectedProgressDetail?.course.title}.</DialogDescription>
          </DialogHeader>
          {selectedProgressDetail && (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Video Title</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Time Spent</TableHead></TableRow></TableHeader>
                <TableBody>
                  {selectedProgressDetail.course.videos?.map(videoId => {
                    const video = allVideos.find(v => v.id === videoId);
                    const videoProgress = selectedProgressDetail.progress.videoProgress.find(vp => vp.videoId === videoId);
                    return (<TableRow key={videoId}><TableCell className="text-xs md:text-sm">{video?.title || 'Unknown Video'}</TableCell><TableCell><Badge variant={videoProgress?.completed ? 'default' : 'secondary'} className="text-[10px]">{videoProgress?.completed ? 'Completed' : 'In Progress'}</Badge></TableCell><TableCell className="text-right text-xs md:text-sm">{formatDuration(videoProgress?.timeSpent || 0)}</TableCell></TableRow>)
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
