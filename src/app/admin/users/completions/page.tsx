
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
} from "firebase/firestore";
import { getFirebaseApp, getFirebaseFirestore } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { User, Course, OnsiteCompletion, Ladder } from "@/lib/types";

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, CheckCircle2, Trash2, Download, Lock, ChevronRight, ChevronLeft, Calendar as CalendarIcon, X as XIcon } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Papa from "papaparse";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { Checkbox } from "@/components/ui/checkbox";

const PAGE_SIZE_DEFAULT = 25;

const getInitials = (name?: string | null) =>
  (!name ? "U" : name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join(""));

const chunk = <T,>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

interface Campus {
  id: string;
  "Campus Name": string;
}

export default function ManageCompletionsPage() {
  const db = getFirebaseFirestore(getFirebaseApp());
  const { user: adminUser, hasPermission, canViewAllCampuses } = useAuth();
  const { toast } = useToast();

  // Lists
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(true);

  // Selections
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [userLoggedCourseIds, setUserLoggedCourseIds] = useState<Set<string>>(new Set());

  // Save state
  const [isSaving, setIsSaving] = useState(false);

  // Log state
  const [logRows, setLogRows] = useState<(OnsiteCompletion & { id: string })[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<(DocumentSnapshot | undefined)[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [logSearchTerm, setLogSearchTerm] = useState("");
  const [selectedLogCampus, setSelectedLogCampus] = useState('all');
  const [selectedLogCourse, setSelectedLogCourse] = useState('all');

  // Selection (log rows)
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [selectAllOnPage, setSelectAllOnPage] = useState(false);

  const canManage = hasPermission('manageCompletions');
  
  const [totalLogCount, setTotalLogCount] = useState(0);

  // --- Load users, courses, ladders, campuses ---
  useEffect(() => {
    (async () => {
      if (!canManage) {
          setIsLoadingLists(false);
          return;
      }
      setIsLoadingLists(true);
      try {
        let usersQuery = query(collection(db, "users"), orderBy("displayName"));
        // Filter users by campus for non-global admins
        if (!canViewAllCampuses && adminUser?.campus) {
            usersQuery = query(usersQuery, where("campus", "==", adminUser.campus));
        }

        const [usersSnap, coursesSnap, laddersSnap, campusesSnap] = await Promise.all([
          getDocs(usersQuery),
          getDocs(query(collection(db, "courses"), where("status", "==", "published"), orderBy("title"))),
          getDocs(query(collection(db, "courseLevels"), orderBy("order"))),
          getDocs(query(collection(db, "Campus"), orderBy("Campus Name"))),
        ]);

        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
        setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
        setLadders(laddersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ladder)));
        setAllCampuses(campusesSnap.docs.map(d => ({id: d.id, ...d.data()} as Campus)));
      } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "Failed to load page data." });
      } finally {
        setIsLoadingLists(false);
      }
    })();
  }, [db, toast, canManage, adminUser?.campus, canViewAllCampuses]);

  const ladderById = useMemo(() => {
    const map = new Map<string, Ladder>();
    ladders.forEach(l => map.set(l.id, l));
    return map;
  }, [ladders]);

  // --- Fetch paginated log ---
  const loadLogPage = useCallback(
    async (
        targetPage: number,
        cursorStack: (DocumentSnapshot | undefined)[],
        user: User | null,
        dateRangeFilter?: DateRange,
        campusFilter?: string,
        courseFilter?: string,
        size?: number
    ) => {
        setIsLoadingLog(true);
        setSelectedLogIds(new Set());
        setSelectAllOnPage(false);

        try {
            const col = collection(db, "onsiteCompletions");
            const baseClauses: any[] = [];
            
            if (user) {
                baseClauses.push(where("userId", "==", user.uid));
            } else if (!canViewAllCampuses && adminUser?.campus) {
                baseClauses.push(where("userCampus", "==", adminUser.campus));
            } else if (campusFilter && campusFilter !== 'all') {
                const campus = allCampuses.find(c => c.id === campusFilter);
                if (campus) baseClauses.push(where("userCampus", "==", campus["Campus Name"]));
            }

            if (courseFilter && courseFilter !== 'all') {
                baseClauses.push(where("courseId", "==", courseFilter));
            }

            if (dateRangeFilter?.from) {
                baseClauses.push(where("completedAt", ">=", startOfDay(dateRangeFilter.from)));
            }
            if (dateRangeFilter?.to) {
                baseClauses.push(where("completedAt", "<=", endOfDay(dateRangeFilter.to)));
            }
            
            // Query for total count
            const countQuery = query(col, ...baseClauses);
            const countSnapshot = await getCountFromServer(countQuery);
            setTotalLogCount(countSnapshot.data().count);


            let qRef = query(col, ...baseClauses, orderBy("completedAt", "desc"), limit((size || PAGE_SIZE_DEFAULT) + 1));

            if (targetPage > 1 && cursorStack[targetPage - 2]) {
                qRef = query(col, ...baseClauses, orderBy("completedAt", "desc"), startAfter(cursorStack[targetPage - 2]), limit((size || PAGE_SIZE_DEFAULT) + 1));
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
            setLogRows([]);
            setHasNextPage(false);
            setTotalLogCount(0);
        } finally {
            setIsLoadingLog(false);
        }
    }, [db, toast, canViewAllCampuses, adminUser, allCampuses]);

  // --- Initial log load & user change effect ---
  useEffect(() => {
    if (!canManage) return;

    setUserLoggedCourseIds(new Set());
    setSelectedCourseIds(new Set());
    setPage(1);
    setCursors([]);

    const loadData = async () => {
      if (selectedUser) {
        const snap = await getDocs(
          query(collection(db, "onsiteCompletions"), where("userId", "==", selectedUser.uid))
        );
        const seen = new Set<string>();
        snap.forEach(d => {
          const data = d.data() as any;
          if (data?.courseId) seen.add(data.courseId);
        });
        setUserLoggedCourseIds(seen);
      }
      await loadLogPage(1, [], selectedUser, dateRange, selectedLogCampus, selectedLogCourse, pageSize);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, canManage]);


  // --- Filters change -> reload page 1 ---
  useEffect(() => {
    if (!canManage) return;
    setPage(1);
    setCursors([]);
    loadLogPage(1, [], selectedUser, dateRange, selectedLogCampus, selectedLogCourse, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, pageSize, canManage, selectedLogCampus, selectedLogCourse]);

  // --- Helpers: filtered lists ---
  const filteredUsers = useMemo(() => {
    const q = userSearchTerm.toLowerCase();
    return users.filter(
      u => (u.displayName || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
    );
  }, [users, userSearchTerm]);

  const filteredCourses = useMemo(() => {
    const q = courseSearchTerm.toLowerCase();
    let userCourses = courses;
    if (selectedUser && selectedUser.language) {
      userCourses = courses.filter(c => c.language === selectedUser.language);
    }
    return userCourses.filter(c => (c.title || "").toLowerCase().includes(q));
  }, [courses, courseSearchTerm, selectedUser]);

  // --- Toggle course multi-select ---
  const toggleCourse = (courseId: string, isLogged: boolean) => {
    if (isLogged) return;
    setSelectedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  // --- Save: create one doc per selected course (store extra user fields) ---
  const handleSave = async () => {
    if (!selectedUser) {
      toast({ variant: "destructive", title: "Pick a user first." });
      return;
    }
    const toSaveIds = Array.from(selectedCourseIds);
    if (toSaveIds.length === 0) {
      toast({ variant: "destructive", title: "Pick at least one course." });
      return;
    }

    setIsSaving(true);
    try {
      const candidateIds = toSaveIds.filter(id => !userLoggedCourseIds.has(id));
      if (candidateIds.length === 0) {
        toast({ variant: "destructive", title: "Already logged", description: "All selected courses are already logged." });
        setIsSaving(false);
        return;
      }

      const serverExisting = new Set<string>();
      for (const group of chunk(candidateIds, 10)) {
        const dSnap = await getDocs(
          query(
            collection(db, "onsiteCompletions"),
            where("userId", "==", selectedUser.uid),
            where("courseId", "in", group),
            limit(10)
          )
        );
        dSnap.forEach(d => {
          const data = d.data() as any;
          if (data?.courseId) serverExisting.add(data.courseId);
        });
      }

      const finalToCreate = candidateIds.filter(id => !serverExisting.has(id));
      if (finalToCreate.length === 0) {
        toast({ variant: "destructive", title: "Already logged", description: "All selected courses are already logged." });
        setIsSaving(false);
        return;
      }

      const userCampus = canViewAllCampuses 
        ? selectedUser.campus 
        : adminUser?.campus;

      if (!userCampus) {
        toast({
          variant: "destructive",
          title: "Missing campus",
          description: "No campus to record for this log. Add a campus to your account or the user."
        });
        setIsSaving(false);
        return;
      }

      const ladderId = (selectedUser as any).classLadderId || null;
      const ladderObj = ladderId ? ladderById.get(ladderId) : undefined;
      const ladderName = ladderObj
        ? `${ladderObj.name}${ladderObj.side && ladderObj.side !== "none" ? ` (${ladderObj.side})` : ""}`
        : "Not assigned";

      const titleById = new Map(courses.map(c => [c.id, c.title || "Untitled Course"]));

      await Promise.all(
        finalToCreate.map(courseId =>
          addDoc(collection(db, "onsiteCompletions"), {
            userId: selectedUser.uid,
            userName: selectedUser.displayName || selectedUser.email || "Unknown User",
            userCampus,
            courseId,
            courseName: titleById.get(courseId) || "Untitled Course",
            completedAt: serverTimestamp(),
            markedBy:
              adminUser?.displayName && adminUser?.email
                ? `${adminUser.displayName} <${adminUser.email}>`
                : adminUser?.email || "Admin",
            markedById: adminUser?.uid || null,
            userEmail: selectedUser.email || null,
            userPhone: (selectedUser as any).phoneNumber || null,
            userGender: (selectedUser as any).gender || null,
            userLadderId: ladderId,
            userLadderName: ladderName,
          })
        )
      );

      toast({
        title: "Logged onsite completions",
        description: `Created ${finalToCreate.length}. Skipped ${serverExisting.size} duplicate(s).`,
      });

      // Clear selections & refresh page 1
      setSelectedCourseIds(new Set());
      setCourseSearchTerm("");
      setPage(1);
      setCursors([]);
      await loadLogPage(1, [], selectedUser, dateRange, selectedLogCampus, selectedLogCourse, pageSize);

      // refresh userLoggedCourseIds quickly
      const newSet = new Set(userLoggedCourseIds);
      finalToCreate.forEach(id => newSet.add(id));
      setUserLoggedCourseIds(newSet);
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Update failed", description: err?.message || "Could not write onsite completions." });
    } finally {
      setIsSaving(false);
    }
  };

  // Pagination
  const goPrev = async () => {
    if (page <= 1) return;
    await loadLogPage(page - 1, cursors, selectedUser, dateRange, selectedLogCampus, selectedLogCourse, pageSize);
  };
  const goNext = async () => {
    if (!hasNextPage) return;
    await loadLogPage(page + 1, cursors, selectedUser, dateRange, selectedLogCampus, selectedLogCourse, pageSize);
  };

  // Log selection
  const toggleSelectLog = (id: string) => {
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAllOnPage = () => {
    if (selectAllOnPage) {
      setSelectedLogIds(new Set());
      setSelectAllOnPage(false);
    } else {
      setSelectedLogIds(new Set(logRows.map(r => r.id)));
      setSelectAllOnPage(true);
    }
  };

  // Bulk delete
  const handleDeleteSelected = async () => {
    if (selectedLogIds.size === 0) {
      toast({ variant: "destructive", title: "Select at least one log row to delete." });
      return;
    }
    try {
      const batch = writeBatch(db);
      selectedLogIds.forEach(id => batch.delete(doc(db, "onsiteCompletions", id)));
      await batch.commit();

      toast({ title: "Deleted", description: `Removed ${selectedLogIds.size} record(s).` });

      await loadLogPage(page, cursors, selectedUser, dateRange, selectedLogCampus, selectedLogCourse, pageSize);
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Delete failed", description: e?.message || "Could not delete records." });
    } finally {
      setSelectedLogIds(new Set());
      setSelectAllOnPage(false);
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
      const baseClauses: any[] = [];
      
      if (selectedUser) {
          baseClauses.push(where("userId", "==", selectedUser.uid));
      } else if (!canViewAllCampuses && adminUser?.campus) {
          baseClauses.push(where("userCampus", "==", adminUser.campus));
      } else if (selectedLogCampus && selectedLogCampus !== 'all') {
          const campus = allCampuses.find(c => c.id === selectedLogCampus);
          if (campus) baseClauses.push(where("userCampus", "==", campus["Campus Name"]));
      }

      if (selectedLogCourse && selectedLogCourse !== 'all') {
          baseClauses.push(where("courseId", "==", selectedLogCourse));
      }

      if (dateRange?.from) {
          baseClauses.push(where("completedAt", ">=", startOfDay(dateRange.from)));
      }
      if (dateRange?.to) {
          baseClauses.push(where("completedAt", "<=", endOfDay(dateRange.to)));
      }

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
            const L = ladderById.get(id);
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
    link.download = `onsite_completions_report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  if (!canManage) {
    return (
      <Alert variant="destructive">
        <Lock className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to manage course completions.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">Manage On-Site Completions</h1>
        <p className="text-muted-foreground">Select a user, select one or more courses, then save. Each log row stores user details at the time of logging.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Users */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Select a User</CardTitle>
            <div className="relative pt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={userSearchTerm} onChange={e => setUserSearchTerm(e.target.value)} className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {isLoadingLists ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map(u => {
                    const selected = selectedUser?.id === u.id;
                    return (
                      <Button
                        key={u.id}
                        variant={selected ? "secondary" : "ghost"}
                        className={cn("w-full justify-start gap-2 h-auto", selected && "ring-1 ring-primary")}
                        onClick={() => { setSelectedUser(selected ? null : u); }}
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

        {/* Courses */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{selectedUser ? `Pick course(s) for ${selectedUser.displayName || selectedUser.email}` : "Pick course(s)"}</CardTitle>
            <CardDescription>Click to toggle selections. “Logged” items are disabled.</CardDescription>
            <div className="relative pt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search courses..." value={courseSearchTerm} onChange={e => setCourseSearchTerm(e.target.value)} className="pl-8" disabled={!selectedUser} />
            </div>
          </CardHeader>
          <CardContent>
            {selectedUser ? (
              <ScrollArea className="h-96">
                {isLoadingLists ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pr-1">
                    {filteredCourses.map(c => {
                      const isLogged = userLoggedCourseIds.has(c.id);
                      const isSelected = selectedCourseIds.has(c.id);
                      return (
                        <Button
                          key={c.id}
                          variant={isLogged ? "outline" : isSelected ? "secondary" : "outline"}
                          className={cn("justify-between h-auto py-3 px-3 w-full", isSelected && !isLogged && "ring-1 ring-primary", isLogged && "opacity-60 cursor-not-allowed")}
                          onClick={() => toggleCourse(c.id, isLogged)}
                          disabled={isLogged}
                          title={isLogged ? "Already logged for this user" : undefined}
                        >
                          <span className="truncate text-left">{c.title}</span>
                          {isLogged ? <Badge variant="secondary">Logged</Badge> : isSelected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg"><p className="text-muted-foreground">Select a user to begin</p></div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedUser ? `${userLoggedCourseIds.size} already logged • ${selectedCourseIds.size} selected` : "Pick a user and course(s)"}
            </div>
            <Button onClick={handleSave} disabled={!selectedUser || selectedCourseIds.size === 0 || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Log table */}
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <CardTitle>On-Site Completion Log</CardTitle>
                    <CardDescription>
                       Viewing {totalLogCount} total records
                    </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Select value={selectedLogCampus} onValueChange={setSelectedLogCampus} disabled={!canViewAllCampuses}>
                        <SelectTrigger className="w-full sm:w-auto">
                            <SelectValue placeholder="Filter by campus" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Campuses</SelectItem>
                            {allCampuses.map(c => <SelectItem key={c.id} value={c.id}>{c["Campus Name"]}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={selectedLogCourse} onValueChange={setSelectedLogCourse}>
                        <SelectTrigger className="w-full sm:w-auto">
                            <SelectValue placeholder="Filter by course" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Courses</SelectItem>
                            {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Popover>
                      <PopoverTrigger asChild>
                        <Button id="date" variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                            ) : (
                              format(dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Filter by date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                      </PopoverContent>
                    </Popover>
                    {dateRange && <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}><XIcon className="h-4 w-4" /></Button>}
                    <Button variant="outline" className="w-full sm:w-auto" onClick={handleDownloadCSV}><Download className="h-4 w-4 mr-2" />CSV</Button>
                </div>
            </div>
            <div className="relative pt-4">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search current page results..." 
                  value={logSearchTerm} 
                  onChange={e => setLogSearchTerm(e.target.value)} 
                  className="pl-8"
                />
            </div>
        </CardHeader>
        <CardContent>
           <div className="flex items-center gap-2 mb-4">
              <Checkbox id="select-all" checked={selectAllOnPage} onCheckedChange={toggleSelectAllOnPage} />
              <label htmlFor="select-all" className="text-sm font-medium">Select all on page</label>
              {selectedLogIds.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete selected ({selectedLogIds.size})
                </Button>
              )}
           </div>
           {isLoadingLog ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42px]"></TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>HP Number</TableHead>
                    <TableHead>Facilitator</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Marked By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogRows.map((oc: any) => {
                    const id = oc.id;
                    const checked = selectedLogIds.has(id);
                    const dateStr = oc.completedAt ? format(new Date((oc.completedAt as Timestamp).seconds * 1000), "PPP") : "N/A";
                    const campus = oc.userCampus || "N/A";
                    const userRecord = users.find(u => u.id === oc.userId);

                    return (
                      <TableRow key={id} data-state={checked ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox checked={checked} onCheckedChange={() => toggleSelectLog(id)} />
                        </TableCell>
                        <TableCell>{userRecord?.firstName || (oc.userName || '').split(' ')[0] || "—"}</TableCell>
                        <TableCell>{userRecord?.lastName || (oc.userName || '').split(' ').slice(1).join(' ') || "—"}</TableCell>
                        <TableCell>{oc.userEmail || "—"}</TableCell>
                        <TableCell>{oc.userPhone || "—"}</TableCell>
                        <TableCell>{userRecord?.hpNumber || "—"}</TableCell>
                        <TableCell>{userRecord?.facilitatorName || "—"}</TableCell>
                        <TableCell>{campus}</TableCell>
                        <TableCell>{oc.courseName}</TableCell>
                        <TableCell>{dateStr}</TableCell>
                        <TableCell>{oc.markedBy || "N/A"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredLogRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground">No records match your filters.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select value={`${pageSize}`} onValueChange={value => setPageSize(Number(value))}>
                    <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder={`${pageSize}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {[10, 25, 50, 100].map(size => (
                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <span className="text-sm text-muted-foreground">
                Page {page}
            </span>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </Button>
                <Button variant="outline" size="sm" onClick={goNext} disabled={!hasNextPage}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
