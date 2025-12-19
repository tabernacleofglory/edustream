
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  startAfter,
  DocumentSnapshot,
  getCountFromServer,
  runTransaction,
  getDoc,
  documentId,
  increment,
  collectionGroup,
} from "firebase/firestore";
import { getFirebaseApp, getFirebaseFirestore } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { User, Course, Ladder, Video, Quiz, CustomForm, UserProgress, UserQuizResult, OnsiteCompletion } from "@/lib/types";

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Badge } from "./ui/badge";
import { Loader2, Search, CheckCircle2, Trash2, Download, Lock, ChevronRight, ChevronLeft, Calendar as CalendarIcon, X as XIcon, BookOpen, Video as VideoIcon, FileQuestion, FileText } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Papa from "papaparse";
import { Skeleton } from "./ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { DateRange } from "react-day-picker";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "./ui/alert-dialog";
import { Progress } from "./ui/progress";


const PAGE_SIZE_DEFAULT = 10;

const getInitials = (name?: string | null) =>
  (!name ? "U" : name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join(""));

const chunk = <T,>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

interface Campus {
  id: string;
  "Campus Name": string;
}

const UserSearch = ({ users, onSelectUser, selectedUser, loading }: { users: User[], onSelectUser: (user: User | null) => void, selectedUser: User | null, loading: boolean }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const filteredUsers = useMemo(() => {
        const q = searchTerm.toLowerCase();
        return users.filter(u => 
            (u.displayName || "").toLowerCase().includes(q) || 
            (u.email || "").toLowerCase().includes(q)
        );
    }, [users, searchTerm]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>1. Select a User</CardTitle>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-64">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredUsers.map(u => {
                                const selected = selectedUser?.id === u.id;
                                return (
                                    <Button
                                        key={u.id}
                                        variant={selected ? "secondary" : "ghost"}
                                        className={cn("w-full justify-start gap-2 h-auto", selected && "ring-1 ring-primary")}
                                        onClick={() => onSelectUser(selected ? null : u)}
                                    >
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={u.photoURL || ""} />
                                            <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-left flex-1">
                                            <p className="font-medium text-sm">{u.displayName || "Unnamed User"}</p>
                                            <p className="text-xs text-muted-foreground">{u.email}</p>
                                        </div>
                                        {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                    </Button>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    )
}

const CoursePicker = ({ courses, onSelectCourse, selectedCourse, user, loading }: { courses: Course[], onSelectCourse: (course: Course | null) => void, selectedCourse: Course | null, user: User | null, loading: boolean }) => {
    const [searchTerm, setSearchTerm] = useState("");
    
    const filteredCourses = useMemo(() => {
        const q = searchTerm.toLowerCase();
        let userCourses = courses;
        if (user?.language) {
          userCourses = courses.filter(c => c.language === user.language);
        }
        return userCourses.filter(c => (c.title || "").toLowerCase().includes(q));
    }, [courses, searchTerm, user]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>2. Pick a Course</CardTitle>
                 <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search courses..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" disabled={!user} />
                </div>
            </CardHeader>
             <CardContent>
                <ScrollArea className="h-64">
                   {loading ? (
                        <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
                   ) : user ? (
                       <div className="space-y-2">
                           {filteredCourses.map(c => (
                               <Button
                                    key={c.id}
                                    variant={selectedCourse?.id === c.id ? "secondary" : "ghost"}
                                    className={cn("w-full justify-start gap-2 h-auto text-left", selectedCourse?.id === c.id && "ring-1 ring-primary")}
                                    onClick={() => onSelectCourse(selectedCourse?.id === c.id ? null : c)}
                                >
                                     <BookOpen className="h-4 w-4 flex-shrink-0" />
                                     <span className="flex-1">{c.title}</span>
                                     {selectedCourse?.id === c.id && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                                </Button>
                           ))}
                       </div>
                   ) : (
                       <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Select a user first</p></div>
                   )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
};

interface CourseContent {
    videos: Video[];
    quizzes: Quiz[];
    form: CustomForm | null;
}

const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const hStr = h > 0 ? `${h}:` : '';
    const mStr = m < 10 && h > 0 ? `0${m}` : `${m}`;
    const sStr = s < 10 ? `0${s}` : `${s}`;
    return `${hStr}${mStr}:${sStr}`;
};

const CourseContentSection = ({
    course,
    loading: courseLoading,
    selectedItems,
    onItemToggle,
    onSave,
    isSaving,
    existingProgress
}: {
    course: Course | null,
    loading: boolean,
    selectedItems: Set<string>,
    onItemToggle: (id: string, type: string) => void,
    onSave: () => void,
    isSaving: boolean,
    existingProgress: { videos: Set<string>, quizzes: Set<string>, forms: Set<string> }
}) => {
    const [content, setContent] = useState<CourseContent>({ videos: [], quizzes: [], form: null });
    const [loading, setLoading] = useState(false);
    const db = getFirebaseFirestore();

    useEffect(() => {
        if (!course) {
            setContent({ videos: [], quizzes: [], form: null });
            return;
        }

        const fetchContent = async () => {
            setLoading(true);
            try {
                const videoIds = course.videos || [];
                const quizIds = course.quizIds || [];
                const formId = course.formId;

                let videos: Video[] = [];
                if (videoIds.length > 0) {
                    const videoChunks = [];
                    for (let i = 0; i < videoIds.length; i += 30) {
                        videoChunks.push(videoIds.slice(i, i + 30));
                    }
                    const videoPromises = videoChunks.map(chunk => getDocs(query(collection(db, 'Contents'), where(documentId(), 'in', chunk))));
                    const videoSnapshots = await Promise.all(videoPromises);
                    const allVideoDocs = videoSnapshots.flatMap(s => s.docs);
                    const videoMap = new Map(allVideoDocs.map(d => [d.id, { id: d.id, ...d.data() } as Video]));
                    videos = videoIds.map(id => videoMap.get(id)).filter(Boolean) as Video[];
                }

                let quizzes: Quiz[] = [];
                if (quizIds.length > 0) {
                    const q = query(collection(db, 'quizzes'), where(documentId(), 'in', quizIds));
                    const snapshot = await getDocs(q);
                    quizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
                }

                let form: CustomForm | null = null;
                if (formId) {
                    const formSnap = await getDoc(doc(db, 'forms', formId));
                    if (formSnap.exists()) {
                        form = { id: formSnap.id, ...formSnap.data() } as CustomForm;
                    }
                }

                setContent({ videos, quizzes, form });

            } catch (error) {
                console.error("Error fetching course content:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [course, db]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>3. Course Content</CardTitle>
                <CardDescription>Select items to grant credit for.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-64 pr-4">
                    {courseLoading || loading ? <Skeleton className="h-24" /> : !course ? (
                        <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Select a course</p></div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-sm mb-2">Videos ({content.videos.length})</h4>
                                <div className="space-y-2">
                                    {content.videos.map(video => {
                                        const isCompleted = existingProgress.videos.has(video.id);
                                        return (
                                        <div key={video.id} className="flex items-center justify-between space-x-2">
                                            <div className="flex items-center gap-2">
                                                <Checkbox id={`video-${video.id}`} checked={selectedItems.has(`video_${video.id}`) || isCompleted} onCheckedChange={() => onItemToggle(video.id, 'video')} disabled={isCompleted} />
                                                <Label htmlFor={`video-${video.id}`} className={cn("font-normal flex items-center gap-2", isCompleted && "text-muted-foreground")}>
                                                    <VideoIcon className="h-4 w-4 text-muted-foreground" />
                                                    {video.title}
                                                </Label>
                                            </div>
                                            <span className={cn("text-xs text-muted-foreground", isCompleted && "line-through")}>{formatDuration(video.duration)}</span>
                                        </div>
                                    )})}
                                </div>
                            </div>
                            {content.quizzes.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Quizzes ({content.quizzes.length})</h4>
                                    <div className="space-y-2">
                                        {content.quizzes.map(quiz => {
                                            const isCompleted = existingProgress.quizzes.has(quiz.id);
                                            return(
                                            <div key={quiz.id} className="flex items-center space-x-2">
                                                <Checkbox id={`quiz-${quiz.id}`} checked={selectedItems.has(`quiz_${quiz.id}`) || isCompleted} onCheckedChange={() => onItemToggle(quiz.id, 'quiz')} disabled={isCompleted} />
                                                <Label htmlFor={`quiz-${quiz.id}`} className={cn("font-normal flex items-center gap-2", isCompleted && "text-muted-foreground line-through")}>
                                                    <FileQuestion className="h-4 w-4 text-muted-foreground" />
                                                    {quiz.title}
                                                </Label>
                                            </div>
                                        )})}
                                    </div>
                                </div>
                            )}
                            {content.form && (
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Form</h4>
                                    <div className="flex items-center space-x-2">
                                         {(() => {
                                            const isCompleted = existingProgress.forms.has(content.form!.id);
                                            return (
                                                <>
                                                    <Checkbox id={`form-${content.form!.id}`} checked={selectedItems.has(`form_${content.form!.id}`) || isCompleted} onCheckedChange={() => onItemToggle(content.form!.id, 'form')} disabled={isCompleted} />
                                                    <Label htmlFor={`form-${content.form!.id}`} className={cn("font-normal flex items-center gap-2", isCompleted && "text-muted-foreground line-through")}>
                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                        {content.form!.title}
                                                    </Label>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
            <CardFooter>
                 <Button onClick={onSave} disabled={!course || courseLoading || loading || isSaving || selectedItems.size === 0}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Credit
                </Button>
            </CardFooter>
        </Card>
    );
};

const RecordsSection = ({ adminUser, canViewAllCampuses, allCampuses, courses, users, ladders, selectedUser, onRefresh, onLogDeleted }: { adminUser: User | null, canViewAllCampuses: boolean, allCampuses: Campus[], courses: Course[], users: User[], ladders: Ladder[], selectedUser: User | null, onRefresh: () => void, onLogDeleted: () => void }) => {
    const [logRows, setLogRows] = useState<(OnsiteCompletion & { id: string })[]>([]);
    const [isLoadingLog, setIsLoadingLog] = useState(true);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
    const [page, setPage] = useState(1);
    const [cursors, setCursors] = useState<(DocumentSnapshot | undefined)[]>([]);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [totalLogCount, setTotalLogCount] = useState(0);

    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [logSearchTerm, setLogSearchTerm] = useState("");
    const [selectedLogCampus, setSelectedLogCampus] = useState('all');
    const [selectedLogCourse, setSelectedLogCourse] = useState('all');
    const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
    
    const { toast } = useToast();
    const db = getFirebaseFirestore();

    const loadLogPage = useCallback(async (targetPage: number, cursorStack: (DocumentSnapshot | undefined)[], size?: number) => {
        setIsLoadingLog(true);
        setSelectedLogIds(new Set());

        try {
            const col = collection(db, "onsiteCompletions");
            const baseClauses: any[] = [where("source", "==", "manual_credit")];
            
            if (selectedUser) {
                baseClauses.push(where("userId", "==", selectedUser.id));
            } else if (!canViewAllCampuses && adminUser?.campus) {
                baseClauses.push(where("userCampus", "==", adminUser.campus));
            } else if (selectedLogCampus && selectedLogCampus !== 'all') {
                const campus = allCampuses.find(c => c.id === selectedLogCampus);
                if (campus) baseClauses.push(where("userCampus", "==", campus["Campus Name"]));
            }

            if (selectedLogCourse && selectedLogCourse !== 'all') {
                baseClauses.push(where("courseId", "==", selectedLogCourse));
            }

            if (dateRange?.from) baseClauses.push(where("completedAt", ">=", startOfDay(dateRange.from)));
            if (dateRange?.to) baseClauses.push(where("completedAt", "<=", endOfDay(dateRange.to)));
            
            // Query for total count
            const countQuery = query(col, ...baseClauses);
            const countSnapshot = await getCountFromServer(countQuery);
            setTotalLogCount(countSnapshot.data().count);


            let qRef = query(col, ...baseClauses, orderBy("completedAt", "desc"), limit((size || PAGE_SIZE_DEFAULT) + 1));

            if (targetPage > 1 && cursorStack[targetPage - 2]) {
                qRef = query(qRef, startAfter(cursorStack[targetPage - 2]));
            }

            const snap = await getDocs(qRef);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            const pageHasNext = docs.length > (size || PAGE_SIZE_DEFAULT);
            const pageDocs = pageHasNext ? docs.slice(0, size || PAGE_SIZE_DEFAULT) : docs;
            
            setLogRows(pageDocs);

            const newStack = [...cursorStack];
            if (pageDocs.length > 0) {
                newStack[targetPage - 1] = snap.docs[Math.min((size || PAGE_SIZE_DEFAULT) - 1, snap.docs.length - 1)];
            }
            setCursors(newStack);
            setPage(targetPage);
            setHasNextPage(pageHasNext);
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Failed to load log." });
        } finally {
            setIsLoadingLog(false);
        }
    }, [db, toast, canViewAllCampuses, adminUser, allCampuses, selectedLogCampus, selectedLogCourse, dateRange, selectedUser]);
    
    useEffect(() => {
        setPage(1);
        setCursors([]);
        loadLogPage(1, [], pageSize);
    }, [pageSize, selectedLogCampus, selectedLogCourse, dateRange, loadLogPage, selectedUser]);

    const goPrev = () => { if (page > 1) loadLogPage(page - 1, cursors, pageSize); };
    const goNext = () => { if (hasNextPage) loadLogPage(page + 1, cursors, pageSize); };

    const handleToggleAllOnPage = () => {
        if (selectedLogIds.size === logRows.length && logRows.length > 0) {
            setSelectedLogIds(new Set());
        } else {
            setSelectedLogIds(new Set(logRows.map(r => r.id)));
        }
    };
    
    const handleDeleteSelected = async () => {
        if (selectedLogIds.size === 0) {
            toast({ variant: "destructive", title: "Select at least one log row to delete." });
            return;
        }
        setIsLoadingLog(true);
        try {
            const batch = writeBatch(db);
            const logsToDelete = logRows.filter(log => selectedLogIds.has(log.id));

            for (const log of logsToDelete) {
                // 1. Reverse video progress
                if (log.creditedVideos?.length) {
                    const progressRef = doc(db, 'userVideoProgress', `${log.userId}_${log.courseId}`);
                    const progressDoc = await getDoc(progressRef);
                    if (progressDoc.exists()) {
                        const progressData = progressDoc.data() as UserProgress;
                        const newVideoProgress = progressData.videoProgress.map(vp => 
                            log.creditedVideos.includes(vp.videoId) ? { ...vp, completed: false, timeSpent: 0 } : vp
                        );
                        batch.update(progressRef, { videoProgress: newVideoProgress });
                    }
                }
                
                // 2. Delete quiz results
                if (log.creditedQuizzes?.length) {
                    for (const quizId of log.creditedQuizzes) {
                        const quizResultRef = doc(db, 'userQuizResults', `${log.userId}_${log.courseId}_${quizId}_manual`);
                        const quizResultDoc = await getDoc(quizResultRef);
                        if (quizResultDoc.exists()) {
                            batch.delete(quizResultRef);
                        }
                    }
                }
                
                // 3. Delete form submissions
                if (log.creditedForm) {
                    const formSubmissionRef = doc(db, 'forms', log.creditedForm.formId, 'submissions', log.creditedForm.submissionId);
                    const formSubmissionDoc = await getDoc(formSubmissionRef);
                    if (formSubmissionDoc.exists()) {
                        batch.delete(formSubmissionRef);
                    }
                }

                // 4. Delete the log entry itself
                batch.delete(doc(db, 'onsiteCompletions', log.id));
            }

            await batch.commit();

            toast({ title: 'Deleted', description: `Removed ${selectedLogIds.size} record(s).` });
            onLogDeleted();
            loadLogPage(1, []);
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Delete failed', description: e.message });
        } finally {
            setIsLoadingLog(false);
            setSelectedLogIds(new Set());
        }
    };


    const filteredLogRows = useMemo(() => {
        if (!logSearchTerm) return logRows;
        const q = logSearchTerm.toLowerCase();
        return logRows.filter((r: any) =>
            (r.userName || "").toLowerCase().includes(q) ||
            (r.userCampus || "").toLowerCase().includes(q) ||
            (r.courseName || "").toLowerCase().includes(q) ||
            (r.markedBy || "").toLowerCase().includes(q) ||
            (r.userEmail || "").toLowerCase().includes(q)
        );
    }, [logRows, logSearchTerm]);


    // CSV of all filtered data
    const handleDownloadCSV = async () => {
        const col = collection(db, "onsiteCompletions");
        const baseClauses: any[] = [where("source", "==", "manual_credit")];
        
        if (selectedUser) {
            baseClauses.push(where("userId", "==", selectedUser.id));
        } else if (!canViewAllCampuses && adminUser?.campus) {
            baseClauses.push(where("userCampus", "==", adminUser.campus));
        } else if (selectedLogCampus && selectedLogCampus !== 'all') {
            const campus = allCampuses.find(c => c.id === selectedLogCampus);
            if (campus) baseClauses.push(where("userCampus", "==", campus["Campus Name"]));
        }

        if (selectedLogCourse && selectedLogCourse !== 'all') {
            baseClauses.push(where("courseId", "==", selectedLogCourse));
        }

        if (dateRange?.from) baseClauses.push(where("completedAt", ">=", startOfDay(dateRange.from)));
        if (dateRange?.to) baseClauses.push(where("completedAt", "<=", endOfDay(dateRange.to)));

        const finalQuery = query(col, ...baseClauses, orderBy("completedAt", "desc"));
        const snapshot = await getDocs(finalQuery);
        let dataToExport = snapshot.docs.map(d => d.data() as OnsiteCompletion);

        if (logSearchTerm) {
            const q = logSearchTerm.toLowerCase();
            dataToExport = dataToExport.filter((r: any) =>
                (r.userName || "").toLowerCase().includes(q) ||
                (r.userCampus || "").toLowerCase().includes(q) ||
                (r.courseName || "").toLowerCase().includes(q) ||
                (r.markedBy || "").toLowerCase().includes(q) ||
                (r.userEmail || "").toLowerCase().includes(q)
            );
        }

        if (dataToExport.length === 0) {
            toast({ variant: "destructive", title: "No records found for the current filters." });
            return;
        }
        
        const header = ["First Name", "Last Name", "Email", "Phone", "HP Number", "Facilitator", "Gender", "Campus", "Ladder", "Course", "Date", "Marked By"];
        const lines = [
            header.join(","),
            ...dataToExport.map((r: any) => {
                const dateStr = r.completedAt ? format(new Date((r.completedAt as Timestamp).seconds * 1000), "yyyy-MM-dd HH:mm:ss") : "";
                const u = users.find(u => u.uid === r.userId);
                const email = r.userEmail ?? u?.email ?? "—";
                const phone = r.userPhone ?? (u as any)?.phoneNumber ?? "—";
                const gender = r.userGender ?? (u as any)?.gender ?? "—";
                const campus = r.userCampus || (u as any)?.campus || "N/A";
                const hpNumber = u?.hpNumber || "N/A";
                const facilitatorName = u?.facilitatorName || "N/A";
                const ladderName =
                r.userLadderName ??
                (() => {
                    const id = r.userLadderId ?? (u as any)?.classLadderId;
                    if (!id) return "Not assigned";
                    const L = ladders.find(l => l.id === id);
                    return L ? `${L.name}${L.side && L.side !== "none" ? ` (${L.side})` : ""}` : "Not assigned";
                })();

                const fields = [
                    u?.firstName || (r.userName || "").split(" ")[0],
                    u?.lastName || (r.userName || "").split(" ").slice(1).join(" "),
                    email,
                    phone,
                    hpNumber,
                    facilitatorName,
                    gender,
                    campus,
                    ladderName,
                    r.courseName || "",
                    dateStr,
                    r.markedBy || "",
                ].map(v => `"${String(v).replace(/"/g, '""')}"`);
                return fields.join(",");
            }),
        ];
        const csv = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(csv);
        const link = document.createElement("a");
        link.href = url;
        link.download = `manual_credit_report.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <Card>
            <CardHeader>
                 <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <CardTitle>4. Credit Log</CardTitle>
                        <CardDescription>History of manually granted course credits ({totalLogCount} total records)</CardDescription>
                    </div>
                     <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <Select value={selectedLogCampus} onValueChange={setSelectedLogCampus} disabled={!canViewAllCampuses || !!selectedUser}>
                            <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filter by campus" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Campuses</SelectItem>
                                {allCampuses.map(c => <SelectItem key={c.id} value={c.id}>{c["Campus Name"]}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={selectedLogCourse} onValueChange={setSelectedLogCourse}>
                            <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filter by course" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Courses</SelectItem>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                        </Select>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</> : format(dateRange.from, "LLL dd, y")) : <span>Filter by date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent>
                        </Popover>
                        {dateRange && <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}><XIcon className="h-4 w-4" /></Button>}
                        <Button variant="outline" className="w-full sm:w-auto" onClick={handleDownloadCSV}><Download className="h-4 w-4 mr-2" />CSV</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
               <div className="flex items-center gap-4 mb-4">
                  <Checkbox id="select-all-log" checked={logRows.length > 0 && selectedLogIds.size === logRows.length} onCheckedChange={handleToggleAllOnPage} />
                  <Label htmlFor="select-all-log" className="text-sm font-medium">Select all on page</Label>
                  {selectedLogIds.size > 0 && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" /> Delete selected ({selectedLogIds.size})</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This action will permanently remove the credit records and revert user progress. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelected}>Delete Credit Records</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                     </AlertDialog>
                  )}
               </div>
               {isLoadingLog ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-12"></TableHead><TableHead>User</TableHead><TableHead>Campus</TableHead><TableHead>Course</TableHead><TableHead>Date</TableHead><TableHead>Granted By</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredLogRows.length > 0 ? filteredLogRows.map((log: any) => {
                        const id = log.id;
                        const checked = selectedLogIds.has(id);
                        const dateStr = log.completedAt ? format(new Date((log.completedAt as Timestamp).seconds * 1000), "PPP") : "N/A";
                        const campus = log.userCampus || "N/A";

                        return (
                          <TableRow key={id} data-state={checked ? 'selected' : undefined}>
                            <TableCell><Checkbox checked={checked} onCheckedChange={() => setSelectedLogIds(p => { const n = new Set(p); if(n.has(log.id)) n.delete(log.id); else n.add(log.id); return n; })} /></TableCell>
                            <TableCell>{log.userName}</TableCell>
                            <TableCell>{campus}</TableCell>
                            <TableCell>{log.courseName}</TableCell>
                            <TableCell>{dateStr}</TableCell>
                            <TableCell>{log.markedBy || "N/A"}</TableCell>
                          </TableRow>
                        );
                      }) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No records match your filters.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Rows per page</span>
                    <Select value={`${pageSize}`} onValueChange={value => setPageSize(Number(value))}>
                        <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{[10, 25, 50, 100].map(size => <SelectItem key={size} value={`${size}`}>{size}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                    Page {page}
                </span>
                <div className="flex gap-2"><Button variant="outline" size="sm" onClick={goPrev} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /> Previous</Button><Button variant="outline" size="sm" onClick={goNext} disabled={!hasNextPage}><ChevronRight className="h-4 w-4" /> Next</Button></div>
            </CardFooter>
        </Card>
    )
}

const AllUserRecords = ({ user, courses, ladders, onRefresh }: { user: User; courses: Course[]; ladders: Ladder[]; onRefresh: () => void }) => {
  type RecordType = { id: string; name: string; date: Date; type: string; progress?: number; docRefPath: string; };

  const [records, setRecords] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const db = getFirebaseFirestore();
  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const allRecords: RecordType[] = [];

    // On-site completions
    const onsiteQuery = query(collection(db, 'onsiteCompletions'), where('userId', '==', user.id));
    const onsiteSnap = await getDocs(onsiteQuery);
    onsiteSnap.forEach(d => {
        const data = d.data() as OnsiteCompletion;
        allRecords.push({ id: d.id, name: data.courseName, date: (data.completedAt as Timestamp).toDate(), type: 'On-site', progress: 100, docRefPath: d.ref.path });
    });

    // Video Progress
    const videoProgressQuery = query(collection(db, 'userVideoProgress'), where('userId', '==', user.id));
    const videoProgressSnap = await getDocs(videoProgressQuery);
    const allVideoIds = videoProgressSnap.docs.flatMap(d => (d.data() as UserProgress).videoProgress.map(vp => vp.videoId));

    let videoMap = new Map<string, Video>();
    if (allVideoIds.length > 0) {
      for (const chunkIds of chunk(allVideoIds, 30)) {
        const videoSnap = await getDocs(query(collection(db, 'Contents'), where(documentId(), 'in', chunkIds)));
        videoSnap.forEach(d => videoMap.set(d.id, d.data() as Video));
      }
    }

    videoProgressSnap.forEach(d => {
        const data = d.data() as UserProgress;
        data.videoProgress.forEach(vp => {
            if (vp.completed) {
                const video = videoMap.get(vp.videoId);
                allRecords.push({ id: `${data.courseId}-${vp.videoId}`, name: video?.title || vp.videoId, date: (data.updatedAt as Timestamp)?.toDate() || new Date(), type: 'Video', progress: 100, docRefPath: d.ref.path });
            }
        });
    });

    // Quiz Results
    const quizResultsQuery = query(collection(db, 'userQuizResults'), where('userId', '==', user.id));
    const quizResultsSnap = await getDocs(quizResultsQuery);
    const allQuizIds = quizResultsSnap.docs.map(d => (d.data() as UserQuizResult).quizId);

    let quizMap = new Map<string, Quiz>();
    if (allQuizIds.length > 0) {
      for (const chunkIds of chunk(allQuizIds, 30)) {
        const quizSnap = await getDocs(query(collection(db, 'quizzes'), where(documentId(), 'in', chunkIds)));
        quizSnap.forEach(d => quizMap.set(d.id, d.data() as Quiz));
      }
    }
    quizResultsSnap.forEach(d => {
        const data = d.data() as UserQuizResult;
        const quiz = quizMap.get(data.quizId);
        allRecords.push({ id: d.id, name: quiz?.title || data.quizId, date: (data.attemptedAt as Timestamp).toDate(), type: 'Quiz', progress: data.score, docRefPath: d.ref.path });
    });

    // Form Submissions
    const formSubmissionsQuery = query(collectionGroup(db, 'submissions'), where('userId', '==', user.id));
    const formSubmissionsSnap = await getDocs(formSubmissionsQuery);
     formSubmissionsSnap.forEach(d => {
        const data = d.data();
        const course = courses.find(c => c.id === data.courseId);
        allRecords.push({ id: d.id, name: `Form in ${course?.title || 'course'}`, date: (data.submittedAt as Timestamp).toDate(), type: 'Form', docRefPath: d.ref.path });
    });


    setRecords(allRecords.sort((a, b) => b.date.getTime() - a.date.getTime()));
    setLoading(false);
  }, [user, db, courses]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleDeleteSelected = async () => {
    if (selectedRecordIds.length === 0) return;
    const batch = writeBatch(db);
    selectedRecordIds.forEach(recordId => {
      const record = records.find(r => r.id === recordId);
      if (record) {
        batch.delete(doc(db, record.docRefPath));
      }
    });

    try {
      await batch.commit();
      toast({ title: "Records deleted" });
      setSelectedRecordIds([]);
      fetchRecords();
      onRefresh();
    } catch (error) {
      toast({ variant: 'destructive', title: "Failed to delete records" });
    }
  };

  const handleToggleSelection = (recordId: string) => {
    setSelectedRecordIds(prev =>
      prev.includes(recordId) ? prev.filter(id => id !== recordId) : [...prev, recordId]
    );
  };
  
   const handleToggleAllOnPage = () => {
        if (selectedRecordIds.length === records.length) {
            setSelectedRecordIds([]);
        } else {
            setSelectedRecordIds(records.map(r => r.id));
        }
    };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                 <CardTitle>5. All User Records</CardTitle>
                 <CardDescription>A complete log of this user's enrollments and completions.</CardDescription>
            </div>
            {selectedRecordIds.length > 0 && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedRecordIds.length})
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete {selectedRecordIds.length} record(s). This might affect user progress and cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteSelected}>Delete Records</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-2">
            <Checkbox id="select-all-records" onCheckedChange={handleToggleAllOnPage} checked={records.length > 0 && selectedRecordIds.length === records.length} />
            <Label htmlFor="select-all-records" className="text-sm font-medium">Select all</Label>
        </div>
        <ScrollArea className="h-64">
          {loading ? <Skeleton className="h-24" /> : records.length === 0 ? <p className="text-muted-foreground">No records found for this user.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Progress/Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec) => (
                  <TableRow key={rec.id} data-state={selectedRecordIds.includes(rec.id) && 'selected'}>
                    <TableCell><Checkbox checked={selectedRecordIds.includes(rec.id)} onCheckedChange={() => handleToggleSelection(rec.id)} /></TableCell>
                    <TableCell>{rec.name}</TableCell>
                    <TableCell><Badge variant={rec.type === 'On-site' ? 'secondary' : 'outline'}>{rec.type}</Badge></TableCell>
                    <TableCell>{format(rec.date, 'PPP')}</TableCell>
                    <TableCell>{rec.progress !== undefined ? `${rec.progress}%` : 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};


export default function CourseCreditManager() {
    const [users, setUsers] = useState<User[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [ladders, setLadders] = useState<Ladder[]>([]);
    const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [existingProgress, setExistingProgress] = useState({ videos: new Set<string>(), quizzes: new Set<string>(), forms: new Set<string>() });

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

    const db = getFirebaseFirestore();
    const { toast } = useToast();
    const { user: adminUser, hasPermission, canViewAllCampuses } = useAuth();

    const canManage = hasPermission('manageCourseCredit');

    const fetchData = useCallback(async () => {
        if (!canManage) { setLoading(false); return; }
        setLoading(true);
        try {
            const [usersSnap, coursesSnap, laddersSnap, campusesSnap] = await Promise.all([
                getDocs(query(collection(db, "users"), orderBy("displayName"))),
                getDocs(query(collection(db, "courses"), where("status", "==", "published"), orderBy("title"))),
                getDocs(query(collection(db, 'courseLevels'), orderBy('order'))),
                getDocs(query(collection(db, "Campus"), orderBy("Campus Name"))),
            ]);
            setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
            setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
            setLadders(laddersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ladder)));
            setAllCampuses(campusesSnap.docs.map(d => ({id: d.id, ...d.data()} as Campus)));
        } catch (e) {
            toast({ variant: "destructive", title: "Failed to load data" });
        } finally {
            setLoading(false);
        }
    }, [db, toast, canManage]);

    const fetchExistingProgress = useCallback(async () => {
        if (!selectedUser || !selectedCourse) {
            setExistingProgress({ videos: new Set(), quizzes: new Set(), forms: new Set() });
            return;
        }
        try {
            const videoProgressSnap = await getDoc(doc(db, "userVideoProgress", `${selectedUser.id}_${selectedCourse.id}`));
            const completedVideos = new Set(
                videoProgressSnap.exists() ? (videoProgressSnap.data() as UserProgress).videoProgress.filter(p => p.completed).map(p => p.videoId) : []
            );

            const quizResultsSnap = await getDocs(query(collection(db, "userQuizResults"), where("userId", "==", selectedUser.id), where("courseId", "==", selectedCourse.id), where("passed", "==", true)));
            const completedQuizzes = new Set(quizResultsSnap.docs.map(d => (d.data() as UserQuizResult).quizId));

            let completedForms = new Set<string>();
            if(selectedCourse.formId) {
                const formSubmissionsSnap = await getDocs(query(collection(db, "forms", selectedCourse.formId, "submissions"), where("userId", "==", selectedUser.id), where("courseId", "==", selectedCourse.id)));
                if (!formSubmissionsSnap.empty) {
                    completedForms.add(selectedCourse.formId);
                }
            }

            setExistingProgress({ videos: completedVideos, quizzes: completedQuizzes, forms: completedForms });
        } catch (error) {
            console.error("Error fetching existing progress:", error);
        }
    }, [selectedUser, selectedCourse, db]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchExistingProgress();
    }, [fetchExistingProgress]);

    const handleItemToggle = (id: string, type: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            const key = `${type}_${id}`;
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleSaveCredit = async () => {
        if (!selectedUser || !selectedCourse || selectedItems.size === 0) {
            toast({ variant: 'destructive', title: 'Selection Missing', description: 'Please select a user, a course, and at least one item to credit.' });
            return;
        }
        setIsSaving(true);
        try {
            await runTransaction(db, async (transaction) => {
                const progressRef = doc(db, "userVideoProgress", `${selectedUser.id}_${selectedCourse.id}`);
                const progressDoc = await transaction.get(progressRef);
                const currentProgressData = progressDoc.exists() ? progressDoc.data() as UserProgress : { userId: selectedUser.id, courseId: selectedCourse.id, videoProgress: [] };

                const updatedVideoProgress = [...(currentProgressData.videoProgress || [])];
                const creditedVideos: string[] = [];
                const creditedQuizzes: string[] = [];
                let creditedForm: { formId: string, submissionId: string } | null = null;
                
                for (const item of selectedItems) {
                    if (item.startsWith('video_')) {
                        const videoId = item.replace('video_', '');
                        const video = (await getDoc(doc(db, 'Contents', videoId))).data() as Video;
                        const duration = video?.duration || 0;
                        const existingVpIndex = updatedVideoProgress.findIndex(vp => vp.videoId === videoId);
                        if (existingVpIndex > -1) {
                            updatedVideoProgress[existingVpIndex] = { ...updatedVideoProgress[existingVpIndex], completed: true, timeSpent: duration };
                        } else {
                            updatedVideoProgress.push({ videoId, timeSpent: duration, completed: true });
                        }
                        creditedVideos.push(videoId);
                    } else if (item.startsWith('quiz_')) {
                        const quizId = item.replace('quiz_', '');
                        const quizResultRef = doc(db, 'userQuizResults', `${selectedUser.id}_${selectedCourse.id}_${quizId}_manual`);
                        transaction.set(quizResultRef, {
                            userId: selectedUser.id, courseId: selectedCourse.id, quizId,
                            answers: { manualCredit: true }, score: 100, passed: true,
                            attemptedAt: serverTimestamp(), source: 'manual_credit'
                        });
                        creditedQuizzes.push(quizId);
                    } else if (item.startsWith('form_')) {
                        const formId = item.replace('form_', '');
                        const submissionRef = doc(collection(db, 'forms', formId, 'submissions'));
                        transaction.set(submissionRef, {
                            userId: selectedUser.id, courseId: selectedCourse.id, formId,
                            submittedAt: serverTimestamp(), source: 'manual_credit', data: { manualCredit: true }
                        });
                        creditedForm = { formId, submissionId: submissionRef.id };
                    }
                }
                
                const totalVideos = selectedCourse.videos?.length || 0;
                const completedCount = updatedVideoProgress.filter(vp => vp.completed).length;
                const totalProgress = totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;
                
                transaction.set(progressRef, {
                    ...currentProgressData,
                    videoProgress: updatedVideoProgress,
                    totalProgress: totalProgress,
                    percent: totalProgress,
                    lastWatchedVideoId: updatedVideoProgress[updatedVideoProgress.length-1]?.videoId,
                    updatedAt: serverTimestamp()
                }, { merge: true });

                const completionRef = doc(collection(db, 'onsiteCompletions'));
                transaction.set(completionRef, {
                    userId: selectedUser.id,
                    userName: selectedUser.displayName,
                    userCampus: selectedUser.campus,
                    courseId: selectedCourse.id,
                    courseName: selectedCourse.title,
                    completedAt: serverTimestamp(),
                    markedBy: adminUser?.displayName,
                    source: 'manual_credit',
                    creditedVideos,
                    creditedQuizzes,
                    creditedForm,
                });
            });

            toast({ title: 'Credit Granted', description: `Progress for ${selectedUser.displayName} has been updated.`});
            setSelectedItems(new Set());
            fetchExistingProgress(); // Refresh progress for current view

        } catch (error: any) {
            console.error("Error granting credit: ", error);
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    useEffect(() => {
        setSelectedItems(new Set());
    }, [selectedUser, selectedCourse]);

    if (!canManage) {
        return (
            <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>You do not have permission to manage course credits.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <UserSearch users={users} onSelectUser={setSelectedUser} selectedUser={selectedUser} loading={loading} />
                <CoursePicker courses={courses} onSelectCourse={setSelectedCourse} selectedCourse={selectedCourse} user={selectedUser} loading={loading} />
            </div>
            <CourseContentSection
                course={selectedCourse}
                loading={loading}
                selectedItems={selectedItems}
                onItemToggle={handleItemToggle}
                onSave={handleSaveCredit}
                isSaving={isSaving}
                existingProgress={existingProgress}
            />
            <RecordsSection 
                onRefresh={fetchData} 
                adminUser={adminUser} 
                canViewAllCampuses={canViewAllCampuses} 
                allCampuses={allCampuses} 
                courses={courses} 
                users={users} 
                ladders={ladders} 
                selectedUser={selectedUser}
                onLogDeleted={fetchExistingProgress}
            />
            {selectedUser && <AllUserRecords user={selectedUser} courses={courses} ladders={ladders} onRefresh={fetchExistingProgress} />}
        </div>
    );
}
