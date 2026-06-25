
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, collectionGroup } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, Search, ListFilter, Shield, BookOpen, CheckCircle2, Globe, ChevronLeft, ChevronRight, Info } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { User, Course, Ladder, UserProgress, UserQuizResult } from '@/lib/types';
import { Progress } from './ui/progress';
import allLanguagesList from "@/lib/languages.json";

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
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  
  // High-performance data maps
  const [userCompletionsMap, setUserCompletionsMap] = useState<Map<string, Set<string>>>(new Map());
  const [userVideoCompletionsMap, setUserVideoCompletionsMap] = useState<Map<string, Set<string>>>(new Map());
  const [userQuizCompletionsMap, setUserQuizCompletionsMap] = useState<Map<string, Set<string>>>(new Map());
  const [formSubmissionsMap, setFormSubmissionsMap] = useState<Map<string, Set<string>>>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const db = getFirebaseFirestore();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch metadata in parallel
      const [usersSnap, coursesSnap, laddersSnap, progressSnap, campusesSnap, videoProgressSnap, quizResultsSnap, formSubmissionsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'courses'), where('status', '==', 'published'))),
        getDocs(query(collection(db, 'courseLevels'), orderBy('order'))),
        getDocs(collection(db, 'userContentProgress')),
        getDocs(collection(db, 'Campus')),
        getDocs(collection(db, 'userVideoProgress')),
        getDocs(query(collection(db, 'userQuizResults'), where('passed', '==', true))),
        getDocs(collectionGroup(db, 'submissions'))
      ]);

      // 2. Build completion sets for every user
      const cmap = new Map<string, Set<string>>();
      progressSnap.forEach(doc => {
          cmap.set(doc.id, new Set(Object.keys(doc.data().completedItems || {})));
      });

      const vmap = new Map<string, Set<string>>();
      videoProgressSnap.forEach(doc => {
          const data = doc.data() as UserProgress;
          if (!vmap.has(data.userId)) vmap.set(data.userId, new Set());
          data.videoProgress?.forEach(vp => {
              if (vp.completed) vmap.get(data.userId)!.add(vp.videoId);
          });
      });

      const qmap = new Map<string, Set<string>>();
      quizResultsSnap.forEach(doc => {
          const data = doc.data() as UserQuizResult;
          if (!qmap.has(data.userId)) qmap.set(data.userId, new Set());
          qmap.get(data.userId)!.add(data.quizId);
      });

      const fmap = new Map<string, Set<string>>();
      formSubmissionsSnap.forEach(doc => {
          const data = doc.data();
          if (data.userId && data.formId) {
              if (!fmap.has(data.userId)) fmap.set(data.userId, new Set());
              fmap.get(data.userId)!.add(data.formId);
          }
      });

      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      setLadders(laddersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder)));
      setCampuses(campusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus)));
      
      setUserCompletionsMap(cmap);
      setUserVideoCompletionsMap(vmap);
      setUserQuizCompletionsMap(qmap);
      setFormSubmissionsMap(fmap);

    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({ title: 'Error', description: 'Failed to fetch accurate report data.', variant: 'destructive' });
    }
    setIsLoading(false);
  }, [db, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const reportData = useMemo(() => {
    let result = users.map(user => {
        const ladder = ladders.find(l => l.id === user.classLadderId);
        const ladderName = ladder ? ladder.name : 'N/A';
        
        // Find courses belonging to this student's ladder and matching their chosen language
        const ladderCourses = courses.filter(c => 
            c.ladderIds?.includes(user.classLadderId || '') && 
            (!user.language || c.language === user.language)
        );

        const globalCompletions = userCompletionsMap.get(user.id) || new Set();
        const videoCompletions = userVideoCompletionsMap.get(user.id) || new Set();
        const quizCompletions = userQuizCompletionsMap.get(user.id) || new Set();
        const formCompletions = formSubmissionsMap.get(user.id) || new Set();
        
        let completedCount = 0;
        
        ladderCourses.forEach(course => {
            // Check if course is completed via Global Sync
            if (globalCompletions.has(course.id)) {
                completedCount++;
                return;
            }

            // Fallback: Verify all specific content items manually
            const requiredVideos = course.videos || [];
            const requiredQuizzes = course.quizIds || [];
            const requiredForm = course.formId;

            const videosFinished = requiredVideos.every(id => videoCompletions.has(id));
            const quizzesFinished = requiredQuizzes.every(id => quizCompletions.has(id));
            const formFinished = !requiredForm || formCompletions.has(requiredForm);

            if (videosFinished && quizzesFinished && formFinished && (requiredVideos.length > 0 || requiredQuizzes.length > 0 || requiredForm)) {
                completedCount++;
            }
        });

        return {
            ...user,
            ladderName,
            totalInLadder: ladderCourses.length,
            completedInLadder: completedCount,
            progressPercent: ladderCourses.length > 0 ? Math.round((completedCount / ladderCourses.length) * 100) : 0
        };
    });

    // Apply Search
    if (searchTerm) {
        const q = searchTerm.toLowerCase();
        result = result.filter(u => 
            (u.displayName || "").toLowerCase().includes(q) || 
            (u.email || "").toLowerCase().includes(q) ||
            (u.campus || "").toLowerCase().includes(q)
        );
    }

    // Apply Campus Filter
    if (selectedCampus !== 'all') {
        const campus = campuses.find(c => c.id === selectedCampus);
        if (campus) {
            result = result.filter(u => u.campus === campus["Campus Name"]);
        }
    }

    // Apply specific course context filter
    if (selectedCourse !== 'all') {
        const course = courses.find(c => c.id === selectedCourse);
        result = result.filter(u => course?.ladderIds?.includes(u.classLadderId || ''));
    }

    // Alphabetic sort
    return result.sort((a, b) => {
        const nameA = (a.displayName || `${a.firstName} ${a.lastName}`).toLowerCase();
        const nameB = (b.displayName || `${b.firstName} ${b.lastName}`).toLowerCase();
        return nameA.localeCompare(nameB);
    });
  }, [users, courses, ladders, userCompletionsMap, userVideoCompletionsMap, userQuizCompletionsMap, formSubmissionsMap, searchTerm, selectedCampus, selectedCourse, campuses]);

  const paginatedData = useMemo(() => {
    return reportData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [reportData, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(reportData.length / rowsPerPage);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCampus !== 'all') count++;
    if (selectedCourse !== 'all') count++;
    return count;
  }, [selectedCampus, selectedCourse]);

  const handleExport = () => {
    const csvData = reportData.map(row => ({
        "First Name": row.firstName || "",
        "Last Name": row.lastName || "",
        "Email": row.email || "",
        "Campus": row.campus || "N/A",
        "Class Ladder": row.ladderName,
        "Language": row.language || "N/A",
        "Required Courses": row.totalInLadder,
        "Completed Courses": row.completedInLadder,
        "Completion %": row.progressPercent,
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `user-completion-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getNativeName = (dbName: string) => {
    const lang = allLanguagesList.find(l => l.name === dbName || l.code === dbName);
    return lang ? cleanNativeName(lang.nativeName) : dbName;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
                <CardTitle>Completions</CardTitle>
                <CardDescription>Comprehensive tracking of student progress based on completed curriculum items.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleExport} variant="outline" disabled={isLoading || reportData.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
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
                    onChange={e => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    }} 
                />
            </div>
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" className="relative h-10">
                        <ListFilter className="mr-2 h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Filter Report</SheetTitle>
                        <SheetDescription>Filter by campus or context of a specific course.</SheetDescription>
                    </SheetHeader>
                    <div className="py-6 space-y-6">
                        <div className="space-y-2">
                            <Label>Campus</Label>
                            <Select value={selectedCampus} onValueChange={(v) => { setSelectedCampus(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All Campuses" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Campuses</SelectItem>
                                    {campuses.map(campus => (
                                        <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Courses in Ladder</Label>
                            <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Filter by course ladder context" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Courses</SelectItem>
                                    {courses.map(course => (
                                        <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <SheetFooter className="flex flex-col gap-2">
                        <Button variant="ghost" className="w-full" onClick={() => { setSelectedCampus('all'); setSelectedCourse('all'); setCurrentPage(1); }}>
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
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Ladder</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead className="text-center">Required</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead>Progress</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {paginatedData.map((row) => (
                    <TableRow key={row.id}>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={row.photoURL || undefined} />
                                <AvatarFallback>{getInitials(row.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="max-w-[200px] truncate">
                                <p className="font-medium truncate text-sm">{row.displayName || `${row.firstName} ${row.lastName}`}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{row.email}</p>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium">{row.ladderName}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px]">{row.language ? getNativeName(row.language) : 'N/A'}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">{row.totalInLadder}</TableCell>
                    <TableCell className="text-center font-mono text-primary font-bold text-sm">
                        {row.completedInLadder}
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold">
                                <span>{row.progressPercent}%</span>
                            </div>
                            <Progress value={row.progressPercent} className="h-1" />
                        </div>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        )}
        {reportData.length === 0 && !isLoading && (
          <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
            No student completion data found matching your current filters.
          </div>
        )}
      </CardContent>
      {totalPages > 1 && (
        <CardFooter className="flex justify-end items-center gap-4 border-t p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select value={`${rowsPerPage}`} onValueChange={(val) => {
                    setRowsPerPage(Number(val));
                    setCurrentPage(1);
                }}>
                    <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {[10, 20, 50, 100].map(size => (
                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
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
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                    disabled={currentPage === 1}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                    disabled={currentPage === totalPages}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </CardFooter>
      )}
    </Card>
  );
}
