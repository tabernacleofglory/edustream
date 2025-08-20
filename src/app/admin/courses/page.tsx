
"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Plus, Edit, Trash2 } from "lucide-react";
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
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from "firebase/firestore";
import type { Course, Enrollment, UserProgress as UserProgressType, Ladder } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";


interface CourseWithStatus extends Course {
  isEnrolled?: boolean;
  isCompleted?: boolean;
}

function AdminCoursesPageContent() {
  const { user, loading: authLoading, isCurrentUserAdmin, hasPermission } = useAuth();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<CourseWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLadderId, setSelectedLadderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { toast } = useToast();
  const db = getFirebaseFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const editCourseId = searchParams.get('editCourseId');

  useEffect(() => {
    if (editCourseId) {
      setIsSheetOpen(true);
    }
  }, [editCourseId]);

  const canAddCourses = hasPermission('addCourses');

  const fetchAllCourses = async () => {
    setLoading(true);
    const coursesCollection = collection(db, 'courses');
    const coursesSnapshot = await getDocs(query(coursesCollection, orderBy('createdAt', 'desc')));
    const coursesList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
    setAllCourses(coursesList);
    setLoading(false);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);

      const categoriesCollection = collection(db, 'courseCategories');
      const categoriesSnapshot = await getDocs(categoriesCollection);
      const categoriesList = categoriesSnapshot.docs.map(doc => doc.data().name as string);
      setCategories(categoriesList);

      const laddersQuery = query(collection(db, "courseLevels"), orderBy("order"));
      const laddersSnapshot = await getDocs(laddersQuery);
      const laddersList = laddersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder));
      setLadders(laddersList);

      await fetchAllCourses();

      setLoading(false);
    };
    
    if (!authLoading) {
      fetchInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, db]);

  useEffect(() => {
    let courses = allCourses;

    if (selectedCategory) {
      courses = courses.filter(course => Array.isArray(course.Category) ? course.Category.includes(selectedCategory) : course.Category === selectedCategory);
    }
    
    if (selectedLadderId) {
      courses = courses.filter(course => course.ladderIds?.includes(selectedLadderId));
    }

    if (searchTerm) {
      courses = courses.filter(course => course.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    setFilteredCourses(courses);
  }, [selectedCategory, selectedLadderId, searchTerm, allCourses]);

  const handleCategoryClick = (category: string | null) => {
    setSelectedCategory(category);
  };
  
  const onCourseUpdated = () => {
    setIsSheetOpen(false);
    router.replace('/admin/courses'); // Clear query param
    fetchAllCourses();
  }

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await deleteDoc(doc(db, "courses", courseId));
      toast({
        title: "Course Deleted",
        description: "The course has been successfully removed.",
      });
      await fetchAllCourses();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not delete the course. Please try again.",
      });
    }
  };

  const handleAddCourse = () => {
    router.replace('/admin/courses?add=true');
    setIsSheetOpen(true);
  }

  const handleEditCourse = (course: CourseWithStatus) => {
    router.replace(`/admin/courses?editCourseId=${course.id}`);
    setIsSheetOpen(true);
  }

  const handleDuplicateCourse = (course: CourseWithStatus) => {
    router.replace(`/admin/courses?editCourseId=${course.id}&duplicate=true`);
    setIsSheetOpen(true);
  }

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
        router.replace('/admin/courses');
    }
  }

  const MAX_DESKTOP_BUTTONS = 4;
  const visibleLadders = isMobile ? [] : ladders.slice(0, MAX_DESKTOP_BUTTONS);
  const hiddenLadders = isMobile ? ladders : ladders.slice(MAX_DESKTOP_BUTTONS);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold md:text-4xl">
            Course Management
          </h1>
          <p className="text-muted-foreground">
            Create, view, and edit courses in your catalog.
          </p>
        </div>
        {canAddCourses && (
            <Button onClick={handleAddCourse}>
                <Plus className="mr-2 h-4 w-4" />
                Add Course
            </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-2">
            {isMobile ? (
                 <Select
                    value={selectedLadderId || "all"}
                    onValueChange={(value) => setSelectedLadderId(value === "all" ? null : value)}
                    >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Class Ladders" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Class Ladders</SelectItem>
                        {ladders.map(ladder => (
                            <SelectItem key={ladder.id} value={ladder.id}>{ladder.name} {ladder.side !== 'none' && `(${ladder.side})`}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <Button
                        variant={selectedLadderId === null ? 'default' : 'outline'}
                        onClick={() => setSelectedLadderId(null)}
                        className="flex-shrink-0"
                    >
                        All Ladders
                    </Button>
                    {visibleLadders.map(ladder => (
                        <Button
                            key={ladder.id}
                            variant={selectedLadderId === ladder.id ? 'default' : 'outline'}
                            onClick={() => setSelectedLadderId(ladder.id)}
                            className="flex-shrink-0"
                        >
                            {ladder.name} {ladder.side !== 'none' && `(${ladder.side})`}
                        </Button>
                    ))}
                    {hiddenLadders.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="flex-shrink-0">
                                    <Filter className="mr-2 h-4 w-4" />
                                    More
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {hiddenLadders.map((ladder) => (
                                    <DropdownMenuItem key={ladder.id} onSelect={() => setSelectedLadderId(ladder.id)}>
                                        {ladder.name} {ladder.side !== 'none' && `(${ladder.side})`}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              <Button
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  onClick={() => handleCategoryClick(null)}
                  className="flex-shrink-0"
              >
                  All Categories
              </Button>
              {categories.slice(0, 4).map((category) => (
                  <Button
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'outline'}
                      onClick={() => handleCategoryClick(category)}
                      className="flex-shrink-0"
                  >
                      {category}
                  </Button>
              ))}
              {categories.length > 4 && (
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="flex-shrink-0">
                              <Filter className="mr-2 h-4 w-4" />
                              More
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                          {categories.slice(4).map((category) => (
                              <DropdownMenuItem
                                  key={category}
                                  onSelect={() => handleCategoryClick(category)}
                              >
                                  {category}
                              </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                  </DropdownMenu>
              )}
          </div>
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
              <CourseCard 
                key={course.id} 
                course={course}
                onEdit={isCurrentUserAdmin ? () => handleEditCourse(course) : undefined}
                onDelete={isCurrentUserAdmin ? () => handleDeleteCourse(course.id) : undefined}
                onDuplicate={isCurrentUserAdmin ? () => handleDuplicateCourse(course) : undefined}
                isAdminView={isCurrentUserAdmin}
              />
            ))
        )}
      </div>

       <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
            <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl p-0">
                <ScrollArea className="h-screen">
                    <SheetHeader className="p-6 sticky top-0 bg-background z-10">
                        <SheetTitle>{editCourseId ? 'Edit Course' : 'Create a New Course'}</SheetTitle>
                    </SheetHeader>
                    <div className="p-6 pt-0">
                        <AddCourseForm allCourses={allCourses} onCourseUpdated={onCourseUpdated} />
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    </div>
  );
}

export default function AdminCoursesPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AdminCoursesPageContent />
        </Suspense>
    );
}
