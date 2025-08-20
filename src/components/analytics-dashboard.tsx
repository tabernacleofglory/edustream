
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
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { collection, getDocs, query, where, getCountFromServer, documentId } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { User, Course, UserProgress as UserProgressType, Video, Enrollment, Post } from "@/lib/types";
import { Skeleton } from "./ui/skeleton";
import { Eye, Download, ArrowUpDown, MessageSquare, ThumbsUp, Share2, ChevronLeft, ChevronRight, Repeat2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Papa from 'papaparse';

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
    comments: number;
    reposts: number;
}

type SortKey = 'user' | 'course';
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
  const [userProgressData, setUserProgressData] = useState<UserProgressType[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [socialData, setSocialData] = useState<SocialInteractionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [selectedProgressDetail, setSelectedProgressDetail] = useState<ProgressDetail | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [socialDataPage, setSocialDataPage] = useState(1);
  const [socialDataPageSize, setSocialDataPageSize] = useState(10);
  const [detailedReportPage, setDetailedReportPage] = useState(1);
  const [detailedReportPageSize, setDetailedReportPageSize] = useState(10);
  const db = getFirebaseFirestore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchAllStaticData = useCallback(async () => {
    setLoading(true);
    try {
        const usersCollection = collection(db, 'users');
        const coursesCollection = query(collection(db, 'courses'), where('status', '==', 'published'));
        const videosCollection = query(collection(db, 'Contents'), where("Type", "==", "video"));
        const campusesCollection = collection(db, 'Campus');
        const communityPostsCollection = collection(db, 'communityPosts');

        // Fetch all static data in parallel
        const [usersSnapshot, coursesSnapshot, videosSnapshot, campusesSnapshot, communityPostsSnapshot] = await Promise.all([
            getDocs(usersCollection),
            getDocs(coursesCollection),
            getDocs(videosCollection),
            getDocs(campusesCollection),
            getDocs(communityPostsCollection),
        ]);
        
        const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        const coursesList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        const videosList = videosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
        const campusesList = campusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus));
        const postsList = communityPostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));

        setAllUsers(usersList);
        setAllCourses(coursesList);
        setAllVideos(videosList);
        setAllCampuses(campusesList);

        // Process social data
        const socialInteractionData = postsList.map(post => ({
            postId: post.id,
            postContent: post.content,
            authorName: post.authorName,
            likes: post.likeCount || 0,
            shares: post.shareCount || 0,
            reposts: post.repostCount || 0,
            comments: 0, // This will be updated if we add comment counts later
        }));
        setSocialData(socialInteractionData);
        
        return { usersList, coursesList, videosList, campusesList };
    } catch (error) {
        console.error("Failed to fetch static analytics data:", error);
        return { usersList: [], coursesList: [], videosList: [], campusesList: [] };
    } finally {
      setLoading(false);
    }
  }, [db]);
  
  const fetchProgressData = useCallback(async () => {
      try {
        let progressQuery = query(collection(db, 'userVideoProgress'));
        // Apply filters if not "all"
        if (selectedUser !== 'all') {
            progressQuery = query(progressQuery, where('userId', '==', selectedUser));
        }
        if (selectedCourse !== 'all') {
            progressQuery = query(progressQuery, where('courseId', '==', selectedCourse));
        }
        const progressSnapshot = await getDocs(progressQuery);
        let progressList = progressSnapshot.docs.map(doc => {
             const data = doc.data() as Omit<UserProgressType, 'totalProgress'>;
             const course = allCourses.find(c => c.id === data.courseId);
             const totalVideos = course?.videos?.length || 0;
             const completedCount = data.videoProgress?.filter(vp => vp.completed).length || 0;
             const totalProgress = totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;
             return { ...data, totalProgress };
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
  }, [db, selectedUser, selectedCourse, selectedCampus, allUsers, allCourses, allCampuses]);

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
    const filtered = [...userProgressData];

    if (sortConfig !== null) {
        filtered.sort((a, b) => {
            const userA = allUsers.find(u => u.id === a.userId);
            const userB = allUsers.find(u => u.id === b.userId);
            const courseA = allCourses.find(c => c.id === a.courseId);
            const courseB = allCourses.find(c => c.id === b.courseId);

            let valA: string | undefined;
            let valB: string | undefined;

            if (sortConfig.key === 'user') {
                valA = userA?.displayName;
                valB = userB?.displayName;
            } else if (sortConfig.key === 'course') {
                valA = courseA?.title;
                valB = courseB?.title;
            }

            if (valA && valB) {
                if (valA < valB) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
            }
            return 0;
        });
    }

    return filtered;
}, [userProgressData, sortConfig, allUsers, allCourses]);

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
              return { campus: campus["Campus Name"], averageProgress: 0 };
          }
          
          const totalProgressSum = progressForCampus.reduce((acc, p) => acc + p.totalProgress, 0);
          const averageProgress = Math.round(totalProgressSum / progressForCampus.length);
          
          return { campus: campus["Campus Name"], averageProgress };
      }).filter(d => d.averageProgress > 0);
      return data;
  }, [allCampuses, allUsers, userProgressData]);
  
  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExportCSV = () => {
    if (sortedAndFilteredProgress.length === 0) return;

    const headers = ["User", "Campus", "Course", "Video Title", "Status", "Time Spent"];
    const rows: (string | number)[][] = [headers];

    sortedAndFilteredProgress.forEach(progress => {
        const user = allUsers.find(u => u.id === progress.userId);
        const course = allCourses.find(c => c.id === progress.courseId);

        if (!user || !course || !course.videos) return;

        (progress.videoProgress || []).forEach(videoProgress => {
            if (videoProgress.timeSpent > 0 || videoProgress.completed) {
                 const video = allVideos.find(v => v.id === videoProgress.videoId);
                 const row = [
                    `"${user.displayName}"`,
                    `"${user.campus || 'N/A'}"`,
                    `"${course.title}"`,
                    `"${video?.title || 'N/A'}"`,
                    videoProgress.completed ? "Completed" : "In Progress",
                    `"${formatDuration(videoProgress.timeSpent || 0)}"`
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
        const row = rowArray.join(",");
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

  const handleExportPDF = () => {
    const input = dashboardRef.current;
    if (input) {
      html2canvas(input, { scale: 2 }).then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "p",
          unit: "px",
          format: "a4",
          putOnlyUsedFonts:true,
          floatPrecision: 16
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / pdfWidth;
        const finalHeight = canvasHeight / ratio;

        if (finalHeight > pdfHeight) {
            const ratioHeight = canvasHeight / pdfHeight;
            const finalWidth = canvasWidth / ratioHeight;
            pdf.addImage(imgData, 'PNG', 0, 0, finalWidth, pdfHeight);
        } else {
           pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, finalHeight);
        }

        pdf.save(`analytics_report_${new Date().toISOString().split('T')[0]}.pdf`);
      });
    }
  };

  const socialDataTotalPages = Math.ceil(socialData.length / socialDataPageSize);
  const currentSocialData = socialData.slice(
      (socialDataPage - 1) * socialDataPageSize,
      socialDataPage * socialDataPageSize
  );

  const detailedReportTotalPages = Math.ceil(sortedAndFilteredProgress.length / detailedReportPageSize);
  const currentDetailedReportData = sortedAndFilteredProgress.slice(
      (detailedReportPage - 1) * detailedReportPageSize,
      detailedReportPage * detailedReportPageSize
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

  return (
    <div className="space-y-8" ref={dashboardRef}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
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
                            <SelectItem key={user.id} value={user.id}>
                            {user.displayName}
                            </SelectItem>
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
                            <SelectItem key={campus.id} value={campus.id}>
                                {campus["Campus Name"]}
                            </SelectItem>
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
        <Card>
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
       <Card>
            <CardHeader>
                <CardTitle>Social Engagement Report</CardTitle>
                <CardDescription>Likes, shares, and comments for each community post.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Post</TableHead>
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
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
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
                                        <TableCell className="max-w-xs truncate" title={item.postContent}>{item.postContent}</TableCell>
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
                  <SelectItem key={user.id} value={user.id}>
                    {user.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {allCourses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
             <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                <SelectTrigger className="w-full sm:w-auto flex-grow">
                    <SelectValue placeholder="Select Campus" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Campuses</SelectItem>
                    {campusesWithProgress.map((campus) => (
                    <SelectItem key={campus.id} value={campus.id}>
                        {campus["Campus Name"]}
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>
             <Button onClick={handleExportCSV} variant="outline" disabled={sortedAndFilteredProgress.length === 0} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export as CSV
            </Button>
             <Button onClick={handleExportPDF} variant="outline" disabled={loading} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export as PDF
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
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                        </TableRow>
                    ))
                ) : (
                    currentDetailedReportData.map((progress) => {
                    const user = allUsers.find(u => u.id === progress.userId);
                    const course = allCourses.find(c => c.id === progress.courseId);
                    const totalTimeSpent = (progress.videoProgress || []).reduce((acc, vp) => acc + vp.timeSpent, 0);
                    const completedVideos = (progress.videoProgress || []).filter(vp => vp.completed).length;
                    const totalVideos = course?.videos?.length || 0;

                    if (!user || !course || (totalTimeSpent === 0 && completedVideos === 0)) return null;

                    return (
                        <TableRow key={`${progress.userId}-${progress.courseId}`}>
                        <TableCell>({user.campus || 'N/A'}) {user.displayName}</TableCell>
                        <TableCell>{course.title}</TableCell>
                        <TableCell>{progress.totalProgress}%</TableCell>
                        <TableCell>{`${completedVideos} / ${totalVideos}`}</TableCell>
                        <TableCell>{formatDuration(totalTimeSpent)}</TableCell>
                        <TableCell className="text-right">
                            <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setSelectedProgressDetail({ progress, user, course })}
                            >
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
