"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc,
  where,
  onSnapshot,
  getDoc,
  updateDoc,
  documentId,
  writeBatch,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Search,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  UserMinus,
  RefreshCw,
  CheckCircle2,
  Circle,
  Video,
  FileQuestion,
  FileText,
  ExternalLink,
  ListFilter,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import Papa from "papaparse";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import { unenrollUserFromCourse } from "@/lib/user-actions";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { User, Course, Enrollment } from "@/lib/types";
import { cn } from "@/lib/utils";

const exportFields = [
  { id: 'firstName', label: 'First Name' },
  { id: 'lastName', label: 'Last Name' },
  { id: 'displayName', label: 'Display Name' },
  { id: 'email', label: 'Email' },
  { id: 'campus', label: 'Campus' },
  { id: 'courseTitle', label: 'Course' },
  { id: 'enrolledAt', label: 'Enrolled At' },
  { id: 'completedAt', label: 'Completed At' },
  { id: 'status', label: 'Status' },
  { id: 'phoneNumber', label: 'Phone' },
  { id: 'hpNumber', label: 'HP Number' },
  { id: 'facilitatorName', label: 'Facilitator' },
];

export default function EnrollmentsPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { hasPermission, canViewAllCampuses, user: currentUser } = useAuth();

  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [courses, setCourses] = useState<Map<string, Course>>(new Map());
  const [campuses, setCampuses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isUnenrolling, setIsUnenrolling] = useState<string | null>(null);

  // Filter states
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterCampus, setFilterCampus] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [enrolledRange, setEnrolledRange] = useState<DateRange | undefined>();
  const [completedRange, setCompletedRange] = useState<DateRange | undefined>();

  // Export states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedExportFields, setSelectedExportFields] = useState<string[]>(['displayName', 'email', 'campus', 'courseTitle', 'status']);

  // Drill-down states
  const [viewingDetail, setViewingDetail] = useState<{ userId: string; courseId: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    videos: { id: string; title: string; isCompleted: boolean }[];
    quizzes: { id: string; title: string; isCompleted: boolean }[];
    form: { id: string; title: string; isCompleted: boolean } | null;
  } | null>(null);

  const canManage = hasPermission("manageCourses");

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setLoading(true);
    
    try {
      // Campus filtering: non-admin users only see users from their campus
      let usersQuery = collection(db, "users");
      if (!canViewAllCampuses && currentUser?.campus && currentUser.campus !== 'All Campuses') {
          usersQuery = query(usersQuery, where('campus', '==', currentUser.campus));
      }

      const [enrollSnap, usersSnap, coursesSnap, campusesSnap] = await Promise.all([
        getDocs(query(collection(db, "enrollments"), orderBy("enrolledAt", "desc"))),
        getDocs(usersQuery),
        getDocs(collection(db, "courses")),
        getDocs(query(collection(db, "Campus"), orderBy("Campus Name"))),
      ]);

      const usersMap = new Map();
      usersSnap.docs.forEach((d) => usersMap.set(d.id, { id: d.id, ...d.data() }));
      setUsers(usersMap);

      const coursesMap = new Map();
      coursesSnap.docs.forEach((d) => coursesMap.set(d.id, { id: d.id, ...d.data() }));
      setCourses(coursesMap);

      setCampuses(campusesSnap.docs.map(d => ({ id: d.id, name: d.data()["Campus Name"] })));

      const enrollList = enrollSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setEnrollments(enrollList);
      
      if (manual && !syncingId) {
        toast({ title: "Data refreshed" });
      }
    } catch (error) {
      console.error("Error fetching enrollments:", error);
      toast({ variant: "destructive", title: "Failed to load enrollments" });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [db, toast, syncingId, canViewAllCampuses, currentUser]);

  useEffect(() => {
    if (canManage) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [canManage, fetchData]);

  const handleSyncEnrollment = async (userId: string, courseId: string) => {
    const enrollId = `${userId}_${courseId}`;
    setSyncingId(enrollId);
    
    try {
      const [courseSnap, progressSnap] = await Promise.all([
        getDoc(doc(db, "courses", courseId)),
        getDoc(doc(db, "userContentProgress", userId))
      ]);

      if (!courseSnap.exists()) {
        toast({ variant: "destructive", title: "Course not found" });
        return;
      }

      const courseData = courseSnap.data() as Course;
      const progressData = progressSnap.exists() ? progressSnap.data() : { completedItems: {} };
      const completedItems = progressData.completedItems || {};

      const requiredIds = [
        ...(courseData.videos || []),
        ...(courseData.quizIds || []),
        ...(courseData.formId ? [courseData.formId] : [])
      ].filter(Boolean);

      if (requiredIds.length === 0) {
        toast({ title: "Audit Complete", description: "This course has no tracked content items." });
        return;
      }

      const allCompleted = requiredIds.every(id => !!completedItems[id]);

      if (allCompleted) {
        let latestTimestamp = null;
        for (const id of requiredIds) {
          const ts = completedItems[id];
          if (!latestTimestamp || (ts && ts.toMillis() > latestTimestamp.toMillis())) {
            latestTimestamp = ts;
          }
        }

        const enrollRef = doc(db, "enrollments", enrollId);
        await updateDoc(enrollRef, {
          completedAt: latestTimestamp
        });

        toast({ title: "Sync Successful", description: "Student has completed all requirements. Enrollment updated." });
        await fetchData(false);
      } else {
        const completedCount = requiredIds.filter(id => !!completedItems[id]).length;
        toast({ 
          title: "Incomplete", 
          description: `Student has completed ${completedCount} of ${requiredIds.length} items. Status remains In Progress.` 
        });
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast({ variant: "destructive", title: "Sync Failed", description: error.message });
    } finally {
      setSyncingId(null);
    }
  };

  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      const user = users.get(e.userId);
      const course = courses.get(e.courseId);

      // Main Search
      const matchesSearch =
        searchTerm === "" ||
        (user?.displayName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user?.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course?.title || "").toLowerCase().includes(searchTerm.toLowerCase());

      // Permissions
      let matchesCampusRestriction = true;
      if (!canViewAllCampuses && currentUser?.campus) {
        matchesCampusRestriction = user?.campus === currentUser.campus;
      }

      // Explicit Filters
      const matchesUser = filterUser === "all" || e.userId === filterUser;
      const matchesCourse = filterCourse === "all" || e.courseId === filterCourse;
      const matchesCampus = filterCampus === "all" || user?.campus === campuses.find(c => c.id === filterCampus)?.name;
      
      const isCompleted = !!e.completedAt;
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "completed" && isCompleted) || 
        (filterStatus === "in-progress" && !isCompleted);

      const enrolledAt = e.enrolledAt?.toDate();
      const matchesEnrollmentDate = !enrolledAt || (
        (!enrolledRange?.from || enrolledAt >= startOfDay(enrolledRange.from)) &&
        (!enrolledRange?.to || enrolledAt <= endOfDay(enrolledRange.to))
      );

      const completedAt = e.completedAt?.toDate();
      const matchesCompletionDate = !completedAt ? (!completedRange) : (
        (!completedRange?.from || completedAt >= startOfDay(completedRange.from)) &&
        (!completedRange?.to || completedAt <= endOfDay(completedRange.to))
      );

      return matchesSearch && matchesCampusRestriction && matchesUser && matchesCourse && matchesCampus && matchesStatus && matchesEnrollmentDate && matchesCompletionDate;
    });
  }, [enrollments, users, courses, searchTerm, canViewAllCampuses, currentUser, filterUser, filterCourse, filterCampus, filterStatus, enrolledRange, completedRange, campuses]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterUser !== "all") count++;
    if (filterCourse !== "all") count++;
    if (filterCampus !== "all") count++;
    if (filterStatus !== "all") count++;
    if (enrolledRange?.from || enrolledRange?.to) count++;
    if (completedRange?.from || completedRange?.to) count++;
    return count;
  }, [filterUser, filterCourse, filterCampus, filterStatus, enrolledRange, completedRange]);

  const resetFilters = () => {
    setFilterUser("all");
    setFilterCourse("all");
    setFilterCampus("all");
    setFilterStatus("all");
    setEnrolledRange(undefined);
    setCompletedRange(undefined);
    setSearchTerm("");
  };

  const userOptions = useMemo(() => 
    Array.from(users.values()).sort((a,b) => (a.displayName || '').localeCompare(b.displayName || '')),
  [users]);

  const courseOptions = useMemo(() => 
    Array.from(courses.values()).sort((a,b) => (a.title || '').localeCompare(b.title || '')),
  [courses]);

  const handleBulkSync = async () => {
    setIsRefreshing(true);
    toast({ title: "Starting Bulk Sync", description: `Auditing ${filteredEnrollments.length} enrollments...` });

    try {
      const userIds = Array.from(new Set(filteredEnrollments.map(e => e.userId)));
      const progressMap = new Map<string, any>();

      const userIdChunks = [];
      for (let i = 0; i < userIds.length; i += 30) {
        userIdChunks.push(userIds.slice(i, i + 30));
      }

      for (const chunk of userIdChunks) {
        const snap = await getDocs(query(collection(db, "userContentProgress"), where(documentId(), "in", chunk)));
        snap.docs.forEach(d => progressMap.set(d.id, d.data()));
      }

      let batch = writeBatch(db);
      let opCount = 0;
      let updatesCount = 0;

      for (const enrollment of filteredEnrollments) {
        const course = courses.get(enrollment.courseId);
        if (!course) continue;

        const progressData = progressMap.get(enrollment.userId) || { completedItems: {} };
        const completedItems = progressData.completedItems || {};

        const requiredIds = [
          ...(course.videos || []),
          ...(course.quizIds || []),
          ...(course.formId ? [course.formId] : [])
        ].filter(Boolean);

        if (requiredIds.length === 0) continue;

        const allCompleted = requiredIds.every(id => !!completedItems[id]);

        if (allCompleted) {
          let latestTimestamp = null;
          for (const id of requiredIds) {
            const ts = completedItems[id];
            if (!latestTimestamp || (ts && ts.toMillis() > latestTimestamp.toMillis())) {
              latestTimestamp = ts;
            }
          }

          const currentCompletedAt = enrollment.completedAt;
          const getMillis = (ts: any) => {
              if (!ts) return 0;
              if (typeof ts.toMillis === 'function') return ts.toMillis();
              if (ts instanceof Date) return ts.getTime();
              return 0;
          };

          const isDifferent = getMillis(latestTimestamp) !== getMillis(currentCompletedAt);

          if (isDifferent) {
            const enrollRef = doc(db, "enrollments", enrollment.id);
            batch.update(enrollRef, { completedAt: latestTimestamp });
            updatesCount++;
            opCount++;
            
            if (opCount >= 499) {
                await batch.commit();
                batch = writeBatch(db);
                opCount = 0;
            }
          }
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }

      toast({ title: "Bulk Sync Complete", description: `Updated ${updatesCount} enrollment(s).` });
      await fetchData(false);
    } catch (error: any) {
      console.error("Bulk sync error:", error);
      toast({ variant: "destructive", title: "Bulk Sync Failed", description: error.message });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewDetail = async (userId: string, courseId: string) => {
    setViewingDetail({ userId, courseId });
    setDetailLoading(true);
    setDetailData(null);
    try {
      const [courseSnap, progressSnap] = await Promise.all([
        getDoc(doc(db, "courses", courseId)),
        getDoc(doc(db, "userContentProgress", userId))
      ]);

      if (!courseSnap.exists()) return;
      const courseData = courseSnap.data() as Course;
      const progressData = progressSnap.exists() ? progressSnap.data() : { completedItems: {} };
      const completedItems = progressData.completedItems || {};

      const videoIds = courseData.videos || [];
      let videos = [];
      if (videoIds.length > 0) {
        const vSnap = await getDocs(query(collection(db, "Contents"), where(documentId(), "in", videoIds.slice(0, 30))));
        videos = videoIds.map(id => {
          const d = vSnap.docs.find(doc => doc.id === id);
          return {
            id,
            title: d?.data()?.title || "Untitled Video",
            isCompleted: !!completedItems[id]
          };
        });
      }

      const quizIds = courseData.quizIds || [];
      let quizzes = [];
      if (quizIds.length > 0) {
        const qSnap = await getDocs(query(collection(db, "quizzes"), where(documentId(), "in", quizIds.slice(0, 30))));
        quizzes = quizIds.map(id => {
          const d = qSnap.docs.find(doc => doc.id === id);
          return {
            id,
            title: d?.data()?.title || "Untitled Quiz",
            isCompleted: !!completedItems[id]
          };
        });
      }

      let form = null;
      if (courseData.formId) {
        const fSnap = await getDoc(doc(db, "forms", courseData.formId));
        if (fSnap.exists()) {
          form = {
            id: fSnap.id,
            title: fSnap.data()?.title || "Untitled Form",
            isCompleted: !!completedItems[fSnap.id]
          };
        }
      }

      setDetailData({ videos, quizzes, form });
    } catch (e) {
      console.error("Error loading drill-down:", e);
      toast({ variant: "destructive", title: "Error loading details" });
    } finally {
      setDetailLoading(false);
    }
  };

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredEnrollments.slice(start, start + rowsPerPage);
  }, [filteredEnrollments, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredEnrollments.length / rowsPerPage);

  const handleUnenroll = async (userId: string, courseId: string) => {
    setIsUnenrolling(`${userId}_${courseId}`);
    try {
      const result = await unenrollUserFromCourse(userId, courseId);
      if (result.success) {
        toast({ title: "Success", description: result.message });
        setEnrollments((prev) => prev.filter((e) => !(e.userId === userId && e.courseId === courseId)));
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to unenroll user" });
    } finally {
      setIsUnenrolling(null);
    }
  };

  const handleExportCSV = () => {
    if (selectedExportFields.length === 0) {
      toast({ variant: "destructive", title: "No fields selected", description: "Please select at least one field to export." });
      return;
    }

    const dataToExport = filteredEnrollments.map((e) => {
      const user = users.get(e.userId);
      const course = courses.get(e.courseId);
      
      const row: any = {};
      selectedExportFields.forEach(fieldId => {
        switch (fieldId) {
          case 'firstName': row['First Name'] = user?.firstName || ''; break;
          case 'lastName': row['Last Name'] = user?.lastName || ''; break;
          case 'displayName': row['Student Name'] = user?.displayName || e.userId; break;
          case 'email': row['Email'] = user?.email || "N/A"; break;
          case 'campus': row['Campus'] = user?.campus || "N/A"; break;
          case 'courseTitle': row['Course'] = course?.title || e.courseId; break;
          case 'enrolledAt': row['Enrolled At'] = e.enrolledAt ? format(e.enrolledAt.toDate(), "yyyy-MM-dd HH:mm") : "N/A"; break;
          case 'completedAt': row['Completed At'] = e.completedAt ? format(e.completedAt.toDate(), "yyyy-MM-dd HH:mm") : "In Progress"; break;
          case 'status': row['Status'] = e.completedAt ? "Completed" : "In Progress"; break;
          case 'phoneNumber': row['Phone'] = user?.phoneNumber || ''; break;
          case 'hpNumber': row['HP Number'] = user?.hpNumber || ''; break;
          case 'facilitatorName': row['Facilitator'] = user?.facilitatorName || ''; break;
        }
      });
      return row;
    });

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `enrollments_report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    setIsExportDialogOpen(false);
  };

  if (!canManage) return <div className="p-8 text-center">Access Denied</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold md:text-4xl">
            {t("admin.enrollments.title", "Enrollment Management")}
          </h1>
          <p className="text-muted-foreground">
            {t("admin.enrollments.description", "View and manage all course enrollments.")}
            {" "}
            ({filteredEnrollments.length} matching filters)
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleBulkSync}
            disabled={isRefreshing}
            title="Refresh All"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <Button onClick={() => setIsExportDialogOpen(true)} variant="outline" disabled={loading || enrollments.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user name, email or course title..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <ListFilter className="h-4 w-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Filter Enrollments</SheetTitle>
                  <SheetDescription>Narrow down the results by specific criteria.</SheetDescription>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div className="space-y-2">
                    <Label>Student</Label>
                    <Select value={filterUser} onValueChange={setFilterUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Students" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Students</SelectItem>
                        {userOptions.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select value={filterCourse} onValueChange={setFilterCourse}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Courses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Courses</SelectItem>
                        {courseOptions.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Campus</Label>
                    <Select value={filterCampus} onValueChange={setFilterCampus} disabled={!canViewAllCampuses}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Campuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Campuses</SelectItem>
                        {campuses.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Enrollment Date Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="date" 
                        value={enrolledRange?.from ? format(enrolledRange.from, 'yyyy-MM-dd') : ''} 
                        onChange={e => setEnrolledRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined }))}
                      />
                      <Input 
                        type="date" 
                        value={enrolledRange?.to ? format(enrolledRange.to, 'yyyy-MM-dd') : ''} 
                        onChange={e => setEnrolledRange(prev => ({ ...prev, to: e.target.value ? new Date(e.target.value + 'T23:59:59') : undefined }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Completion Date Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="date" 
                        value={completedRange?.from ? format(completedRange.from, 'yyyy-MM-dd') : ''} 
                        onChange={e => setCompletedRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined }))}
                      />
                      <Input 
                        type="date" 
                        value={completedRange?.to ? format(completedRange.to, 'yyyy-MM-dd') : ''} 
                        onChange={e => setCompletedRange(prev => ({ ...prev, to: e.target.value ? new Date(e.target.value + 'T23:59:59') : undefined }))}
                      />
                    </div>
                  </div>
                </div>
                <SheetFooter className="flex-col gap-2 sm:flex-col">
                  <Button variant="outline" onClick={resetFilters} className="w-full">Reset Filters</Button>
                  <SheetClose asChild>
                    <Button className="w-full">Apply Filters</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Enrolled At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((e) => {
                    const user = users.get(e.userId);
                    const course = courses.get(e.courseId);
                    const isCompleted = !!e.completedAt;
                    const isSyncing = syncingId === e.id;

                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{user?.displayName || "Unknown"}</span>
                            <span className="text-[10px] text-muted-foreground">{user?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{course?.title || "Deleted Course"}</TableCell>
                        <TableCell className="text-xs">
                          {e.enrolledAt ? format(e.enrolledAt.toDate(), "MMM d, yyyy") : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isCompleted ? "default" : "secondary"}>
                            {isCompleted ? "Completed" : "In Progress"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="View Progress"
                              onClick={() => handleViewDetail(e.userId, e.courseId)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleSyncEnrollment(e.userId, e.courseId)}
                              disabled={isSyncing}
                              title="Sync Completion"
                            >
                              <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isUnenrolling === e.id} title="Un-enroll User">
                                  {isUnenrolling === e.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <UserMinus className="h-4 w-4 text-destructive" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will un-enroll the user from this course and delete their progress.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleUnenroll(e.userId, e.courseId)}>
                                    Un-enroll
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                      No enrollments found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {totalPages > 1 && (
          <CardFooter className="flex justify-end items-center gap-4 border-t pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={`${rowsPerPage}`}
                onValueChange={(val) => {
                  setRowsPerPage(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <Sheet open={!!viewingDetail} onOpenChange={(open) => !open && setViewingDetail(null)}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl px-6">
          <SheetHeader className="flex flex-row items-center justify-between gap-4 border-b pb-4 mb-4">
            <div className="text-left">
              <SheetTitle className="text-xl font-bold">
                {users.get(viewingDetail?.userId || "")?.displayName}'s Progress
              </SheetTitle>
              <SheetDescription className="text-sm">
                Detailed content checklist for "{courses.get(viewingDetail?.courseId || "")?.title}"
              </SheetDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={`/admin/users/${viewingDetail?.userId}`}>
                View Full Profile <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            {detailLoading ? (
              <div className="space-y-4 py-8">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : detailData ? (
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  {/* Videos */}
                  {detailData.videos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                        <Video className="h-3 w-3" /> Videos ({detailData.videos.length})
                      </h4>
                      <div className="grid gap-2">
                        {detailData.videos.map(v => (
                          <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                            <div className="flex items-center gap-3">
                              {v.isCompleted ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                              <span className={cn("text-sm font-medium", v.isCompleted && "text-muted-foreground line-through")}>{v.title}</span>
                            </div>
                            <Badge variant={v.isCompleted ? "default" : "outline"} className="text-[10px] uppercase">
                              {v.isCompleted ? "Watched" : "Pending"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quizzes */}
                  {detailData.quizzes.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                        <FileQuestion className="h-3 w-3" /> Quizzes ({detailData.quizzes.length})
                      </h4>
                      <div className="grid gap-2">
                        {detailData.quizzes.map(q => (
                          <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                            <div className="flex items-center gap-3">
                              {q.isCompleted ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                              <span className={cn("text-sm font-medium", q.isCompleted && "text-muted-foreground line-through")}>{q.title}</span>
                            </div>
                            <Badge variant={q.isCompleted ? "default" : "outline"} className="text-[10px] uppercase">
                              {q.isCompleted ? "Passed" : "Required"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Form */}
                  {detailData.form && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                        <FileText className="h-3 w-3" /> Required Form
                      </h4>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                        <div className="flex items-center gap-3">
                          {detailData.form.isCompleted ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                          <span className={cn("text-sm font-medium", detailData.form.isCompleted && "text-muted-foreground line-through")}>{detailData.form.title}</span>
                        </div>
                        <Badge variant={detailData.form.isCompleted ? "default" : "outline"} className="text-[10px] uppercase">
                          {detailData.form.isCompleted ? "Submitted" : "Missing"}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12 text-muted-foreground">No data available for this enrollment.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Export Enrollments</DialogTitle>
            <DialogDescription>Select the fields you want to include in the enrollment report CSV.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-4 px-1">
            <Checkbox 
              id="select-all-export" 
              checked={selectedExportFields.length === exportFields.length}
              onCheckedChange={(c) => setSelectedExportFields(c ? exportFields.map(f => f.id) : [])}
            />
            <Label htmlFor="select-all-export" className="text-sm font-semibold cursor-pointer">Select All Fields</Label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 max-h-[50vh] overflow-y-auto">
            {exportFields.map(field => (
              <div key={field.id} className="flex items-center gap-2">
                <Checkbox 
                  id={`exp-${field.id}`} 
                  checked={selectedExportFields.includes(field.id)} 
                  onCheckedChange={(c) => setSelectedExportFields(p => c ? [...p, field.id] : p.filter(x => x !== field.id))} 
                />
                <Label htmlFor={`exp-${field.id}`} className="text-xs cursor-pointer">{field.label}</Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" /> Start Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
