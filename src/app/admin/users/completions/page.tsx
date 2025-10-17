

"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Loader2, Search, CheckCircle2, Trash2, Download, Lock, ChevronRight, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Papa from "papaparse";
import { Skeleton } from "../ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const PAGE_SIZE_DEFAULT = 25;

const getInitials = (name?: string | null) =>
  (!name ? "U" : name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join(""));

const chunk = <T,>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

export default function ManageCompletionsPage() {
  const db = getFirebaseFirestore(getFirebaseApp());
  const { user: adminUser, hasPermission } = useAuth();
  const { toast } = useToast();
  const isModerator = adminUser?.role === 'moderator';

  // Lists
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
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
  const [cursors, setCursors] = useState<DocumentSnapshot[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [logSearchTerm, setLogSearchTerm] = useState("");

  // Selection (log rows)
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [selectAllOnPage, setSelectAllOnPage] = useState(false);

  const canManage = hasPermission('manageCompletions');

  // --- Load users, courses, ladders ---
  useEffect(() => {
    (async () => {
      if (!canManage) {
          setIsLoadingLists(false);
          return;
      }
      setIsLoadingLists(true);
      try {
        let usersQuery = query(collection(db, "users"), orderBy("displayName"));
        if (isModerator && adminUser?.campus) {
            usersQuery = query(usersQuery, where("campus", "==", adminUser.campus));
        }

        const usersSnap = await getDocs(usersQuery);
        const coursesSnap = await getDocs(
          query(collection(db, "courses"), where("status", "==", "published"), orderBy("title"))
        );
        const laddersSnap = await getDocs(query(collection(db, "courseLevels"), orderBy("order")));

        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
        setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
        setLadders(laddersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ladder)));
      } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "Failed to load users/courses/ladders." });
      } finally {
        setIsLoadingLists(false);
      }
    })();
  }, [db, toast, canManage, isModerator, adminUser?.campus]);

  const ladderById = useMemo(() => {
    const map = new Map<string, Ladder>();
    ladders.forEach(l => map.set(l.id, l));
    return map;
  }, [ladders]);

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
      await loadLogPage(1, [], selectedUser, dateFrom, dateTo, pageSize);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, canManage]);


  // --- Filters change -> reload page 1 ---
  useEffect(() => {
    if (!canManage) return;
    setPage(1);
    setCursors([]);
    loadLogPage(1, [], selectedUser, dateFrom, dateTo, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, pageSize, canManage]);

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

      // ***** Campus logic — OVERRIDE for moderators *****
      // If actor is a moderator and has a campus, ALWAYS write that campus on the log.
      // This guarantees the Firestore rule (request.resource.data.userCampus == actorCampus()) passes.
      const actorCampus = isModerator ? (adminUser?.campus ?? null) : null;
      const userCampus =
        actorCampus // moderator override
        ?? (selectedUser as any).campus
        ?? (selectedUser as any).userCampus
        ?? null;

      if (isModerator && !actorCampus) {
        toast({
          variant: "destructive",
          title: "Your account has no campus",
          description: "Ask an admin to set your campus on your profile."
        });
        setIsSaving(false);
        return;
      }
      if (!userCampus) {
        toast({
          variant: "destructive",
          title: "Missing campus",
          description: "No campus to record for this log. Add a campus to your account or the user."
        });
        setIsSaving(false);
        return;
      }
      // ***** End Campus fix *****

      const ladderId = (selectedUser as any).classLadderId || null;
      const ladderObj = ladderId ? ladderById.get(ladderId) : undefined;
      const ladderName = ladderObj
        ? `${ladderObj.name}${ladderObj.side && ladderObj.side !== "none" ? ` (${ladderObj.side})` : ""}`
        : "Not assigned";

      const titleById = new Map(courses.map(c => [c.id, c.title || "Untitled Course"]));

      await Promise.all(
        finalToCreate.map(courseId =>
          addDoc(collection(db, "onsiteCompletions"), {
            // required / old
            userId: selectedUser.uid,
            userName: selectedUser.displayName || selectedUser.email || "Unknown User",
            userCampus, // forced to moderator campus when applicable
            courseId,
            courseName: titleById.get(courseId) || "Untitled Course",
            completedAt: serverTimestamp(),
            markedBy:
              adminUser?.displayName && adminUser?.email
                ? `${adminUser.displayName} <${adminUser.email}>`
                : adminUser?.email || "Admin",
            markedById: adminUser?.uid || null,

            // richer fields
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
      await loadLogPage(1, [], selectedUser, dateFrom, dateTo, pageSize);

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

  // --- Fetch paginated log ---
  async function loadLogPage(
    targetPage: number,
    cursorStack: DocumentSnapshot[],
    user: User | null,
    from: string,
    to: string,
    size: number
  ) {
    setIsLoadingLog(true);
    setSelectedLogIds(new Set());
    setSelectAllOnPage(false);

    try {
      const col = collection(db, "onsiteCompletions");
      const baseClauses: any[] = [];
      
      if (user) {
        baseClauses.push(where("userId", "==", user.uid));
      } else if (isModerator && adminUser?.campus) {
        baseClauses.push(where("userCampus", "==", adminUser.campus));
      }

      if (from) {
        const startDate = new Date(from);
        baseClauses.push(where("completedAt", ">=", Timestamp.fromDate(new Date(startDate.setHours(0, 0, 0, 0)))));
      }
      if (to) {
        const endDate = new Date(to);
        baseClauses.push(where("completedAt", "<=", Timestamp.fromDate(new Date(endDate.setHours(23, 59, 59, 999)))));
      }

      let qRef = query(col, ...baseClauses, orderBy("completedAt", "desc"), limit(size + 1));

      if (targetPage > 1 && cursorStack[targetPage - 2]) {
        qRef = query(col, ...baseClauses, orderBy("completedAt", "desc"), startAfter(cursorStack[targetPage - 2]), limit(size + 1));
      }

      const snap = await getDocs(qRef);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const pageHasNext = docs.length > size;
      const pageDocs = pageHasNext ? docs.slice(0, size) : docs;

      setLogRows(pageDocs);

      const newStack = [...cursorStack];
      if (pageDocs.length > 0) {
        newStack[targetPage - 1] = snap.docs[Math.min(size - 1, snap.docs.length - 1)];
      }
      setCursors(newStack);
      setPage(targetPage);
      setHasNextPage(pageHasNext);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to load log." });
      setLogRows([]);
      setHasNextPage(false);
    } finally {
      setIsLoadingLog(false);
    }
  }

  // Pagination
  const goPrev = async () => {
    if (page <= 1) return;
    await loadLogPage(page - 1, cursors, selectedUser, dateFrom, dateTo, pageSize);
  };
  const goNext = async () => {
    if (!hasNextPage) return;
    await loadLogPage(page + 1, cursors, selectedUser, dateFrom, dateTo, pageSize);
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

      await loadLogPage(page, cursors, selectedUser, dateFrom, dateTo, pageSize);
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Delete failed", description: e?.message || "Could not delete records." });
    } finally {
      setSelectedLogIds(new Set());
      setSelectAllOnPage(false);
    }
  };

  // CSV of current page
  const handleDownloadCSV = () => {
    if (logRows.length === 0) {
      toast({ variant: "destructive", title: "No rows to download." });
      return;
    }
    const header = ["User", "Email", "Phone", "Gender", "Campus", "Ladder", "Course", "Date", "Marked By"];
    const lines = [
      header.join(","),
      ...logRows.map((r: any) => {
        const dateStr = r.completedAt ? format(new Date((r.completedAt as Timestamp).seconds * 1000), "yyyy-MM-dd HH:mm:ss") : "";
        const u = users.find(u => u.uid === r.userId);
        const email = r.userEmail ?? u?.email ?? "—";
        const phone = r.userPhone ?? (u as any)?.phoneNumber ?? "—";
        const gender = r.userGender ?? (u as any)?.gender ?? "—";
        const campus = r.userCampus || (u as any)?.campus || "N/A";
        const ladderName =
          r.userLadderName ??
          (() => {
            const id = r.userLadderId ?? (u as any)?.classLadderId;
            if (!id) return "Not assigned";
            const L = ladderById.get(id);
            return L ? `${L.name}${L.side && L.side !== "none" ? ` (${L.side})` : ""}` : "Not assigned";
          })();

        const fields = [
          r.userName || u?.displayName || "",
          email,
          phone,
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
    link.download = `onsite_completions_page_${page}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const visibleLogRows = useMemo(() => {
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
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>On-Site Completion Log</CardTitle>
              <CardDescription>
                {selectedUser ? `Viewing logs for ${selectedUser.displayName || selectedUser.email}` : isModerator ? `Viewing logs for ${adminUser?.campus} campus` : "Viewing all logs"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                 <Input 
                  placeholder="Date From" 
                  type="date" 
                  value={dateFrom} 
                  onChange={e => setDateFrom(e.target.value)} 
                  className="w-full sm:w-auto"
                />
                <Input 
                  placeholder="Date To" 
                  type="date" 
                  value={dateTo} 
                  onChange={e => setDateTo(e.target.value)} 
                  className="w-full sm:w-auto"
                />
                <Input 
                  placeholder="Search page..." 
                  value={logSearchTerm} 
                  onChange={e => setLogSearchTerm(e.target.value)} 
                  className="w-full sm:w-auto"
                />
                <Button variant="outline" className="w-full sm:w-auto" onClick={handleDownloadCSV}><Download className="h-4 w-4 mr-2" />CSV</Button>
            </div>
        </CardHeader>
        <CardContent>
           <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={selectAllOnPage} onChange={toggleSelectAllOnPage} className="w-4 h-4" />
              <label className="text-sm font-medium">Select all on page</label>
              {selectedLogIds.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete selected ({selectedLogIds.size})
                </Button>
              )}
           </div>
           {isLoadingLog ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42px]"></TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Ladder</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Marked By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLogRows.map((oc: any) => {
                    const id = oc.id;
                    const checked = selectedLogIds.has(id);
                    const dateStr = oc.completedAt ? format(new Date((oc.completedAt as Timestamp).seconds * 1000), "PPP") : "N/A";

                    const u = users.find(u => u.uid === oc.userId);
                    const email = oc.userEmail ?? u?.email ?? "—";
                    const phone = oc.userPhone ?? (u as any)?.phoneNumber ?? "—";
                    const gender = oc.userGender ?? (u as any)?.gender ?? "—";
                    const campus = oc.userCampus || (u as any)?.campus || "N/A";
                    const ladderName =
                      oc.userLadderName ??
                      (() => {
                        const id = oc.userLadderId ?? (u as any)?.classLadderId;
                        if (!id) return "Not assigned";
                        const L = ladderById.get(id);
                        return L ? `${L.name}${L.side && L.side !== "none" ? ` (${L.side})` : ""}` : "Not assigned";
                      })();

                    return (
                      <TableRow key={id} className={checked ? "bg-muted/50" : undefined}>
                        <TableCell>
                          <input type="checkbox" checked={checked} onChange={() => toggleSelectLog(id)} />
                        </TableCell>
                        <TableCell>{oc.userName || u?.displayName || "—"}</TableCell>
                        <TableCell>{email}</TableCell>
                        <TableCell>{phone}</TableCell>
                        <TableCell className="capitalize">{gender}</TableCell>
                        <TableCell>{campus}</TableCell>
                        <TableCell>{ladderName}</TableCell>
                        <TableCell>{oc.courseName}</TableCell>
                        <TableCell>{dateStr}</TableCell>
                        <TableCell>{oc.markedBy || "N/A"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {visibleLogRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">No records on this page.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
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
            <span className="text-sm text-muted-foreground">Page {page} of ?</span>
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
