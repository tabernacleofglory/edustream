
"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Course, Video as VideoType, Quiz, CustomForm } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock, CheckCircle2, Circle, Play, FileQuestion, FileText } from "lucide-react";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, query, where, documentId, getDocs, doc, getDoc } from "firebase/firestore";
import { Skeleton } from "./ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "./ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useI18n } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

interface CoursePreviewProps {
  course: Course & { isLocked?: boolean; prerequisiteCourse?: { id: string; title: string } };
  isEnrolled: boolean;
  isCompleted: boolean;
  onEnroll: () => void;
}

interface CurriculumItem {
    id: string;
    title: string;
    type: 'video' | 'quiz' | 'form';
    isCompleted: boolean;
}

export default function CoursePreview({
  course,
  isEnrolled,
  isCompleted,
  onEnroll,
}: CoursePreviewProps) {
  const [content, setContent] = useState<{ videos: VideoType[], quizzes: Quiz[], form: CustomForm | null }>({ videos: [], quizzes: [], form: null });
  const [completions, setCompletions] = useState<{ videos: Set<string>, quizzes: Set<string>, form: Set<string> }>({ videos: new Set(), quizzes: new Set(), form: new Set() });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const db = getFirebaseFirestore();

  const isLocked = course.isLocked && !isEnrolled;

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const videoIds = course.videos || [];
        const quizIds = course.quizIds || [];
        const formId = course.formId;

        // 1. Fetch Content
        let videos: VideoType[] = [];
        if (videoIds.length > 0) {
            const chunkSize = 10;
            const fetched: Record<string, VideoType> = {};
            for (let i = 0; i < videoIds.length; i += chunkSize) {
                const slice = videoIds.slice(i, i + chunkSize);
                const q = query(collection(db, "Contents"), where(documentId(), "in", slice), where("status", "==", "published"));
                const snap = await getDocs(q);
                snap.docs.forEach((d) => { fetched[d.id] = { id: d.id, ...(d.data() as any) } as VideoType; });
            }
            videos = videoIds.map((id) => fetched[id]).filter(Boolean) as VideoType[];
        }

        let quizzes: Quiz[] = [];
        if (quizIds.length > 0) {
            const qSnap = await getDocs(query(collection(db, 'quizzes'), where(documentId(), 'in', quizIds)));
            quizzes = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz));
        }

        let form: CustomForm | null = null;
        if (formId) {
            const fSnap = await getDoc(doc(db, 'forms', formId));
            if (fSnap.exists()) form = { id: fSnap.id, ...fSnap.data() } as CustomForm;
        }

        setContent({ videos, quizzes, form });

        // 2. Fetch User Completions if Enrolled
        if (user && isEnrolled) {
            const [progressSnap, quizResultsSnap, globalSnap, onsiteSnap] = await Promise.all([
                getDoc(doc(db, 'userVideoProgress', `${user.uid}_${course.id}`)),
                getDocs(query(collection(db, 'userQuizResults'), where('userId', '==', user.uid), where('courseId', '==', course.id), where('passed', '==', true))),
                getDoc(doc(db, 'userContentProgress', user.uid)),
                getDocs(query(collection(db, 'onsiteCompletions'), where('userId', '==', user.uid), where('courseId', '==', course.id)))
            ]);

            const videoDone = new Set<string>();
            const quizDone = new Set<string>();
            const formDone = new Set<string>();

            if (!onsiteSnap.empty) {
                videoIds.forEach(id => videoDone.add(id));
                quizIds.forEach(id => quizDone.add(id));
                if (formId) formDone.add(formId);
            }

            if (globalSnap.exists()) {
                const items = globalSnap.data().completedItems || {};
                videoIds.forEach(id => { if (items[id]) videoDone.add(id); });
                quizIds.forEach(id => { if (items[id]) quizDone.add(id); });
                if (formId && items[formId]) formDone.add(formId);
            }

            if (progressSnap.exists()) {
                progressSnap.data().videoProgress?.forEach((vp: any) => { if (vp.completed) videoDone.add(vp.videoId); });
            }
            quizResultsSnap.docs.forEach(d => quizDone.add(d.data().quizId));
            
            // Check form submissions
            if (formId) {
                const submissionsSnap = await getDocs(query(collection(db, 'forms', formId, 'submissions'), where('userId', '==', user.uid), where('courseId', '==', course.id)));
                if (!submissionsSnap.empty) formDone.add(formId);
            }

            setCompletions({ videos: videoDone, quizzes: quizDone, form: formDone });
        }
      } catch (err) {
        console.error("Failed to fetch course data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [course.id, course.videos, course.quizIds, course.formId, db, user, isEnrolled]);

  const curriculum = useMemo((): CurriculumItem[] => {
    const items: CurriculumItem[] = [];
    content.videos.forEach(v => items.push({ id: v.id, title: v.title, type: 'video', isCompleted: completions.videos.has(v.id) }));
    content.quizzes.forEach(q => items.push({ id: q.id, title: q.title, type: 'quiz', isCompleted: completions.quizzes.has(q.id) }));
    if (content.form) items.push({ id: content.form.id, title: content.form.title, type: 'form', isCompleted: completions.form.has(content.form.id) });
    return items;
  }, [content, completions]);

  const handlePrimaryAction = () => {
    if (isEnrolled) {
      router.push(`/courses/${course.id}/curriculum`);
      return;
    }
    onEnroll();
  };

  const PrimaryButton = () => {
    if (isCompleted) {
       return (
        <Button onClick={handlePrimaryAction} className="w-full" size="lg">
            {t('course.action.review', 'Review Course')}
        </Button>
      );
    }

    if (isLocked) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button disabled className="w-full" size="lg">
                  <Lock className="mr-2 h-4 w-4" />
                  {t('course.status.locked', 'Locked')}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {course.prerequisiteCourse?.title
                  ? t('course.tooltip.prereq', 'Complete "{{title}}" to unlock.').replace('{{title}}', course.prerequisiteCourse.title)
                  : t('course.tooltip.higher_ladder', 'This is in a higher ladder and locked for now.')}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button
        onClick={handlePrimaryAction}
        className="w-full"
        size="lg"
      >
        {isEnrolled ? t('course.action.go_to', 'Go to Course') : t('course.action.enroll', 'Enroll Now')}
      </Button>
    );
  };

  return (
    <div className="grid md:grid-cols-2 max-h-[90vh]">
      <div className="relative h-64 md:h-full hidden md:block">
        <Image
          src={(course as any)["Image ID"] || "https://picsum.photos/seed/course/600/400"}
          alt={course.title || "Course thumbnail"}
          fill
          priority
          style={{ objectFit: "cover" }}
          className="rounded-l-lg"
          data-ai-hint="course thumbnail"
        />
      </div>

      <div className="flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 pb-2 flex-shrink-0">
          <h2 className="text-2xl font-bold font-headline">{course.title}</h2>
        </div>

        <ScrollArea className="flex-grow px-6 -mx-6">
          <div className="px-6 pb-6">
            <p className="text-muted-foreground mb-6 whitespace-pre-wrap text-sm">{course.description}</p>
            
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">
                {t('curriculum.checklist.title', 'Course Curriculum')}
            </h3>
            <div className="space-y-2">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : curriculum.length > 0 ? (
                <div className="space-y-2">
                  {curriculum.map((item, index) => {
                    const itemIsLocked = !isEnrolled;
                    return (
                        <div
                          key={item.id}
                          className={cn(
                              "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                              !itemIsLocked ? "bg-background" : "bg-muted/50 opacity-60"
                          )}
                        >
                            <div className="flex-shrink-0">
                                {item.isCompleted ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={cn("font-medium text-sm truncate", item.isCompleted && "text-muted-foreground line-through")}>
                                    {item.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    {item.type === 'video' ? <Play className="h-3 w-3 text-muted-foreground" /> :
                                     item.type === 'quiz' ? <FileQuestion className="h-3 w-3 text-muted-foreground" /> :
                                     <FileText className="h-3 w-3 text-muted-foreground" />}
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{item.type}</span>
                                </div>
                            </div>
                            {item.isCompleted && (
                                <Badge variant="secondary" className="text-[10px] uppercase">{t('curriculum.status.done', 'Done')}</Badge>
                            )}
                        </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t('course.preview.no_lessons', 'No items available yet.')}</p>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 pt-6 border-t mt-auto flex-shrink-0">
          <PrimaryButton />
        </div>
      </div>
    </div>
  );
}
