"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { collection, getDocs, query, where, getCountFromServer, documentId, orderBy, collectionGroup, limit, doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { User, Course, UserProgress as UserProgressType, Video, Enrollment, Post, Quiz, UserQuizResult, QuizQuestion, CourseGroup, OnsiteCompletion, Ladder } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Download, ArrowUpDown, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X as XIcon, RefreshCw, BookCopy, FileQuestion, Users as UsersIcon, Home, Award, UserPlus, Loader2, BarChart3, CheckCircle2, Waves, GraduationCap, Users2, MapPin, Monitor, Map as MapIcon, Globe } from "lucide-react";
import Papa from 'papaparse';
import { format, isValid, startOfDay, endOfDay, subDays, isSameDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
type LoadState = "idle" | "loading" | "loaded";
type AnalyticsCardKey =
  | "totalEnrollments"
  | "classesCompletedStat"
  | "pendingHpRequests"
  | "userEngagement"
  | "classesCompletedChart"
  | "completionType"
  | "locationPreference"
  | "baptismStatus"
  | "graduationStatus"
  | "genderDistribution"
  | "campusDistribution"
  | "courseReport"
  | "quizPerformance";

interface BaseAnalyticsData {
  users: User[];
  courses: Course[];
  courseGroups: CourseGroup[];
  ladders: Ladder[];
  videos: Video[];
  quizzes: Quiz[];
  campuses: Campus[];
}

interface CompletionAnalyticsData {
  totalLadderGraduates: number;
  completionChartData: { ladder: string, count: number, breakdown: { campuses: any[], languages: any[] } }[];
  completionTypeChartData: { type: string, count: number }[];
}

const initialLoadStates: Record<AnalyticsCardKey, LoadState> = {
  totalEnrollments: "idle",
  classesCompletedStat: "idle",
  pendingHpRequests: "idle",
  userEngagement: "idle",
  classesCompletedChart: "idle",
  completionType: "idle",
  locationPreference: "idle",
  baptismStatus: "idle",
  graduationStatus: "idle",
  genderDistribution: "idle",
  campusDistribution: "idle",
  courseReport: "idle",
  quizPerformance: "idle",
};

const engagementChartConfig = {
  count: {
    label: "Activities",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const breakdownChartConfig = {
  value: {
    label: "Count",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const completionChartConfig = {
  count: {
    label: "Completed",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig;

const baptismChartConfig = {
  count: {
    label: "Users",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const graduationChartConfig = {
  count: {
    label: "Users",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const genderChartConfig = {
  count: {
    label: "Users",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const campusChartConfig = {
  count: {
    label: "Users",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

const completionTypeChartConfig = {
  count: {
    label: "Total",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const locationPreferenceChartConfig = {
  count: {
    label: "Users",
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

const ClickToLoad = ({ onFetch, title, loading = false, compact = false }: { onFetch: () => void | Promise<void>, title: string, loading?: boolean, compact?: boolean }) => (
  <div className={compact ? "h-8 flex items-center" : "flex items-center justify-center h-full min-h-[300px]"}>
    <Button onClick={onFetch} variant="outline" size={compact ? "sm" : "default"} disabled={loading} className={compact ? "h-8 px-2 text-xs" : ""}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
      {loading ? "Loading..." : `Load ${title}`}
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
  const [totalEnrollments, setTotalEnrollments] = useState<number | null>(null);
  const [totalHpRequests, setTotalHpRequests] = useState<number | null>(null);
  const [totalLadderGraduates, setTotalLadderGraduates] = useState<number | null>(null);
  const [engagementData, setEngagementData] = useState<{ date: string, count: number, breakdown: { name: string, value: number }[] }[]>([]);
  const [completionData, setCompletionData] = useState<{ ladder: string, count: number, breakdown: { campuses: any[], languages: any[] } }[]>([]);
  const [baptismData, setBaptismData] = useState<{ status: string, count: number }[]>([]);
  const [graduationData, setGraduationData] = useState<{ status: string, count: number }[]>([]);
  const [genderData, setGenderData] = useState<{ status: string, count: number }[]>([]);
  const [campusDistributionData, setCampusDistributionData] = useState<{ name: string, count: number }[]>([]);
  const [completionTypeData, setCompletionTypeData] = useState<{ type: string, count: number }[]>([]);
  const [locationPreferenceData, setLocationPreferenceData] = useState<{ preference: string, count: number }[]>([]);
  const [selectedDayBreakdown, setSelectedDayBreakdown] = useState<any | null>(null);
  const [selectedLadderBreakdown, setSelectedLadderBreakdown] = useState<any | null>(null);


  // Loading states
  const [isClient, setIsClient] = useState(false);
  const [loadStates, setLoadStates] = useState<Record<AnalyticsCardKey, LoadState>>(initialLoadStates);
  const baseDataRef = useRef<BaseAnalyticsData | null>(null);
  const baseDataPromiseRef = useRef<Promise<BaseAnalyticsData> | null>(null);
  const usersDataRef = useRef<User[] | null>(null);
  const usersDataPromiseRef = useRef<Promise<User[]> | null>(null);
  const coursesDataRef = useRef<Course[] | null>(null);
  const coursesDataPromiseRef = useRef<Promise<Course[]> | null>(null);
  const quizzesDataRef = useRef<Quiz[] | null>(null);
  const quizzesDataPromiseRef = useRef<Promise<Quiz[]> | null>(null);
  const completionAnalyticsRef = useRef<CompletionAnalyticsData | null>(null);
  const completionAnalyticsPromiseRef = useRef<Promise<CompletionAnalyticsData> | null>(null);
  
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

  const isCardLoading = (key: AnalyticsCardKey) => loadStates[key] === "loading";
  const isCardLoaded = (key: AnalyticsCardKey) => loadStates[key] === "loaded";

  const loadCard = useCallback(async (key: AnalyticsCardKey, title: string, loader: () => Promise<void>) => {
    setLoadStates((prev) => ({ ...prev, [key]: "loading" }));
    try {
      await loader();
      setLoadStates((prev) => ({ ...prev, [key]: "loaded" }));
    } catch (error) {
      console.error(`Error loading ${title}:`, error);
      toast({ variant: "destructive", title: `Failed to load ${title}.` });
      setLoadStates((prev) => ({ ...prev, [key]: "idle" }));
    }
  }, [toast]);

  const ensureUsers = useCallback(async (): Promise<User[]> => {
    if (usersDataRef.current) {
      return usersDataRef.current;
    }

    if (!usersDataPromiseRef.current) {
      usersDataPromiseRef.current = getDocs(collection(db, 'users')).then((snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        usersDataRef.current = users;
        setAllUsers(users);
        return users;
      });
    }

    try {
      return await usersDataPromiseRef.current;
    } catch (error) {
      usersDataPromiseRef.current = null;
      throw error;
    }
  }, [db]);

  const ensureCourses = useCallback(async (): Promise<Course[]> => {
    if (coursesDataRef.current) {
      return coursesDataRef.current;
    }

    if (!coursesDataPromiseRef.current) {
      coursesDataPromiseRef.current = getDocs(query(collection(db, 'courses'), where('status', '==', 'published'))).then((snapshot) => {
        const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        coursesDataRef.current = courses;
        setAllCourses(courses);
        return courses;
      });
    }

    try {
      return await coursesDataPromiseRef.current;
    } catch (error) {
      coursesDataPromiseRef.current = null;
      throw error;
    }
  }, [db]);

  const ensureQuizzes = useCallback(async (): Promise<Quiz[]> => {
    if (quizzesDataRef.current) {
      return quizzesDataRef.current;
    }

    if (!quizzesDataPromiseRef.current) {
      quizzesDataPromiseRef.current = getDocs(collection(db, 'quizzes')).then((snapshot) => {
        const quizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
        quizzesDataRef.current = quizzes;
        setAllQuizzes(quizzes);
        return quizzes;
      });
    }

    try {
      return await quizzesDataPromiseRef.current;
    } catch (error) {
      quizzesDataPromiseRef.current = null;
      throw error;
    }
  }, [db]);

  const ensureBaseData = useCallback(async (): Promise<BaseAnalyticsData> => {
    if (baseDataRef.current) {
      return baseDataRef.current;
    }

    if (!baseDataPromiseRef.current) {
      baseDataPromiseRef.current = (async () => {
        const courseGroupsCollection = collection(db, 'courseGroups');
        const laddersCollection = query(collection(db, 'courseLevels'), orderBy('order'));
        const videosCollection = query(collection(db, 'Contents'), where("Type", "in", ["video", "youtube", "googledrive"]));
        const campusesCollection = collection(db, 'Campus');

        const [users, courses, quizzes, courseGroupsSnapshot, laddersSnapshot, videosSnapshot, campusesSnapshot] = await Promise.all([
          ensureUsers(),
          ensureCourses(),
          ensureQuizzes(),
          getDocs(courseGroupsCollection),
          getDocs(laddersCollection),
          getDocs(videosCollection),
          getDocs(campusesCollection),
        ]);

        const baseData = {
          users,
          courses,
          courseGroups: courseGroupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseGroup)),
          ladders: laddersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder)),
          videos: videosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video)),
          quizzes,
          campuses: campusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus)),
        };

        baseDataRef.current = baseData;
        setAllUsers(baseData.users);
        setAllCourses(baseData.courses);
        setAllCourseGroups(baseData.courseGroups);
        setAllLadders(baseData.ladders);
        setAllVideos(baseData.videos);
        setAllQuizzes(baseData.quizzes);
        setAllCampuses(baseData.campuses);

        return baseData;
      })();
    }

    try {
      return await baseDataPromiseRef.current;
    } catch (error) {
      baseDataPromiseRef.current = null;
      throw error;
    }
  }, [db, ensureCourses, ensureQuizzes, ensureUsers]);

  const ensureCompletionAnalytics = useCallback(async (): Promise<CompletionAnalyticsData> => {
    if (completionAnalyticsRef.current) {
      return completionAnalyticsRef.current;
    }

    if (!completionAnalyticsPromiseRef.current) {
      completionAnalyticsPromiseRef.current = (async () => {
        const { users, courses, ladders, videos, quizzes } = await ensureBaseData();
  
        const userCompletionsMap = new Map<string, Set<string>>();

        const [onlineCompletionsSnap, onsiteCompletionsSnap, globalProgressSnap, videoProgressSnap, quizResultsSnap, formSubmissionsSnap] = await Promise.all([
          getDocs(query(collection(db, 'enrollments'), where('completedAt', '!=', null))),
          getDocs(collection(db, 'onsiteCompletions')),
          getDocs(collection(db, 'userContentProgress')),
          getDocs(collection(db, 'userVideoProgress')),
          getDocs(query(collection(db, 'userQuizResults'), where('passed', '==', true))),
          getDocs(collectionGroup(db, 'submissions'))
        ]);

        const recordCompletion = (userId: string, courseId: string) => {
          if (!userId || !courseId) return;
          if (!userCompletionsMap.has(userId)) userCompletionsMap.set(userId, new Set());
          userCompletionsMap.get(userId)!.add(courseId);
        };

        onsiteCompletionsSnap.forEach(d => {
          const data = d.data();
          if (data.userId && data.courseId) recordCompletion(data.userId, data.courseId);
        });
        onlineCompletionsSnap.forEach(d => {
          const data = d.data();
          if (data.userId && data.courseId) recordCompletion(data.userId, data.courseId);
        });
        globalProgressSnap.forEach(doc => {
          const items = doc.data().completedItems || {};
          Object.keys(items).forEach(cid => {
            if (courses.some(c => c.id === cid)) recordCompletion(doc.id, cid);
          });
        });

        const videoDoneMap = new Map<string, Set<string>>();
        videoProgressSnap.forEach(d => {
          const data = d.data();
          if(data.userId && Array.isArray(data.videoProgress)) {
            if(!videoDoneMap.has(data.userId)) videoDoneMap.set(data.userId, new Set());
            data.videoProgress.forEach((vp: any) => {
              if(vp.completed && vp.videoId) videoDoneMap.get(data.userId)!.add(vp.videoId);
            });
          }
        });

        const quizDoneMap = new Map<string, Set<string>>();
        quizResultsSnap.forEach(d => {
          const data = d.data();
          if(data.userId && data.quizId) {
            if(!quizDoneMap.has(data.userId)) quizDoneMap.set(data.userId, new Set());
            quizDoneMap.get(data.userId)!.add(data.quizId);
          }
        });

        const formDoneMap = new Map<string, Set<string>>();
        formSubmissionsSnap.forEach(d => {
          const data = d.data();
          if (data.userId && data.formId) {
            if(!formDoneMap.has(data.userId)) formDoneMap.set(data.userId, new Set());
            formDoneMap.get(data.userId)!.add(data.formId);
          }
        });

        const allVideoIds = new Set(videos.map(v => v.id));
        const allQuizIds = new Set(quizzes.map(q => q.id));
        globalProgressSnap.forEach(doc => {
          const userId = doc.id;
          const items = doc.data().completedItems || {};
          Object.keys(items).forEach(itemId => {
            if (allVideoIds.has(itemId)) {
              if(!videoDoneMap.has(userId)) videoDoneMap.set(userId, new Set());
              videoDoneMap.get(userId)!.add(itemId);
            }
            if (allQuizIds.has(itemId)) {
              if(!quizDoneMap.has(userId)) quizDoneMap.set(userId, new Set());
              quizDoneMap.get(userId)!.add(itemId);
            }
          });
        });

        users.forEach(user => {
          const myVideos = videoDoneMap.get(user.id) || new Set();
          const myQuizzes = quizDoneMap.get(user.id) || new Set();
          const myForms = formDoneMap.get(user.id) || new Set();

          courses.forEach(c => {
            if (userCompletionsMap.get(user.id)?.has(c.id)) return;
            const vOk = (c.videos || []).every(id => myVideos.has(id));
            const qOk = (c.quizIds || []).every(id => myQuizzes.has(id));
            const fOk = !c.formId || myForms.has(c.formId);
            const hasReqs = (c.videos?.length || 0) > 0 || (c.quizIds?.length || 0) > 0 || !!c.formId;
            if (vOk && qOk && fOk && hasReqs) {
              recordCompletion(user.id, c.id);
            }
          });
        });

        const ladderStats: Record<string, {
          count: number,
          campuses: Record<string, number>,
          languages: Record<string, number>
        }> = {};

        ladders.forEach(ladder => {
          ladderStats[ladder.id] = { count: 0, campuses: {}, languages: {} };
          const requiredCourses = courses.filter(c => c.ladderIds?.includes(ladder.id));

          users.forEach(user => {
            if (user.classLadderId !== ladder.id) return;
            const userLang = user.language || 'English';
            const langRequiredCourses = requiredCourses.filter(c => c.language === userLang);
            if (langRequiredCourses.length === 0) return;

            const userCompletedIds = userCompletionsMap.get(user.id) || new Set();
            const finishedAll = langRequiredCourses.every(c => userCompletedIds.has(c.id));

            if (finishedAll) {
              ladderStats[ladder.id].count++;
              const campus = user.campus || 'Unknown';
              ladderStats[ladder.id].campuses[campus] = (ladderStats[ladder.id].campuses[campus] || 0) + 1;
              ladderStats[ladder.id].languages[userLang] = (ladderStats[ladder.id].languages[userLang] || 0) + 1;
            }
          });
        });

        const completionChartData = ladders
          .map(l => ({
            ladder: l.name,
            count: ladderStats[l.id]?.count || 0,
            breakdown: {
              campuses: Object.entries(ladderStats[l.id]?.campuses || {}).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
              languages: Object.entries(ladderStats[l.id]?.languages || {}).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
            }
          }))
          .filter(d => d.count > 0)
          .sort((a,b) => a.count - b.count);

        const analyticsData = {
          totalLadderGraduates: Object.values(ladderStats).reduce((sum, s) => sum + s.count, 0),
          completionChartData,
          completionTypeChartData: [
            { type: "Online", count: onlineCompletionsSnap.size },
            { type: "On-site", count: onsiteCompletionsSnap.size }
          ]
        };

        completionAnalyticsRef.current = analyticsData;
        setTotalLadderGraduates(analyticsData.totalLadderGraduates);
        setCompletionData(analyticsData.completionChartData);
        setCompletionTypeData(analyticsData.completionTypeChartData);

        return analyticsData;
      })();
    }

    try {
      return await completionAnalyticsPromiseRef.current;
    } catch (error) {
      completionAnalyticsPromiseRef.current = null;
      throw error;
    }
  }, [db, ensureBaseData]);

  const loadTotalEnrollments = useCallback(() => loadCard("totalEnrollments", "Total Enrollments", async () => {
    const enrollmentsCountSnap = await getCountFromServer(collection(db, 'enrollments'));
    setTotalEnrollments(enrollmentsCountSnap.data().count);
  }), [db, loadCard]);

  const loadClassesCompletedStat = useCallback(() => loadCard("classesCompletedStat", "Classes Completed", async () => {
    const analyticsData = await ensureCompletionAnalytics();
    setTotalLadderGraduates(analyticsData.totalLadderGraduates);
  }), [ensureCompletionAnalytics, loadCard]);

  const loadPendingHpRequests = useCallback(() => loadCard("pendingHpRequests", "Pending HP Requests", async () => {
    const users = await ensureUsers();
    const hpRequestingUsers = users.filter(
      (u) => (u.isInHpGroup === false || u.isInHpGroup === undefined || u.isInHpGroup === null) && u.hpAvailabilityDay
    );
    setTotalHpRequests(hpRequestingUsers.length);
  }), [ensureUsers, loadCard]);

  const loadUserEngagement = useCallback(() => loadCard("userEngagement", "User Engagement", async () => {
    const courses = await ensureCourses();
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
        if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
            const dateStr = format(data.updatedAt.toDate(), 'MMM dd');
            if (activityMap[dateStr] !== undefined) {
                activityMap[dateStr].count += 1;
                const course = courses.find(c => c.id === data.courseId);
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
  }), [db, ensureCourses, loadCard]);

  const loadClassesCompletedChart = useCallback(() => loadCard("classesCompletedChart", "Classes Completed", async () => {
    const analyticsData = await ensureCompletionAnalytics();
    setCompletionData(analyticsData.completionChartData);
  }), [ensureCompletionAnalytics, loadCard]);

  const loadCompletionType = useCallback(() => loadCard("completionType", "Class Completion Type", async () => {
    const analyticsData = await ensureCompletionAnalytics();
    setCompletionTypeData(analyticsData.completionTypeChartData);
  }), [ensureCompletionAnalytics, loadCard]);

  const loadLocationPreference = useCallback(() => loadCard("locationPreference", "Location Preference", async () => {
    const users = await ensureUsers();
    const prefMap: Record<string, number> = { "Online": 0, "Onsite": 0 };
    users.forEach(u => {
        const pref = u.locationPreference || "Online";
        if (prefMap[pref] !== undefined) {
            prefMap[pref]++;
        }
    });
    setLocationPreferenceData(Object.entries(prefMap).map(([preference, count]) => ({ preference, count })));
  }), [ensureUsers, loadCard]);

  const loadBaptismStatus = useCallback(() => loadCard("baptismStatus", "Baptism Status", async () => {
    const users = await ensureUsers();
    const baptizedCount = users.filter(u => u.isBaptized === true).length;
    const notBaptizedCount = users.filter(u => u.isBaptized === false || u.isBaptized === undefined || u.isBaptized === null).length;
    setBaptismData([
        { status: "Baptized", count: baptizedCount },
        { status: "Not Baptized", count: notBaptizedCount }
    ]);
  }), [ensureUsers, loadCard]);

  const loadGraduationStatus = useCallback(() => loadCard("graduationStatus", "Graduation Status", async () => {
    const users = await ensureUsers();
    const gradMap: Record<string, number> = {
        "Not Started": 0,
        "In Progress": 0,
        "Eligible": 0,
        "Graduated": 0
    };
    users.forEach(u => {
        const status = u.graduationStatus || "Not Started";
        if (gradMap[status] !== undefined) {
            gradMap[status]++;
        } else {
            gradMap[status] = (gradMap[status] || 0) + 1;
        }
    });
    setGraduationData(Object.entries(gradMap).map(([status, count]) => ({ status, count })));
  }), [ensureUsers, loadCard]);

  const loadGenderDistribution = useCallback(() => loadCard("genderDistribution", "Gender Distribution", async () => {
    const users = await ensureUsers();
    const genderMap: Record<string, number> = { "Male": 0, "Female": 0, "Other": 0 };
    users.forEach(u => {
        const gender = u.gender || "Other";
        if (genderMap[gender] !== undefined) {
            genderMap[gender]++;
        } else {
            genderMap["Other"]++;
        }
    });
    setGenderData(Object.entries(genderMap).map(([status, count]) => ({ status, count })));
  }), [ensureUsers, loadCard]);

  const loadCampusDistribution = useCallback(() => loadCard("campusDistribution", "Campus Distribution", async () => {
    const users = await ensureUsers();
    const campusDistributionMap: Record<string, number> = {};
    users.forEach(u => {
        const campus = u.campus || "Unknown";
        campusDistributionMap[campus] = (campusDistributionMap[campus] || 0) + 1;
    });
    setCampusDistributionData(Object.entries(campusDistributionMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    );
  }), [ensureUsers, loadCard]);

  const fetchQuizPerformance = useCallback(() => loadCard("quizPerformance", "Quiz Performance", async () => {
    const quizzes = await ensureQuizzes();
    const quizResultsList = (await getDocs(collection(db, 'userQuizResults'))).docs.map(doc => doc.data() as UserQuizResult);
    const quizPerformance = quizzes.map(quiz => {
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
  }), [db, ensureQuizzes, loadCard]);

  const fetchProgressData = useCallback(() => loadCard("courseReport", "Course Report", async () => {
    const { courses, videos } = await ensureBaseData();
    const [progressSnapshot, enrollmentSnapshot] = await Promise.all([
        getDocs(collection(db, 'userVideoProgress')),
        getDocs(collection(db, 'enrollments')),
    ]);
        
    const enrollmentsMap = new Map(enrollmentSnapshot.docs.map(doc => [`${doc.data().userId}_${doc.data().courseId}`, doc.data() as Enrollment]));

    const progressList = progressSnapshot.docs.map(doc => {
        const data = doc.data() as Omit < UserProgressType, 'totalProgress' > ;
        const course = courses.find(c => c.id === data.courseId);
        const publishedVideoIdsInCourse = new Set((course?.videos || []).filter(vid => videos.some(v => v.id === vid && v.status === 'published')));
        const totalVideos = publishedVideoIdsInCourse.size;
        const completedCount = data.videoProgress?.filter(vp => vp.completed && publishedVideoIdsInCourse.has(vp.videoId)).length || 0;
        const totalProgress = totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;
        const enrollment = enrollmentsMap.get(`${data.userId}_${data.courseId}`);
        return { ...data, totalProgress, enrollment };
    });
        
    setUserProgressData(progressList);
  }), [db, ensureBaseData, loadCard]);

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
        return (progress.videoProgress || []).filter(vp => vp.completed).map(videoProgress => {
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
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {isCardLoaded("totalEnrollments") && totalEnrollments !== null ? (
                        <div className="text-2xl font-bold">{totalEnrollments}</div>
                      ) : (
                        <ClickToLoad onFetch={loadTotalEnrollments} title="Total Enrollments" loading={isCardLoading("totalEnrollments")} compact />
                      )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Classes Completed</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {isCardLoaded("classesCompletedStat") && totalLadderGraduates !== null ? (
                        <>
                          <div className="text-2xl font-bold">{totalLadderGraduates}</div>
                          <p className="text-[10px] text-muted-foreground mt-1">Verified unique graduates per ladder</p>
                        </>
                      ) : (
                        <ClickToLoad onFetch={loadClassesCompletedStat} title="Classes Completed" loading={isCardLoading("classesCompletedStat")} compact />
                      )}
                    </CardContent>
                </Card>
                <Card className="sm:col-span-2 md:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending HP Requests</CardTitle>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      {isCardLoaded("pendingHpRequests") && totalHpRequests !== null ? (
                        <div className="text-2xl font-bold">{totalHpRequests}</div>
                      ) : (
                        <ClickToLoad onFetch={loadPendingHpRequests} title="Pending HP Requests" loading={isCardLoading("pendingHpRequests")} compact />
                      )}
                    </CardContent>
                </Card>
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
                        {!isCardLoaded("userEngagement") ? (
                            <ClickToLoad onFetch={loadUserEngagement} title="User Engagement" loading={isCardLoading("userEngagement")} />
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
                            Classes Completed
                        </CardTitle>
                        <CardDescription>Unique users who completed all requirements for their ladder track.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {!isCardLoaded("classesCompletedChart") ? (
                            <ClickToLoad onFetch={loadClassesCompletedChart} title="Classes Completed" loading={isCardLoading("classesCompletedChart")} />
                        ) : (
                            <ChartContainer config={completionChartConfig} className="h-full w-full">
                                <BarChart data={completionData} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis hide type="number" />
                                    <YAxis
                                        dataKey="ladder"
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
                                                setSelectedLadderBreakdown(data.activePayload[0].payload);
                                            } else if (data && data.ladder) {
                                                setSelectedLadderBreakdown(data);
                                            }
                                        }}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Class Completion Type and Location Preference Section */}
            <div className="grid gap-4 mt-6 grid-cols-1 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-primary" />
                            Class Completion Type
                        </CardTitle>
                        <CardDescription>Breakdown of Online vs. On-site course completions.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {!isCardLoaded("completionType") ? (
                            <ClickToLoad onFetch={loadCompletionType} title="Class Completion Type" loading={isCardLoading("completionType")} />
                        ) : (
                            <ChartContainer config={completionTypeChartConfig} className="h-full w-full">
                                <BarChart data={completionTypeData} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis hide type="number" />
                                    <YAxis
                                        dataKey="type"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
                                        axisLine={false}
                                        fontSize={isMobile ? 10 : 12}
                                        width={isMobile ? 80 : 100}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapIcon className="h-4 w-4 text-primary" />
                            Location Preference
                        </CardTitle>
                        <CardDescription>Breakdown of users by their preferred learning environment.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {!isCardLoaded("locationPreference") ? (
                            <ClickToLoad onFetch={loadLocationPreference} title="Location Preference" loading={isCardLoading("locationPreference")} />
                        ) : (
                            <ChartContainer config={locationPreferenceChartConfig} className="h-full w-full">
                                <BarChart data={locationPreferenceData} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis hide type="number" />
                                    <YAxis
                                        dataKey="preference"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
                                        axisLine={false}
                                        fontSize={isMobile ? 10 : 12}
                                        width={isMobile ? 80 : 100}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Baptism and Graduation Status Section */}
            <div className="grid gap-4 mt-6 grid-cols-1 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Waves className="h-4 w-4 text-primary" />
                            Baptism Status
                        </CardTitle>
                        <CardDescription>Breakdown of baptized vs. non-baptized users.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {!isCardLoaded("baptismStatus") ? (
                            <ClickToLoad onFetch={loadBaptismStatus} title="Baptism Status" loading={isCardLoading("baptismStatus")} />
                        ) : (
                            <ChartContainer config={baptismChartConfig} className="h-full w-full">
                                <BarChart data={baptismData} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis hide type="number" />
                                    <YAxis
                                        dataKey="status"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
                                        axisLine={false}
                                        fontSize={isMobile ? 10 : 12}
                                        width={isMobile ? 80 : 100}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            Graduation Status
                        </CardTitle>
                        <CardDescription>Breakdown of users by their graduation phase.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {!isCardLoaded("graduationStatus") ? (
                            <ClickToLoad onFetch={loadGraduationStatus} title="Graduation Status" loading={isCardLoading("graduationStatus")} />
                        ) : (
                            <ChartContainer config={graduationChartConfig} className="h-full w-full">
                                <BarChart data={graduationData} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis hide type="number" />
                                    <YAxis
                                        dataKey="status"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
                                        axisLine={false}
                                        fontSize={isMobile ? 10 : 12}
                                        width={isMobile ? 80 : 100}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Gender and Campus Distribution Section */}
            <div className="grid gap-4 mt-6 grid-cols-1 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users2 className="h-4 w-4 text-primary" />
                            Gender Distribution
                        </CardTitle>
                        <CardDescription>Breakdown of users by gender.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {!isCardLoaded("genderDistribution") ? (
                            <ClickToLoad onFetch={loadGenderDistribution} title="Gender Distribution" loading={isCardLoading("genderDistribution")} />
                        ) : (
                            <ChartContainer config={genderChartConfig} className="h-full w-full">
                                <BarChart data={genderData} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis hide type="number" />
                                    <YAxis
                                        dataKey="status"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
                                        axisLine={false}
                                        fontSize={isMobile ? 10 : 12}
                                        width={isMobile ? 80 : 100}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            Campus Distribution
                        </CardTitle>
                        <CardDescription>Breakdown of users by campus.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {!isCardLoaded("campusDistribution") ? (
                            <ClickToLoad onFetch={loadCampusDistribution} title="Campus Distribution" loading={isCardLoading("campusDistribution")} />
                        ) : (
                            <ChartContainer config={campusChartConfig} className="h-full w-full">
                                <BarChart data={campusDistributionData} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis hide type="number" />
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
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[0, 4, 4, 0]}
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
                    {userProgressData === null ? <ClickToLoad onFetch={fetchProgressData} title="Course Report" loading={isCardLoading("courseReport")} /> : (
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
                                            setDateRange((prev) => from ? { from, to: prev?.to } : undefined);
                                        }}
                                        className="w-full sm:w-[150px]"
                                    />
                                    <span className="text-muted-foreground">-</span>
                                    <Input
                                        type="date"
                                        value={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                                        onChange={(e) => {
                                            const to = e.target.value ? new Date(e.target.value.replace(/-/g, '/')) : undefined;
                                            setDateRange((prev) => prev?.from ? { from: prev.from, to } : to ? { from: to, to } : undefined);
                                        }}
                                        className="w-full sm:w-[150px]"
                                    />
                                </div>
                                {dateRange && <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}><XIcon className="h-4 w-4" /></Button>}
                                <Button onClick={handleExportDetailedReportCSV} variant="outline" disabled={!sortedAndFilteredProgress || sortedAndFilteredProgress.length === 0} className="w-full sm:auto"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
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
                {quizPerformanceSummary === null ? <ClickToLoad onFetch={fetchQuizPerformance} title="Quiz Performance" loading={isCardLoading("quizPerformance")} /> : (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader><TableRow><TableHead>Quiz Title</TableHead><TableHead className="text-center">Attempts</TableHead><TableHead className="text-center hidden sm:table-cell">Unique Users</TableHead><TableHead className="text-center text-green-600">Passes</TableHead><TableHead className="text-center text-red-600">Fails</TableHead></TableRow></TableHeader>
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
                            <XAxis hide type="number" />
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

      <Dialog open={!!selectedLadderBreakdown} onOpenChange={() => setSelectedLadderBreakdown(null)}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full">
            <DialogHeader>
                <DialogTitle>Completion Breakdown - {selectedLadderBreakdown?.ladder}</DialogTitle>
                <DialogDescription>
                    Students who finished this ladder track by campus and language.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        By Campus
                    </h4>
                    <div className="h-[250px]">
                        {selectedLadderBreakdown && (
                            <ChartContainer config={breakdownChartConfig} className="h-full w-full">
                                <BarChart data={selectedLadderBreakdown.breakdown.campuses} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis hide type="number" />
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
                        <Globe className="h-4 w-4 text-primary" />
                        By Language
                    </h4>
                    <div className="h-[250px]">
                        {selectedLadderBreakdown && (
                            <ChartContainer config={breakdownChartConfig} className="h-full w-full">
                                <BarChart data={selectedLadderBreakdown.breakdown.languages} layout="vertical">
                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis hide type="number" />
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
