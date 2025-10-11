
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Course } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

interface CourseWithStatus extends Course {
  isEnrolled?: boolean;
  isCompleted?: boolean;
}

export default function AllCoursesPage() {
  const { user, isCurrentUserAdmin, loading: authLoading } = useAuth();
  const { processedCourses, allLadders, loading: coursesLoading, refresh } = useProcessedCourses();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLadderId, setSelectedLadderId] = useState<string>('all');
  const router = useRouter();
  const isMobile = useIsMobile();

  const loading = authLoading || coursesLoading;

  // Rule: Auto-Categorization on Login
  useEffect(() => {
    if (!loading && user && user.classLadderId) {
        setSelectedLadderId(user.classLadderId);
    } else if (!loading && !user) {
        // Default to showing the lowest ladder for guests
        const lowestLadder = allLadders.length > 0 ? allLadders[0] : null;
        if (lowestLadder) {
            setSelectedLadderId(lowestLadder.id);
        }
    }
  }, [loading, user, allLadders]);

  const filteredAndSortedCourses = useMemo(() => {
    let courses = processedCourses;
    
    if (selectedLadderId !== 'all') {
      courses = courses.filter(course => course.ladderIds?.includes(selectedLadderId));
    }
    
    if (searchTerm) {
      courses = courses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sort courses: incomplete first, then by order
    courses.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      return (a.order ?? Infinity) - (b.order ?? Infinity);
    });

    return courses;
  }, [searchTerm, processedCourses, selectedLadderId]);
  
  const groupedCourses = useMemo(() => {
    const groups: { [key: string]: CourseWithStatus[] } = {};
    
    filteredAndSortedCourses.forEach(course => {
      if (course.ladderIds && course.ladderIds.length > 0) {
        course.ladderIds.forEach(ladderId => {
          if (!groups[ladderId]) {
            groups[ladderId] = [];
          }
          groups[ladderId].push(course);
        });
      } else {
        if (!groups['uncategorized']) {
          groups['uncategorized'] = [];
        }
        groups['uncategorized'].push(course);
      }
    });

    // If a specific ladder is selected, only show that group
    if (selectedLadderId !== 'all') {
        const ladder = allLadders.find(l => l.id === selectedLadderId);
        if (ladder && groups[selectedLadderId]) {
            return [{
                ladderId: selectedLadderId,
                ladderName: ladder.name || 'Selected Ladder',
                order: ladder.order,
                courses: groups[selectedLadderId]
            }];
        }
        return []; // Return empty if no courses match the selected ladder
    }

    return Object.keys(groups).map(ladderId => {
        const ladder = allLadders.find(l => l.id === ladderId);
        return {
            ladderId,
            ladderName: ladder?.name || 'Uncategorized',
            order: ladder?.order ?? Infinity,
            courses: groups[ladderId]
        }
    }).sort((a, b) => {
        // Rule: Show user's current ladder first
        if (user?.classLadderId) {
            if (a.ladderId === user.classLadderId) return -1;
            if (b.ladderId === user.classLadderId) return 1;
        }
        return a.order - b.order;
    });

  }, [filteredAndSortedCourses, allLadders, user, selectedLadderId]);


  const onCourseUpdated = () => {
    refresh();
  }

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
             <Button onClick={() => router.push('/admin/courses?add=true')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Course
              </Button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by course title..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={selectedLadderId}
            onValueChange={setSelectedLadderId}
          >
            <SelectTrigger className="w-full md:w-[280px]">
              <SelectValue placeholder="Filter by Class Ladder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Class Ladders</SelectItem>
              {allLadders.map(ladder => (
                <SelectItem key={ladder.id} value={ladder.id}>{ladder.name} {ladder.side !== 'none' && `(${ladder.side})`}</SelectItem>
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
                            {Array.from({ length: 3 }).map((_, index) => (
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
                groupedCourses.map(group => (
                    <div key={group.ladderId} id={`ladder-group-${group.ladderId}`} className="scroll-mt-32">
                        <h3 className="font-headline text-2xl font-bold mb-4">{group.ladderName}</h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                        {group.courses.map((course) => (
                            <div key={course.id} className="relative group">
                                <CourseCard 
                                course={course} 
                                onChange={refresh} 
                                showEnroll={!user} 
                                isAdminView={false}
                                />
                                {isCurrentUserAdmin && (
                                <Button asChild size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500">
                                    <Link href={`/admin/courses?editCourseId=${course.id}`}>
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
