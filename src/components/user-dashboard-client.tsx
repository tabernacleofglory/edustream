
"use client";

import { useState, useMemo, useEffect } from "react";
import { CourseCard } from "./course-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "./ui/card";
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
import { ArrowRight, Loader2, Trophy, AlertCircle, CheckCircle2, XCircle, Video as VideoIcon, FileQuestion, FileText, BookOpen, Circle, Lock } from "lucide-react";
import { Progress } from "./ui/progress";
import { useToast } from "@/hooks/use-toast";
import { requestPromotion } from "@/lib/user-actions";
import AnnouncementCard from "./announcement-card";
import VideoAnnouncement from "./video-announcement";
import { useI18n } from "@/hooks/use-i18n";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { collection, query, where, getDocs, doc, getDoc, collectionGroup, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

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

const COURSE_META_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CourseMetaCache {
    [courseId: string]: {
        videos: { id: string; title: string }[];
        quizzes: { id: string; title: string }[];
        formTitle: string;
        timestamp: number;
    }
}

function getCourseMetaCache(): CourseMetaCache {
    if (typeof window === 'undefined') return {};
    try {
        const cached = sessionStorage.getItem('gloryhub_course_meta');
        if (!cached) return {};
        const data = JSON.parse(cached) as CourseMetaCache;
        // Prune expired entries
        const now = Date.now();
        const pruned: CourseMetaCache = {};
        for (const [id, meta] of Object.entries(data)) {
            if (now - meta.timestamp < COURSE_META_CACHE_TTL) {
                pruned[id] = meta;
            }
        }
        return pruned;
    } catch {
        return {};
    }
}

function setCourseMetaCache(courseId: string, meta: Omit<CourseMetaCache[string], 'timestamp'>): void {
    if (typeof window === 'undefined') return;
    try {
        const cache = getCourseMetaCache();
        cache[courseId] = { ...meta, timestamp: Date.now() };
        sessionStorage.setItem('gloryhub_course_meta', JSON.stringify(cache));
    } catch {
        // sessionStorage full — ignore
    }
}

const RequiredStepsCard = ({ coursesInProgress }: { coursesInProgress: any[] }) => {
    const { user } = useAuth();
    const { t } = useI18n();
    const [courseSteps, setCourseSteps] = useState<{ courseId: string, courseTitle: string, items: { type: string, title: string, id: string, isCompleted: boolean }[] }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || coursesInProgress.length === 0) {
            setCourseSteps([]);
            setLoading(false);
            return;
        }

        const fetchFullCurriculum = async () => {
            setLoading(true);
            try {
                const [progressSnap, quizResultsSnap, globalSnap, formSubmissionsSnap] = await Promise.all([
                    getDocs(query(collection(db, 'userVideoProgress'), where('userId', '==', user.uid))),
                    getDocs(query(collection(db, 'userQuizResults'), where('userId', '==', user.uid), where('passed', '==', true))),
                    getDoc(doc(db, 'userContentProgress', user.uid)),
                    getDocs(query(collectionGroup(db, 'submissions'), where('userId', '==', user.uid)))
                ]);

                const globalDone = new Set(globalSnap.exists() ? Object.keys(globalSnap.data().completedItems || {}) : []);
                
                // Unify logic: add all verified completions to the set
                quizResultsSnap.docs.forEach(d => globalDone.add(d.data().quizId));
                formSubmissionsSnap.docs.forEach(d => globalDone.add(d.data().formId));
                progressSnap.forEach(d => d.data().videoProgress?.forEach((vp: any) => { if (vp.completed) globalDone.add(vp.videoId); }));

                const results = [];

                for (const course of coursesInProgress) {
                    const videoIds = (course.videos || []) as string[];
                    const quizIds = (course.quizIds || []) as string[];
                    const formId = course.formId;

                    const allItems: { type: string, title: string, id: string, isCompleted: boolean }[] = [];

                    // Check cache for course metadata
                    const metaCache = getCourseMetaCache();
                    const cachedMeta = metaCache[course.id];
                    const useCache = cachedMeta && (Date.now() - cachedMeta.timestamp < COURSE_META_CACHE_TTL);

                    if (videoIds.length > 0) {
                        let vMap: Map<string, string>;
                        if (useCache) {
                            vMap = new Map(cachedMeta.videos.map(v => [v.id, v.title]));
                        } else {
                            const vSnap = await getDocs(query(collection(db, 'Contents'), where(documentId(), 'in', videoIds.slice(0, 30))));
                            vMap = new Map(vSnap.docs.map(d => [d.id, d.data().title]));
                        }
                        videoIds.forEach(id => {
                            allItems.push({ 
                                type: 'video', 
                                title: vMap.get(id) || 'Video', 
                                id, 
                                isCompleted: globalDone.has(id)
                            });
                        });
                    }

                    if (quizIds.length > 0) {
                        let qMap: Map<string, string>;
                        if (useCache) {
                            qMap = new Map(cachedMeta.quizzes.map(q => [q.id, q.title]));
                        } else {
                            const qSnap = await getDocs(query(collection(db, 'quizzes'), where(documentId(), 'in', quizIds.slice(0, 30))));
                            qMap = new Map(qSnap.docs.map(d => [d.id, d.data().title]));
                        }
                        quizIds.forEach(id => {
                            allItems.push({ 
                                type: 'quiz', 
                                title: qMap.get(id) || 'Quiz', 
                                id, 
                                isCompleted: globalDone.has(id)
                            });
                        });
                    }

                    if (formId) {
                        let formTitle: string;
                        if (useCache) {
                            formTitle = cachedMeta.formTitle;
                        } else {
                            const fSnap = await getDoc(doc(db, 'forms', formId));
                            formTitle = fSnap.exists() ? fSnap.data().title : 'Form';
                        }
                        allItems.push({ 
                            type: 'form', 
                            title: formTitle, 
                            id: formId, 
                            isCompleted: globalDone.has(formId)
                        });
                    }

                    // Cache metadata if it wasn't cached
                    if (!useCache) {
                        setCourseMetaCache(course.id, {
                            videos: videoIds.map(id => ({ id, title: allItems.find(i => i.id === id && i.type === 'video')?.title || 'Video' })),
                            quizzes: quizIds.map(id => ({ id, title: allItems.find(i => i.id === id && i.type === 'quiz')?.title || 'Quiz' })),
                            formTitle: allItems.find(i => i.type === 'form')?.title || 'Form',
                        });
                    }

                    if (allItems.some(item => !item.isCompleted)) {
                        results.push({
                            courseId: course.id,
                            courseTitle: course.title,
                            items: allItems
                        });
                    }
                }
                setCourseSteps(results);
            } catch (error) {
                console.error("Error fetching curriculum requirements:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFullCurriculum();
    }, [user, coursesInProgress]);

    if (loading) return <Skeleton className="h-40 w-full" />;
    if (courseSteps.length === 0) return null;

    return (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertCircle className="h-5 w-5" />
                    {t('dashboard.required_steps.title', 'Required Steps')}
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-300">
                    {t('dashboard.required_steps.description', 'Please complete these items to unlock further courses in your track.')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {courseSteps.map(courseStep => {
                    const courseMeta = coursesInProgress.find(c => c.id === courseStep.courseId);
                    const isCourseLocked = courseMeta?.isLocked;

                    return (
                        <div key={courseStep.courseId} className="space-y-4">
                            <div className="flex items-center justify-between border-b border-amber-200/50 pb-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-sm text-amber-900 dark:text-amber-100 flex items-center gap-2">
                                        <BookOpen className="h-4 w-4" /> {courseStep.courseTitle}
                                    </h4>
                                    {isCourseLocked && <Lock className="h-3 w-3 text-amber-600 animate-pulse" />}
                                </div>
                                <Badge variant="outline" className="bg-white/50 border-amber-200 text-amber-800 text-[10px] uppercase font-bold">
                                    {courseStep.items.filter(i => i.isCompleted).length} / {courseStep.items.length} Complete
                                </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                                {courseStep.items.map(item => (
                                    <Link 
                                        key={item.id} 
                                        href={isCourseLocked ? "#" : (item.type === 'video' ? `/courses/${courseStep.courseId}/video/${item.id}` : 
                                              item.type === 'quiz' ? `/courses/${courseStep.courseId}/quiz/${item.id}` : 
                                              `/courses/${courseStep.courseId}/form/${item.id}`)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border transition-all group relative overflow-hidden",
                                            item.isCompleted 
                                                ? "bg-white/40 border-green-200/50 opacity-60" 
                                                : isCourseLocked 
                                                ? "bg-muted/50 border-dashed border-muted-foreground/30 cursor-not-allowed opacity-70"
                                                : "bg-background border-amber-200 shadow-sm hover:shadow-md hover:border-primary"
                                        )}
                                        onClick={(e) => isCourseLocked && e.preventDefault()}
                                    >
                                        <div className={cn(
                                            "p-2 rounded-lg shrink-0",
                                            item.isCompleted ? "bg-green-100" : isCourseLocked ? "bg-muted" : "bg-amber-100 dark:bg-amber-900/40"
                                        )}>
                                            {item.isCompleted ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                                             isCourseLocked ? <Lock className="h-4 w-4 text-muted-foreground" /> :
                                             item.type === 'video' ? <VideoIcon className="h-4 w-4 text-amber-600" /> :
                                             item.type === 'quiz' ? <FileQuestion className="h-4 w-4 text-amber-600" /> :
                                             <FileText className="h-4 w-4 text-amber-600" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-xs font-semibold truncate", (item.isCompleted || isCourseLocked) && "text-muted-foreground", item.isCompleted && "line-through")}>
                                                {item.title}
                                            </p>
                                            <span className="text-[9px] uppercase font-bold tracking-tighter text-muted-foreground opacity-70">
                                                {item.type}
                                            </span>
                                        </div>
                                        {!item.isCompleted && !isCourseLocked && (
                                            <ArrowRight className="h-3 w-3 text-amber-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
            <CardFooter className="bg-amber-100/50 dark:bg-amber-900/20 p-4 border-t border-amber-200/50">
                <Button asChild variant="default" className="w-full h-11 rounded-full shadow-lg" disabled={coursesInProgress.every(c => c.isLocked)}>
                    <Link href={`/courses/${courseSteps[0].courseId}/curriculum`}>
                        {t('dashboard.required_steps.complete_course', 'Continue Learning Path')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
};

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

      <RequiredStepsCard coursesInProgress={coursesInProgress} />

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
