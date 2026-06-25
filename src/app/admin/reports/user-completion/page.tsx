
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, collectionGroup, doc, getDoc, Timestamp } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, Search, ListFilter, Shield, BookOpen, CheckCircle2, Globe, ChevronLeft, ChevronRight, Info, XCircle, X as XIcon, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { User, Course, Ladder, UserProgress, UserQuizResult, OnsiteCompletion, Enrollment } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import allLanguagesList from "@/lib/languages.json";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";

interface Campus {
  id: string;
  "Campus Name": string;
}

const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase();
};

const cleanNativeName = (name: string) => {
    if (!name) return "";
    const firstPart = name.split(/[;,]/)[0].trim();
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
};

export default function UserCompletionReport() {
  const { user: currentUser, canViewAllCampuses, hasPermission } = useAuth();
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [publishedLanguages, setPublishedLanguages] = useState<{id: string, name: string}[]>([]);
  
  const [userCompletionsMap, setUserCompletionsMap] = useState<Map<string, Set<string>>>(new Map());
  const [completionDatesMap, setCompletionDatesMap] = useState<Map<string, Map<string, Date>>>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedExportFields, setSelectedExportFields] = useState<string[]>(['firstName', 'lastName', 'email', 'ladderName', 'progressPercent']);

  const [selectedLadder, setSelectedLadder] = useState<string>('all');
  const [selectedBaptism, setSelectedBaptism] = useState<string>('all');
  const [selectedGraduation, setSelectedGraduation] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [minCompletedCount, setMinCompletedCount] = useState<number>(0);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [viewingUserDetails, setViewingUserDetails] = useState<any | null>(null);
  const [isDetailedLoading, setIsDetailedLoading] = useState(false);
  const [detailedUserCompletions, setDetailedUserCompletions] = useState<Set<string>>(new Set());

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCampus !== 'all') count++;
    if (selectedCourse !== 'all') count++;
    if (selectedLadder !== 'all') count++;
    if (selectedBaptism !== 'all') count++;
    if (selectedGraduation !== 'all') count++;
    if (selectedLanguage !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    if (minCompletedCount > 0) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [selectedCampus, selectedCourse, selectedLadder, selectedBaptism, selectedGraduation, selectedLanguage, selectedStatus, minCompletedCount, dateFrom, dateTo]);

  const db = getFirebaseFirestore();
  const { toast } = useToast();

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
    { id: 'ladderName', label: 'Membership Ladder' },
    { id: 'charge', label: 'Charge' },
    { id: 'graduationStatus', label: 'Graduation status' },
    { id: 'graduationDate', label: 'Graduation Date' },
    { id: 'totalInLadder', label: 'Courses in Ladder' },
    { id: 'completedInLadder', label: 'Courses Completed' },
    { id: 'progressPercent', label: 'Progress %' },
  ];

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Campus filtering: if user doesn't have view-all permission and has a campus (not All Campuses),
      // only load users from their campus (same logic as user management page)
      let usersQuery = collection(db, 'users');
      if (!canViewAllCampuses && currentUser?.campus && currentUser.campus !== 'All Campuses') {
          usersQuery = query(usersQuery, where('campus', '==', currentUser.campus));
      }

      const [usersSnap, coursesSnap, laddersSnap, progressSnap, campusesSnap, enrollSnap, onsiteSnap, videoProgressSnap, quizResultsSnap, languagesSnap] = await Promise.all([
        getDocs(usersQuery),
        getDocs(query(collection(db, 'courses'), where('status', '==', 'published'))),
        getDocs(query(collection(db, 'courseLevels'), orderBy('order'))),
        getDocs(collection(db, 'userContentProgress')),
        getDocs(collection(db, 'Campus')),
        getDocs(query(collection(db, 'enrollments'), where('completedAt', '!=', null))),
        getDocs(collection(db, 'onsiteCompletions')),
        getDocs(collection(db, 'userVideoProgress')),
        getDocs(query(collection(db, 'userQuizResults'), where('passed', '==', true))),
        getDocs(query(collection(db, 'languages'), where('status', '==', 'published'))),
      ]);

      const cmap = new Map<string, Set<string>>();
      const dateMap = new Map<string, Map<string, Date>>();
      const addComp = (uid: string, cid: string) => {
          if(!cmap.has(uid)) cmap.set(uid, new Set());
          cmap.get(uid)!.add(cid);
      };
      const trackDate = (uid: string, cid: string, date: Date | null) => {
          if (!date) return;
          if (!dateMap.has(uid)) dateMap.set(uid, new Map());
          const existing = dateMap.get(uid)!.get(cid);
          if (!existing || date > existing) {
              dateMap.get(uid)!.set(cid, date);
          }
      };

      // 1. One Source of Truth: New global model
      progressSnap.forEach(doc => {
          const items = doc.data().completedItems || {};
          Object.entries(items).forEach(([cid, val]) => {
              addComp(doc.id, cid);
              const ts = (val as Timestamp)?.toDate ? (val as Timestamp).toDate() : null;
              trackDate(doc.id, cid, ts);
          });
      });

      // 2. Legacy enrollments and onsite
      enrollSnap.forEach(d => {
          addComp(d.data().userId, d.data().courseId);
          const ts = d.data().completedAt?.toDate ? d.data().completedAt.toDate() : null;
          trackDate(d.data().userId, d.data().courseId, ts);
      });
      onsiteSnap.forEach(d => {
          addComp(d.data().userId, d.data().courseId);
          const ts = d.data().completedAt?.toDate ? d.data().completedAt.toDate() : null;
          trackDate(d.data().userId, d.data().courseId, ts);
      });

      // 3. Fallback data preparation (deferred execution to avoid blocking render)
      const passedQuizzes = new Map<string, Set<string>>();
      quizResultsSnap.forEach(d => {
          const r = d.data();
          if(!passedQuizzes.has(r.userId)) passedQuizzes.set(r.userId, new Set());
          passedQuizzes.get(r.userId)!.add(r.quizId);
      });

      const videoDone = new Map<string, Set<string>>();
      videoProgressSnap.forEach(d => {
          const data = d.data();
          const uid = data.userId;
          if(!videoDone.has(uid)) videoDone.set(uid, new Set());
          data.videoProgress?.forEach((vp: any) => { if(vp.completed) videoDone.get(uid)!.add(vp.videoId); });
      });

      const coursesList = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));

      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      setCourses(coursesList);
      setLadders(laddersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder)));
      setCampuses(campusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus)));
      setPublishedLanguages(languagesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));

      // Set primary completion data immediately so the UI can render
      setUserCompletionsMap(cmap);
      setCompletionDatesMap(dateMap);
      setIsLoading(false);

      // Deferred fallback verification - runs after render to avoid blocking
      setTimeout(() => {
          const fallbackMap = new Map<string, Set<string>>();
          cmap.forEach((v, k) => fallbackMap.set(k, new Set(v)));

          usersSnap.docs.forEach(uDoc => {
              const uid = uDoc.id;
              const myPassedQuizzes = passedQuizzes.get(uid) || new Set();
              const myVideoDone = videoDone.get(uid) || new Set();

              coursesList.forEach(c => {
                  if(fallbackMap.get(uid)?.has(c.id)) return;
                  const vOk = (c.videos || []).every(id => myVideoDone.has(id));
                  const qOk = (c.quizIds || []).every(id => myPassedQuizzes.has(id));
                  if(vOk && qOk && ((c.videos?.length || 0) > 0 || (c.quizIds?.length || 0) > 0)) {
                      if(!fallbackMap.has(uid)) fallbackMap.set(uid, new Set());
                      fallbackMap.get(uid)!.add(c.id);
                  }
              });
          });
          // Only update if fallback found additional completions
          if (fallbackMap.size > cmap.size) {
              setUserCompletionsMap(fallbackMap);
          }
      }, 100);

    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({ title: 'Error', description: 'Failed to fetch report data.', variant: 'destructive' });
      setIsLoading(false);
    }
  }, [db, toast, canViewAllCampuses, currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const reportData = useMemo(() => {
    let result = users.map(user => {
        const ladder = ladders.find(l => l.id === user.classLadderId);
        const ladderName = ladder ? ladder.name : 'N/A';
        const ladderCourses = courses.filter(c => 
            c.ladderIds?.includes(user.classLadderId || '') && 
            (!user.language || c.language === user.language)
        );

        const completions = userCompletionsMap.get(user.id) || new Set();
        const completedCount = ladderCourses.filter(c => completions.has(c.id)).length;

        return {
            ...user,
            ladderName,
            totalInLadder: ladderCourses.length,
            completedInLadder: completedCount,
            progressPercent: ladderCourses.length > 0 ? Math.round((completedCount / ladderCourses.length) * 100) : 0
        };
    });

    if (searchTerm) {
        const q = searchTerm.toLowerCase();
        result = result.filter(u => 
            (u.displayName || "").toLowerCase().includes(q) || 
            (u.email || "").toLowerCase().includes(q) ||
            (u.campus || "").toLowerCase().includes(q)
        );
    }

    if (selectedCampus !== 'all') {
        const campus = campuses.find(c => c.id === selectedCampus);
        if (campus) result = result.filter(u => u.campus === campus["Campus Name"]);
    }

    if (selectedCourse !== 'all') {
        const course = courses.find(c => c.id === selectedCourse);
        result = result.filter(u => course?.ladderIds?.includes(u.classLadderId || ''));
    }
    
    if (selectedLadder !== 'all') {
        result = result.filter(u => u.classLadderId === selectedLadder);
    }
    
    if (selectedBaptism !== 'all') {
        const isBaptized = selectedBaptism === 'true';
        result = result.filter(u => !!u.isBaptized === isBaptized);
    }
    
    if (selectedGraduation !== 'all') {
        result = result.filter(u => (u.graduationStatus || 'Empty (Not Set)') === selectedGraduation);
    }
    
    if (selectedLanguage !== 'all') {
        result = result.filter(u => u.language === selectedLanguage);
    }

    if (selectedStatus === 'completed') {
        result = result.filter(u => u.progressPercent === 100);
    } else if (selectedStatus === 'in-progress') {
        result = result.filter(u => u.progressPercent < 100);
    }
    
    if (minCompletedCount > 0) {
        result = result.filter(u => u.completedInLadder >= minCompletedCount);
    }

    // Date range filter: keep users who have a completion within the date window
    if (dateFrom || dateTo) {
        const fromDate = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
        const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;
        result = result.filter(u => {
            const userDates = completionDatesMap.get(u.id);
            if (!userDates) return false;
            for (const d of userDates.values()) {
                if (fromDate && d < fromDate) continue;
                if (toDate && d > toDate) continue;
                return true; // at least one completion in range
            }
            return false;
        });
    }

    return result.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  }, [users, courses, ladders, userCompletionsMap, completionDatesMap, searchTerm, selectedCampus, selectedCourse, campuses, selectedLadder, selectedBaptism, selectedGraduation, selectedLanguage, selectedStatus, minCompletedCount, dateFrom, dateTo]);

  const paginatedData = useMemo(() => {
    return reportData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [reportData, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(reportData.length / rowsPerPage);

  const getNativeName = (dbName: string) => {
    const lang = allLanguagesList.find(l => l.name === dbName || l.code === dbName);
    return lang ? cleanNativeName(lang.nativeName) : dbName;
  }

  const handleUserClick = async (user: any) => {
    setViewingUserDetails(user);
    setIsDetailedLoading(true);
    try {
        const userId = user.id;
        const [enrollSnap, onsiteSnap, progressSnap, quizSnap, globalSnap, formSnap] = await Promise.all([
            getDocs(query(collection(db, 'enrollments'), where('userId', '==', userId))),
            getDocs(query(collection(db, 'onsiteCompletions'), where('userId', '==', userId))),
            getDocs(query(collection(db, 'userVideoProgress'), where('userId', '==', userId))),
            getDocs(query(collection(db, 'userQuizResults'), where('userId', '==', userId), where('passed', '==', true))),
            getDoc(doc(db, "userContentProgress", userId)),
            getDocs(query(collectionGroup(db, 'submissions'), where('userId', '==', userId)))
        ]);

        const completedIds = new Set<string>();
        
        onsiteSnap.forEach(d => completedIds.add(d.data().courseId));
        enrollSnap.forEach(d => { if (d.data().completedAt) completedIds.add(d.data().courseId); });
        if (globalSnap.exists()) {
            const gItems = globalSnap.data().completedItems || {};
            Object.keys(gItems).forEach(id => completedIds.add(id));
        }

        const videoDone = new Set<string>();
        progressSnap.forEach(d => d.data().videoProgress?.forEach((vp: any) => { if (vp.completed) videoDone.add(vp.videoId); }));
        const quizzesDone = new Set(quizSnap.docs.map(d => d.data().quizId));
        const formsDone = new Set(formSnap.docs.map(d => d.data().formId));

        // Sync everything to the detailed set
        quizzesDone.forEach(id => completedIds.add(id));
        formsDone.forEach(id => completedIds.add(id));
        videoDone.forEach(id => completedIds.add(id));

        courses.forEach(c => {
            if (completedIds.has(c.id)) return;
            const vOk = (c.videos || []).every(id => videoDone.has(id));
            const qOk = (c.quizIds || []).every(id => quizzesDone.has(id));
            const fOk = !c.formId || formsDone.has(c.formId);
            if (vOk && qOk && fOk && ((c.videos?.length || 0) > 0 || (c.quizIds?.length || 0) > 0 || c.formId)) {
                completedIds.add(c.id);
            }
        });

        setDetailedUserCompletions(completedIds);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch detailed records.' });
    } finally {
        setIsDetailedLoading(false);
    }
  };

  const getUserCourseBreakdown = () => {
    if (!viewingUserDetails) return [];
    return courses
        .filter(c => c.ladderIds?.includes(viewingUserDetails.classLadderId || '') && (!viewingUserDetails.language || c.language === viewingUserDetails.language))
        .map(c => ({
            id: c.id,
            title: c.title,
            isCompleted: detailedUserCompletions.has(c.id)
        }))
        .sort((a,b) => a.title.localeCompare(b.title));
  };

  const handleExportCSV = () => {
    if (selectedExportFields.length === 0) {
        toast({ variant: 'destructive', title: 'Selection Missing', description: 'Please select at least one field to export.' });
        return;
    }
    const csvData = reportData.map(u => {
        const row: any = {};
        selectedExportFields.forEach(fieldId => {
            const val = (u as any)[fieldId];
            row[exportFields.find(f => f.id === fieldId)?.label || fieldId] = val ?? '';
        });
        return row;
    });
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `completions_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    setIsExportDialogOpen(false);
  };

  if (!isClient) return null;

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
                <CardTitle>{t('reports.user_completion.title', "Completions")}</CardTitle>
                <CardDescription>
                    {t('reports.user_completion.description', "Track student completion across courses and ladders.")}
                    {" "}
                    ({reportData.length} students matching current filters)
                </CardDescription>
            </div>
            <div className="flex gap-2">
                <Button onClick={() => setIsExportDialogOpen(true)} variant="outline" disabled={isLoading || reportData.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
            </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search by student name or campus..." 
                    className="pl-10 h-10"
                    value={searchTerm} 
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                />
            </div>
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" className="relative h-10">
                        <ListFilter className="mr-2 h-4 w-4" /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Filter Report</SheetTitle>
                        <SheetDescription>Narrow down the students in this report.</SheetDescription>
                    </SheetHeader>
                    <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
                        <div className="space-y-2">
                            <Label>Campus</Label>
                            <Select value={selectedCampus} onValueChange={(v) => { setSelectedCampus(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All Campuses" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Campuses</SelectItem>
                                    {campuses.map(campus => <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Course Track Ladder</Label>
                            <Select value={selectedLadder} onValueChange={(v) => { setSelectedLadder(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All Ladders" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Ladders</SelectItem>
                                    {ladders.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.side})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Baptism</Label>
                            <Select value={selectedBaptism} onValueChange={(v) => { setSelectedBaptism(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="true">Baptized (Yes)</SelectItem>
                                    <SelectItem value="false">Not Baptized (No)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Graduation Status</Label>
                            <Select value={selectedGraduation} onValueChange={(v) => { setSelectedGraduation(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    {graduationOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Language</Label>
                            <Select value={selectedLanguage} onValueChange={(v) => { setSelectedLanguage(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All Languages" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Languages</SelectItem>
                                    {publishedLanguages.map(lang => {
                                        const langInfo = allLanguagesList.find(l => l.code === lang.id);
                                        const displayName = langInfo ? cleanNativeName(langInfo.nativeName) : lang.name;
                                        return <SelectItem key={lang.id} value={lang.name}>{displayName}</SelectItem>
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Completed Between</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                                    className="w-full"
                                />
                                <span className="text-muted-foreground">-</span>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                                    className="w-full"
                                />
                                {(dateFrom || dateTo) && (
                                    <Button variant="ghost" size="icon" onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}>
                                        <XIcon className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Completion Status</Label>
                            <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="completed">Completed (100%)</SelectItem>
                                    <SelectItem value="in-progress">In Progress (&lt; 100%)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Completed Courses (Min)</Label>
                            <Select value={String(minCompletedCount)} onValueChange={(v) => { setMinCompletedCount(Number(v)); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Any amount" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Any amount</SelectItem>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 30, 40, 50].map(val => (
                                        <SelectItem key={val} value={String(val)}>{val}{val >= 20 ? '+' : ''} or more</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <SheetFooter className="flex flex-col gap-2 mt-4 border-t pt-4">
                        <Button variant="ghost" className="w-full" onClick={() => { 
                            setSelectedCampus('all'); 
                            setSelectedCourse('all'); 
                            setSelectedLadder('all');
                            setSelectedBaptism('all');
                            setSelectedGraduation('all');
                            setSelectedLanguage('all');
                            setSelectedStatus('all');
                            setMinCompletedCount(0);
                            setDateFrom('');
                            setDateTo('');
                            setCurrentPage(1); 
                        }}>
                            Reset Filters
                        </Button>
                        <SheetClose asChild>
                            <Button className="w-full">Apply Filters</Button>
                        </SheetClose>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>{t('reports.user_completion.table.student', 'Student')}</TableHead>
                    <TableHead>{t('reports.user_completion.table.ladder', 'Class Ladder')}</TableHead>
                    <TableHead>{t('reports.user_completion.table.language', 'Language')}</TableHead>
                    <TableHead className="text-center">{t('reports.user_completion.table.baptism', 'Baptism')}</TableHead>
                    <TableHead>{t('reports.user_completion.table.graduation', 'Graduation')}</TableHead>
                    <TableHead className="text-center">{t('reports.user_completion.table.courses', '# Courses')}</TableHead>
                    <TableHead className="text-center">{t('reports.user_completion.table.completed', 'Completed')}</TableHead>
                    <TableHead>{t('reports.user_completion.table.progress', 'Progress')}</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {paginatedData.map((row) => (
                    <TableRow key={row.id}>
                    <TableCell>
                        <div className="flex items-center gap-3 cursor-pointer group/user" onClick={() => handleUserClick(row)}>
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={row.photoURL || undefined} />
                                <AvatarFallback>{getInitials(row.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="max-w-[200px] truncate">
                                <p className="font-medium truncate group-hover/user:underline">{row.displayName || `${row.firstName} ${row.lastName}`}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{row.email}</p>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell><div className="flex items-center gap-2"><Shield className="h-3 w-3 text-muted-foreground" /><span className="text-xs font-medium">{row.ladderName}</span></div></TableCell>
                    <TableCell><div className="flex items-center gap-2"><Globe className="h-3 w-3 text-muted-foreground" /><span className="text-[10px]">{row.language ? getNativeName(row.language) : 'N/A'}</span></div></TableCell>
                    <TableCell className="text-center">
                        {row.isBaptized ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Yes</Badge>
                        ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">No</Badge>
                        )}
                    </TableCell>
                    <TableCell>
                        <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                            {row.graduationStatus || 'Not Set'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">{row.totalInLadder}</TableCell>
                    <TableCell className="text-center font-mono text-primary font-bold text-sm">{row.completedInLadder}</TableCell>
                    <TableCell className="min-w-[120px]"><div className="space-y-1"><div className="flex justify-between text-[9px] font-bold"><span>{row.progressPercent}%</span></div><Progress value={row.progressPercent} className="h-1" /></div></TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {totalPages > 1 && (
        <CardFooter className="flex justify-end items-center gap-4 border-t p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select value={`${rowsPerPage}`} onValueChange={(val) => { setRowsPerPage(Number(val)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{[10, 20, 50, 100].map(size => <SelectItem key={size} value={`${size}`}>{size}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
            </div>
        </CardFooter>
      )}
    </Card>

    <Dialog open={!!viewingUserDetails} onOpenChange={() => setViewingUserDetails(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>{t('reports.user_completion.dialog.title', 'Course Breakdown: {{name}}').replace('{{name}}', viewingUserDetails?.displayName || '')}</DialogTitle>
                <DialogDescription>{t('reports.user_completion.dialog.description', 'Reviewing required courses for the {{ladder}} ladder.').replace('{{ladder}}', viewingUserDetails?.ladderName || '')} ({viewingUserDetails?.language || 'No language set'}).</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] mt-4">
                <div className="space-y-3 p-1">
                    {isDetailedLoading ? (
                        <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
                    ) : getUserCourseBreakdown().length > 0 ? (
                        getUserCourseBreakdown().map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                                <div className="flex items-center gap-3">
                                    {item.isCompleted ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />}
                                    <span className="text-sm font-medium">{item.title}</span>
                                </div>
                                <Badge variant={item.isCompleted ? "default" : "outline"} className="text-[10px]">{item.isCompleted ? 'Completed' : 'Pending'}</Badge>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed"><BookOpen className="h-8 w-8 mx-auto mb-2 opacity-20" /><p>No courses found for this student's ladder track.</p></div>
                    )}
                </div>
            </ScrollArea>
            <DialogFooter>
                <Button onClick={() => setViewingUserDetails(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Export Students</DialogTitle>
                <DialogDescription>Select the fields you want to include in the completion report CSV.</DialogDescription>
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
    </>
  );
}
