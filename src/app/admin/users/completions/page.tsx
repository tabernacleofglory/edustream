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
import type { User, Course, OnsiteCompletion } from "@/lib/types";

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
import { Loader2, Search, CheckCircle2, Trash2, Download } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const PAGE_SIZE_DEFAULT = 25;

const getInitials = (name?: string | null) =>
  (!name ? "U" : name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join(""));

const chunk = <T,>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

export default function ManageCompletionsPage() {
  const db = getFirebaseFirestore(getFirebaseApp());
  const { user: adminUser } = useAuth();
  const { toast } = useToast();

  // Lists
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(true);

  // Selections (left and middle panes)
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [userLoggedCourseIds, setUserLoggedCourseIds] = useState<Set<string>>(new Set());

  // Save state
  const [isSaving, setIsSaving] = useState(false);

  // Log (right / bottom pane) state
  const [logRows, setLogRows] = useState<(OnsiteCompletion & { id: string })[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<DocumentSnapshot[]>([]); // cursor stack for startAfter
  const [hasNextPage, setHasNextPage] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState<string>(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>("");   // yyyy-mm-dd
  const [logSearchTerm, setLogSearchTerm] = useState(""); // simple client-side search over displayed page
  // Selection (log rows)
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [selectAllOnPage, setSelectAllOnPage] = useState(false);

  // --- Load users & courses (once) ---
  useEffect(() => {
    (async () => {
      setIsLoadingLists(true);
      try {
        const usersSnap = await getDocs(query(collection(db, "users"), orderBy("displayName")));
        const coursesSnap = await getDocs(
          query(collection(db, "courses"), where("status", "==", "published"), orderBy("title"))
        );
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
        setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
      } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "Failed to load users/courses." });
      } finally {
        setIsLoadingLists(false);
      }
    })();
  }, [db, toast]);

  // --- When user changes: refresh “already logged” set + reset course selection + reset pagination ---
  useEffect(() => {
    (async () => {
      setUserLoggedCourseIds(new Set());
      setSelectedCourseIds(new Set());
      setPage(1);
      setCursors([]);
      if (!selectedUser) return;

      // Build set of courseIds already logged for this user
      const seen = new Set<string>();
      // Use batched reads (pagination not needed here, we only need IDs)
      // We query by userId and pull all; if you have huge data, add a limit+cursor loop.
      const snap = await getDocs(
        query(collection(db, "onsiteCompletions"), where("userId", "==", selectedUser.uid))
      );
      snap.forEach(d => {
        const data = d.data() as any;
        if (data?.courseId) seen.add(data.courseId);
      });
      setUserLoggedCourseIds(seen);

      // Also (re)load log page 1 for this user
      await loadLogPage(1, [], selectedUser, dateFrom, dateTo, pageSize);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  // --- If filters change: reset to page 1 and reload ---
  useEffect(() => {
    if (!selectedUser) return;
    setPage(1);
    setCursors([]);
    loadLogPage(1, [], selectedUser, dateFrom, dateTo, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, pageSize, selectedUser]);

  // --- Helpers: user/course filtered lists ---
  const filteredUsers = useMemo(() => {
    const q = userSearchTerm.toLowerCase();
    return users.filter(
      u => (u.displayName || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
    );
  }, [users, userSearchTerm]);

  const filteredCourses = useMemo(() => {
    const q = courseSearchTerm.toLowerCase();
    return courses.filter(c => (c.title || "").toLowerCase().includes(q));
  }, [courses, courseSearchTerm]);

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

  // --- Save: create one doc per selected course (skip dupes) ---
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
      // client-side dedupe
      const candidateIds = toSaveIds.filter(id => !userLoggedCourseIds.has(id));
      if (candidateIds.length === 0) {
        toast({ variant: "destructive", title: "Already logged", description: "All selected courses are already logged." });
        setIsSaving(false);
        return;
      }

      // server-side dedupe (race-safe) with "in" queries in chunks of 10
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

      const userCampus =
        (selectedUser as any).campus ||
        (selectedUser as any).userCampus ||
        selectedUser.locationPreference ||
        "N/A";

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
          })
        )
      );

      toast({
        title: "Logged onsite completions",
        description: `Created ${finalToCreate.length}. Skipped ${serverExisting.size} duplicate(s).`,
      });

      // Clear selections and refresh page 1
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

  // --- Fetch paginated log for selected user + date filters ---
  async function loadLogPage(
    targetPage: number,
    cursorStack: DocumentSnapshot[],
    user: User,
    from: string,
    to: string,
    size: number
  ) {
    setIsLoadingLog(true);
    setSelectedLogIds(new Set());
    setSelectAllOnPage(false);

    try {
      const col = collection(db, "onsiteCompletions");
      const baseClauses: any[] = [where("userId", "==", user.uid)];

      // Date range: inclusive day range (convert yyyy-mm-dd to T00:00 / T23:59:59)
      if (from) {
        const startDate = new Date(from);
        baseClauses.push(where("completedAt", ">=", Timestamp.fromDate(new Date(startDate.setHours(0, 0, 0, 0)))));
      }
      if (to) {
        const endDate = new Date(to);
        baseClauses.push(where("completedAt", "<=", Timestamp.fromDate(new Date(endDate.setHours(23, 59, 59, 999)))));
      }

      // Important: Firestore may require a composite index for (userId, completedAt) with the chosen directions
      // If Console prompts for an index, create it once.

      let qRef = query(col, ...baseClauses, orderBy("completedAt", "desc"), limit(size + 1)); // +1 to know if next page exists

      // Apply cursor for pages > 1
      if (targetPage > 1 && cursorStack[targetPage - 2]) {
        qRef = query(col, ...baseClauses, orderBy("completedAt", "desc"), startAfter(cursorStack[targetPage - 2]), limit(size + 1));
      }

      const snap = await getDocs(qRef);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const pageHasNext = docs.length > size;

      const pageDocs = pageHasNext ? docs.slice(0, size) : docs;
      setLogRows(pageDocs);

      // update cursors stack
      const newStack = [...cursorStack];
      if (pageDocs.length > 0) {
        newStack[targetPage - 1] = snap.docs[Math.min(size - 1, snap.docs.length - 1)]; // last visible of this page
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

  // --- Pagination handlers ---
  const goPrev = async () => {
    if (!selectedUser) return;
    if (page <= 1) return;
    await loadLogPage(page - 1, cursors, selectedUser, dateFrom, dateTo, pageSize);
  };

  const goNext = async () => {
    if (!selectedUser) return;
    if (!hasNextPage) return;
    await loadLogPage(page + 1, cursors, selectedUser, dateFrom, dateTo, pageSize);
  };

  // --- Log selection ---
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

  // --- Bulk delete selected log rows ---
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

      // Refresh current page (could have fewer rows now)
      if (selectedUser) {
        await loadLogPage(page, cursors, selectedUser, dateFrom, dateTo, pageSize);
      }
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Delete failed", description: e?.message || "Could not delete records." });
    } finally {
      setSelectedLogIds(new Set());
      setSelectAllOnPage(false);
    }
  };

  // --- CSV download for current (filtered) page ---
  const handleDownloadCSV = () => {
    if (logRows.length === 0) {
      toast({ variant: "destructive", title: "No rows to download." });
      return;
    }
    const header = ["User", "Campus", "Course", "Date", "Marked By"];
    const lines = [
      header.join(","),
      ...logRows.map((r: any) => {
        const dateStr = r.completedAt ? format(new Date((r.completedAt as Timestamp).seconds * 1000), "yyyy-MM-dd HH:mm:ss") : "";
        const fields = [
          r.userName || "",
          r.userCampus || "",
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

  // --- Client-side quick filter over displayed page (logSearchTerm) ---
  const visibleLogRows = useMemo(() => {
    if (!logSearchTerm) return logRows;
    const q = logSearchTerm.toLowerCase();
    return logRows.filter((r: any) =>
      (r.userName || "").toLowerCase().includes(q) ||
      (r.userCampus || "").toLowerCase().includes(q) ||
      (r.courseName || "").toLowerCase().includes(q) ||
      (r.markedBy || "").toLowerCase().includes(q)
    );
  }, [logRows, logSearchTerm]);

  // UI
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">Manage Course Completions</h1>
        <p className="text-muted-foreground">Select a user, select one or more courses, then save to log onsite completions (one row per course). The log supports filtering, CSV download, pagination, and bulk delete.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
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
                        onClick={() => { setSelectedUser(u); setSelectedCourseIds(new Set()); }}
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

        {/* Courses (multi-select) */}
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

        {/* Filters & CSV */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Log Filters</CardTitle>
            <CardDescription>Filter by completion date and export the current page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">Date from</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Date to</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Search (on page)</label>
              <Input placeholder="Find in page…" value={logSearchTerm} onChange={e => setLogSearchTerm(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Rows per page</label>
              <Input type="number" min={5} max={200} value={pageSize} onChange={e => setPageSize(Math.max(5, Math.min(200, Number(e.target.value) || PAGE_SIZE_DEFAULT)))} />
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" className="w-full" onClick={handleDownloadCSV}>
              <Download className="h-4 w-4 mr-2" /> CSV (this page)
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Log table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Onsite Completion Log</CardTitle>
            <CardDescription>
              {selectedUser ? `Viewing logs for ${selectedUser.displayName || selectedUser.email}` : "Pick a user to load logs"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" disabled={selectedLogIds.size === 0} onClick={handleDeleteSelected}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete selected
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedUser ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">No user selected.</div>
          ) : isLoadingLog ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42px]">
                      <input type="checkbox" checked={selectAllOnPage} onChange={toggleSelectAllOnPage} />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Campus</TableHead>
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
                    return (
                      <TableRow key={id} className={checked ? "bg-muted/50" : undefined}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectLog(id)}
                          />
                        </TableCell>
                        <TableCell>{oc.userName}</TableCell>
                        <TableCell>{oc.userCampus || "N/A"}</TableCell>
                        <TableCell>{oc.courseName}</TableCell>
                        <TableCell>{dateStr}</TableCell>
                        <TableCell>{oc.markedBy || "N/A"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {visibleLogRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">No records on this page.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Page {page}{hasNextPage ? "" : " (last)"} • {visibleLogRows.length} row(s)</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={goPrev} disabled={!selectedUser || page <= 1}>Previous</Button>
            <Button variant="outline" onClick={goNext} disabled={!selectedUser || !hasNextPage}>Next</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
