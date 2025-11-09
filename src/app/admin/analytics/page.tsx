
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { collection, getDocs, query, where, getCountFromServer, documentId, orderBy, collectionGroup } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { User, Course, UserProgress as UserProgressType, Video, Enrollment, Post, Quiz, UserQuizResult, QuizQuestion, CourseGroup, OnsiteCompletion } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Download, ArrowUpDown, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X as XIcon, CheckCircle, XCircle, Trash2, BookCopy, FileQuestion, Loader2, RefreshCw } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from 'papaparse';
import { format, isValid, startOfDay, endOfDay, addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface Campus {
  id: string;
  "Campus Name": string;
}

const engagementChartConfig = {
  timeSpent: {
    label: "Time Spent (minutes)",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const progressChartConfig = {
    averageProgress: {
        label: "Average Progress (%)",
        color: "hsl(var(--chart-2))",
    }
} satisfies ChartConfig;

const userRoleChartConfig = {
    users: {
        label: "Users",
        color: "hsl(var(--chart-3))",
    },
} satisfies ChartConfig;

const hpRequestChartConfig = {
    requests: {
        label: "Requests",
        color: "hsl(var(--chart-4))",
    },
} satisfies ChartConfig;


interface ProgressDetail {
  progress: UserProgressType;
  user: User;
  course: Course;
}

interface CourseEngagementData {
    courseId: string;
    courseTitle: string;
    enrollments: number;
    completions: number;
    likes: number;
    comments: number;
}

interface QuizPerformanceSummary {
    quizId: string;
    quizTitle: string;
    totalAttempts: number;
    passCount: number;
    failCount: number;
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
  const [selectedUser, setSelectedUser] = useState<string | "all">("all");
  const [selectedCourse, setSelectedCourse] = useState<string | "all">("all");
  const [selectedCampus, setSelectedCampus] = useState<string | "all">("all");
  
  // Data states
  const [userProgressData, setUserProgressData] = useState<(UserProgressType & { enrollment?: Enrollment })[] | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allCourseGroups, setAllCourseGroups] = useState<CourseGroup[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [courseEngagementData, setCourseEngagementData] = useState<CourseEngagementData[] | null>(null);
  const [userRoleData, setUserRoleData] = useState<{ name: string; users: number }[] | null>(null);
  const [hpRequestData, setHpRequestData] = useState<{ day: string; requests: number }[] | null>(null);
  const [quizPerformanceSummary, setQuizPerformanceSummary] = useState<QuizPerformanceSummary[] | null>(null);
  const [campusProgressChartData, setCampusProgressChartData] = useState<{ campus: string; averageProgress: number }[] | null>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  const [selectedProgressDetail, setSelectedProgressDetail] = useState<ProgressDetail | null>(null);
  const [sortConfig, setSortConfig] = useState < { key: SortKey; direction: SortDirection } | null > (null);
  const [dateRange, setDateRange] = useState < DateRange | undefined > ();

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
    if (allUsers.length > 0) return; // Don't refetch if already loaded
    setLoading(true);
    try {
        const usersCollection = collection(db, 'users');
        const coursesCollection = query(collection(db, 'courses'), where('status', '==', 'published'));
        const courseGroupsCollection = collection(db, 'courseGroups');
        const videosCollection = query(collection(db, 'Contents'), where("Type", "in", ["video", "youtube", "googledrive"]));
        const quizzesCollection = collection(db, 'quizzes');
        const campusesCollection = collection(db, 'Campus');
        
        const [usersSnapshot, coursesSnapshot, courseGroupsSnapshot, videosSnapshot, quizzesSnapshot, campusesSnapshot] = await Promise.all([
            getDocs(usersCollection),
            getDocs(coursesCollection),
            getDocs(courseGroupsCollection),
            getDocs(videosCollection),
            getDocs(quizzesCollection),
            getDocs(campusesCollection),
        ]);

        setAllUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        setAllCourses(coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
        setAllCourseGroups(courseGroupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseGroup)));
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


  const fetchUserRoles = useCallback(async () => {
    setLoading(true);
    const rolesCount = allUsers.reduce((acc, user) => {
        const role = user.role || 'user';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number });
    const roleData = Object.entries(rolesCount).map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        users: count,
    }));
    setUserRoleData(roleData);
    setLoading(false);
  }, [allUsers]);

  const fetchHpRequests = useCallback(async () => {
    setLoading(true);
    const hpRequestingUsers = allUsers.filter(u => 
        (u.isInHpGroup === false || u.isInHpGroup === undefined || u.isInHpGroup === null) && u.hpAvailabilityDay
    );
    const hpRequestsByDay = hpRequestingUsers.reduce((acc, user) => {
        const day = user.hpAvailabilityDay!;
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number });
    const hpChartData = Object.entries(hpRequestsByDay).map(([day, count]) => ({ day, requests: count }));
    setHpRequestData(hpChartData);
    setLoading(false);
  }, [allUsers]);
  
  const fetchCourseEngagement = useCallback(async () => {
    setLoading(true);
    try {
        const [enrollmentsSnap, onsiteCompletionsSnap, formSubmissionsSnap, quizResultsSnap, progressSnap] = await Promise.all([
          getDocs(collection(db, 'enrollments')),
          getDocs(collection(db, 'onsiteCompletions')),
          getDocs(query(collectionGroup(db, 'submissions'))),
          getDocs(collection(db, 'userQuizResults')),
          getDocs(collection(db, 'userVideoProgress')),
        ]);

        const quizResultsList = quizResultsSnap.docs.map(d => d.data() as UserQuizResult);
        const formSubmissionsList = formSubmissionsSnap.docs.map(d => d.data() as {userId: string, courseId: string, formId: string});
        const progressDocs = progressSnap.docs.map(doc => doc.data() as UserProgressType);
        
        const passedQuizzesByCourseAndUser = new Map<string, Set<string>>();
        quizResultsList.forEach(qr => {
            if (qr.passed) {
                const key = `${qr.userId}_${qr.courseId}`;
                if (!passedQuizzesByCourseAndUser.has(key)) passedQuizzesByCourseAndUser.set(key, new Set());
                passedQuizzesByCourseAndUser.get(key)!.add(qr.quizId);
            }
        });
        const completedFormsByCourseAndUser = new Map<string, Set<string>>();
        formSubmissionsList.forEach(fs => {
            const key = `${fs.userId}_${fs.courseId}`;
            if (!completedFormsByCourseAndUser.has(key)) completedFormsByCourseAndUser.set(key, new Set());
            completedFormsByCourseAndUser.get(key)!.add(fs.formId);
        });

        const completionsByCourse = new Map<string, number>();

        allUsers.forEach(user => {
            allCourses.forEach(course => {
                const isOnsiteCompleted = onsiteCompletionsSnap.docs.some(d => {
                    const oc = d.data() as OnsiteCompletion;
                    return oc.userId === user.id && oc.courseId === course.id;
                });
                if (isOnsiteCompleted) {
                    completionsByCourse.set(course.id, (completionsByCourse.get(course.id) || 0) + 1);
                    return;
                }

                const progressDoc = progressDocs.find(p => p.userId === user.id && p.courseId === course.id);
                const videosInCourse = course.videos || [];
                const completedVideos = progressDoc?.videoProgress?.filter(v => v.completed).length || 0;
                const allVideosWatched = videosInCourse.length > 0 ? completedVideos >= videosInCourse.length : true;
                if (!allVideosWatched) return;

                const requiredQuizzes = course.quizIds || [];
                const allQuizzesPassed = requiredQuizzes.every(qid => passedQuizzesByCourseAndUser.get(`${user.id}_${course.id}`)?.has(qid));
                if (!allQuizzesPassed) return;
                
                const requiredForm = course.formId;
                const formSubmitted = requiredForm ? completedFormsByCourseAndUser.get(`${user.id}_${course.id}`)?.has(requiredForm) : true;

                if (allVideosWatched && allQuizzesPassed && formSubmitted) {
                    completionsByCourse.set(course.id, (completionsByCourse.get(course.id) || 0) + 1);
                }
            });
        });

        const courseEngagementPromises = allCourses.map(async (course) => {
            const videosInCourse = allVideos.filter(video => course.videos?.includes(video.id));
            const [likeCounts, commentCounts] = await Promise.all([
                Promise.all(videosInCourse.map(video => getCountFromServer(query(collection(db, 'Contents', video.id, 'likes'))).then(s => s.data().count))),
                Promise.all(videosInCourse.map(video => getCountFromServer(query(collection(db, 'Contents', video.id, 'comments'))).then(s => s.data().count))),
            ]);
            const totalLikes = likeCounts.reduce((sum, count) => sum + count, 0);
            const totalComments = commentCounts.reduce((sum, count) => sum + count, 0);

            return {
              courseId: course.id,
              courseTitle: course.title,
              enrollments: course.enrollmentCount || 0,
              completions: completionsByCourse.get(course.id) || 0,
              likes: totalLikes,
              comments: totalComments,
            };
        });

        const courseEngagement = await Promise.all(courseEngagementPromises);
        setCourseEngagementData(courseEngagement.filter(c => c.enrollments > 0 || c.completions > 0));

    } catch(e) {
      console.error(e)
    } finally {
        setLoading(false);
    }
  }, [allCourses, allUsers, allVideos, db]);
  
  const fetchQuizPerformance = useCallback(async () => {
    setLoading(true);
    const quizResultsList = (await getDocs(collection(db, 'userQuizResults'))).docs.map(doc => doc.data() as UserQuizResult);
    const quizPerformance = allQuizzes.map(quiz => {
        const resultsForQuiz = quizResultsList.filter(r => r.quizId === quiz.id);
        const totalAttempts = resultsForQuiz.length;
        const passCount = resultsForQuiz.filter(r => r.passed).length;
        return {
            quizId: quiz.id,
            quizTitle: quiz.title,
            totalAttempts: totalAttempts,
            passCount: passCount,
            failCount: totalAttempts - passCount,
        };
    });
    setQuizPerformanceSummary(quizPerformance.filter(q => q.totalAttempts > 0));
    setLoading(false);
  }, [allQuizzes, db]);

  const fetchProgressData = useCallback(async () => {
    setLoading(true);
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
        
        const campusProgData = allCampuses.map(campus => {
            const campusUsers = allUsers.filter(u => u.campus === campus["Campus Name"]);
            const campusUserIds = new Set(campusUsers.map(u => u.id));
            const progressForCampus = progressList.filter(p => campusUserIds.has(p.userId));

            if (progressForCampus.length === 0) return { campus: campus["Campus Name"], averageProgress: 0 };

            const totalProgressSum = progressForCampus.reduce((acc, p) => acc + p.totalProgress, 0);
            return {
                campus: campus["Campus Name"],
                averageProgress: Math.round(totalProgressSum / progressForCampus.length)
            };
        }).filter(d => d.averageProgress > 0);
        
        setUserProgressData(progressList);
        setCampusProgressChartData(campusProgData);
    } catch (error) {
        console.error("Error fetching progress data:", error);
    } finally {
        setLoading(false);
    }
}, [db, allCourses, allVideos, allUsers, allCampuses]);

  const campusesWithProgress = useMemo(() => {
    if (!userProgressData) return [];
    const userIdsWithProgress = new Set(userProgressData.filter(p => (p.videoProgress || []).some(vp => vp.timeSpent > 0 || vp.completed)).map(p => p.userId));
    const relevantUsers = allUsers.filter(u => userIdsWithProgress.has(u.id));
    const campusNames = new Set(relevantUsers.map(u => u.campus).filter(Boolean));
    return allCampuses.filter(c => campusNames.has(c["Campus Name"]));
  }, [userProgressData, allUsers, allCampuses]);

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

  const engagementChartData = useMemo(() => {
    if (!sortedAndFilteredProgress) return [];
    return allCourses.map(course => {
      const timeSpent = sortedAndFilteredProgress
        .filter(p => p.courseId === course.id)
        .reduce((total, p) => total + (p.videoProgress || []).reduce((sum, vp) => sum + vp.timeSpent, 0), 0);
      return {
        course: course.title,
        timeSpent: Math.round(timeSpent / 60)
      };
    }).filter(d => d.timeSpent > 0);
  }, [allCourses, sortedAndFilteredProgress]);
  
  const totalHpRequests = useMemo(() => hpRequestData?.reduce((sum, item) => sum + item.requests, 0) || 0, [hpRequestData]);
  
 const groupedCourseEngagement = useMemo(() => {
    if (!courseEngagementData) return [];
    const groups: { [key: string]: CourseEngagementData[] } = {};
    const uncategorizedCourses: CourseEngagementData[] = [];

    const courseToGroupMap = new Map<string, string[]>();
    allCourseGroups.forEach(group => {
        group.courseIds.forEach(courseId => {
            if (!courseToGroupMap.has(courseId)) courseToGroupMap.set(courseId, []);
            courseToGroupMap.get(courseId)!.push(group.title);
        });
    });

    courseEngagementData.forEach(course => {
        const groupTitles = courseToGroupMap.get(course.courseId);
        if (groupTitles && groupTitles.length > 0) {
            groupTitles.forEach(title => {
                if (!groups[title]) groups[title] = [];
                groups[title].push(course);
            });
        } else {
            uncategorizedCourses.push(course);
        }
    });

    const extractSessionNumber = (title: string) => {
        const match = title.match(/Session (\d+)/i);
        return match ? parseInt(match[1], 10) : Infinity;
    };
    
    for (const groupTitle in groups) {
        groups[groupTitle].sort((a, b) => extractSessionNumber(a.courseTitle) - extractSessionNumber(b.courseTitle));
    }
    uncategorizedCourses.sort((a, b) => extractSessionNumber(a.courseTitle) - extractSessionNumber(b.courseTitle));
    
    const groupedArray = Object.entries(groups).map(([title, courses]) => ({ title, courses }));
    
    if(uncategorizedCourses.length > 0) {
      groupedArray.push({ title: 'Uncategorized', courses: uncategorizedCourses });
    }

    return groupedArray;
}, [courseEngagementData, allCourseGroups]);

  const learningPathSummary = useMemo(() => {
      if (!groupedCourseEngagement) return { summary: [], grandTotal: { enrollments: 0, completions: 0, likes: 0, comments: 0 } };
      const summary = groupedCourseEngagement.map(group => {
          const totals = group.courses.reduce((acc, course) => {
              acc.enrollments += course.enrollments;
              acc.completions += course.completions;
              acc.likes += course.likes;
              acc.comments += course.comments;
              return acc;
          }, { enrollments: 0, completions: 0, likes: 0, comments: 0 });
          
          return { title: group.title, ...totals };
      });

      const grandTotal = summary.reduce((acc, group) => {
          acc.enrollments += group.enrollments;
          acc.completions += group.completions;
          acc.likes += group.likes;
          acc.comments += group.comments;
          return acc;
      }, { enrollments: 0, completions: 0, likes: 0, comments: 0 });

      return { summary, grandTotal };
  }, [groupedCourseEngagement]);


  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleExportCSV = () => {
    if (!sortedAndFilteredProgress || sortedAndFilteredProgress.length === 0) return;

    const headers = ["User", "Campus", "Course", "Video Title", "Status", "Time Spent", "Start Date", "Completion Date"];
    const rows: (string | number)[][] = [headers];

    sortedAndFilteredProgress.forEach(progress => {
      const user = allUsers.find(u => u.id === progress.userId);
      const course = allCourses.find(c => c.id === progress.courseId);

      if (!user || !course || !course.videos) return;

      (progress.videoProgress || []).forEach(videoProgress => {
        if (videoProgress.timeSpent > 0 || videoProgress.completed) {
          const video = allVideos.find(v => v.id === videoProgress.videoId);
          const startDate = progress.enrollment?.enrolledAt?.toDate ? format(progress.enrollment.enrolledAt.toDate(), 'yyyy-MM-dd') : 'N/A';
          const completionDate = progress.enrollment?.completedAt?.toDate ? format(progress.enrollment.completedAt.toDate(), 'yyyy-MM-dd') : 'N/A';

          rows.push([
            `"${user.displayName}"`, `"${user.campus || 'N/A'}"`, `"${course.title}"`, `"${video?.title || 'N/A'}"`,
            videoProgress.completed ? "Completed" : "In Progress", `"${formatDuration(videoProgress.timeSpent || 0)}"`,
            `"${startDate}"`, `"${completionDate}"`
          ]);
        }
      });
    });

    if (rows.length <= 1) {
      alert("No data with progress to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `video_progress_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleExportCourseEngagementCSV = () => {
    if (!groupedCourseEngagement) return;
    const dataToExport = groupedCourseEngagement.flatMap(group => 
        group.courses.map(item => ({
            "Learning Path": group.title, "Course": item.courseTitle, "Enrollments": item.enrollments,
            "Completions": item.completions, "Likes": item.likes, "Comments": item.comments,
        }))
    );
    if (dataToExport.length === 0) {
        toast({ variant: 'destructive', title: 'No engagement data to export.' });
        return;
    }
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "course_engagement_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Course Engagement</CardTitle>
            <CardDescription>Total time spent per course in minutes.</CardDescription>
          </CardHeader>
          <CardContent>
            {userProgressData === null ? (
                <ClickToLoad onFetch={fetchProgressData} title="Engagement Report" />
            ) : (
              <>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select User" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Users</SelectItem>{allUsers.map((user) => (<SelectItem key={user.id} value={user.id}>{user.displayName}</SelectItem>))}</SelectContent>
                  </Select>
                  <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={!canViewAllCampuses}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Campus" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Campuses</SelectItem>{campusesWithProgress.map((campus) => (<SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                {loading ? <Skeleton className="h-[300px] w-full mt-4" /> : (
                  <ChartContainer config={engagementChartConfig} className="min-h-[200px] w-full mt-4">
                    <BarChart data={engagementChartData} height={300}>
                      <CartesianGrid vertical={false} /><XAxis dataKey="course" tickLine={false} tickMargin={10} axisLine={false} /><YAxis /><Tooltip content={<ChartTooltipContent />} /><Bar dataKey="timeSpent" fill="var(--color-timeSpent)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Campus Progress</CardTitle>
            <CardDescription>Average course completion percentage by campus.</CardDescription>
          </CardHeader>
          <CardContent>
            {campusProgressChartData === null ? (
                <ClickToLoad onFetch={fetchProgressData} title="Campus Progress" />
            ) : loading ? <Skeleton className="h-[348px] w-full" /> : (
              <ChartContainer config={progressChartConfig} className="min-h-[200px] w-full">
                <BarChart data={campusProgressChartData} height={348}>
                  <CartesianGrid vertical={false} /><XAxis dataKey="campus" tickLine={false} tickMargin={10} axisLine={false} /><YAxis domain={[0, 100]} /><Tooltip content={<ChartTooltipContent />} /><Bar dataKey="averageProgress" fill="var(--color-averageProgress)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>User Overview</CardTitle>
            <CardDescription>User counts by role.</CardDescription>
          </CardHeader>
          <CardContent>
            {userRoleData === null ? <ClickToLoad onFetch={fetchUserRoles} title="User Overview" /> : loading ? <Skeleton className="h-[348px] w-full" /> : (
              <ChartContainer config={userRoleChartConfig} className="min-h-[200px] w-full">
                <BarChart data={userRoleData} height={348}>
                    <CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} /><YAxis /><Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} /><Bar dataKey="users" fill="var(--color-users)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
         <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>HP Requests by Day</CardTitle>
            {hpRequestData && <CardDescription>A total of {totalHpRequests} pending HP placement requests by user availability.</CardDescription>}
          </CardHeader>
          <CardContent>
             {hpRequestData === null ? <ClickToLoad onFetch={fetchHpRequests} title="HP Requests" /> : loading ? <Skeleton className="h-[348px] w-full" /> : (
              <ChartContainer config={hpRequestChartConfig} className="min-h-[200px] w-full">
                <BarChart data={hpRequestData} height={348}>
                  <CartesianGrid vertical={false} /><XAxis dataKey="day" tickLine={false} tickMargin={10} axisLine={false} /><YAxis /><Tooltip content={<ChartTooltipContent />} /><Bar dataKey="requests" fill="var(--color-requests)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Course Engagement Report</CardTitle>
            <CardDescription>Enrollments, completions, likes, and comments for each course.</CardDescription>
          </div>
          {courseEngagementData && <Button onClick={handleExportCourseEngagementCSV} variant="outline" disabled={courseEngagementData.length === 0}><Download className="mr-2 h-4 w-4" /> Export as CSV</Button>}
        </CardHeader>
        <CardContent>
          {courseEngagementData === null ? <ClickToLoad onFetch={fetchCourseEngagement} title="Engagement Report" /> : loading ? <Skeleton className="h-48 w-full" /> : (
            <>
              {learningPathSummary.summary.length > 0 && (
                  <div className="mb-6">
                      <h3 className="font-semibold text-lg mb-2">Learning Path Summary</h3>
                      <div className="border rounded-lg overflow-hidden">
                          <Table>
                              <TableHeader><TableRow><TableHead>Learning Path</TableHead><TableHead className="text-center">Enrollments</TableHead><TableHead className="text-center">Completions</TableHead><TableHead className="text-center">Likes</TableHead><TableHead className="text-center">Comments</TableHead></TableRow></TableHeader>
                              <TableBody>
                                  {learningPathSummary.summary.map(item => (<TableRow key={item.title}><TableCell className="font-medium">{item.title}</TableCell><TableCell className="text-center">{item.enrollments}</TableCell><TableCell className="text-center">{item.completions}</TableCell><TableCell className="text-center">{item.likes}</TableCell><TableCell className="text-center">{item.comments}</TableCell></TableRow>))}
                                  <TableRow className="font-bold bg-muted/50"><TableCell>Grand Total</TableCell><TableCell className="text-center">{learningPathSummary.grandTotal.enrollments}</TableCell><TableCell className="text-center">{learningPathSummary.grandTotal.completions}</TableCell><TableCell className="text-center">{learningPathSummary.grandTotal.likes}</TableCell><TableCell className="text-center">{learningPathSummary.grandTotal.comments}</TableCell></TableRow>
                              </TableBody>
                          </Table>
                      </div>
                  </div>
              )}
              <div className="space-y-4">
                  {groupedCourseEngagement.length > 0 ? (
                      groupedCourseEngagement.map(group => (
                          <div key={group.title}>
                              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><BookCopy className="h-5 w-5"/>{group.title}</h3>
                              <div className="border rounded-lg overflow-hidden">
                                  <Table>
                                      <TableHeader><TableRow><TableHead>Course</TableHead><TableHead className="text-center">Enrollments</TableHead><TableHead className="text-center">Completions</TableHead><TableHead className="text-center">Likes</TableHead><TableHead className="text-center">Comments</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {group.courses.map(item => (<TableRow key={item.courseId}><TableCell className="font-medium">{item.courseTitle}</TableCell><TableCell className="text-center">{item.enrollments}</TableCell><TableCell className="text-center">{item.completions}</TableCell><TableCell className="text-center">{item.likes}</TableCell><TableCell className="text-center">{item.comments}</TableCell></TableRow>))}
                                      </TableBody>
                                  </Table>
                              </div>
                          </div>
                      ))
                  ) : <p className="text-center p-8 text-muted-foreground">No course engagement data available.</p>}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Quiz Performance Summary</CardTitle>
          <CardDescription>A summary of attempts and pass/fail rates for each quiz.</CardDescription>
        </CardHeader>
        <CardContent>
          {quizPerformanceSummary === null ? <ClickToLoad onFetch={fetchQuizPerformance} title="Quiz Performance" /> : loading ? <Skeleton className="h-48 w-full" /> : (
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader><TableRow><TableHead>Quiz Title</TableHead><TableHead className="text-center">Total Attempts</TableHead><TableHead className="text-center">Passes</TableHead><TableHead className="text-center">Fails</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {currentQuizPerformanceData.length > 0 ? (
                            currentQuizPerformanceData.map(item => (<TableRow key={item.quizId}><TableCell className="font-medium">{item.quizTitle}</TableCell><TableCell className="text-center">{item.totalAttempts}</TableCell><TableCell className="text-center text-green-600">{item.passCount}</TableCell><TableCell className="text-center text-red-600">{item.failCount}</TableCell></TableRow>))
                        ) : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground p-8">No quiz attempts recorded yet.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
        {quizPerformanceSummary && quizPerformanceTotalPages > 1 && (
            <CardFooter className="flex justify-end items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>Rows per page</span><Select value={`${quizPerformancePageSize}`} onValueChange={(value) => { setQuizPerformancePageSize(Number(value)); setQuizPerformancePage(1); }}><SelectTrigger className="w-[70px]"><SelectValue placeholder={`${quizPerformancePageSize}`} /></SelectTrigger><SelectContent>{[10, 25, 50].map(size => (<SelectItem key={size} value={`${size}`}>{size}</SelectItem>))}</SelectContent></Select></div>
                <span className="text-sm text-muted-foreground">Page {quizPerformancePage} of {quizPerformanceTotalPages}</span>
                <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setQuizPerformancePage(prev => Math.max(prev - 1, 1))} disabled={quizPerformancePage === 1}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" onClick={() => setQuizPerformancePage(prev => Math.min(prev + 1, quizPerformanceTotalPages))} disabled={quizPerformancePage === quizPerformanceTotalPages}>Next<ChevronRight className="h-4 w-4" /></Button></div>
            </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Report</CardTitle>
          <CardDescription>User progress and time spent on courses.</CardDescription>
        </CardHeader>
        <CardContent>
          {userProgressData === null ? <ClickToLoad onFetch={fetchProgressData} title="Detailed Report" /> : loading ? <Skeleton className="h-64 w-full" /> : (
            <>
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 flex-wrap">
                <Select value={selectedUser} onValueChange={setSelectedUser}><SelectTrigger className="w-full sm:w-auto flex-grow"><SelectValue placeholder="Select User" /></SelectTrigger><SelectContent><SelectItem value="all">All Users</SelectItem>{allUsers.map((user) => (<SelectItem key={user.id} value={user.id}>{user.displayName}</SelectItem>))}</SelectContent></Select>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}><SelectTrigger className="w-full sm:w-auto flex-grow"><SelectValue placeholder="Select Course or Learning Path" /></SelectTrigger><SelectContent><SelectGroup><SelectLabel>Learning Paths</SelectLabel>{allCourseGroups.map((group) => (<SelectItem key={group.id} value={`group_${group.id}`}>{group.title}</SelectItem>))}</SelectGroup><SelectGroup><SelectLabel>Courses</SelectLabel>{allCourses.map((course) => (<SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>))}</SelectGroup></SelectContent></Select>
                <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={!canViewAllCampuses}><SelectTrigger className="w-full sm:w-auto flex-grow"><SelectValue placeholder="Select Campus" /></SelectTrigger><SelectContent><SelectItem value="all">All Campuses</SelectItem>{campusesWithProgress.map((campus) => (<SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>))}</SelectContent></Select>
                <Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent></Popover>
                {dateRange && <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}><XIcon className="h-4 w-4" /></Button>}
                <Button onClick={handleExportCSV} variant="outline" disabled={!sortedAndFilteredProgress || sortedAndFilteredProgress.length === 0} className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" />Export as CSV</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead><Button variant="ghost" onClick={() => handleSort('user')}>User<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead><TableHead><Button variant="ghost" onClick={() => handleSort('course')}>Course<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead><TableHead>Progress</TableHead><TableHead>Videos Watched</TableHead><TableHead><Button variant="ghost" onClick={() => handleSort('startDate')}>Start Date<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead><TableHead><Button variant="ghost" onClick={() => handleSort('completionDate')}>Completion Date<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead><TableHead>Time Spent</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader>
                  <TableBody>
                      {currentDetailedReportData.map((progress) => {
                        const user = allUsers.find(u => u.id === progress.userId);
                        const course = allCourses.find(c => c.id === progress.courseId);
                        const totalTimeSpent = (progress.videoProgress || []).reduce((acc, vp) => acc + vp.timeSpent, 0);
                        if (!user || !course) return null;
                        if (totalTimeSpent === 0 && !progress.videoProgress?.some(vp => vp.completed)) return null;
                        const startDate = progress.enrollment?.enrolledAt?.toDate ? format(progress.enrollment.enrolledAt.toDate(), 'yyyy-MM-dd') : 'N/A';
                        const completionDate = progress.enrollment?.completedAt?.toDate ? format(progress.enrollment.completedAt.toDate(), 'yyyy-MM-dd') : 'N/A';
                        const publishedVideoIdsInCourse = new Set((course?.videos || []).filter(vid => allVideos.some(v => v.id === vid && v.status === 'published')));
                        const totalVideos = publishedVideoIdsInCourse.size;
                        const completedVideos = (progress.videoProgress || []).filter(vp => vp.completed && publishedVideoIdsInCourse.has(vp.videoId)).length;
                        return (<TableRow key={`${progress.userId}-${progress.courseId}`}><TableCell>({user.campus || 'N/A'}) {user.displayName}</TableCell><TableCell>{course.title}</TableCell><TableCell>{progress.totalProgress}%</TableCell><TableCell>{`${completedVideos} / ${totalVideos}`}</TableCell><TableCell>{startDate}</TableCell><TableCell>{completionDate}</TableCell><TableCell>{formatDuration(totalTimeSpent)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setSelectedProgressDetail({ progress, user, course })}><Eye className="h-4 w-4" /></Button></TableCell></TableRow>);
                      })}
                  </TableBody>
                </Table>
              </div>
              {(!sortedAndFilteredProgress || sortedAndFilteredProgress.length === 0) && <p className="text-center p-8 text-muted-foreground">No data available for the selected filters.</p>}
            </>
          )}
        </CardContent>
        {userProgressData && detailedReportTotalPages > 1 && (
          <CardFooter className="flex justify-end items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>Rows per page</span><Select value={`${detailedReportPageSize}`} onValueChange={(value) => { setDetailedReportPageSize(Number(value)); setDetailedReportPage(1);}}><SelectTrigger className="w-[70px]"><SelectValue placeholder={`${detailedReportPageSize}`} /></SelectTrigger><SelectContent>{[10, 25, 50, 100].map(size => (<SelectItem key={size} value={`${size}`}>{size}</SelectItem>))}</SelectContent></Select></div>
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
                <TableHeader><TableRow><TableHead>Video Title</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Time Spent</TableHead></TableRow></TableHeader>
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
