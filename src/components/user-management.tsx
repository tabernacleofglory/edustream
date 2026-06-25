
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  getDoc, 
  where, 
  limit, 
  onSnapshot, 
  Timestamp,
  documentId,
  writeBatch,
  collectionGroup
} from "firebase/firestore";
import Link from "next/link";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { User, Course, Enrollment, UserProgress as UserProgressType, Ladder, OnsiteCompletion, UserQuizResult, Video, Quiz } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Edit, Eye, Loader2, Plus, Trash, Download, 
  ChevronLeft, ChevronRight, ListFilter, 
  X, CheckCircle2, Shield, Phone, MapPin, Calendar, 
  Globe, User as UserIcon, BookOpen, Award,
  Search,
  Check,
  BookCheck,
  Users,
  XCircle,
  FileQuestion,
  FileText,
  Video as VideoIcon,
  UserRound,
} from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import AddUserForm from "./add-user-form";
import Papa from "papaparse";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import EditUserForm from "./edit-user-form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "./ui/progress";
import { format } from "date-fns";
import {
  getAssignableRoles,
  isHigherOrEqualRank,
} from "@/lib/role-hierarchy";

const PAGE_SIZE_DEFAULT = 10;

const getInitials = (name?: string | null) =>
  (!name ? "U" : name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join(""));

const chunk = <T,>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

interface Campus {
  id: string;
  "Campus Name": string;
}

export default function UserManagement() {
  const { user: currentUser, canViewAllCampuses, hasPermission, startImpersonation } = useAuth();
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  // Data States
  const [allUsersMetadata, setAllUsersMetadata] = useState<User[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [userCompletionsMap, setUserCompletionsMap] = useState<Map<string, Set<string>>>(new Map());

  // UI States
  const [loading, setLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedExportFields, setSelectedExportFields] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isViewingDetails, setIsViewingDetails] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [detailedProgress, setDetailedProgress] = useState<any[]>([]);
  const [detailedOnsite, setDetailedOnsite] = useState<OnsiteCompletion[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Drill-down states
  const [viewingCourseContent, setViewingCourseContent] = useState<Course | null>(null);
  const [isLoadingDrillDown, setIsLoadingDrillDown] = useState(false);
  const [drillDownContent, setDrillDownContent] = useState<{ videos: Video[], quizzes: Quiz[], form: any | null }>({ videos: [], quizzes: [], form: null });
  const [userVideoCompletions, setUserVideoCompletions] = useState<Set<string>>(new Set());
  const [userQuizCompletions, setUserQuizCompletions] = useState<Set<string>>(new Set());
  const [userFormCompletions, setUserFormCompletions] = useState<Set<string>>(new Set());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterLadders, setFilterLadders] = useState<string[]>([]);
  const [filterGraduations, setFilterGraduations] = useState<string[]>([]);
  const [filterMinClasses, setFilterMinClasses] = useState<number>(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(PAGE_SIZE_DEFAULT);

  const assignableRoles = useMemo(() => getAssignableRoles(currentUser?.role || 'user'), [currentUser?.role]);

  const graduationOptions = ['Empty (Not Set)', 'Not Started', 'In Progress', 'Eligible', 'Graduated'];

  const exportFields = [
    { id: 'firstName', label: 'First Name' },
    { id: 'lastName', label: 'Last Name' },
    { id: 'email', label: 'Email' },
    { id: 'phoneNumber', label: 'Phone' },
    { id: 'campus', label: 'Campus' },
    { id: 'hpNumber', label: 'HP' },
    { id: 'facilitatorName', label: 'Facilitator Name' },
    { id: 'gender', label: 'Gender' },
    { id: 'ageRange', label: 'Age Range' },
    { id: 'maritalStatus', label: 'Marital Status' },
    { id: 'isBaptized', label: 'Baptism status' },
    { id: 'baptismDate', label: 'Baptism Date' },
    { id: 'denomination', label: 'Denomination' },
    { id: 'language', label: 'Language' },
    { id: 'locationPreference', label: 'Location Preference' },
    { id: 'role', label: 'Role' },
    { id: 'classLadder', label: 'Membership Ladder' },
    { id: 'charge', label: 'Charge' },
    { id: 'graduationStatus', label: 'Graduation status' },
    { id: 'graduationDate', label: 'Graduation Date' },
  ];

  const getUserLadderName = useCallback((ladderId?: string) => {
    if (!ladderId) return 'Not Assigned';
    const ladder = ladders.find(l => l.id === ladderId);
    return ladder ? ladder.name : 'Unknown Ladder';
  }, [ladders]);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const [laddersSnap, coursesSnap, campusesSnap, usersSnap, enrollSnap, onsiteSnap, progressSnap] = await Promise.all([
                getDocs(query(collection(db, "courseLevels"), orderBy("order"))),
                getDocs(collection(db, 'courses')),
                getDocs(query(collection(db, "Campus"), orderBy("Campus Name"))),
                getDocs(query(collection(db, "users"), orderBy("displayName"))),
                getDocs(query(collection(db, "enrollments"), where("completedAt", "!=", null))),
                getDocs(collection(db, "onsiteCompletions")),
                getDocs(query(collection(db, "userVideoProgress"), where("totalProgress", "==", 100)))
            ]);

            setLadders(laddersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ladder)));
            setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
            setAllCampuses(campusesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Campus)));
            setAllUsersMetadata(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));

            const cmap = new Map<string, Set<string>>();
            const addCompletion = (uid: string, cid: string) => {
                if (!cmap.has(uid)) cmap.set(uid, new Set());
                cmap.get(uid)!.add(cid);
            };

            enrollSnap.forEach(d => {
                const data = d.data();
                if (data.userId && data.courseId) addCompletion(data.userId, data.courseId);
            });
            onsiteSnap.forEach(d => {
                const data = d.data();
                if (data.userId && data.courseId) addCompletion(data.userId, data.courseId);
            });
            progressSnap.forEach(d => {
                const data = d.data();
                if (data.userId && data.courseId) addCompletion(data.userId, data.courseId);
            });

            setUserCompletionsMap(cmap);

        } catch (e) {
            console.error("Fetch error", e);
            toast({ variant: 'destructive', title: 'Failed to load data.' });
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [db, toast]);

  const filteredUsersList = useMemo(() => {
    let result = [...allUsersMetadata];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(u => 
        (u.displayName || "").toLowerCase().includes(q) || 
        (u.email || "").toLowerCase().includes(q) ||
        (u.campus || "").toLowerCase().includes(q) ||
        (u.firstName || "").toLowerCase().includes(q) ||
        (u.lastName || "").toLowerCase().includes(q) ||
        (u.fullName || "").toLowerCase().includes(q)
      );
    }

    if (!canViewAllCampuses && currentUser?.campus) {
        result = result.filter(u => u.campus === currentUser.campus);
    } else if (selectedCampus !== 'all') {
        const campusObj = allCampuses.find(c => c.id === selectedCampus);
        if (campusObj) result = result.filter(u => u.campus === campusObj["Campus Name"]);
    }

    if (filterRoles.length > 0) result = result.filter(u => filterRoles.includes(u.role || 'user'));
    if (filterLadders.length > 0) result = result.filter(u => filterLadders.includes(u.classLadderId || ''));
    if (filterGraduations.length > 0) {
        result = result.filter(u => filterGraduations.includes(u.graduationStatus || 'Empty (Not Set)'));
    }

    if (filterMinClasses > 0) {
        result = result.filter(u => (userCompletionsMap.get(u.id)?.size || 0) >= filterMinClasses);
    }

    return result;
  }, [allUsersMetadata, searchTerm, selectedCampus, filterRoles, filterLadders, filterGraduations, filterMinClasses, userCompletionsMap, allCampuses, canViewAllCampuses, currentUser]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCampus !== 'all') count++;
    if (filterRoles.length > 0) count++;
    if (filterLadders.length > 0) count++;
    if (filterGraduations.length > 0) count++;
    if (filterMinClasses > 0) count++;
    return count;
  }, [selectedCampus, filterRoles, filterLadders, filterGraduations, filterMinClasses]);

  const totalPages = Math.ceil(filteredUsersList.length / usersPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  
  const currentUsersPage = useMemo(() => {
    return filteredUsersList.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);
  }, [filteredUsersList, currentPage, usersPerPage]);

  // Role changes are now only done through the Edit User dialog
  // Inline role editing has been removed for security - use the Edit button instead

  const handleViewDetails = async (user: User) => {
    setViewingUser(user);
    setIsViewingDetails(true);
    setIsLoadingDetails(true);
    try {
        const userId = user.id;
        const [progressSnap, onsiteSnap, enrollmentsSnap, quizSnap, globalSnap, formSnap] = await Promise.all([
            getDocs(query(collection(db, 'userVideoProgress'), where('userId', '==', userId))),
            getDocs(query(collection(db, 'onsiteCompletions'), where('userId', '==', userId))),
            getDocs(query(collection(db, 'enrollments'), where('userId', '==', userId))),
            getDocs(query(collection(db, 'userQuizResults'), where('userId', '==', userId), where('passed', '==', true))),
            getDoc(doc(db, "userContentProgress", userId)),
            getDocs(query(collectionGroup(db, 'submissions'), where('userId', '==', userId)))
        ]);

        const courseById = new Map(courses.map(course => [course.id, course]));
        const knownCourseIds = new Set(courseById.keys());
        const knownVideoIds = new Set<string>();
        const knownQuizIds = new Set<string>();
        const knownFormIds = new Set<string>();
        courses.forEach(course => {
            (course.videos || []).forEach(id => knownVideoIds.add(id));
            (course.quizIds || []).forEach(id => knownQuizIds.add(id));
            if (course.formId) knownFormIds.add(course.formId);
        });

        const completedIds = new Set<string>();
        const engagedCourseIds = new Set<string>();
        const videoDone = new Set<string>();
        const quizzesDone = new Set<string>();
        const formsDone = new Set<string>();
        const onsiteRecords = onsiteSnap.docs.map(d => d.data() as OnsiteCompletion);
        const onsiteCourseTitles = new Map<string, string>();
        
        // 1. Onsite
        onsiteRecords.forEach(record => {
            if (!record.courseId) return;
            completedIds.add(record.courseId);
            engagedCourseIds.add(record.courseId);
            if (record.courseName) onsiteCourseTitles.set(record.courseId, record.courseName);
            (record.creditedVideos || []).forEach(id => knownVideoIds.has(id) && videoDone.add(id));
            (record.creditedQuizzes || []).forEach(id => knownQuizIds.has(id) && quizzesDone.add(id));
            if (record.creditedForm?.formId && knownFormIds.has(record.creditedForm.formId)) {
                formsDone.add(record.creditedForm.formId);
            }
        });
        // 2. Enrollment formal finish
        enrollmentsSnap.forEach(d => {
            const enrollment = d.data() as Enrollment;
            if (!enrollment.courseId) return;
            if (enrollment.completedAt) {
                completedIds.add(enrollment.courseId);
                engagedCourseIds.add(enrollment.courseId);
            }
        });
        // 3. Global Sync
        const globalCompletedItems = new Set<string>();
        if (globalSnap.exists()) {
            const gItems = globalSnap.data().completedItems || {};
            Object.keys(gItems).forEach(id => {
                globalCompletedItems.add(id);
                if (knownCourseIds.has(id)) completedIds.add(id);
                if (knownVideoIds.has(id)) videoDone.add(id);
                if (knownQuizIds.has(id)) quizzesDone.add(id);
                if (knownFormIds.has(id)) formsDone.add(id);
            });
        }
        
        // 4. Fallback granular check
        progressSnap.forEach(d => {
            const data = d.data() as UserProgressType;
            const hasVideoActivity = data.videoProgress?.some((vp: any) => vp.completed || (vp.timeSpent || 0) > 0);
            if (data.courseId && ((data.totalProgress || data.percent || 0) > 0 || hasVideoActivity)) {
                engagedCourseIds.add(data.courseId);
            }
            data.videoProgress?.forEach((vp: any) => { if (vp.completed) videoDone.add(vp.videoId); });
        });
        quizSnap.docs.forEach(d => {
            const data = d.data();
            if (data.quizId) quizzesDone.add(data.quizId);
            if (data.courseId) engagedCourseIds.add(data.courseId);
        });
        formSnap.docs.forEach(d => {
            const data = d.data();
            if (data.formId) formsDone.add(data.formId);
            if (data.courseId) engagedCourseIds.add(data.courseId);
        });

        setUserVideoCompletions(videoDone);
        setUserQuizCompletions(quizzesDone);
        setUserFormCompletions(formsDone);

        courses.forEach(c => {
            if (completedIds.has(c.id)) return;
            const reqVideos = c.videos || [];
            const reqQuizzes = c.quizIds || [];
            const reqForm = c.formId;

            const videosOk = reqVideos.every(id => videoDone.has(id));
            const quizzesOk = reqQuizzes.every(id => quizzesDone.has(id));
            const formOk = !reqForm || formsDone.has(reqForm);

            if (videosOk && quizzesOk && formOk && (reqVideos.length > 0 || reqQuizzes.length > 0 || reqForm)) {
                completedIds.add(c.id);
            }

            const hasCourseActivity =
                globalCompletedItems.has(c.id) ||
                reqVideos.some(id => videoDone.has(id)) ||
                reqQuizzes.some(id => quizzesDone.has(id)) ||
                (!!reqForm && formsDone.has(reqForm));

            if (hasCourseActivity) {
                engagedCourseIds.add(c.id);
            }
        });

        const progressDocs = progressSnap.docs.map(d => d.data() as UserProgressType);
        const allRelevantCourseIds = Array.from(new Set([
            ...Array.from(engagedCourseIds),
            ...Array.from(completedIds)
        ].filter((courseId): courseId is string => typeof courseId === 'string' && courseId.length > 0)));

        const detailedList = allRelevantCourseIds.flatMap(cid => {
            const course = courseById.get(cid);
            const progress = progressDocs.find(p => p.courseId === cid);
            const isCompleted = completedIds.has(cid);
            const courseTitle = course?.title || onsiteCourseTitles.get(cid);
            if (!courseTitle) return [];

            return [{
                courseId: cid,
                courseTitle,
                totalProgress: isCompleted ? 100 : (progress?.totalProgress || 0),
                isCompleted: isCompleted,
                ladderIds: course?.ladderIds || [],
                language: course?.language,
            }];
        });

        setDetailedProgress(detailedList.sort((a,b) => a.courseTitle.localeCompare(b.courseTitle)));
        setDetailedOnsite(onsiteRecords);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Failed to load details' });
    } finally {
        setIsLoadingDetails(false);
    }
  };

  const handleViewCourseDrillDown = async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    setViewingCourseContent(course);
    setIsLoadingDrillDown(true);
    try {
        const videoIds = course.videos || [];
        const quizIds = course.quizIds || [];
        const formId = course.formId;

        let videos: Video[] = [];
        if (videoIds.length > 0) {
            const videoChunks = chunk(videoIds, 30);
            const snaps = await Promise.all(videoChunks.map(ids => getDocs(query(collection(db, 'Contents'), where(documentId(), 'in', ids)))));
            videos = snaps.flatMap(s => s.docs.map(d => ({id: d.id, ...d.data()} as Video)));
        }

        let quizzes: Quiz[] = [];
        if (quizIds.length > 0) {
            const snaps = await getDocs(query(collection(db, 'quizzes'), where(documentId(), 'in', quizIds)));
            quizzes = snaps.docs.map(d => ({id: d.id, ...d.data()} as Quiz));
        }

        let form = null;
        if (formId) {
            const snap = await getDoc(doc(db, 'forms', formId));
            if (snap.exists()) form = { id: snap.id, ...snap.data() };
        }

        setDrillDownContent({ videos, quizzes, form });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Failed to load granular content' });
    } finally {
        setIsLoadingDrillDown(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedExportFields.length === 0) {
        toast({ variant: 'destructive', title: 'Selection Missing', description: 'Please select at least one field to export.' });
        return;
    }
    const csvData = filteredUsersList.map(u => {
        const row: any = {};
        selectedExportFields.forEach(fieldId => {
            let val = (u as any)[fieldId];
            if (fieldId === 'classLadder') val = getUserLadderName(u.classLadderId);
            row[exportFields.find(f => f.id === fieldId)?.label || fieldId] = val ?? '';
        });
        return row;
    });
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `user_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    setIsExportDialogOpen(false);
  };

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Managing {filteredUsersList.length} filtered users.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
                <Button onClick={() => setIsAddUserOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search by name, email, campus..." 
                    className="pl-10 h-10"
                    value={searchTerm} 
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                />
            </div>
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline">
                        <ListFilter className="mr-2 h-4 w-4" /> 
                        Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                    </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>User Filters</SheetTitle>
                        <SheetDescription>Refine the user list by criteria.</SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-150px)] mt-4">
                        <div className="space-y-6 px-1">
                            <div><Label>Campus</Label>
                                <Select value={selectedCampus} onValueChange={(v) => { setSelectedCampus(v); setCurrentPage(1); }} disabled={!canViewAllCampuses}>
                                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {allCampuses.map(c => <SelectItem key={c.id} value={c.id}>{c["Campus Name"]}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Roles</Label>
                                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                                    {ALL_ROLES.map(r => (
                                        <div key={r.id} className="flex items-center gap-2">
                                            <Checkbox id={`r-${r.id}`} checked={filterRoles.includes(r.id)} onCheckedChange={(c) => { setFilterRoles(p => c ? [...p, r.id] : p.filter(x => x !== r.id)); setCurrentPage(1); }} />
                                            <Label htmlFor={`r-${r.id}`}>{r.name}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Ladders</Label>
                                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                                    {ladders.map(l => (
                                        <div key={l.id} className="flex items-center gap-2">
                                            <Checkbox id={`l-${l.id}`} checked={filterLadders.includes(l.id)} onCheckedChange={(c) => { setFilterLadders(p => c ? [...p, l.id] : p.filter(x => x !== l.id)); setCurrentPage(1); }} />
                                            <Label htmlFor={`l-${l.id}`}>{l.name} ({l.side})</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Graduation Status</Label>
                                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                                    {graduationOptions.map(opt => (
                                        <div key={opt} className="flex items-center gap-2">
                                            <Checkbox id={`g-${opt}`} checked={filterGraduations.includes(opt)} onCheckedChange={(c) => { setFilterGraduations(p => c ? [...p, opt] : p.filter(x => x !== opt)); setCurrentPage(1); }} />
                                            <Label htmlFor={`g-${opt}`}>{opt}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Class Count</Label>
                                <Select value={String(filterMinClasses)} onValueChange={(v) => { setFilterMinClasses(Number(v)); setCurrentPage(1); }}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Any amount" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Any amount</SelectItem>
                                        {[1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50].map(val => (
                                            <SelectItem key={val} value={String(val)}>{val}+ or more</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>

        <div className="overflow-x-auto">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Membership Ladder</TableHead>
                <TableHead className="text-center">Baptism</TableHead>
                <TableHead>Graduation</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                    ))
                ) : (
                    currentUsersPage.map((u) => (
                    <TableRow key={u.id}>
                        <TableCell>
                            <div 
                                className="flex items-center gap-3 cursor-pointer group/user"
                                onClick={() => handleViewDetails(u)}
                            >
                                <Avatar><AvatarImage src={u.photoURL || undefined} /><AvatarFallback>{getInitials(u.displayName)}</AvatarFallback></Avatar>
                                <div className="max-[150px] truncate">
                                    <p className="font-medium truncate group-hover/user:underline">{u.displayName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-xs">{u.campus || 'N/A'}</TableCell>
                        <TableCell>
                            {isHigherOrEqualRank(currentUser?.role || 'user', u.role || 'user') ? (
                              <span className="text-muted-foreground text-xs">
                                <Badge variant="outline" className="text-xs">{u.role || 'User'}</Badge>
                              </span>
                            ) : (
                              <Badge variant="outline" className="text-xs">{u.role || 'User'}</Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-xs">{getUserLadderName(u.classLadderId)}</TableCell>
                        <TableCell className="text-center">
                            {u.isBaptized ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Yes</Badge> : <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">No</Badge>}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px] whitespace-nowrap">{u.graduationStatus || 'Not Set'}</Badge></TableCell>
                        <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetails(u)}><Eye className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingUser(u)}><Edit className="h-4 w-4" /></Button>
                                {(currentUser?.role === 'admin' || currentUser?.role === 'developer') && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    title="View as this student"
                                    onClick={() => startImpersonation(u.id)}
                                  >
                                    <UserRound className="h-4 w-4" />
                                  </Button>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                    ))
                )}
            </TableBody>
            </Table>
        </div>
      </CardContent>
      <CardFooter className="justify-between border-t p-4">
        <div className="text-sm text-muted-foreground">Page {currentPage} of {Math.max(1, totalPages)}</div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={!hasPrevPage}><ChevronLeft className="h-4 w-4" /> Prev</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={!hasNextPage}><ChevronRight className="h-4 w-4" /> Next</Button>
        </div>
      </CardFooter>
    </Card>

    <Dialog open={isViewingDetails} onOpenChange={setIsViewingDetails}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b bg-muted/20 text-left shrink-0">
                <DialogTitle className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
                        <AvatarImage src={viewingUser?.photoURL || undefined} />
                        <AvatarFallback className="text-xl">{getInitials(viewingUser?.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                        <h2 className="text-2xl font-bold">{viewingUser?.displayName}</h2>
                        <p className="text-sm text-muted-foreground">{viewingUser?.email}</p>
                    </div>
                </DialogTitle>
            </DialogHeader>
            {viewingUser && (
                <>
                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-8">
                        {isLoadingDetails ? (
                            <div className="space-y-8">
                                <Skeleton className="h-40 w-full" />
                                <Skeleton className="h-20 w-full" />
                                <div className="space-y-3">
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                </div>
                            </div>
                        ) : (
                            <>
                            <section>
                                <h4 className="font-bold text-sm uppercase text-primary mb-4 flex items-center gap-2"><UserIcon className="h-4 w-4" /> Profile Info</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-muted/30 p-4 rounded-lg border">
                                    {[
                                        { label: 'Name', value: viewingUser.fullName },
                                        { label: 'Campus', value: viewingUser.campus, icon: MapPin },
                                        { label: 'Language', value: viewingUser.language, icon: Globe },
                                        { label: 'In HP Group', value: viewingUser.isInHpGroup ? 'Yes' : 'No' },
                                        { label: 'HP #', value: viewingUser.hpNumber },
                                        { label: 'Facilitator', value: viewingUser.facilitatorName },
                                        { label: 'Class Ladder', value: getUserLadderName(viewingUser.classLadderId), icon: Shield },
                                        { label: 'Courses Completed', value: detailedProgress.filter(p => p.isCompleted).length, icon: BookCheck },
                                        { label: 'Charge', value: viewingUser.charge, icon: Award },
                                        { label: 'Graduation', value: viewingUser.graduationStatus || 'Not Set' },
                                    ].map((field, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground">{field.label}</p>
                                            <p className="text-sm font-medium flex items-center gap-2">{field.icon && <field.icon className="h-3 w-3" />}{String(field.value) || '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                            <section>
                                <h4 className="font-bold text-sm uppercase text-primary mb-4 flex items-center gap-2"><Shield className="h-4 w-4" /> Ladder Completion</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {ladders.map(ladder => {
                                        const ladderCourses = courses.filter(c => c.ladderIds?.includes(ladder.id) && (!viewingUser.language || c.language === viewingUser.language));
                                        if (ladderCourses.length === 0) return null;
                                        
                                        const completedInLadder = detailedProgress.filter(p => 
                                            p.isCompleted && ladderCourses.some(lc => lc.id === p.courseId)
                                        ).length;
                                        
                                        const pct = ladderCourses.length > 0 ? Math.round((completedInLadder / ladderCourses.length) * 100) : 0;
                                        return (
                                            <div key={ladder.id} className="space-y-2 p-3 border rounded-lg bg-background">
                                                <div className="flex justify-between items-center text-xs font-bold"><span>{ladder.name}</span><span>{pct}%</span></div>
                                                <Progress value={pct} className="h-1.5" />
                                                <p className="text-[10px] text-muted-foreground text-right">{completedInLadder} / {ladderCourses.length} Courses</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                            <section>
                                <h4 className="font-bold text-sm uppercase text-primary mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4" /> Course History</h4>
                                <div className="space-y-3">
                                    {detailedProgress.length > 0 ? (
                                        detailedProgress.map((item) => (
                                            <div key={item.courseId} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                                                <div className="flex items-center gap-3">
                                                    {item.isCompleted ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />}
                                                    <span className="text-sm font-medium">{item.courseTitle}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {!item.isCompleted && (
                                                        <div className="hidden sm:flex flex-col items-end gap-1">
                                                            <span className="text-[10px] font-bold">{item.totalProgress}%</span>
                                                            <Progress value={item.totalProgress} className="h-1 w-20" />
                                                        </div>
                                                    )}
                                                    <Badge 
                                                        variant={item.isCompleted ? "default" : "secondary"} 
                                                        className="text-[10px] cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => handleViewCourseDrillDown(item.courseId)}
                                                    >
                                                        {item.isCompleted ? 'Completed' : 'Pending'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed"><BookOpen className="h-8 w-8 mx-auto mb-2 opacity-20" /><p>No courses found for this student.</p></div>
                                    )}
                                </div>
                            </section>
                            </>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
                    <Button variant="secondary" onClick={() => setIsViewingDetails(false)}>Close</Button>
                    <Button asChild><Link href={`/admin/users/${viewingUser.id}`}>Go to Full Profile</Link></Button>
                </DialogFooter>
                </>
            )}
        </DialogContent>
    </Dialog>

    <Dialog open={!!viewingCourseContent} onOpenChange={(open) => !open && setViewingCourseContent(null)}>
        <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Granular Progress: {viewingCourseContent?.title}</DialogTitle>
                <DialogDescription>Checking lesson-by-lesson completion for {viewingUser?.displayName}.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 mt-4 pr-4">
                {isLoadingDrillDown ? (
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Videos */}
                        {drillDownContent.videos.length > 0 && (
                            <section>
                                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                    <VideoIcon className="h-3 w-3" /> Videos ({drillDownContent.videos.length})
                                </h4>
                                <div className="space-y-2">
                                    {drillDownContent.videos.map(video => {
                                        const done = userVideoCompletions.has(video.id);
                                        return (
                                            <div key={video.id} className="flex items-center justify-between p-2 rounded border bg-muted/10">
                                                <div className="flex items-center gap-3">
                                                    {done ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                                                    <span className="text-sm">{video.title}</span>
                                                </div>
                                                <Badge variant={done ? "default" : "outline"} className="text-[10px]">{done ? 'Watched' : 'Remaining'}</Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Quizzes */}
                        {drillDownContent.quizzes.length > 0 && (
                            <section>
                                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                    <FileQuestion className="h-3 w-3" /> Quizzes ({drillDownContent.quizzes.length})
                                </h4>
                                <div className="space-y-2">
                                    {drillDownContent.quizzes.map(quiz => {
                                        const done = userQuizCompletions.has(quiz.id);
                                        return (
                                            <div key={quiz.id} className="flex items-center justify-between p-2 rounded border bg-muted/10">
                                                <div className="flex items-center gap-3">
                                                    {done ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                                                    <span className="text-sm">{quiz.title}</span>
                                                </div>
                                                <Badge variant={done ? "default" : "outline"} className="text-[10px]">{done ? 'Passed' : 'Pending'}</Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Form */}
                        {drillDownContent.form && (
                            <section>
                                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                    <FileText className="h-3 w-3" /> Final Form
                                </h4>
                                <div className="flex items-center justify-between p-2 rounded border bg-muted/10">
                                    <div className="flex items-center gap-3">
                                        {userFormCompletions.has(drillDownContent.form.id) ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                                        <span className="text-sm">{drillDownContent.form.title}</span>
                                    </div>
                                    <Badge variant={userFormCompletions.has(drillDownContent.form.id) ? "default" : "outline"} className="text-[10px]">
                                        {userFormCompletions.has(drillDownContent.form.id) ? 'Submitted' : 'Required'}
                                    </Badge>
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
                <Button variant="secondary" onClick={() => setViewingCourseContent(null)}>Close Checklist</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Export Users</DialogTitle>
                <DialogDescription>Select fields to include in the CSV export.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 max-h-[50vh] overflow-y-auto">
                {exportFields.map(field => (
                    <div key={field.id} className="flex items-center gap-2">
                        <Checkbox id={`exp-${field.id}`} checked={selectedExportFields.includes(field.id)} onCheckedChange={(c) => setSelectedExportFields(p => c ? [...p, field.id] : p.filter(x => x !== field.id))} />
                        <Label htmlFor={`exp-${field.id}`} className="text-xs">{field.label}</Label>
                    </div>
                ))}
            </div>
            <DialogFooter><Button onClick={handleExportCSV}>Start Export</Button></DialogFooter>
        </DialogContent>
    </Dialog>

    <Sheet open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <SheetContent className="sm:max-w-md">
            <SheetHeader>
                <SheetTitle>Edit User Profile</SheetTitle>
                <SheetDescription>Modify student information and status.</SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                {editingUser && <EditUserForm userToEdit={editingUser} onUserUpdated={() => { setEditingUser(null); window.location.reload(); }} />}
            </ScrollArea>
        </SheetContent>
    </Sheet>

    <Sheet open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <SheetContent className="sm:max-w-md">
            <SheetHeader>
                <SheetTitle>Add New User</SheetTitle>
                <SheetDescription>Register a new student account manually.</SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                <AddUserForm onUserAdded={() => { setIsAddUserOpen(false); window.location.reload(); }} ladders={ladders} />
            </ScrollArea>
        </SheetContent>
    </Sheet>
    </>
  );
}
