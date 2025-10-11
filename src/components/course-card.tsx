
"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Course, Speaker } from "@/lib/types";
import { Clock, Loader2, CheckCircle, Edit, Eye, Trash2, UserMinus, PlayCircle, Lock, Copy, Hash } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { getFirebaseFirestore } from "@/lib/firebase";
import { doc, setDoc, updateDoc, getDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, increment } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
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
import CoursePreview from "./course-preview";
import { Progress } from "./ui/progress";
import { unenrollUserFromCourse } from "@/lib/user-actions";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface CourseCardProps {
  course: Course & {
    isEnrolled?: boolean;
    isCompleted?: boolean;
    completedAt?: string;
    totalProgress?: number;
    lastWatchedVideoId?: string;
    isLocked?: boolean;
    prerequisiteCourse?: { id: string; title: string };
  };
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onChange?: () => void;
  isAdminView?: boolean;
  showEnroll?: boolean;
}

export function CourseCard({
  course,
  onEdit,
  onDelete,
  onDuplicate,
  onChange,
  isAdminView = false,
  showEnroll = false,
}: CourseCardProps) {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [speaker, setSpeaker] = useState<Speaker | null>(null);
  const [firstPublishedVideoId, setFirstPublishedVideoId] = useState<string | null>(null);
  const [publishedVideoCount, setPublishedVideoCount] = useState<number>(0);
  const db = getFirebaseFirestore();

  const isEnrolled = !!course.isEnrolled;
  const isCompleted = !!course.isCompleted;
  const isInProgress = isEnrolled && !isCompleted;
  const isLocked = !!course.isLocked && !isEnrolled && !isAdminView;
  const progressPercentage = Math.max(0, Math.min(100, course.totalProgress ?? 0));

  useEffect(() => {
    const fetchSpeaker = async () => {
      if (course.speakerId) {
        const speakerDocRef = doc(db, "speakers", course.speakerId);
        const speakerDocSnap = await getDoc(speakerDocRef);
        if (speakerDocSnap.exists()) setSpeaker(speakerDocSnap.data() as Speaker);
      } else {
        setSpeaker(null);
      }
    };

    const findFirstPublishedVideo = async () => {
      if (!course.videos || course.videos.length === 0) {
        setFirstPublishedVideoId(null);
        setPublishedVideoCount(0);
        return;
      }

      // Firestore 'in' queries max 10 IDs. Chunk the array.
      const ids = course.videos as string[];
      const chunkSize = 10;
      const publishedIds = new Set<string>();

      for (let i = 0; i < ids.length; i += chunkSize) {
        const slice = ids.slice(i, i + chunkSize);
        const q = query(collection(db, "Contents"), where("__name__", "in", slice), where("status", "==", "published"));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => publishedIds.add(d.id));
      }

      setPublishedVideoCount(publishedIds.size);

      // pick first course.videos item that is published
      const first = ids.find((id) => publishedIds.has(id)) || null;
      setFirstPublishedVideoId(first);
    };

    fetchSpeaker();
    findFirstPublishedVideo();
  }, [course.speakerId, course.videos, db]);

  const handleEnroll = async (e?: React.MouseEvent<HTMLElement>) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    if (isLocked) {
      const prereq = course.prerequisiteCourse?.title;
      toast({
        variant: "destructive",
        title: "Locked",
        description: prereq
          ? `Complete "${prereq}" to unlock this course.`
          : "This course is in a higher ladder and isn’t available yet.",
      });
      return;
    }
    
    if (publishedVideoCount === 0) {
        router.push(`/courses`);
        return;
    }

    setIsEnrolling(true);
    try {
      const enrollmentId = `${user.uid}_${course.id}`;
      const enrollmentRef = doc(db, "enrollments", enrollmentId);
      const courseRef = doc(db, "courses", course.id);

      await setDoc(enrollmentRef, {
        userId: user.uid,
        courseId: course.id,
        enrolledAt: serverTimestamp(),
      });
      
      await updateDoc(courseRef, {
        enrollmentCount: increment(1)
      });

      toast({ title: "Enrolled", description: `You can now start ${course.title}.` });
      
      const videoIdToRedirect = course.lastWatchedVideoId || firstPublishedVideoId;
      if(videoIdToRedirect) {
          router.push(`/courses/${course.id}/video/${videoIdToRedirect}`);
      }

      onChange?.();
      refreshUser();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Enrollment Failed",
        description: "Could not enroll in the course. Please try again.",
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleUnenroll = async (e?: React.MouseEvent<HTMLElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!user) return;

    setIsUnenrolling(true);
    const result = await unenrollUserFromCourse(user.uid, course.id);
    if (result.success) {
      toast({ title: "Successfully unenrolled" });
      onChange?.();
    } else {
      toast({ variant: "destructive", title: "Unenrollment failed", description: result.message });
    }
    setIsUnenrolling(false);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    return parts.map((n) => n[0]).join("").toUpperCase();
  };

  const EnrollButton = () => {
    if (showEnroll) {
      return (
        <Button onClick={handleEnroll} disabled={authLoading || isEnrolling || (!firstPublishedVideoId && !course.lastWatchedVideoId)} className="w-full">
          {isEnrolling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Enroll Now
        </Button>
      );
    }
    if (isLocked) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button disabled className="w-full">
                  <Lock className="mr-2 h-4 w-4" />
                  Locked
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {course.prerequisiteCourse?.title
                  ? `Complete "${course.prerequisiteCourse.title}" to unlock.`
                  : "This is in a higher ladder and locked for now."}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <Button onClick={handleEnroll} disabled={authLoading || isEnrolling || (!firstPublishedVideoId && !course.lastWatchedVideoId)} className="w-full">
        {isEnrolling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Enroll Now
      </Button>
    );
  };

  const resumeTargetId = course.lastWatchedVideoId || firstPublishedVideoId || "";
  const canResume = !!resumeTargetId;
  const resumeLink = canResume ? `/courses/${course.id}/video/${resumeTargetId}` : `/courses`;


  return (
    <>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogTrigger asChild>
          <div className="group cursor-pointer">
            <Card className="h-full overflow-hidden transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1 flex flex-col">
              <CardHeader className="p-0">
                <div className="relative h-48 w-full">
                  <Image
                    src={(course as any)["Image ID"] || "https://placehold.co/600x400.png"}
                    alt={course.title || "Course thumbnail"}
                    fill
                    style={{ objectFit: "cover" }}
                    data-ai-hint={`${Array.isArray(course.Category) ? course.Category.join(", ") : course.Category} course`}
                  />
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Lock className="h-10 w-10 text-white/80" />
                    </div>
                  )}
                  {isCompleted && (
                    <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      <span>Completed</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPreviewOpen(true);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                  </div>
                  {isAdminView && (
                    <Badge variant={course.status === "published" ? "default" : "secondary"} className="absolute top-2 left-2">
                      {course.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-grow">
                <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(course.Category) ? course.Category : [course.Category]).filter(Boolean).map((category, i) => (
                      <Badge key={`${category}-${i}`} variant="secondary">
                        {category}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {(course as any).ladders?.map((ladder: string, i: number) => (
                      <Badge key={`${ladder}-${i}`} variant="outline">
                        {ladder}
                      </Badge>
                    ))}
                  </div>
                </div>
                <CardTitle className="mb-2 text-lg font-headline group-hover:text-primary transition-colors">
                  {course.title}
                </CardTitle>
                <CardDescription className="line-clamp-2">{course.description}</CardDescription>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex flex-col items-start gap-4">
                <div className="flex items-center text-sm text-muted-foreground gap-4">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{publishedVideoCount} lessons</span>
                  </div>
                  {course.order !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-4 h-4" />
                      <span>Order: {course.order}</span>
                    </div>
                  )}
                  {speaker && (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={speaker.photoURL || ""} alt={speaker.name || ""} />
                        <AvatarFallback>{getInitials(speaker.name)}</AvatarFallback>
                      </Avatar>
                      <span>{speaker.name}</span>
                    </div>
                  )}
                </div>

                {isAdminView && onEdit && onDelete && (
                  <div className="flex w-full gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="flex-1" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the course "{course.title}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}

                {authLoading && !showEnroll ? (
                  <div className="w-full">
                    <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
                  </div>
                ) : !isEnrolled || showEnroll ? (
                  <div className="flex w-full gap-2">
                    <EnrollButton />
                  </div>
                ) : isCompleted ? (
                  <Button asChild className="w-full" variant="outline">
                    <Link href="/my-certificates">
                        View Certificate
                    </Link>
                  </Button>
                ) : isInProgress ? (
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Progress</span>
                      <span className="text-sm font-bold">{progressPercentage}%</span>
                    </div>
                    <Progress value={progressPercentage} className="w-full h-2 [&>div]:bg-gradient-to-r from-pink-500 to-orange-400" />
                    <div className="flex w-full gap-2 mt-4">
                      <Button asChild className="flex-1" disabled={!canResume}>
                        <Link href={resumeLink}>
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Resume
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" disabled={isUnenrolling}>
                            {isUnenrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Un-enroll from course?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to un-enroll from "{course.title}"? Your progress will be saved if you enroll again later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleUnenroll}>Un-enroll</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ) : null}
              </CardFooter>
            </Card>
          </div>
        </DialogTrigger>

        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="sr-only">{course.title} Preview</DialogTitle>
          </DialogHeader>
          <CoursePreview
            course={course}
            isEnrolled={isEnrolled}
            isCompleted={isCompleted}
            onEnroll={handleEnroll}
            isLocked={isLocked}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
