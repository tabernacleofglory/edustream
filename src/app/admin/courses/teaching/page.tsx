
"use client";

import { useEffect, useState, useMemo } from "react";
import { TeachingCard } from "@/components/teaching-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import type { Course } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CourseWithStatus extends Course {
  isEnrolled?: boolean;
  isCompleted?: boolean;
}

export default function AdminTeachingPage() {
  const { hasPermission } = useAuth();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const db = getFirebaseFirestore();

  const canViewPage = hasPermission('viewCourseManagement');

  useEffect(() => {
    const fetchCatalogData = async () => {
      if (!canViewPage) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const coursesQuery = query(collection(db, 'courses'), where('status', '==', 'published'));
        const categoriesQuery = query(collection(db, 'courseCategories'), orderBy('name'));

        const [coursesSnapshot, categoriesSnapshot] = await Promise.all([
          getDocs(coursesQuery),
          getDocs(categoriesQuery),
        ]);

        const coursesList = coursesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
            } as Course;
        }).sort((a,b) => (a.order ?? 999) - (b.order ?? 999));
        
        const categoriesList = categoriesSnapshot.docs.map(doc => doc.data().name as string);

        setAllCourses(coursesList);
        setCategories(categoriesList);
      } catch (error) {
        console.error("Failed to fetch course catalog:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogData();
  }, [canViewPage, db]);

  const filteredCourses = useMemo(() => {
    let courses = allCourses;

    if (selectedCategory) {
      courses = courses.filter(course =>
        Array.isArray(course.Category)
          ? course.Category.includes(selectedCategory)
          : course.Category === selectedCategory
      );
    }

    if (searchTerm) {
      courses = courses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return courses;
  }, [selectedCategory, searchTerm, allCourses]);

  if (!canViewPage) {
    return <p>You do not have permission to view this page.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Published Teaching Catalog
        </h1>
        <p className="text-muted-foreground">
          A view of all published courses on the platform, without restrictions.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by course title..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(null)}
            className="flex-shrink-0"
          >
            All Categories
          </Button>
          {categories.slice(0, 5).map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(category)}
              className="flex-shrink-0"
            >
              {category}
            </Button>
          ))}
          {categories.length > 5 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-shrink-0">
                  <Filter className="mr-2 h-4 w-4" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {categories.slice(5).map((category) => (
                  <DropdownMenuItem
                    key={category}
                    onSelect={() => setSelectedCategory(category)}
                  >
                    {category}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
            <TeachingCard
              key={course.id}
              course={course}
            />
          ))
        )}
      </div>
      {filteredCourses.length === 0 && !loading && (
        <div className="text-center py-16 text-muted-foreground col-span-full">
            <p>No published courses match your filters.</p>
        </div>
      )}
    </div>
  );
}
