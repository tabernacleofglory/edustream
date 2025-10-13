
"use client";

import { useState, useMemo, useEffect } from "react";
import { CourseCard } from "./course-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "./ui/button";
import { ArrowRight, Loader2, Send, Trophy } from "lucide-react";
import { Progress } from "./ui/progress";
import { useToast } from "@/hooks/use-toast";
import { requestPromotion } from "@/lib/user-actions";
import AnnouncementCard from "./announcement-card";


const progressChartConfig = {
    progress: {
        label: "Progress",
        color: "hsl(var(--primary))",
    },
} satisfies ChartConfig;

function RecommendationsLoading() {
  return (
    <CarouselContent>
      {Array.from({ length: 3 }).map((_, index) => (
        <CarouselItem key={index} className="basis-full md:basis-1/2 lg:basis-1/3">
          <div className="p-1">
            <Card>
              <CardHeader className="p-0">
                <Skeleton className="h-48 w-full" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>
        </CarouselItem>
      ))}
    </CarouselContent>
  );
}

export default function UserDashboardClient() {
  const { user, loading: authLoading } = useAuth();
  const { processedCourses, allLadders, loading: coursesLoading, refresh } = useProcessedCourses();
  const isMobile = useIsMobile();
  const [promotedToLadder, setPromotedToLadder] = useState<string | null>(null);
  const [isRequestingPromotion, setIsRequestingPromotion] = useState(false);
  const { toast } = useToast();

  const loading = authLoading || coursesLoading;

  useEffect(() => {
    const promoted = sessionStorage.getItem('promotedToLadder');
    if (promoted) {
      setPromotedToLadder(promoted);
      sessionStorage.removeItem('promotedToLadder');
    }
  }, []);

  const enrolledCourses = useMemo(() => processedCourses.filter(p => p.isEnrolled), [processedCourses]);
  
  const coursesInProgress = useMemo(() => enrolledCourses.filter(p => !p.isCompleted), [enrolledCourses]);

  const completedCourses = useMemo(() => enrolledCourses.filter(p => p.isCompleted), [enrolledCourses]);
  
  const coursesForProgressOverview = useMemo(() => {
    return enrolledCourses
        .map(p => ({
            name: p.title,
            progress: p.totalProgress || 0,
            courseId: p.id,
            lastWatchedVideoId: p.lastWatchedVideoId
        }))
        .filter(p => p.progress > 0 && p.progress < 100);
  }, [enrolledCourses]);
  
  const currentLadderDetails = useMemo(() => {
    if (!user || !user.classLadderId) return null;
    return allLadders.find(l => l.id === user.classLadderId);
  }, [user, allLadders]);

  const coursesInCurrentLadder = useMemo(() => {
    if (!currentLadderDetails || !user?.language) return [];
    // Important: Filter courses in the ladder by the user's specific language.
    return processedCourses.filter(c => 
        c.ladderIds?.includes(currentLadderDetails.id) && c.language === user.language
    );
  }, [processedCourses, currentLadderDetails, user?.language]);

  const allCoursesInLadderCompleted = useMemo(() => {
    // If there are no courses in the current ladder for the user's language, they can't have completed it.
    if (coursesInCurrentLadder.length === 0) return false;
    // Check if every course required for this ladder (in this language) is marked as completed.
    return coursesInCurrentLadder.every(c => c.isCompleted);
  }, [coursesInCurrentLadder]);

  const nextLadder = useMemo(() => {
    if (!currentLadderDetails) return null;
    // Find the next ladder in sequence based on the 'order' property.
    return allLadders.find(l => l.order > currentLadderDetails.order);
  }, [allLadders, currentLadderDetails]);
  
  const ladderProgress = useMemo(() => {
    if (!currentLadderDetails) return { completed: 0, total: 0, percentage: 0 };
    const total = coursesInCurrentLadder.length;
    if (total === 0) return { completed: 0, total: 0, percentage: 0 };
    
    const completed = coursesInCurrentLadder.filter(c => c.isCompleted).length;
    const percentage = Math.round((completed / total) * 100);
    
    return { completed, total, percentage };
  }, [currentLadderDetails, coursesInCurrentLadder]);

  const groupedCourses = useMemo(() => {
    const groups: { [key: string]: (typeof processedCourses[0])[] } = {};
    
    processedCourses.forEach(course => {
      if (course.ladderIds && course.ladderIds.length > 0) {
        course.ladderIds.forEach(ladderId => {
          if (!groups[ladderId]) groups[ladderId] = [];
          groups[ladderId].push(course);
        });
      } else {
        if (!groups['uncategorized']) groups['uncategorized'] = [];
        groups['uncategorized'].push(course);
      }
    });

    return Object.keys(groups).map(ladderId => {
        const ladder = allLadders.find(l => l.id === ladderId);
        return {
            ladderId,
            ladderName: ladder?.name || 'Uncategorized',
            order: ladder?.order ?? Infinity,
            courses: groups[ladderId]
        }
    }).sort((a, b) => {
        if (user?.classLadderId) {
            if (a.ladderId === user.classLadderId) return -1;
            if (b.ladderId === user.classLadderId) return 1;
        }
        return a.order - b.order;
    });
  }, [processedCourses, allLadders, user]);

  
  const handleRequestPromotion = async () => {
    if (!user || !currentLadderDetails || !nextLadder) return;
    setIsRequestingPromotion(true);
    try {
      const result = await requestPromotion(user.uid, user.displayName || 'User', user.email || '', currentLadderDetails, nextLadder);
      if (result.success) {
        toast({ title: "Promotion Request Sent", description: "Your request has been sent for review."});
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
       toast({ variant: 'destructive', title: "Request Failed", description: error.message });
    } finally {
        setIsRequestingPromotion(false);
    }
  };


  return (
    <div className="space-y-8">
       {promotedToLadder && (
        <Card className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800">
            <CardHeader className="text-center">
                <div className="mx-auto bg-green-100 dark:bg-green-900 p-3 rounded-full w-fit">
                    <Trophy className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-green-800 dark:text-green-200">Congratulations!</CardTitle>
                <CardDescription className="text-green-700 dark:text-green-300">
                    You've been promoted to the next level: <span className="font-bold">{promotedToLadder}</span>.
                    New courses are now available for you.
                </CardDescription>
            </CardHeader>
        </Card>
       )}
       <AnnouncementCard />
        
        {currentLadderDetails && (
             <Card>
                <CardHeader>
                    <CardTitle>My Ladder Progress</CardTitle>
                    <CardDescription>Your progress in the <span className="font-bold">{currentLadderDetails.name}</span> ladder.</CardDescription>
                </CardHeader>
                <CardContent>
                    {allCoursesInLadderCompleted && nextLadder ? (
                         <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <Trophy className="mx-auto h-10 w-10 text-blue-600 dark:text-blue-400" />
                            <h3 className="mt-2 text-lg font-semibold text-blue-800 dark:text-blue-200">Ladder Complete!</h3>
                            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                                You are qualified to become a potential {nextLadder.name}.
                            </p>
                            <Button onClick={handleRequestPromotion} disabled={isRequestingPromotion} className="mt-4">
                                {isRequestingPromotion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Request Promotion
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                             <div className="flex justify-between items-center text-sm">
                                <p className="font-medium text-muted-foreground">{ladderProgress.completed} of {ladderProgress.total} courses completed</p>
                                <p className="font-bold">{ladderProgress.percentage}%</p>
                            </div>
                            <Progress value={ladderProgress.percentage} className="h-2" />
                        </div>
                    )}
                </CardContent>
            </Card>
        )}

       <Card>
            <CardHeader>
                <CardTitle>My Progress Overview</CardTitle>
                <CardDescription>Your completion percentage for each course you're currently taking.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ) : coursesForProgressOverview.length > 0 ? (
                    <div className="space-y-4">
                        {coursesForProgressOverview.map(course => (
                            <div key={course.courseId} className="space-y-2">
                                <Link href={`/courses/${course.courseId}/video/${course.lastWatchedVideoId}`}>
                                <div className="flex justify-between items-center">
                                    <p className="font-medium hover:underline">{course.name}</p>
                                    <p className="text-sm text-muted-foreground">{course.progress}%</p>
                                </div>
                                </Link>
                                <Progress value={course.progress} className="h-2" />
                            </div>  
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        <p>You have not made progress on any courses yet. <Link href="/courses" className="text-primary underline">Explore courses</Link> to get started!</p>
                    </div>
                )}
            </CardContent>
        </Card>

      {coursesInProgress.length > 0 && (
          <section>
            <h2 className="font-headline text-2xl font-semibold mb-4">
              Continue Learning
            </h2>
            {loading ? (
                <Carousel opts={{ align: "start" }} className="w-full">
                    <RecommendationsLoading />
                </Carousel>
            ) : (
              isMobile ? (
                 <div className="grid grid-cols-1 gap-4">
                  {coursesInProgress.map(course => (
                      <CourseCard key={course.id} course={course} onChange={refresh} />
                  ))}
                </div>
              ) : (
                <Carousel opts={{ align: "start", loop: coursesInProgress.length > 3 }} className="w-full">
                  <CarouselContent>
                      {coursesInProgress.map(course => (
                          <CarouselItem key={course.id} className="basis-full md:basis-1/2 lg:basis-1/3">
                            <div className="p-1">
                               <CourseCard course={course} onChange={refresh} />
                            </div>
                          </CarouselItem>
                      ))}
                  </CarouselContent>
                  <CarouselPrevious className="hidden sm:flex" />
                  <CarouselNext className="hidden sm:flex"/>
                </Carousel>
              )
            )}
          </section>
      )}

      <section>
          <div className="space-y-12">
            {loading ? (
                Array.from({ length: 2 }).map((_, groupIndex) => (
                    <div key={groupIndex} className="space-y-4">
                         <Skeleton className="h-8 w-1/3" />
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
                            </div>
                        ))}
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-16 text-muted-foreground">
                    <p>No courses available at this time.</p>
                </div>
            )}
        </div>
      </section>

      {completedCourses.length > 0 && (
          <section>
            <h2 className="font-headline text-2xl font-semibold mb-4">
              Completed Courses
            </h2>
             {loading ? (
                <Carousel opts={{ align: "start" }} className="w-full">
                    <RecommendationsLoading />
                </Carousel>
            ) : (
               isMobile ? (
                  <div className="grid grid-cols-1 gap-4">
                    {completedCourses.map(course => (
                      <CourseCard key={course.id} course={course} onChange={refresh} />
                    ))}
                  </div>
                ) : (
                  <Carousel opts={{ align: "start", loop: completedCourses.length > 3 }} className="w-full">
                    <CarouselContent>
                      {completedCourses.map(course => (
                         <CarouselItem key={course.id} className="basis-full md:basis-1/2 lg:basis-1/3">
                           <div className="p-1">
                             <CourseCard course={course} onChange={refresh} />
                           </div>
                         </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="hidden sm:flex" />
                    <CarouselNext className="hidden sm:flex"/>
                  </Carousel>
                )
            )}
          </section>
      )}
    </div>
  );
}
