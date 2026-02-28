
"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  getDocs,
  orderBy,
  where,
  addDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Send,
  Search,
  ListFilter,
  User,
  Mail,
  CheckCircle2,
  Eye,
  BookOpen,
  Trash2,
  History,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  X as XIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { User as AppUser, EmailTemplate, Ladder, Course, Enrollment, EmailLayoutSettings } from "@/lib/types";
import { marked } from "marked";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
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
import { wrapInEmailLayout } from "@/lib/email-utils";
import { format, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";

export default function EmailSenderPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [campuses, setCampuses] = useState<{ id: string; name: string }[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [emailLayout, setEmailLayout] = useState<EmailLayoutSettings | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  // Selection/Filtering State
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCampus, setFilterCampus] = useState("all");
  const [filterLadder, setFilterLadder] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterHpRequest, setFilterHpRequest] = useState<"all" | "pending">("all");
  const [filterCourses, setFilterCourses] = useState<string[]>([]);
  const [filterCompletionStatus, setFilterCompletionStatus] = useState<"completed" | "not-completed">("completed");
  const [completedUserIds, setCompletedUserIds] = useState<Set<string>>(new Set());

  // Sent Emails Log State
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const [viewingEmail, setViewingEmail] = useState<any | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);
  
  // Log Filtering State
  const [logFilterDateRange, setLogFilterDateRange] = useState<DateRange | undefined>();
  const [logFilterSubject, setLogFilterSubject] = useState("");
  const [logFilterStatus, setLogFilterStatus] = useState("all");
  const [logFilterCampus, setLogFilterCampus] = useState("all");
  const [logFilterLadder, setLogFilterLadder] = useState("all");
  const [logFilterRole, setLogFilterRole] = useState("all");

  // Log Pagination State
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);

  const canManage = hasPermission("manageContent");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersSnap, templatesSnap, laddersSnap, campusesSnap, coursesSnap, layoutSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), orderBy("displayName"))),
          getDocs(query(collection(db, "emailTemplates"), orderBy("name"))),
          getDocs(query(collection(db, "courseLevels"), orderBy("order"))),
          getDocs(query(collection(db, "Campus"), orderBy("Campus Name"))),
          getDocs(query(collection(db, "courses"), where("status", "==", "published"), orderBy("title"))),
          getDoc(doc(db, "siteSettings", "emailLayout")),
        ]);

        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
        setTemplates(templatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as EmailTemplate)));
        setLadders(laddersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ladder)));
        setCampuses(campusesSnap.docs.map(d => ({ id: d.id, name: d.data()["Campus Name"] })));
        setAllCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
        if (layoutSnap.exists()) setEmailLayout(layoutSnap.data() as EmailLayoutSettings);
      } catch (error) {
        console.error("Error fetching sender data:", error);
        toast({ variant: "destructive", title: "Failed to load data" });
      } finally {
        setLoading(false);
      }
    };
    if (canManage) fetchData();
  }, [db, toast, canManage]);

  // Real-time listener for the mail log
  useEffect(() => {
    if (!canManage) return;
    const q = query(collection(db, "mail"), orderBy("delivery.startTime", "desc"), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSentEmails(logs);
    });
    return () => unsubscribe();
  }, [db, canManage]);

  // Handle Course Completion Filtering (Multi-select)
  useEffect(() => {
    const fetchCompletions = async () => {
      if (filterCourses.length === 0) {
        setCompletedUserIds(new Set());
        return;
      }
      setLoading(true);
      try {
        const uids = new Set<string>();
        // Firestore 'in' query supports up to 30 values
        const courseChunks = [];
        for (let i = 0; i < filterCourses.length; i += 30) {
            courseChunks.push(filterCourses.slice(i, i + 30));
        }

        for (const chunk of courseChunks) {
            const [onlineSnap, onsiteSnap] = await Promise.all([
              getDocs(query(collection(db, "enrollments"), where("courseId", "in", chunk))),
              getDocs(query(collection(db, "onsiteCompletions"), where("courseId", "in", chunk)))
            ]);
            onlineSnap.docs.forEach(d => {
              const data = d.data() as Enrollment;
              if (data.completedAt) uids.add(data.userId);
            });
            onsiteSnap.docs.forEach(d => uids.add(d.data().userId));
        }
        setCompletedUserIds(uids);
      } catch (e) {
        console.error("Error fetching completions for filter:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchCompletions();
  }, [filterCourses, db]);

  const filteredUsers = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return users.filter(u => {
      const matchesSearch = !search || 
        (u.displayName || "").toLowerCase().includes(search) || 
        (u.email || "").toLowerCase().includes(search);
      const matchesCampus = filterCampus === "all" || u.campus === campuses.find(c => c.id === filterCampus)?.name;
      const matchesLadder = filterLadder === "all" || u.classLadderId === filterLadder;
      const matchesRole = filterRole === "all" || u.role === filterRole;
      
      let matchesCourse = true;
      if (filterCourses.length > 0) {
        const isCompleted = completedUserIds.has(u.id);
        matchesCourse = filterCompletionStatus === "completed" ? isCompleted : !isCompleted;
      }

      let matchesHpRequest = true;
      if (filterHpRequest === "pending") {
          const isPending = (u.isInHpGroup === false || u.isInHpGroup === undefined || u.isInHpGroup === null) && u.hpAvailabilityDay;
          matchesHpRequest = !!isPending;
      }

      return matchesSearch && matchesCampus && matchesLadder && matchesRole && matchesCourse && matchesHpRequest;
    });
  }, [users, searchTerm, filterCampus, filterLadder, filterRole, filterCourses, filterCompletionStatus, completedUserIds, campuses, filterHpRequest]);

  const filteredLogEmails = useMemo(() => {
    return sentEmails.filter(email => {
      const status = email.delivery?.state || "PENDING";
      const subject = (email.message?.subject || "").toLowerCase();
      const startTime = email.delivery?.startTime?.toDate();
      const user = users.find(u => u.id === email.userId);

      const matchesStatus = logFilterStatus === "all" || status === logFilterStatus;
      const matchesSubject = !logFilterSubject || subject.includes(logFilterSubject.toLowerCase());
      
      const matchesDate = !logFilterDateRange || (
        (!logFilterDateRange.from || (startTime && startTime >= startOfDay(logFilterDateRange.from))) &&
        (!logFilterDateRange.to || (startTime && startTime <= endOfDay(logFilterDateRange.to)))
      );

      const matchesCampus = logFilterCampus === "all" || user?.campus === campuses.find(c => c.id === logFilterCampus)?.name;
      const matchesLadder = logFilterLadder === "all" || user?.classLadderId === logFilterLadder;
      const matchesRole = logFilterRole === "all" || user?.role === logFilterRole;

      return matchesStatus && matchesSubject && matchesDate && matchesCampus && matchesLadder && matchesRole;
    });
  }, [sentEmails, logFilterStatus, logFilterSubject, logFilterDateRange, logFilterCampus, logFilterLadder, logFilterRole, users, campuses]);

  const toggleUserSelection = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUserIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleSendBulk = async () => {
    if (!selectedTemplateId || selectedUserIds.size === 0) return;
    
    setIsSending(true);
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    let successCount = 0;
    let errorCount = 0;

    for (const userId of Array.from(selectedUserIds)) {
      const user = users.find(u => u.id === userId);
      if (!user || !user.email) {
        errorCount++;
        continue;
      }

      try {
        let subject = template.subject || '';
        let body = template.body || '';

        const placeholders: Record<string, any> = {
          userName: user.displayName || user.firstName || 'User',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phoneNumber: user.phoneNumber || '',
          campus: user.campus || '',
          hpNumber: user.hpNumber || '',
          facilitatorName: user.facilitatorName || '',
          classLadder: user.classLadder || '',
          ministry: user.ministry || '',
          charge: user.charge || '',
        };

        Object.entries(placeholders).forEach(([key, val]) => {
          const regex = new RegExp(`{{${key}}}`, "g");
          subject = subject.replace(regex, String(val ?? ''));
          body = body.replace(regex, String(val ?? ''));
        });

        const formPlaceholderRegex = /{{form:([^:]+):([^}]+)}}/g;
        const formTitleRegex = /{{formTitle:([^}]+)}}/g;
        
        const combinedText = subject + " " + body;
        const formMatches = Array.from(combinedText.matchAll(formPlaceholderRegex));
        const formTitleMatches = Array.from(combinedText.matchAll(formTitleRegex));
        
        const formIdsInUse = Array.from(new Set([
            ...formMatches.map(m => m[1]),
            ...formTitleMatches.map(m => m[1])
        ]));

        const formSubmissionsMap: Record<string, any> = {};
        const formTitlesMap: Record<string, string> = {};

        for (const fId of formIdsInUse) {
            try {
                const formSnap = await getDoc(doc(db, 'forms', fId));
                if (formSnap.exists()) {
                    formTitlesMap[fId] = formSnap.data().title || 'Untitled Form';
                }
            } catch (e) { console.warn(`Could not fetch form ${fId}`, e); }

            const hasFieldMatch = formMatches.some(m => m[1] === fId);
            if (hasFieldMatch) {
                const subQuery = query(
                    collection(db, 'forms', fId, 'submissions'),
                    where('userId', '==', user.id),
                    orderBy('submittedAt', 'desc'),
                    limit(1)
                );
                try {
                    const snap = await getDocs(subQuery);
                    if (!snap.empty) {
                        const subData = snap.docs[0].data();
                        formSubmissionsMap[fId] = subData.data || subData;
                    }
                } catch (e) { console.warn(`Could not fetch submission for form ${fId}`, e); }
            }
        }

        const formReplacer = (match: string, fId: string, fFieldId: string) => {
            const val = formSubmissionsMap[fId]?.[fFieldId];
            return val == null ? '' : Array.isArray(val) ? val.join(', ') : String(val);
        };
        subject = subject.replace(formPlaceholderRegex, formReplacer);
        body = body.replace(formPlaceholderRegex, formReplacer);

        const titleReplacer = (match: string, fId: string) => formTitlesMap[fId] || '';
        subject = subject.replace(formTitleRegex, titleReplacer);
        body = body.replace(formTitleRegex, titleReplacer);

        const htmlContent = marked.parse(body, { breaks: true });
        
        let finalHtml = `<div style="font-family:sans-serif;line-height:1.5;color:#2d3748;max-width:600px;margin:0 auto;">${htmlContent}</div>`;
        if (emailLayout) {
            finalHtml = wrapInEmailLayout(htmlContent, emailLayout);
        }

        await addDoc(collection(db, 'mail'), {
          to: [user.email],
          message: {
            subject: subject,
            html: finalHtml,
          },
          templateId: selectedTemplateId,
          userId: user.id,
          sentByBulk: true,
          createdAt: serverTimestamp(),
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to queue email for ${user.email}:`, err);
        errorCount++;
      }
    }

    toast({
      title: "Bulk Sending Complete",
      description: `Successfully queued ${successCount} emails. ${errorCount} failed.`,
    });
    setIsSending(false);
    setSelectedUserIds(new Set());
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await deleteDoc(doc(db, "mail", id));
      toast({ title: "Log entry removed" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to delete log entry" });
    }
  };

  const handleClearLog = async () => {
    if (!window.confirm("Are you sure you want to clear the entire email log?")) return;
    setIsDeletingLog(true);
    try {
      const batch = writeBatch(db);
      sentEmails.forEach(email => {
        batch.delete(doc(db, "mail", email.id));
      });
      await batch.commit();
      toast({ title: "Email log cleared successfully" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to clear log" });
    } finally {
      setIsDeletingLog(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const activeFilterCount = [
    filterCampus !== 'all',
    filterLadder !== 'all',
    filterRole !== 'all',
    filterHpRequest !== 'all',
    filterCourses.length > 0
  ].filter(Boolean).length;

  const activeLogFilterCount = [
    !!logFilterDateRange,
    !!logFilterSubject,
    logFilterStatus !== 'all',
    logFilterCampus !== 'all',
    logFilterLadder !== 'all',
    logFilterRole !== 'all'
  ].filter(Boolean).length;

  const logTotalPages = Math.ceil(filteredLogEmails.length / logPageSize);
  const currentLogData = useMemo(() => {
    return filteredLogEmails.slice((logPage - 1) * logPageSize, logPage * logPageSize);
  }, [filteredLogEmails, logPage, logPageSize]);

  if (!canManage) return <div className="p-8 text-center">Access Denied</div>;

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">Email Sender</h1>
        <p className="text-muted-foreground">Select recipients and a template to send bulk messages.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Select Recipients</CardTitle>
              <div className="flex items-center gap-2 pt-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name or email..." 
                    className="pl-9 h-10 pr-12" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
                  <div className="absolute right-1 top-1">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                          <ListFilter className="h-4 w-4" />
                          {activeFilterCount > 0 && (
                            <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-primary">
                              {activeFilterCount}
                            </Badge>
                          )}
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="w-full sm:max-w-xs flex flex-col">
                        <SheetHeader className="mb-6 flex-shrink-0">
                          <SheetTitle>Filter Recipients</SheetTitle>
                          <SheetDescription>Narrow down your target audience.</SheetDescription>
                        </SheetHeader>
                        <ScrollArea className="flex-1 pr-6 -mr-6">
                          <div className="space-y-6 px-1">
                            <div className="space-y-2">
                              <Label>Campus</Label>
                              <Select value={filterCampus} onValueChange={setFilterCampus}>
                                <SelectTrigger>
                                  <SelectValue placeholder="All Campuses" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Campuses</SelectItem>
                                  {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Membership Ladder</Label>
                              <Select value={filterLadder} onValueChange={setFilterLadder}>
                                <SelectTrigger>
                                  <SelectValue placeholder="All Ladders" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Ladders</SelectItem>
                                  {ladders.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>User Role</Label>
                              <Select value={filterRole} onValueChange={setFilterRole}>
                                <SelectTrigger>
                                  <SelectValue placeholder="All Roles" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Roles</SelectItem>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="team">Team</SelectItem>
                                  <SelectItem value="moderator">Moderator</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>HP Placement Request</Label>
                              <Select value={filterHpRequest} onValueChange={(v: any) => setFilterHpRequest(v)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Users</SelectItem>
                                  <SelectItem value="pending">Pending HP Requests</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-4 pt-2 border-t">
                              <div className="space-y-2">
                                  <Label>Completion Status</Label>
                                  <Select value={filterCompletionStatus} onValueChange={(v: any) => setFilterCompletionStatus(v)}>
                                      <SelectTrigger>
                                          <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                          <SelectItem value="completed">Completed</SelectItem>
                                          <SelectItem value="not-completed">Not Completed</SelectItem>
                                      </SelectContent>
                                  </Select>
                              </div>

                              <div className="space-y-2">
                                  <Label>Course Selection</Label>
                                  <div className="flex items-center space-x-2 py-2 border-b">
                                      <Checkbox 
                                          id="all-courses" 
                                          checked={filterCourses.length === allCourses.length && allCourses.length > 0}
                                          onCheckedChange={(checked) => {
                                              if (checked) setFilterCourses(allCourses.map(c => c.id));
                                              else setFilterCourses([]);
                                          }}
                                      />
                                      <Label htmlFor="all-courses" className="text-sm font-medium">Select All</Label>
                                  </div>
                                  <ScrollArea className="h-48 border rounded-md p-2">
                                      {allCourses.map(c => (
                                          <div key={c.id} className="flex items-center space-x-2 py-1">
                                              <Checkbox 
                                                  id={`course-${c.id}`}
                                                  checked={filterCourses.includes(c.id)}
                                                  onCheckedChange={(checked) => {
                                                      if (checked) setFilterCourses(prev => [...prev, c.id]);
                                                      else setFilterCourses(prev => prev.filter(id => id !== c.id));
                                                  }}
                                              />
                                              <Label htmlFor={`course-${c.id}`} className="text-xs font-normal truncate">{c.title}</Label>
                                          </div>
                                      ))}
                                  </ScrollArea>
                              </div>
                            </div>
                          </div>
                        </ScrollArea>
                        <SheetFooter className="mt-8 flex flex-col gap-2 flex-shrink-0">
                          <Button variant="outline" onClick={() => {
                            setFilterCampus("all");
                            setFilterLadder("all");
                            setFilterRole("all");
                            setFilterHpRequest("all");
                            setFilterCourses([]);
                          }}>Reset Filters</Button>
                          <SheetClose asChild>
                            <Button className="w-full">Done</Button>
                          </SheetClose>
                        </SheetFooter>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Ladder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredUsers.length > 0 ? (
                      filteredUsers.map(u => (
                        <TableRow key={u.id} className="cursor-pointer" onClick={() => toggleUserSelection(u.id)}>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox checked={selectedUserIds.has(u.id)} onCheckedChange={() => toggleUserSelection(u.id)} />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-xs sm:text-sm">{u.displayName}</div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">{u.email}</div>
                          </TableCell>
                          <TableCell className="text-xs">{u.campus || "N/A"}</TableCell>
                          <TableCell className="text-xs">{u.classLadder || "N/A"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                          No users match your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
            <CardFooter className="justify-between border-t p-4 bg-muted/20">
              <div className="text-sm font-medium text-muted-foreground">
                {selectedUserIds.size} recipients selected
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedUserIds(new Set())}>
                Clear Selection
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>2. Choose Template</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an email template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <CardTitle>3. Preview & Send</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] border rounded-md bg-muted/10 p-4">
                {selectedTemplate ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Subject</Label>
                      <p className="font-semibold text-sm">{selectedTemplate.subject}</p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Body Preview</Label>
                      <div className="prose dark:prose-invert prose-sm max-w-full mt-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                          {selectedTemplate.body}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                    <Mail className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm italic">Select a template to preview</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                size="lg"
                disabled={!selectedTemplateId || selectedUserIds.size === 0 || isSending}
                onClick={handleSendBulk}
              >
                {isSending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> Send to {selectedUserIds.size} Users</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Card className="mt-8 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Sent Emails Log
            </CardTitle>
            <CardDescription>Monitor delivery status and review recently sent messages.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <ListFilter className="h-4 w-4 mr-2" />
                  Filter Log
                  {activeLogFilterCount > 0 && (
                    <Badge className="ml-2 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-primary">
                      {activeLogFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-xs flex flex-col">
                <SheetHeader className="mb-6 flex-shrink-0">
                  <SheetTitle>Filter Email Log</SheetTitle>
                  <SheetDescription>Find specific messages in your history.</SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 pr-6 -mr-6">
                  <div className="space-y-6 px-1">
                    <div className="space-y-2">
                      <Label>Date Range</Label>
                      <div className="grid gap-2">
                        <Input 
                          type="date" 
                          value={logFilterDateRange?.from ? format(logFilterDateRange.from, 'yyyy-MM-dd') : ''}
                          onChange={e => {
                            const from = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
                            setLogFilterDateRange(prev => ({ ...prev, from }));
                          }}
                        />
                        <Input 
                          type="date" 
                          value={logFilterDateRange?.to ? format(logFilterDateRange.to, 'yyyy-MM-dd') : ''}
                          onChange={e => {
                            const to = e.target.value ? new Date(e.target.value + 'T23:59:59') : undefined;
                            setLogFilterDateRange(prev => ({ ...prev, to }));
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Subject Topic</Label>
                      <Input 
                        placeholder="Filter by subject..." 
                        value={logFilterSubject}
                        onChange={e => setLogFilterSubject(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Delivery Status</Label>
                      <Select value={logFilterStatus} onValueChange={setLogFilterStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="SUCCESS">SUCCESS</SelectItem>
                          <SelectItem value="ERROR">ERROR</SelectItem>
                          <SelectItem value="PENDING">PENDING</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />
                    
                    <div className="space-y-4">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Recipient Category</Label>
                      <div className="space-y-2">
                        <Label>Campus</Label>
                        <Select value={logFilterCampus} onValueChange={setLogFilterCampus}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Campuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Campuses</SelectItem>
                            {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Ladder</Label>
                        <Select value={logFilterLadder} onValueChange={setLogFilterLadder}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Ladders" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Ladders</SelectItem>
                            {ladders.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={logFilterRole} onValueChange={setLogFilterRole}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Roles" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <SheetFooter className="mt-8 flex flex-col gap-2 flex-shrink-0">
                  <Button variant="outline" className="w-full" onClick={() => {
                    setLogFilterDateRange(undefined);
                    setLogFilterSubject("");
                    setLogFilterStatus("all");
                    setLogFilterCampus("all");
                    setLogFilterLadder("all");
                    setLogFilterRole("all");
                  }}>
                    Reset Filters
                  </Button>
                  <SheetClose asChild>
                    <Button className="w-full">Done</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            {sentEmails.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearLog} disabled={isDeletingLog}>
                {isDeletingLog ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Clear Log
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date Sent</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentLogData.length > 0 ? (
                  currentLogData.map((email) => {
                    const status = email.delivery?.state || "PENDING";
                    const isError = status === "ERROR";
                    const isSuccess = status === "SUCCESS";
                    
                    return (
                      <TableRow key={email.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {email.delivery?.startTime ? format(email.delivery.startTime.toDate(), "MMM d, p") : "Just now"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate font-medium">
                          {email.to?.[0] || "N/A"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground italic">
                          {email.message?.subject || "(No Subject)"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isSuccess ? "default" : isError ? "destructive" : "secondary"} className="text-[10px] px-1.5 h-5">
                            {isError && <AlertCircle className="h-3 w-3 mr-1" />}
                            {!isError && !isSuccess && <Clock className="h-3 w-3 mr-1 animate-pulse" />}
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingEmail(email)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteLog(email.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                      <div className="flex flex-col items-center gap-2">
                        <Mail className="h-8 w-8 opacity-20" />
                        No emails match your filters
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {logTotalPages > 1 && (
          <CardFooter className="flex justify-end items-center gap-4 border-t bg-muted/5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select value={`${logPageSize}`} onValueChange={(value) => { setLogPageSize(Number(value)); setLogPage(1); }}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={`${logPageSize}`} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50].map(size => (
                    <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">Page {logPage} of {logTotalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setLogPage(prev => Math.max(prev - 1, 1))} disabled={logPage === 1}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLogPage(prev => Math.min(prev + 1, logTotalPages))} disabled={logPage === logTotalPages}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <Dialog open={!!viewingEmail} onOpenChange={(open) => !open && setViewingEmail(null)}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b flex-shrink-0">
            <DialogTitle>Message Review</DialogTitle>
            <DialogDescription>
              Sent to: <span className="font-semibold text-foreground">{viewingEmail?.to?.[0]}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted/20">
            <iframe 
              srcDoc={viewingEmail?.message?.html} 
              className="w-full h-full border-0" 
              title="Email Sent Content"
            />
          </div>
          <DialogFooter className="p-4 border-t bg-background flex-shrink-0">
            <Button variant="secondary" onClick={() => setViewingEmail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
