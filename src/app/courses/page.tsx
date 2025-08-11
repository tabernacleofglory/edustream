
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import AddCourseForm from "@/components/add-course-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Course } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { useRouter } from "next/navigation";

export default function AllCoursesPage() {
  const { isCurrentUserAdmin } = useAuth();
  const { processedCourses, loading, refresh } = useProcessedCourses(true); // Fetch all courses, not just for the user's ladder
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const router = useRouter();


  const filteredCourses = useMemo(() => {
    if (!searchTerm) {
      return processedCourses;
    }
    return processedCourses.filter(course =>
      course.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, processedCourses]);

  const onCourseUpdated = () => {
    setIsSheetOpen(false);
    refresh();
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="font-headline text-3xl font-bold md:text-4xl">
              All Courses
            </h1>
            <p className="text-muted-foreground">
              Expand your knowledge with our extensive library.
            </p>
          </div>
          {isCurrentUserAdmin && (
             <Button onClick={() => router.push('/admin/courses?add=true')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Course
              </Button>
          )}
        </div>

        <div className="md:sticky top-16 z-10 bg-background/95 backdrop-blur-sm -mx-6 px-6 py-4 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))
          ) : (
            filteredCourses.map((course) => (
              <div key={course.id} className="relative group">
                <CourseCard course={course} onUnenroll={refresh} />
                {isCurrentUserAdmin && (
                  <Button asChild size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500">
                    <Link href={`/admin/courses?editCourseId=${course.id}`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
