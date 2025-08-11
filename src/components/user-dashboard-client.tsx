
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

  const handleUnenrollment = () => {
    refresh();
  };

  const enrolledCourses = useMemo(() => processedCourses.filter(p => p.isEnrolled), [processedCourses]);
  
  const coursesInProgress = useMemo(() => enrolledCourses.filter(p => !p.isCompleted), [enrolledCourses]);

  const completedCourses = useMemo(() => enrolledCourses.filter(p => p.isCompleted), [enrolledCourses]);
  
  const suggestedCourses = useMemo(() => processedCourses.filter(p => !p.isEnrolled && !p.isLocked), [processedCourses]);

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
    if (!currentLadderDetails) return [];
    return processedCourses.filter(c => c.ladderIds?.includes(currentLadderDetails.id));
  }, [processedCourses, currentLadderDetails]);

  const allCoursesInLadderCompleted = useMemo(() => {
    if (coursesInCurrentLadder.length === 0) return false;
    return coursesInCurrentLadder.every(c => c.isCompleted);
  }, [coursesInCurrentLadder]);

  const nextLadder = useMemo(() => {
    if (!currentLadderDetails) return null;
    return allLadders.find(l => l.order > currentLadderDetails.order);
  }, [allLadders, currentLadderDetails]);
  
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
        {allCoursesInLadderCompleted && nextLadder && (
             <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-blue-100 dark:bg-blue-900 p-3 rounded-full w-fit">
                        <Trophy className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-blue-800 dark:text-blue-200">Ladder Complete!</CardTitle>
                    <CardDescription className="text-blue-700 dark:text-blue-300">
                        Congratulations, you have completed all classes for the {currentLadderDetails?.name} ladder.
                        You are qualified to become a potential {nextLadder.name}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                    <Button onClick={handleRequestPromotion} disabled={isRequestingPromotion}>
                        {isRequestingPromotion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Request to become a potential {nextLadder.name}
                    </Button>
                </CardContent>
            </Card>
        )}
       <section>
            <h2 className="font-headline text-2xl font-semibold mb-4">
                My Progress Overview
            </h2>
            {loading ? (
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            ) : coursesForProgressOverview.length > 0 ? (
                 <Card>
                    <CardHeader>
                        <CardTitle>My Course Progress</CardTitle>
                        <CardDescription>Your completion percentage for each course you're currently taking.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         {coursesForProgressOverview.map(course => (
                           <div key={course.courseId} className="space-y-2">
                             <Link href={`/courses/${course.courseId}/video/${course.lastWatchedVideoId}`}>
                                <div className="flex justify-between items-center">
                                  <p className="font-medium hover:underline">{course.name}</p>
                                  <p className="text-sm text-muted-foreground">{course.progress}%</p>
                                </div>
                             </Link>
                            {!isMobile && (
                                <Progress value={course.progress} className="h-2" />
                            )}
                           </div>  
                         ))}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    <p className="text-muted-foreground">You have not made progress on any courses yet. <Link href="/courses" className="text-primary underline">Explore courses</Link> to get started!</p>
                </div>
            )}
       </section>

      {suggestedCourses.length > 0 && (
          <section>
              <h2 className="font-headline text-2xl font-semibold mb-4">Your Next Steps</h2>
              <p className="text-muted-foreground mb-4">
                  Here are some courses in your learning path to get you started.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suggestedCourses.map(course => (
                      <CourseCard key={course.id} course={course} onUnenroll={() => handleUnenrollment()} />
                  ))}
              </div>
          </section>
      )}

      <section>
        <h2 className="font-headline text-2xl font-semibold mb-4">
          Courses in Progress
        </h2>
        {loading ? (
            <Carousel opts={{ align: "start" }} className="w-full">
                <RecommendationsLoading />
            </Carousel>
        ) : coursesInProgress.length > 0 ? (
          isMobile ? (
             <div className="grid grid-cols-1 gap-4">
              {coursesInProgress.map(course => (
                  <CourseCard key={course.id} course={course} onUnenroll={() => handleUnenrollment()} />
              ))}
            </div>
          ) : (
            <Carousel opts={{ align: "start" }} className="w-full">
              <CarouselContent>
                  {coursesInProgress.map(course => (
                      <CarouselItem key={course.id} className="basis-full md:basis-1/2 lg:basis-1/3">
                        <div className="p-1">
                           <CourseCard course={course} onUnenroll={() => handleUnenrollment()} />
                        </div>
                      </CarouselItem>
                  ))}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex" />
              <CarouselNext className="hidden sm:flex"/>
            </Carousel>
          )
        ) : (
            <p className="text-muted-foreground">You have no courses in progress. <Link href="/courses" className="text-primary underline">Explore courses</Link> to get started!</p>
        )}
      </section>

      <section>
        <h2 className="font-headline text-2xl font-semibold mb-4">
          Completed Courses
        </h2>
         {loading ? (
            <Carousel opts={{ align: "start" }} className="w-full">
                <RecommendationsLoading />
            </Carousel>
        ) : completedCourses.length > 0 ? (
           isMobile ? (
              <div className="grid grid-cols-1 gap-4">
                {completedCourses.map(course => (
                  <CourseCard key={course.id} course={course} onUnenroll={() => handleUnenrollment()} />
                ))}
              </div>
            ) : (
              <Carousel opts={{ align: "start" }} className="w-full">
                <CarouselContent>
                  {completedCourses.map(course => (
                     <CarouselItem key={course.id} className="basis-full md:basis-1/2 lg:basis-1/3">
                       <div className="p-1">
                         <CourseCard course={course} onUnenroll={() => handleUnenrollment()} />
                       </div>
                     </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden sm:flex" />
                <CarouselNext className="hidden sm:flex"/>
              </Carousel>
            )
        ) : (
             <p className="text-muted-foreground">You haven't completed any courses yet.</p>
        )}
      </section>
    </div>
  );
}
