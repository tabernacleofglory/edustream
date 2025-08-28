"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Course } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CourseWithStatus extends Course {
  isEnrolled?: boolean;
  isCompleted?: boolean;
}

export default function AllCoursesPage() {
  const { user, isCurrentUserAdmin, loading: authLoading } = useAuth();
  const { processedCourses, allLadders, loading: coursesLoading, refresh } =
    useProcessedCourses(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLadderId, setSelectedLadderId] = useState<string>("all");
  const router = useRouter();

  const loading = authLoading || coursesLoading;

  // Auto-select ladder on first load, but don't override a user's manual choice later.
  useEffect(() => {
    if (loading) return;

    setSelectedLadderId((prev) => {
      if (prev !== "all") return prev; // user already chose something

      if (user?.classLadderId) return user.classLadderId;

      if (!user && allLadders.length > 0) return allLadders[0].id;

      return prev;
    });
  }, [loading, user, allLadders]);

  const filteredAndSortedCourses = useMemo(() => {
    let list = processedCourses;

    if (selectedLadderId !== "all") {
      list = list.filter((c) => c.ladderIds?.includes(selectedLadderId));
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((c) => {
        const title = String(c.title ?? "").toLowerCase();
        const desc = String(c.description ?? "").toLowerCase();
        const cats = Array.isArray(c.Category)
          ? c.Category.join(" ").toLowerCase()
          : String(c.Category ?? "").toLowerCase();
        return title.includes(q) || desc.includes(q) || cats.includes(q);
      });
    }

    // clone before sort to avoid mutating source state
    const sorted = [...list].sort((a, b) => {
      if ((a.isCompleted ?? false) !== (b.isCompleted ?? false)) {
        return a.isCompleted ? 1 : -1; // incomplete first
      }
      return (a.order ?? Infinity) - (b.order ?? Infinity);
    });

    return sorted;
  }, [searchTerm, processedCourses, selectedLadderId]);

  const groupedCourses = useMemo(() => {
    // Group by ladder ID(s)
    const groups: Record<string, CourseWithStatus[]> = {};

    filteredAndSortedCourses.forEach((course) => {
      if (course.ladderIds && course.ladderIds.length > 0) {
        course.ladderIds.forEach((lid) => {
          if (!groups[lid]) groups[lid] = [];
          groups[lid].push(course);
        });
      } else {
        if (!groups["uncategorized"]) groups["uncategorized"] = [];
        groups["uncategorized"].push(course);
      }
    });

    // If a specific ladder is selected, only show that group
    if (selectedLadderId !== "all") {
      const ladder = allLadders.find((l) => l.id === selectedLadderId);
      if (ladder && groups[selectedLadderId]) {
        return [
          {
            ladderId: selectedLadderId,
            ladderName: ladder.name || "Selected Ladder",
            order: ladder.order,
            courses: groups[selectedLadderId],
          },
        ];
      }
      return [];
    }

    // Otherwise map all groups and sort by ladder order (user's ladder first)
    const all = Object.keys(groups).map((ladderId) => {
      const ladder = allLadders.find((l) => l.id === ladderId);
      return {
        ladderId,
        ladderName: ladder?.name || "Uncategorized",
        order: ladder?.order ?? Infinity,
        courses: groups[ladderId],
      };
    });

    all.sort((a, b) => {
      if (user?.classLadderId) {
        if (a.ladderId === user.classLadderId) return -1;
        if (b.ladderId === user.classLadderId) return 1;
      }
      return a.order - b.order;
    });

    return all;
  }, [filteredAndSortedCourses, allLadders, user, selectedLadderId]);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h4 className="font-headline text-3xl font-bold md:text-4xl">
              COURSES
            </h4>
            <p className="text-muted-foreground">
              Expand your knowledge with our extensive library.
            </p>
          </div>
          {isCurrentUserAdmin && (
            <Button onClick={() => router.push("/admin/courses?add=true")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </Button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by title, description, or category..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={selectedLadderId} onValueChange={setSelectedLadderId}>
            <SelectTrigger className="w-full md:w-[280px]">
              <SelectValue placeholder="Filter by Class Ladder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Class Ladders</SelectItem>
              {allLadders.map((ladder) => (
                <SelectItem key={ladder.id} value={ladder.id}>
                  {ladder.name}{" "}
                  {ladder.side !== "none" && `(${ladder.side})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-12">
          {loading ? (
            Array.from({ length: 2 }).map((_, groupIndex) => (
              <div key={groupIndex} className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((__, index) => (
                    <div key={index} className="space-y-4">
                      <Skeleton className="h-48 w-full" />
                      <div className="space-y-2 p-4">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : groupedCourses.length > 0 ? (
            groupedCourses.map((group) => (
              <div
                key={group.ladderId}
                id={`ladder-group-${group.ladderId}`}
                className="scroll-mt-32"
              >
                <h3 className="font-headline text-2xl font-bold mb-4">
                  {group.ladderName}
                </h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {group.courses.map((course) => (
                    <div key={course.id} className="relative group">
                      <CourseCard
                        course={course}
                        onChange={refresh} // unified refresh
                        showEnroll={!user}
                        isAdminView={false}
                      />
                      {isCurrentUserAdmin && (
                        <Button
                          asChild
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500"
                        >
                          <Link
                            href={`/admin/courses?editCourseId=${course.id}`}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p>No courses match your current filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
