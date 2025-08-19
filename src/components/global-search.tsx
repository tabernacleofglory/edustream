
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "use-debounce";
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
import { globalSearch } from "@/ai/flows/global-search";
import type { GlobalSearchOutput } from "@/ai/flows/global-search";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, getDocs, query as firestoreQuery, where, documentId, Timestamp } from "firebase/firestore";
import type { Course, Video as VideoType, Documentation as DocType, User } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useAuth } from "@/hooks/use-auth";

// Helper to convert Firestore Timestamps to a serializable format
const convertTimestamps = (data: any) => {
  if (data && typeof data === 'object') {
    for (const key in data) {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate().toISOString();
      } else if (Array.isArray(data[key])) {
        data[key] = data[key].map(item => convertTimestamps(item));
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        convertTimestamps(data[key]);
      }
    }
  }
  return data;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [results, setResults] = useState<GlobalSearchOutput["results"]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const db = getFirebaseFirestore();
  const isMobile = useIsMobile();
  const { hasPermission } = useAuth();

  // Pre-fetch all searchable data once
  const [searchableData, setSearchableData] = useState<{
    courses: any[],
    videos: any[],
    documentation: any[],
    users: any[]
  } | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
        try {
            const coursesQuery = firestoreQuery(collection(db, 'courses'));
            const coursesSnapshot = await getDocs(coursesQuery);
            const courses = coursesSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() as Course }));

            const allVideoIds = courses.flatMap(course => course.videos || []);
            
            let videos: { id: string; title: any; courseId: any; courseTitle: any; }[] = [];

            if (allVideoIds.length > 0) {
              const videoChunks: string[][] = [];
              for (let i = 0; i < allVideoIds.length; i += 30) {
                  videoChunks.push(allVideoIds.slice(i, i + 30));
              }

              const videoPromises = videoChunks.map(chunk => 
                  getDocs(firestoreQuery(collection(db, 'Contents'), where(documentId(), 'in', chunk)))
              );
              
              const videoSnapshots = await Promise.all(videoPromises);
              
              const allVideoDocs = videoSnapshots.flatMap(snapshot => snapshot.docs);

              videos = allVideoDocs.map(doc => {
                  const data = doc.data();
                  const course = courses.find(c => Array.isArray(c.videos) && c.videos.includes(doc.id));
                  if (course) {
                      return { id: doc.id, title: data.title, courseId: course.id, courseTitle: course.title };
                  }
                  return null;
              }).filter((v): v is { id: string; title: any; courseId: any; courseTitle: any; } => v !== null);
            }


            const docsQuery = firestoreQuery(collection(db, 'documentation'));
            const docsSnapshot = await getDocs(docsQuery);
            const documentation = docsSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
            
            let users: User[] = [];
            // This is the crucial change: only fetch users if the user has permission.
            if(hasPermission('manageUsers')) {
                const usersQuery = firestoreQuery(collection(db, 'users'));
                const usersSnapshot = await getDocs(usersQuery);
                users = usersSnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() as User }));
            }
            

            setSearchableData({ courses, videos: videos as any[], documentation, users });
        } catch (error) {
            console.error("Failed to fetch searchable data:", error);
        }
    }
    fetchAllData();
  }, [db, hasPermission]);

  useEffect(() => {
    if (debouncedQuery.length > 2 && searchableData) {
      setIsLoading(true);
      globalSearch({ 
          query: debouncedQuery, 
          ...searchableData
      })
        .then((res) => setResults(res.results))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    } else {
      setResults([]);
    }
  }, [debouncedQuery, searchableData]);

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
    setSearchQuery('');
  };

  const getIcon = (type: 'course' | 'video' | 'document' | 'user') => {
      switch(type) {
          case 'course': return <BookOpen className="h-5 w-5 text-muted-foreground" />;
          case 'video': return <Video className="h-5 w-5 text-muted-foreground" />;
          case 'document': return <FileText className="h-5 w-5 text-muted-foreground" />;
          case 'user': return <Users className="h-5 w-5 text-muted-foreground" />;
          default: return null;
      }
  }

  return (
    <>
      {isMobile ? (
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
            <DialogDescription>Search for courses, videos, or documents across the entire platform.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for courses, videos, or documents..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
            />
             {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="ml-2">
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
                            <p className="text-xs text-muted-foreground capitalize">{result.type}</p>
                        </div>
                    </div>
                ))}
              </div>
            ) : (
                !isLoading && debouncedQuery.length > 2 && (
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
