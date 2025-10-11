
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
import { collection, getDocs, query, where, getCountFromServer, documentId, orderBy, writeBatch, doc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { User, Course, UserProgress as UserProgressType, Video, Enrollment, Post, Quiz, UserQuizResult, QuizQuestion, CourseGroup } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Download, ArrowUpDown, MessageSquare, ThumbsUp, Share2, ChevronLeft, ChevronRight, Repeat2, Calendar as CalendarIcon, X as XIcon, CheckCircle, XCircle, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";


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

interface SocialInteractionData {
    postId: string;
    postContent: string;
    authorName: string;
    likes: number;
    shares: number;
    reposts: number;
    comments: number;
}

interface CourseEngagementData {
    courseId: string;
    courseTitle: string;
    enrollments: number;
    likes: number;
    comments: number;
}

interface QuizReportData {
    resultId: string;
    userId: string;
    userName: string;
    courseId: string;
    courseTitle: string;
    quizId: string;
    quizTitle: string;
    score: number;
    passed: boolean;
    attemptedAt: Date;
    answers: Record<string, any>;
    quizData?: Quiz;
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


export default function AnalyticsDashboard() {
  const [selectedUser, setSelectedUser] = useState<string | "all">("all");
  const [selectedCourse, setSelectedCourse] = useState<string | "all">("all");
  const [selectedCampus, setSelectedCampus] = useState<string | "all">("all");
  const [userProgressData, setUserProgressData] = useState<(UserProgressType & { enrollment?: Enrollment })[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allCourseGroups, setAllCourseGroups] = useState<CourseGroup[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [socialData, setSocialData] = useState<SocialInteractionData[]>([]);
  const [courseEngagementData, setCourseEngagementData] = useState<CourseEngagementData[]>([]);
  const [quizReportData, setQuizReportData] = useState<QuizReportData[]>([]);
  const [userRoleData, setUserRoleData] = useState<{ name: string; users: number }[]>([]);
  const [hpRequestData, setHpRequestData] = useState<{ day: string; requests: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [selectedProgressDetail, setSelectedProgressDetail] = useState<ProgressDetail | null>(null);
  const [viewingQuizResult, setViewingQuizResult] = useState<QuizReportData | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const courseEngagementRef = useRef<HTMLDivElement>(null);
  const quizReportRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState < {
    key: SortKey;
    direction: SortDirection
  } | null > (null);
  const [dateRange, setDateRange] = useState < DateRange | undefined > ();

  const [courseEngagementPage, setCourseEngagementPage] = useState(1);
  const [courseEngagementPageSize, setCourseEngagementPageSize] = useState(10);
  const [socialDataPage, setSocialDataPage] = useState(1);
  const [socialDataPageSize, setSocialDataPageSize] = useState(10);
  const [quizReportPage, setQuizReportPage] = useState(1);
  const [quizReportPageSize, setQuizReportPageSize] = useState(10);
  const [detailedReportPage, setDetailedReportPage] = useState(1);
  const [detailedReportPageSize, setDetailedReportPageSize] = useState(10);
  const [selectedQuizResults, setSelectedQuizResults] = useState<string[]>([]);
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchAllStaticData = useCallback(async () => {
    setLoading(true);
    try {
      const usersCollection = collection(db, 'users');
      const coursesCollection = query(collection(db, 'courses'), where('status', '==', 'published'));
      const courseGroupsCollection = collection(db, 'courseGroups');
      const videosCollection = query(collection(db, 'Contents'), where("Type", "in", ["video", "youtube", "googledrive"]));
      const quizzesCollection = collection(db, 'quizzes');
      const quizResultsCollection = query(collection(db, 'userQuizResults'), orderBy('attemptedAt', 'desc'));
      const campusesCollection = collection(db, 'Campus');
      const communityPostsCollection = collection(db, 'communityPosts');

      const [usersSnapshot, coursesSnapshot, courseGroupsSnapshot, videosSnapshot, quizzesSnapshot, quizResultsSnapshot, campusesSnapshot, communityPostsSnapshot] = await Promise.all([
        getDocs(usersCollection),
        getDocs(coursesCollection),
        getDocs(courseGroupsCollection),
        getDocs(videosCollection),
        getDocs(quizzesCollection),
        getDocs(quizResultsCollection),
        getDocs(campusesCollection),
        getDocs(communityPostsCollection),
      ]);

      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
      const coursesList = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Course));
       const courseGroupsList = courseGroupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CourseGroup));
      const videosList = videosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Video));
      const quizzesList = quizzesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Quiz));
      const quizResultsList = quizResultsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserQuizResult));
      const campusesList = campusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Campus));
      const postsList = communityPostsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Post));

      setAllUsers(usersList);
      setAllCourses(coursesList);
      setAllCourseGroups(courseGroupsList);
      setAllVideos(videosList);
      setAllQuizzes(quizzesList);
      setAllCampuses(campusesList);

      const rolesCount = usersList.reduce((acc, user) => {
        const role = user.role || 'user';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });
      
      const roleData = Object.entries(rolesCount).map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        users: count,
      }));
      setUserRoleData(roleData);

      const hpRequestingUsers = usersList.filter(u => 
        (u.isInHpGroup === false || u.isInHpGroup === undefined || u.isInHpGroup === null) && u.hpAvailabilityDay
      );
      const hpRequestsByDay = hpRequestingUsers.reduce((acc, user) => {
        const day = user.hpAvailabilityDay!; // We've already filtered for this
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });
      
      const hpChartData = Object.entries(hpRequestsByDay).map(([day, count]) => ({ day, requests: count }));
      setHpRequestData(hpChartData);


      const quizReport = quizResultsList.map(result => {
        const user = usersList.find(u => u.id === result.userId);
        const course = coursesList.find(c => c.id === result.courseId);
        const quiz = quizzesList.find(q => q.id === result.quizId);
        return {
          resultId: result.id,
          userId: result.userId,
          userName: user?.displayName || 'Unknown User',
          courseId: result.courseId,
          courseTitle: course?.title || 'Unknown Course',
          quizId: result.quizId,
          quizTitle: quiz?.title || 'Unknown Quiz',
          score: result.score,
          passed: result.passed,
          attemptedAt: result.attemptedAt.toDate(),
          answers: result.answers,
          quizData: quiz
        };
      });
      setQuizReportData(quizReport as QuizReportData[]);

      const socialDataPromises = postsList.map(async (post) => {
        const repliesQuery = query(collection(db, 'communityPosts', post.id, 'replies'));
        const repliesSnapshot = await getCountFromServer(repliesQuery);
        return {
          postId: post.id,
          postContent: post.content,
          authorName: post.authorName,
          likes: post.likeCount || 0,
          shares: post.shareCount || 0,
          reposts: post.repostCount || 0,
          comments: repliesSnapshot.data().count,
        };
      });
      const socialInteractionData = await Promise.all(socialDataPromises);
      setSocialData(socialInteractionData);

      const courseEngagement = coursesList.map(course => {
        const videosInCourse = videosList.filter(video => course.videos?.includes(video.id));
        const totalLikes = videosInCourse.reduce((sum, video) => sum + (video.likeCount || 0), 0);
        const totalComments = videosInCourse.reduce((sum, video) => sum + (video.commentCount || 0), 0);

        return {
          courseId: course.id,
          courseTitle: course.title,
          enrollments: course.enrollmentCount || 0,
          likes: totalLikes,
          comments: totalComments,
        };
      });
      setCourseEngagementData(courseEngagement);

      return {
        usersList,
        coursesList,
        videosList,
        campusesList
      };
    } catch (error) {
      console.error("Failed to fetch static analytics data:", error);
      return {
        usersList: [],
        coursesList: [],
        videosList: [],
        campusesList: []
      };
    } finally {
      setLoading(false);
    }
  }, [db]);

  const fetchProgressData = useCallback(async () => {
    try {
      let progressQuery = query(collection(db, 'userVideoProgress'));
      if (selectedUser !== 'all') {
        progressQuery = query(progressQuery, where('userId', '==', selectedUser));
      }
      
      const courseIdsToFilter = new Set<string>();
      if (selectedCourse.startsWith('group_')) {
        const groupId = selectedCourse.replace('group_', '');
        const group = allCourseGroups.find(g => g.id === groupId);
        group?.courseIds.forEach(id => courseIdsToFilter.add(id));
      } else if (selectedCourse !== 'all') {
        courseIdsToFilter.add(selectedCourse);
      }

      if (courseIdsToFilter.size > 0) {
        progressQuery = query(progressQuery, where('courseId', 'in', Array.from(courseIdsToFilter)));
      }

      const progressSnapshot = await getDocs(progressQuery);

      const enrollmentQuery = query(collection(db, 'enrollments'));
      const enrollmentSnapshot = await getDocs(enrollmentQuery);
      const enrollmentsMap = new Map(enrollmentSnapshot.docs.map(doc => [`${doc.data().userId}_${doc.data().courseId}`, doc.data() as Enrollment]));

      let progressList = progressSnapshot.docs.map(doc => {
        const data = doc.data() as Omit < UserProgressType, 'totalProgress' > ;
        const course = allCourses.find(c => c.id === data.courseId);

        const publishedVideoIdsInCourse = new Set((course?.videos || []).filter(vid => allVideos.some(v => v.id === vid && v.status === 'published')));
        const totalVideos = publishedVideoIdsInCourse.size;

        const completedCount = data.videoProgress?.filter(vp => vp.completed && publishedVideoIdsInCourse.has(vp.videoId)).length || 0;
        const totalProgress = totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;

        const enrollment = enrollmentsMap.get(`${data.userId}_${data.courseId}`);

        return {
          ...data,
          totalProgress,
          enrollment
        };
      });

      if (selectedCampus !== 'all') {
        const campus = allCampuses.find(c => c.id === selectedCampus);
        if (campus) {
          const userIdsInCampus = new Set(allUsers.filter(u => u.campus === campus["Campus Name"]).map(u => u.id));
          progressList = progressList.filter(p => userIdsInCampus.has(p.userId));
        }
      }
      setUserProgressData(progressList);
    } catch (error) {
      console.error("Error fetching progress data:", error);
      setUserProgressData([]);
    }
  }, [db, selectedUser, selectedCourse, selectedCampus, allUsers, allCourses, allCampuses, allVideos, allCourseGroups]);

  useEffect(() => {
    fetchAllStaticData();
  }, [fetchAllStaticData]);

  useEffect(() => {
    if (!loading) {
      fetchProgressData();
    }
  }, [loading, selectedUser, selectedCourse, selectedCampus, fetchProgressData]);


  const campusesWithProgress = useMemo(() => {
    const userIdsWithProgress = new Set(userProgressData.filter(p => (p.videoProgress || []).some(vp => vp.timeSpent > 0 || vp.completed)).map(p => p.userId));
    const relevantUsers = allUsers.filter(u => userIdsWithProgress.has(u.id));
    const campusNames = new Set(relevantUsers.map(u => u.campus).filter(Boolean));
    return allCampuses.filter(c => campusNames.has(c["Campus Name"]));
  }, [userProgressData, allUsers, allCampuses]);

  const sortedAndFilteredProgress = useMemo(() => {
    let filtered = [...userProgressData];

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

        let valA,
          valB;

        switch (sortConfig.key) {
          case 'user':
            valA = userA?.displayName;
            valB = userB?.displayName;
            break;
          case 'course':
            valA = courseA?.title;
            valB = courseB?.title;
            break;
          case 'startDate':
            valA = a.enrollment?.enrolledAt?.seconds || 0;
            valB = b.enrollment?.enrolledAt?.seconds || 0;
            break;
          case 'completionDate':
            valA = a.enrollment?.completedAt?.seconds || 0;
            valB = b.enrollment?.completedAt?.seconds || 0;
            break;
          default:
            valA = '';
            valB = '';
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
  }, [userProgressData, sortConfig, allUsers, allCourses, dateRange]);

  const engagementChartData = useMemo(() => {
    return allCourses.map(course => {
      const timeSpent = sortedAndFilteredProgress
        .filter(p => p.courseId === course.id)
        .reduce((total, p) => total + (p.videoProgress || []).reduce((sum, vp) => sum + vp.timeSpent, 0), 0);
      return {
        course: course.title,
        timeSpent: Math.round(timeSpent / 60) // in minutes
      };
    }).filter(d => d.timeSpent > 0);
  }, [allCourses, sortedAndFilteredProgress]);

  const campusProgressChartData = useMemo(() => {
    const data = allCampuses.map(campus => {
      const campusUsers = allUsers.filter(u => u.campus === campus["Campus Name"]);
      const campusUserIds = new Set(campusUsers.map(u => u.id));
      const progressForCampus = userProgressData.filter(p => campusUserIds.has(p.userId));

      if (progressForCampus.length === 0) {
        return {
          campus: campus["Campus Name"],
          averageProgress: 0
        };
      }

      const totalProgressSum = progressForCampus.reduce((acc, p) => acc + p.totalProgress, 0);
      const averageProgress = Math.round(totalProgressSum / progressForCampus.length);

      return {
        campus: campus["Campus Name"],
        averageProgress
      };
    }).filter(d => d.averageProgress > 0);
    return data;
  }, [allCampuses, allUsers, userProgressData]);
  
  const totalHpRequests = useMemo(() => hpRequestData.reduce((sum, item) => sum + item.requests, 0), [hpRequestData]);


  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({
      key,
      direction
    });
  };

  const handleExportCSV = () => {
    if (sortedAndFilteredProgress.length === 0) return;

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

          const row = [
            `"${user.displayName}"`,
            `"${user.campus || 'N/A'}"`,
            `"${course.title}"`,
            `"${video?.title || 'N/A'}"`,
            videoProgress.completed ? "Completed" : "In Progress",
            `"${formatDuration(videoProgress.timeSpent || 0)}"`,
            `"${startDate}"`,
            `"${completionDate}"`
          ];
          rows.push(row);
        }
      });
    });

    if (rows.length <= 1) {
      alert("No data with progress to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    rows.forEach(rowArray => {
      let row = rowArray.join(",");
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `video_progress_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleExportPDF = (ref: React.RefObject < HTMLDivElement > , filename: string) => {
    // This function is currently not implemented due to complexity with html2canvas.
    toast({ variant: 'destructive', title: 'Export to PDF is currently unavailable.' });
  };

  const handleExportCourseEngagementCSV = () => {
    const dataToExport = courseEngagementData.map(item => ({
      "Course": item.courseTitle,
      "Enrollments": item.enrollments,
      "Likes": item.likes,
      "Comments": item.comments,
    }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "course_engagement_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const courseEngagementTotalPages = Math.ceil(courseEngagementData.length / courseEngagementPageSize);
  const currentCourseEngagementData = courseEngagementData.slice(
    (courseEngagementPage - 1) * courseEngagementPageSize,
    courseEngagementPage * courseEngagementPageSize
  );

  const socialDataTotalPages = Math.ceil(socialData.length / socialDataPageSize);
  const currentSocialData = socialData.slice(
    (socialDataPage - 1) * socialDataPageSize,
    socialDataPage * socialDataPageSize
  );

  const filteredQuizReportData = useMemo(() => {
    let filtered = [...quizReportData];

    if (selectedUser !== 'all') {
      filtered = filtered.filter(r => r.userId === selectedUser);
    }
    
    // Updated logic to handle course groups
    if (selectedCourse !== 'all') {
        if (selectedCourse.startsWith('group_')) {
            const groupId = selectedCourse.replace('group_', '');
            const group = allCourseGroups.find(g => g.id === groupId);
            const courseIdsInGroup = new Set(group?.courseIds || []);
            filtered = filtered.filter(r => courseIdsInGroup.has(r.courseId));
        } else {
            filtered = filtered.filter(r => r.courseId === selectedCourse);
        }
    }
    
    if (selectedCampus !== 'all') {
      const campus = allCampuses.find(c => c.id === selectedCampus);
      if (campus) {
        const userIdsInCampus = new Set(allUsers.filter(u => u.campus === campus["Campus Name"]).map(u => u.id));
        filtered = filtered.filter(r => userIdsInCampus.has(r.userId));
      }
    }
    if (dateRange?.from) {
      filtered = filtered.filter(r => r.attemptedAt >= startOfDay(dateRange.from!));
    }
    if (dateRange?.to) {
      filtered = filtered.filter(r => r.attemptedAt <= endOfDay(dateRange.to!));
    }

    return filtered;
  }, [quizReportData, selectedUser, selectedCourse, allCourseGroups, selectedCampus, dateRange, allUsers, allCampuses]);

  const handleExportQuizReportCSV = () => {
    const dataToExport = filteredQuizReportData.map(item => ({
      "User": item.userName,
      "Course": item.courseTitle,
      "Quiz": item.quizTitle,
      "Score": item.score,
      "Status": item.passed ? "Passed" : "Failed",
      "Date": format(item.attemptedAt, 'yyyy-MM-dd HH:mm'),
    }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "quiz_performance_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
    const handleDeleteSelectedQuizResults = async () => {
        if (selectedQuizResults.length === 0) {
            toast({ variant: 'destructive', title: 'No records selected' });
            return;
        }

        const batch = writeBatch(db);
        selectedQuizResults.forEach(resultId => {
            const docRef = doc(db, 'userQuizResults', resultId);
            batch.delete(docRef);
        });

        try {
            await batch.commit();
            toast({ title: `${selectedQuizResults.length} records deleted successfully` });
            setQuizReportData(prev => prev.filter(r => !selectedQuizResults.includes(r.resultId)));
            setSelectedQuizResults([]);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to delete records' });
        }
    };


  const quizReportTotalPages = Math.ceil(filteredQuizReportData.length / quizReportPageSize);
  const currentQuizReportData = filteredQuizReportData.slice(
    (quizReportPage - 1) * quizReportPageSize,
    quizReportPage * quizReportPageSize
  );

  const detailedReportTotalPages = Math.ceil(sortedAndFilteredProgress.length / detailedReportPageSize);
  const currentDetailedReportData = sortedAndFilteredProgress.slice(
    (detailedReportPage - 1) * detailedReportPageSize,
    (detailedReportPage * detailedReportPageSize)
  );


  if (!isClient) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  
    const renderQuizResponses = (result: QuizReportData) => {
        if (!result.quizData || !result.answers) return <p>No response data available.</p>;

        return result.quizData.questions.map((q, index) => {
            const userAnswer = result.answers[`question_${q.id}`];
            let isCorrect = false;
            if (q.type === 'multiple-choice') {
                isCorrect = Number(userAnswer) === q.correctAnswerIndex;
            } else if (q.type === 'multiple-select') {
                const correct = new Set(q.correctAnswerIndexes);
                const answered = new Set(userAnswer);
                isCorrect = correct.size === answered.size && [...correct].every(idx => answered.has(idx));
            } else if (q.type === 'free-text') {
                isCorrect = true; // Manually graded
            }

            return (
                <div key={q.id} className="mb-4 p-3 border rounded-md">
                    <p className="font-semibold">{index + 1}. {q.questionText}</p>
                    {q.type === 'multiple-choice' && (
                        <RadioGroup value={String(userAnswer)} disabled className="mt-2 space-y-1">
                            {q.options.map((opt, i) => (
                                <div key={i} className={cn("flex items-center space-x-2 p-2 rounded-md", 
                                    i === q.correctAnswerIndex && "bg-green-100 dark:bg-green-900",
                                    i === Number(userAnswer) && i !== q.correctAnswerIndex && "bg-red-100 dark:bg-red-900"
                                )}>
                                    <RadioGroupItem value={String(i)} id={`${q.id}-${i}`} />
                                    <Label htmlFor={`${q.id}-${i}`}>{opt}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    )}
                     {q.type === 'multiple-select' && (
                        <div className="mt-2 space-y-1">
                            {q.options.map((opt, i) => (
                                 <div key={i} className={cn("flex items-center space-x-2 p-2 rounded-md", 
                                    q.correctAnswerIndexes?.includes(i) && "bg-green-100 dark:bg-green-900",
                                    userAnswer?.includes(i) && !q.correctAnswerIndexes?.includes(i) && "bg-red-100 dark:bg-red-900"
                                )}>
                                    <Checkbox checked={userAnswer?.includes(i)} disabled />
                                    <Label>{opt}</Label>
                                </div>
                            ))}
                        </div>
                    )}
                    {q.type === 'free-text' && (
                        <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                            <p className="font-semibold">User's Answer:</p>
                            <p>{userAnswer || '(No answer provided)'}</p>
                        </div>
                    )}
                </div>
            );
        });
    }

  return (
    <div className="space-y-8" ref={dashboardRef}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Course Engagement</CardTitle>
            <CardDescription>Total time spent per course in minutes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {allUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Campus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campuses</SelectItem>
                    {campusesWithProgress.map((campus) => (
                      <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ChartContainer config={engagementChartConfig} className="min-h-[200px] w-full">
                  <BarChart data={engagementChartData} height={300}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="course" tickLine={false} tickMargin={10} axisLine={false} />
                    <YAxis />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="timeSpent" fill="var(--color-timeSpent)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Campus Progress</CardTitle>
            <CardDescription>Average course completion percentage by campus.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[348px] w-full" />
            ) : (
              <ChartContainer config={progressChartConfig} className="min-h-[200px] w-full">
                <BarChart data={campusProgressChartData} height={348}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="campus" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="averageProgress" fill="var(--color-averageProgress)" radius={4} />
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
            {loading ? (
              <Skeleton className="h-[348px] w-full" />
            ) : (
              <ChartContainer config={userRoleChartConfig} className="min-h-[200px] w-full">
                <BarChart data={userRoleData} height={348}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis />
                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                    <Bar dataKey="users" fill="var(--color-users)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
         <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>HP Requests by Day</CardTitle>
            <CardDescription>A total of {totalHpRequests} pending HP placement requests by user availability.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[348px] w-full" />
            ) : (
              <ChartContainer config={hpRequestChartConfig} className="min-h-[200px] w-full">
                <BarChart data={hpRequestData} height={348}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="requests" fill="var(--color-requests)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card ref={courseEngagementRef}>
        <CardHeader className="flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Course Engagement Report</CardTitle>
            <CardDescription>Enrollments, likes, and comments for each course.</CardDescription>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button onClick={handleExportCourseEngagementCSV} variant="outline" disabled={courseEngagementData.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export as CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-center">Enrollments</TableHead>
                  <TableHead className="text-center">Likes</TableHead>
                  <TableHead className="text-center">Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  currentCourseEngagementData.map((item) => (
                    <TableRow key={item.courseId}>
                      <TableCell className="font-medium">{item.courseTitle}</TableCell>
                      <TableCell className="text-center">{item.enrollments}</TableCell>
                      <TableCell className="text-center">{item.likes}</TableCell>
                      <TableCell className="text-center">{item.comments}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {courseEngagementData.length === 0 && !loading && (
            <div className="text-center p-8 text-muted-foreground">
              No course engagement data available.
            </div>
          )}
        </CardContent>
        {courseEngagementTotalPages > 1 && (
          <CardFooter className="flex justify-end items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={`${courseEngagementPageSize}`}
                onValueChange={(value) => {
                  setCourseEngagementPageSize(Number(value));
                  setCourseEngagementPage(1);
                }}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={`${courseEngagementPageSize}`} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map(size => (
                    <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              Page {courseEngagementPage} of {courseEngagementTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCourseEngagementPage(prev => Math.max(prev - 1, 1))}
                disabled={courseEngagementPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCourseEngagementPage(prev => Math.min(prev + 1, courseEngagementTotalPages))}
                disabled={courseEngagementPage === courseEngagementTotalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <Card ref={quizReportRef}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Quiz Performance Report</CardTitle>
              <CardDescription>User scores and pass / fail status for all quiz attempts.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
               {selectedQuizResults.length > 0 && (
                <Button variant="destructive" onClick={handleDeleteSelectedQuizResults}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected ({selectedQuizResults.length})
                </Button>
              )}
              <Button onClick={handleExportQuizReportCSV} variant="outline" disabled={filteredQuizReportData.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 flex-wrap">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {allUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select Course or Learning Path" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses &amp; Paths</SelectItem>
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
            <Select value={selectedCampus} onValueChange={setSelectedCampus}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select Campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campuses</SelectItem>
                {campusesWithProgress.map((campus) => (
                  <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date-quiz" variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
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
                   <TableHead className="w-[50px]">
                    <Checkbox
                        checked={selectedQuizResults.length > 0 && selectedQuizResults.length === currentQuizReportData.length}
                        onCheckedChange={(checked) => {
                            if (checked) {
                                setSelectedQuizResults(currentQuizReportData.map(r => r.resultId));
                            } else {
                                setSelectedQuizResults([]);
                            }
                        }}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Quiz</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                       <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  currentQuizReportData.map((item) => (
                    <TableRow key={item.resultId} data-state={selectedQuizResults.includes(item.resultId) && "selected"}>
                      <TableCell>
                        <Checkbox
                            checked={selectedQuizResults.includes(item.resultId)}
                            onCheckedChange={(checked) => {
                                if (checked) {
                                    setSelectedQuizResults([...selectedQuizResults, item.resultId]);
                                } else {
                                    setSelectedQuizResults(selectedQuizResults.filter(id => id !== item.resultId));
                                }
                            }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.userName}</TableCell>
                      <TableCell>{item.courseTitle}</TableCell>
                      <TableCell>{item.quizTitle}</TableCell>
                      <TableCell className="text-center font-semibold">{item.score.toFixed(0)}%</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.passed ? "default" : "destructive"} className="gap-1">
                          {item.passed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {item.passed ? 'Passed' : 'Failed'}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(item.attemptedAt, 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setViewingQuizResult(item)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {quizReportData.length === 0 && !loading && (
            <div className="text-center p-8 text-muted-foreground">
              No quiz attempts have been recorded yet.
            </div>
          )}
        </CardContent>
        {quizReportTotalPages > 1 && (
          <CardFooter className="flex justify-end items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={`${quizReportPageSize}`}
                onValueChange={(value) => {
                  setQuizReportPageSize(Number(value));
                  setQuizReportPage(1);
                }}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={`${quizReportPageSize}`} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map(size => (
                    <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              Page {quizReportPage} of {quizReportTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuizReportPage(prev => Math.max(prev - 1, 1))}
                disabled={quizReportPage === 1}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuizReportPage(prev => Math.min(prev + 1, quizReportTotalPages))}
                disabled={quizReportPage === quizReportTotalPages}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
      
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <CardTitle>Social Engagement Report</CardTitle>
                    <CardDescription>Likes, shares, and comments for each community post.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Author</TableHead>
                  <TableHead className="text-center">Likes</TableHead>
                  <TableHead className="text-center">Comments</TableHead>
                  <TableHead className="text-center">Reposts</TableHead>
                  <TableHead className="text-center">Shares</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  currentSocialData.map((item) => (
                    <TableRow key={item.postId}>
                      <TableCell>{item.authorName}</TableCell>
                      <TableCell className="text-center">{item.likes}</TableCell>
                      <TableCell className="text-center">{item.comments}</TableCell>
                      <TableCell className="text-center">{item.reposts}</TableCell>
                      <TableCell className="text-center">{item.shares}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {socialData.length === 0 && !loading && (
            <div className="text-center p-8 text-muted-foreground">
              No social interaction data available.
            </div>
          )}
        </CardContent>
        {socialDataTotalPages > 1 && (
          <CardFooter className="flex justify-end items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={`${socialDataPageSize}`}
                onValueChange={(value) => {
                  setSocialDataPageSize(Number(value));
                  setSocialDataPage(1);
                }}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={`${socialDataPageSize}`} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map(size => (
                    <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              Page {socialDataPage} of {socialDataTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSocialDataPage(prev => Math.max(prev - 1, 1))}
                disabled={socialDataPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSocialDataPage(prev => Math.min(prev + 1, socialDataTotalPages))}
                disabled={socialDataPage === socialDataTotalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Report</CardTitle>
          <CardDescription>
            User progress and time spent on courses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 flex-wrap">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {allUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select Course or Learning Path" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses &amp; Paths</SelectItem>
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
            <Select value={selectedCampus} onValueChange={setSelectedCampus}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select Campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campuses</SelectItem>
                {campusesWithProgress.map((campus) => (
                  <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
            {dateRange && <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}><XIcon className="h-4 w-4" /></Button>}
            <Button onClick={handleExportCSV} variant="outline" disabled={sortedAndFilteredProgress.length === 0} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Export as CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('user')}>
                      User
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('course')}>
                      Course
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Videos Watched</TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('startDate')}>
                      Start Date
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('completionDate')}>
                      Completion Date
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Time Spent</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  currentDetailedReportData.map((progress) => {
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


                    return (
                      <TableRow key={`${progress.userId}-${progress.courseId}`}>
                        <TableCell>({user.campus || 'N/A'}) {user.displayName}</TableCell>
                        <TableCell>{course.title}</TableCell>
                        <TableCell>{progress.totalProgress}%</TableCell>
                        <TableCell>{`${completedVideos} / ${totalVideos}`}</TableCell>
                        <TableCell>{startDate}</TableCell>
                        <TableCell>{completionDate}</TableCell>
                        <TableCell>{formatDuration(totalTimeSpent)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedProgressDetail({ progress, user, course })}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {sortedAndFilteredProgress.length === 0 && !loading && (
            <div className="text-center p-8 text-muted-foreground">
              No data available for the selected filters.
            </div>
          )}
        </CardContent>
        {detailedReportTotalPages > 1 && (
          <CardFooter className="flex justify-end items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={`${detailedReportPageSize}`}
                onValueChange={(value) => {
                  setDetailedReportPageSize(Number(value));
                  setDetailedReportPage(1);
                }}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={`${detailedReportPageSize}`} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map(size => (
                    <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              Page {detailedReportPage} of {detailedReportTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailedReportPage(prev => Math.max(prev - 1, 1))}
                disabled={detailedReportPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailedReportPage(prev => Math.min(prev + 1, detailedReportTotalPages))}
                disabled={detailedReportPage === detailedReportTotalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
      
      <Dialog open={!!viewingQuizResult} onOpenChange={() => setViewingQuizResult(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quiz Attempt Details</DialogTitle>
             <DialogDescription>
              Viewing answers for {viewingQuizResult?.userName} in quiz "{viewingQuizResult?.quizTitle}".
            </DialogDescription>
          </DialogHeader>
          {viewingQuizResult && (
            <div className="max-h-[60vh] overflow-y-auto p-1 pr-4">
                {renderQuizResponses(viewingQuizResult)}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProgressDetail} onOpenChange={() => setSelectedProgressDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Progress Details</DialogTitle>
            <DialogDescription>
              Detailed video progress for {selectedProgressDetail?.user.displayName} in {selectedProgressDetail?.course.title}.
            </DialogDescription>
          </DialogHeader>
          {selectedProgressDetail && (
            <>
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

                      return (
                        <TableRow key={videoId}>
                          <TableCell>{video?.title || 'Unknown Video'}</TableCell>
                          <TableCell>{videoProgress?.completed ? 'Completed' : 'In Progress'}</TableCell>
                          <TableCell className="text-right">{formatDuration(videoProgress?.timeSpent || 0)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

    