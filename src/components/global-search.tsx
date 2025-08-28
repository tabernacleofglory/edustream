"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, BookOpen, Video, FileText, X, Users } from "lucide-react";
import { getFirebaseFirestore } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query as firestoreQuery,
  where,
  documentId,
  Timestamp,
} from "firebase/firestore";
import type { Course, Video as VideoType, User } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useAuth } from "@/hooks/use-auth";

/* -------------------- Local helpers (no external deps) -------------------- */

// Lightweight debounce hook (replaces 'use-debounce' package)
function useDebounce<T>(value: T, delay = 300): [T] {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return [debounced];
}

// Local DocType (since '@/lib/types' doesn't export it)
type DocType = {
  id: string;
  title?: string;
  body?: string;
  content?: string;
};

// Convert Firestore Timestamps to serializable strings
const convertTimestamps = (data: any) => {
  if (data && typeof data === "object") {
    for (const key in data) {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate().toISOString();
      } else if (Array.isArray(data[key])) {
        data[key] = data[key].map((item) => convertTimestamps(item));
      } else if (typeof data[key] === "object" && data[key] !== null) {
        convertTimestamps(data[key]);
      }
    }
  }
  return data;
};

type ResultType = "course" | "video" | "document" | "user";

type LocalResult = {
  id: string;
  type: ResultType;
  title: string;
  url: string;
  score: number;
};

// Pure client-side matcher — no AI calls
function localSearch(
  query: string,
  data: {
    courses: any[];
    videos: any[];
    documentation: any[];
    users: any[];
  }
): LocalResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);
  const results: LocalResult[] = [];

  const scoreText = (text?: string) => {
    if (!text) return 0;
    const t = text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const idx = t.indexOf(term);
      if (idx >= 0) {
        score += 2; // hit
        if (idx < 16) score += 1; // early-hit bonus
      }
    }
    return score;
  };

  // Courses
  for (const c of data.courses) {
    const title = String(c.title ?? "");
    const desc = String(c.description ?? "");
    const cats = Array.isArray(c.Category) ? c.Category.join(" ") : String(c.Category ?? "");
    let score = 0;
    score += scoreText(title) * 3;
    score += scoreText(desc);
    score += scoreText(cats);
    if (score > 0) {
      results.push({
        id: c.id,
        type: "course",
        title: title || "Untitled course",
        url: `/courses/${c.id}`,
        score,
      });
    }
  }

  // Videos
  for (const v of data.videos) {
    const title = String(v.title ?? "");
    const courseTitle = String(v.courseTitle ?? "");
    let score = 0;
    score += scoreText(title) * 3;
    score += scoreText(courseTitle);
    if (score > 0) {
      results.push({
        id: v.id,
        type: "video",
        title: title || "Untitled video",
        url: `/courses/${v.courseId}/video/${v.id}`,
        score,
      });
    }
  }

  // Documentation
  for (const d of data.documentation) {
    const title = String(d.title ?? "");
    const body = String(d.body ?? d.content ?? "");
    let score = 0;
    score += scoreText(title) * 3;
    score += scoreText(body);
    if (score > 0) {
      results.push({
        id: d.id,
        type: "document",
        title: title || "Untitled document",
        url: `/docs/${d.id}`,
        score,
      });
    }
  }

  // Users (only if present)
  for (const u of data.users ?? []) {
    const name = String(u.displayName ?? u.name ?? "");
    const email = String(u.email ?? "");
    let score = 0;
    score += scoreText(name) * 3;
    score += scoreText(email);
    if (score > 0) {
      results.push({
        id: u.id,
        type: "user",
        title: name || email || "User",
        url: `/admin/users/${u.id}`,
        score,
      });
    }
  }

  results.sort((a, b) => (b.score - a.score) || a.title.localeCompare(b.title));
  return results.slice(0, 50);
}

/* ------------------------------- Component ------------------------------- */

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [results, setResults] = useState<LocalResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const db = getFirebaseFirestore();
  const isMobile = useIsMobile();
  const { hasPermission } = useAuth();

  const [searchableData, setSearchableData] = useState<{
    courses: any[];
    videos: any[];
    documentation: any[];
    users: any[];
  } | null>(null);

  // Preload searchable data
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Courses
        const coursesQuery = firestoreQuery(collection(db, "courses"));
        const coursesSnapshot = await getDocs(coursesQuery);
        const courses = coursesSnapshot.docs.map((doc) =>
          convertTimestamps({ id: doc.id, ...(doc.data() as Course) })
        );

        // Videos for those courses (chunked: Firestore 'in' max 10 IDs)
        const allVideoIds = courses.flatMap((course) => course.videos || []);
        let videos:
          | { id: string; title: any; courseId: any; courseTitle: any }[]
          | [] = [];

        if (allVideoIds.length > 0) {
          const chunkSize = 10;
          const chunks: string[][] = [];
          for (let i = 0; i < allVideoIds.length; i += chunkSize) {
            chunks.push(allVideoIds.slice(i, i + chunkSize));
          }

          const snaps = await Promise.all(
            chunks.map((chunk) =>
              getDocs(
                firestoreQuery(
                  collection(db, "Contents"),
                  where(documentId(), "in", chunk)
                )
              )
            )
          );

          const allVideoDocs = snaps.flatMap((s) => s.docs);

          videos = allVideoDocs
            .map((doc) => {
              const data = doc.data() as VideoType;
              const course = courses.find(
                (c) => Array.isArray(c.videos) && c.videos.includes(doc.id)
              );
              if (course) {
                return {
                  id: doc.id,
                  title: data.title,
                  courseId: course.id,
                  courseTitle: course.title,
                };
              }
              return null;
            })
            .filter(
              (v): v is { id: string; title: any; courseId: any; courseTitle: any } =>
                v !== null
            );
        }

        // Documentation
        const docsQuery = firestoreQuery(collection(db, "documentation"));
        const docsSnapshot = await getDocs(docsQuery);
        const documentation = docsSnapshot.docs.map((doc) =>
          convertTimestamps({ id: doc.id, ...(doc.data() as DocType) })
        );

        // Users (permission-gated)
        let users: User[] = [];
        if (hasPermission("manageUsers")) {
          const usersQuery = firestoreQuery(collection(db, "users"));
          const usersSnapshot = await getDocs(usersQuery);
          users = usersSnapshot.docs.map((doc) =>
            convertTimestamps({ id: doc.id, ...(doc.data() as User) })
          ) as any;
        }

        setSearchableData({
          courses,
          videos: videos as any[],
          documentation,
          users,
        });
      } catch (error) {
        console.error("Failed to fetch searchable data:", error);
      }
    };

    fetchAllData();
  }, [db, hasPermission]);

  // Run local search
  useEffect(() => {
    if (debouncedQuery.length > 2 && searchableData) {
      setIsLoading(true);
      try {
        const res = localSearch(debouncedQuery, searchableData);
        setResults(res);
      } finally {
        setIsLoading(false);
      }
    } else {
      setResults([]);
    }
  }, [debouncedQuery, searchableData]);

  // ⌘K / Ctrl+K toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectResult = (url: string) => {
    router.push(url);
    setIsOpen(false);
    setSearchQuery("");
  };

  const getIcon = (type: ResultType) => {
    switch (type) {
      case "course":
        return <BookOpen className="h-5 w-5 text-muted-foreground" />;
      case "video":
        return <Video className="h-5 w-5 text-muted-foreground" />;
      case "document":
        return <FileText className="h-5 w-5 text-muted-foreground" />;
      case "user":
        return <Users className="h-5 w-5 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <>
      {useIsMobile() ? (
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
          <Search className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          variant="outline"
          className="relative w-full justify-start text-muted-foreground"
          onClick={() => setIsOpen(true)}
        >
          <Search className="h-4 w-4 mr-2" />
          Search...
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Global Search</DialogTitle>
            <DialogDescription>
              Search for courses, videos, documents, and users (when permitted).
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for courses, videos, documents..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-2">
            {results.length > 0 ? (
              <div className="max-h-[450px] overflow-y-auto">
                {results.map((result) => (
                  <div
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectResult(result.url)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
                  >
                    {getIcon(result.type)}
                    <div className="flex-1">
                      <p className="font-semibold">{result.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {result.type}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !isLoading &&
              debouncedQuery.length > 2 && (
                <div className="text-center p-8 text-muted-foreground">
                  No results found for "{debouncedQuery}".
                </div>
              )
            )}
            {!debouncedQuery && !isLoading && (
              <div className="text-center p-8 text-muted-foreground">
                Start typing to search.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
