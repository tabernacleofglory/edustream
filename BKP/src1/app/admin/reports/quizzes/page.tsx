
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { collection, getDocs, query, where, orderBy, writeBatch, doc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { User, Course, Quiz, UserQuizResult, QuizQuestion, CourseGroup } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Download, Calendar as CalendarIcon, X as XIcon, CheckCircle, XCircle, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Papa from 'papaparse';
import { format, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

interface Campus {
  id: string;
  "Campus Name": string;
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

export default function QuizReportsPage() {
  const { user: currentUser, canViewAllCampuses } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allCourseGroups, setAllCourseGroups] = useState<CourseGroup[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [quizReportData, setQuizReportData] = useState<QuizReportData[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<string | "all">("all");
  const [selectedCourse, setSelectedCourse] = useState<string | "all">("all");
  const [selectedCampus, setSelectedCampus] = useState<string | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [viewingQuizResult, setViewingQuizResult] = useState<QuizReportData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [quizReportPage, setQuizReportPage] = useState(1);
  const [quizReportPageSize, setQuizReportPageSize] = useState(10);
  const [selectedQuizResults, setSelectedQuizResults] = useState<string[]>([]);
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  const fetchAllStaticData = useCallback(async () => {
    setLoading(true);
    try {
      const usersCollection = collection(db, 'users');
      const coursesCollection = query(collection(db, 'courses'), where('status', '==', 'published'));
      const courseGroupsCollection = collection(db, 'courseGroups');
      const quizzesCollection = collection(db, 'quizzes');
      const quizResultsCollection = query(collection(db, 'userQuizResults'), orderBy('attemptedAt', 'desc'));
      const campusesCollection = collection(db, 'Campus');

      const [usersSnapshot, coursesSnapshot, courseGroupsSnapshot, quizzesSnapshot, quizResultsSnapshot, campusesSnapshot] = await Promise.all([
        getDocs(usersCollection),
        getDocs(coursesCollection),
        getDocs(courseGroupsCollection),
        getDocs(quizzesCollection),
        getDocs(quizResultsCollection),
        getDocs(campusesCollection),
      ]);

      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      const coursesList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      const courseGroupsList = courseGroupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseGroup));
      const quizzesList = quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      const quizResultsList = quizResultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserQuizResult));
      const campusesList = campusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus));

      setAllUsers(usersList);
      setAllCourses(coursesList);
      setAllCourseGroups(courseGroupsList);
      setAllQuizzes(quizzesList);
      setAllCampuses(campusesList);

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
          quizData: quiz,
        };
      });
      setQuizReportData(quizReport as QuizReportData[]);

    } catch (error) {
      console.error("Failed to fetch static analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchAllStaticData();
  }, [fetchAllStaticData]);

  const filteredQuizReportData = useMemo(() => {
    let filtered = [...quizReportData];

    if (selectedUser !== 'all') {
      filtered = filtered.filter(r => r.userId === selectedUser);
    }
    
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
    if (searchTerm) {
        const lowercasedSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(r => 
            r.userName.toLowerCase().includes(lowercasedSearch) || 
            r.quizTitle.toLowerCase().includes(lowercasedSearch)
        );
    }

    return filtered;
  }, [quizReportData, selectedUser, selectedCourse, allCourseGroups, selectedCampus, dateRange, allUsers, allCampuses, searchTerm]);
  
  useEffect(() => {
    setQuizReportPage(1); // Reset to first page on filter change
  }, [selectedUser, selectedCourse, selectedCampus, dateRange, searchTerm, quizReportPageSize])

  const quizReportTotalPages = Math.ceil(filteredQuizReportData.length / quizReportPageSize);
  const currentQuizReportData = filteredQuizReportData.slice(
    (quizReportPage - 1) * quizReportPageSize,
    quizReportPage * quizReportPageSize
  );

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
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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
  };

  return (
    <div className="space-y-8">
      <Card>
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
             <div className="relative flex-grow w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search user or quiz..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
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
            <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={!canViewAllCampuses}>
              <SelectTrigger className="w-full sm:w-auto flex-grow">
                <SelectValue placeholder="Select Campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campuses</SelectItem>
                {allCampuses.map((campus) => (
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
                <Select value={`${quizReportPageSize}`} onValueChange={value => setQuizReportPageSize(Number(value))}>
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
            <span className="text-sm text-muted-foreground">Page {quizReportPage} of {quizReportTotalPages}</span>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setQuizReportPage(prev => Math.max(1, prev - 1))} disabled={quizReportPage === 1}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuizReportPage(prev => Math.min(quizReportTotalPages, prev + 1))} disabled={quizReportPage === quizReportTotalPages}>
                    Next <ChevronRight className="h-4 w-4" />
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
    </div>
  );
}
