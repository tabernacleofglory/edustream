
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit, Filter, Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Course } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";


interface CourseWithStatus extends Course {
  isEnrolled?: boolean;
  isCompleted?: boolean;
}

export default function MinistryTrainingPage() {
  const { user, isCurrentUserAdmin, loading: authLoading } = useAuth();
  const { processedCourses, allLadders, loading: coursesLoading, refresh } = useProcessedCourses();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLadderId, setSelectedLadderId] = useState<string>('all');
  const router = useRouter();
  const isMobile = useIsMobile();

  const [allMinistries, setAllMinistries] = useState<{id: string, name: string}[]>([]);
  const [selectedMinistry, setSelectedMinistry] = useState<string>('all');

  const loading = authLoading || coursesLoading;
  
  useEffect(() => {
    const fetchMinistries = async () => {
      try {
        const ministriesSnapshot = await getDocs(query(collection(db, "ministries"), orderBy("name")));
        setAllMinistries(ministriesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
      } catch (error) {
        console.error("Error fetching ministries:", error);
      }
    };
    fetchMinistries();
  }, []);

  // Auto-select user's ministry
  useEffect(() => {
    if (user?.ministry && allMinistries.length > 0) {
      let firstMinistryName: string | undefined;
      if (typeof user.ministry === 'string') {
        firstMinistryName = user.ministry.split(',')[0].trim();
      } else if (Array.isArray(user.ministry) && user.ministry.length > 0) {
        firstMinistryName = user.ministry[0];
      }

      if (firstMinistryName) {
        const userMinistry = allMinistries.find(m => m.name === firstMinistryName);
        if (userMinistry) {
          setSelectedMinistry(userMinistry.id);
        }
      }
    }
  }, [user, allMinistries]);

  const ministryLadders = useMemo(() => {
    return allLadders.filter(l => l.side === 'ministry');
  }, [allLadders]);

  // Rule: Auto-Categorization on Login
  useEffect(() => {
    if (!loading && ministryLadders.length > 0) {
        if (user && user.classLadderId) {
            const userIsOnMinistryLadder = ministryLadders.some(l => l.id === user.classLadderId);
            if (userIsOnMinistryLadder) {
                setSelectedLadderId(user.classLadderId);
            } else {
                // Default to 'Volunteer' if user's ladder is not a ministry one
                const volunteerLadder = ministryLadders.find(l => l.name === 'Volunteer');
                if (volunteerLadder) {
                    setSelectedLadderId(volunteerLadder.id);
                } else if (ministryLadders.length > 0) {
                    setSelectedLadderId(ministryLadders[0].id); // Fallback to the first ministry ladder
                }
            }
        } else if (!user) {
            // Default guests to 'Volunteer'
            const volunteerLadder = ministryLadders.find(l => l.name === 'Volunteer');
            if (volunteerLadder) {
                setSelectedLadderId(volunteerLadder.id);
            } else if (ministryLadders.length > 0) {
                setSelectedLadderId(ministryLadders[0].id); // Fallback
            }
        }
    }
  }, [loading, user, ministryLadders]);
  
  const isNewMember = useMemo(() => {
    const newMemberLadder = allLadders.find(l => l.name === 'New Member');
    return user?.classLadderId === newMemberLadder?.id;
  }, [user, allLadders]);

  const filteredAndSortedCourses = useMemo(() => {
    // Language filtering is now handled internally by useProcessedCourses hook
    let courses = processedCourses.filter(course => 
        (course.ladderIds?.some(id => ministryLadders.some(ml => ml.id === id)))
    );
    
    if (selectedLadderId !== 'all') {
      courses = courses.filter(course => course.ladderIds?.includes(selectedLadderId));
    }

    if (selectedMinistry !== 'all') {
        const ministry = allMinistries.find(m => m.id === selectedMinistry);
        if (ministry) {
            courses = courses.filter(course => course.ministryIds?.includes(ministry.id));
        }
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
  }, [searchTerm, processedCourses, selectedLadderId, selectedMinistry, ministryLadders, allMinistries]);
  
  const groupedCourses = useMemo(() => {
    const groups: { [key: string]: CourseWithStatus[] } = {};
    
    filteredAndSortedCourses.forEach(course => {
      if (course.ladderIds && course.ladderIds.length > 0) {
        const relevantLadders = course.ladderIds.filter(id => ministryLadders.some(l => l.id === id));
        relevantLadders.forEach(ladderId => {
          if (!groups[ladderId]) {
            groups[ladderId] = [];
          }
          groups[ladderId].push(course);
        });
      }
    });

    // If a specific ladder is selected, only show that group
    if (selectedLadderId !== 'all') {
        const ladder = ministryLadders.find(l => l.id === selectedLadderId);
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
        const ladder = ministryLadders.find(l => l.id === ladderId);
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

  }, [filteredAndSortedCourses, ministryLadders, user, selectedLadderId]);


  if (isNewMember && !loading) {
    return (
         <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
             <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                <Lock className="h-4 w-4 !text-blue-800" />
                <AlertTitle>Content Locked</AlertTitle>
                <AlertDescription>
                    This section is not available for New Members. Please complete your assigned courses in the "All Courses" section to unlock more content.
                </AlertDescription>
            </Alert>
         </div>
    )
  }


  const onCourseUpdated = () => {
    refresh();
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h4 className="font-headline text-3xl font-bold md:text-4xl">
              Ministry Training
            </h4>
            <p className="text-muted-foreground">
              Courses designed for ministry-specific roles and development.
            </p>
          </div>
          {isCurrentUserAdmin && (
             <Button onClick={() => router.push('/admin/courses?add=true')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Course
              </Button>
          )}
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Ministry-Specific Courses</AlertTitle>
          <AlertDescription>
            This page only displays courses that are assigned to a ladder with the "Ministry" side.
          </AlertDescription>
        </Alert>

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
              <SelectValue placeholder="Filter by Ministry Ladder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ministry Ladders</SelectItem>
              {ministryLadders.map(ladder => (
                <SelectItem key={ladder.id} value={ladder.id}>{ladder.name} ({ladder.side})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedMinistry}
            onValueChange={setSelectedMinistry}
          >
            <SelectTrigger className="w-full md:w-[280px]">
              <SelectValue placeholder="All Ministries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ministries</SelectItem>
              {allMinistries.map(ministry => (
                <SelectItem key={ministry.id} value={ministry.id}>{ministry.name}</SelectItem>
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
                    <p>No ministry courses match your current filters.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
