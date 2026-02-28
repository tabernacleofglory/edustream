
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
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "./ui/button";
import { ArrowRight, Loader2, Trophy, AlertCircle } from "lucide-react";
import { Progress } from "./ui/progress";
import { useToast } from "@/hooks/use-toast";
import { requestPromotion } from "@/lib/user-actions";
import AnnouncementCard from "./announcement-card";
import VideoAnnouncement from "./video-announcement";
import { useI18n } from "@/hooks/use-i18n";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

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
  const { t } = useI18n();
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
  
  const currentLadderDetails = useMemo(() => {
    if (!user || !user.classLadderId) return null;
    return allLadders.find(l => l.id === user.classLadderId);
  }, [user, allLadders]);

  const coursesInCurrentLadder = useMemo(() => {
    if (!currentLadderDetails || !user?.language) return [];
    return processedCourses.filter(c => 
        c.ladderIds?.includes(currentLadderDetails.id) && c.language === user.language
    );
  }, [processedCourses, currentLadderDetails, user?.language]);

  const allCoursesInLadderCompleted = useMemo(() => {
    if (coursesInCurrentLadder.length === 0) return false;
    return coursesInCurrentLadder.every(c => c.isCompleted);
  }, [coursesInCurrentLadder]);

  const nextLadder = useMemo(() => {
    if (!currentLadderDetails) return null;
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

  const userName = user?.displayName?.split(' ')[0] || "";

  return (
    <div className="space-y-8">
       <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {t('dashboard.welcome_back', 'Welcome Back,')} {userName}!
          </h1>
       </div>

       <Alert className="border-primary/20 bg-primary/5">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="font-bold">{t('dashboard.notice.title', 'Important Notice')}</AlertTitle>
          <AlertDescription className="text-sm">
            {t('dashboard.notice.text', 'To be eligible for graduation, all required courses must be completed, and active participation in a ministry is required.')}
          </AlertDescription>
       </Alert>

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
       <VideoAnnouncement />
       <AnnouncementCard />
        
        {currentLadderDetails && (
             <Card>
                <CardHeader>
                    <CardTitle>{t('dashboard.ladder_progress.title', 'My Ladder Progress')}</CardTitle>
                    <CardDescription>{t('dashboard.ladder_progress.description', `Your progress in the current ladder.`)} ({currentLadderDetails.name})</CardDescription>
                </CardHeader>
                <CardContent>
                    {allCoursesInLadderCompleted && nextLadder ? (
                         <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <Trophy className="mx-auto h-10 w-10 text-blue-600 dark:text-blue-400" />
                            <h3 className="mt-2 text-lg font-semibold text-blue-800 dark:text-blue-200">{t('dashboard.ladder_progress.complete_title', 'Ladder Complete!')}</h3>
                            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                                {t('dashboard.ladder_progress.complete_desc', `You are qualified to become a potential candidate for the next level.`)}
                            </p>
                            <Button onClick={handleRequestPromotion} disabled={isRequestingPromotion} className="mt-4">
                                {isRequestingPromotion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('dashboard.ladder_progress.request_button', 'Request Promotion')}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                             <div className="flex justify-between items-center text-sm">
                                <p className="font-medium text-muted-foreground">
                                    {t('dashboard.ladder_progress.summary', '{{completed}} of {{total}} courses completed')
                                        .replace('{{completed}}', String(ladderProgress.completed))
                                        .replace('{{total}}', String(ladderProgress.total))}
                                </p>
                                <p className="font-bold">{ladderProgress.percentage}%</p>
                            </div>
                            <Progress value={ladderProgress.percentage} className="h-2" />
                        </div>
                    )}
                </CardContent>
            </Card>
        )}

      {coursesInProgress.length > 0 && (
          <section>
            <h2 className="font-headline text-2xl font-semibold mb-4">
              {t('dashboard.sections.continue', 'Continue Learning')}
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

      {currentLadderDetails && coursesInCurrentLadder.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-headline text-2xl font-semibold">
                {t('dashboard.sections.courses_in', 'Courses in:')} {currentLadderDetails.name}
              </h2>
              <Button asChild variant="outline">
                <Link href="/courses">
                  {t('dashboard.button.view_all', 'View All')} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {coursesInCurrentLadder.map((course) => (
                <div key={course.id} className="relative group">
                  <CourseCard course={course} onChange={refresh} showEnroll={!user} />
                </div>
              ))}
            </div>
          </section>
      )}

      {completedCourses.length > 0 && (
          <section>
            <h2 className="font-headline text-2xl font-semibold mb-4">
              {t('dashboard.sections.completed', 'Completed Courses')}
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
