
"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Course, User, Speaker } from "@/lib/types";
import { Clock, Loader2, CheckCircle, Edit, Eye, Trash2, Printer, UserMinus, PlayCircle, Lock, Copy, Hash } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { getFirebaseFirestore } from "@/lib/firebase";
import { doc, setDoc, updateDoc, increment, getDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
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
<<<<<<< HEAD
import useRealTimeProgress from "@/hooks/use-real-time-progress";
import { Progress } from "./ui/progress";
import CertificatePrint from "./certificate-print";
=======
import { Progress } from "./ui/progress";
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
import { unenrollUserFromCourse } from "@/lib/user-actions";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";


interface CourseCardProps {
  course: Course & { isEnrolled?: boolean; isCompleted?: boolean; completedAt?: string, totalProgress?: number, lastWatchedVideoId?: string; isLocked?: boolean; prerequisiteCourse?: { id: string; title: string; }; };
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onUnenroll?: (courseId: string) => void;
  isAdminView?: boolean;
<<<<<<< HEAD
}

export function CourseCard({ course, onEdit, onDelete, onDuplicate, onUnenroll, isAdminView = false }: CourseCardProps) {
=======
  showEnroll?: boolean;
}

export function CourseCard({ course, onEdit, onDelete, onDuplicate, onUnenroll, isAdminView = false, showEnroll = false }: CourseCardProps) {
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
    const { user, loading: authLoading, refreshUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [isUnenrolling, setIsUnenrolling] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [speaker, setSpeaker] = useState<Speaker | null>(null);
    const [firstVideoId, setFirstVideoId] = useState<string | null>(null);
    const [publishedVideoCount, setPublishedVideoCount] = useState<number>(0);
    const db = getFirebaseFirestore();
<<<<<<< HEAD
    const { percentage: progressPercentage } = useRealTimeProgress(user?.uid || '', course.id);
=======
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
    
    const isEnrolled = course.isEnrolled || false;
    const isCompleted = course.isCompleted || false;
    const isInProgress = isEnrolled && !isCompleted;
    const isLocked = course.isLocked && !isEnrolled && !isAdminView;
<<<<<<< HEAD
=======
    const progressPercentage = course.totalProgress || 0;
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)


     useEffect(() => {
        const fetchSpeaker = async () => {
            if (course.speakerId) {
                const speakerDocRef = doc(db, "speakers", course.speakerId);
                const speakerDocSnap = await getDoc(speakerDocRef);
                if (speakerDocSnap.exists()) {
                    setSpeaker(speakerDocSnap.data() as Speaker);
                }
            } else {
                setSpeaker(null);
            }
        };
        const findFirstPublishedVideo = async () => {
            if (course.videos && course.videos.length > 0) {
                 const videosQuery = query(collection(db, 'Contents'), where('__name__', 'in', course.videos), where('status', '==', 'published'));
                const videoSnapshots = await getDocs(videosQuery);
                const publishedVideoIds = videoSnapshots.docs.map(doc => doc.id);
                setPublishedVideoCount(publishedVideoIds.length);

                const firstAvailableId = course.videos.find(videoId => publishedVideoIds.includes(videoId));
                setFirstVideoId(firstAvailableId || null);
            }
        }
        fetchSpeaker();
        findFirstPublishedVideo();
    }, [course.speakerId, course.videos, db]);
    
    const handleEnroll = async (e?: React.MouseEvent<HTMLElement>) => {
        e?.preventDefault();
        e?.stopPropagation();

        if (!user) {
            router.push('/login');
            return;
        }

        // Security check: Ensure user is in the correct ladder for this course
        if (!course.ladderIds?.includes(user.classLadderId || '')) {
            toast({
                variant: 'destructive',
                title: 'Enrollment Not Allowed',
                description: 'This course is not part of your current learning path.',
            });
            return;
        }

        setIsEnrolling(true);
        try {
            const enrollmentId = `${user.uid}_${course.id}`;
            const enrollmentRef = doc(db, 'enrollments', enrollmentId);
            
            await setDoc(enrollmentRef, {
                userId: user.uid,
                courseId: course.id,
                enrolledAt: serverTimestamp(),
            });
            
<<<<<<< HEAD
            const courseRef = doc(db, 'courses', course.id);
            await updateDoc(courseRef, { enrollmentCount: increment(1) });
            
=======
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
            // Post-enrollment check for immediate completion
            const progressQuery = query(collection(db, 'userVideoProgress'), where('userId', '==', user.uid));
            const progressSnapshot = await getDocs(progressQuery);
            const allWatchedVideos = new Set<string>();
            progressSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.videoProgress) {
                    data.videoProgress.forEach((vp: { videoId: string; completed: boolean; }) => {
                        if (vp.completed) {
                            allWatchedVideos.add(vp.videoId);
                        }
                    });
                }
            });
            
            const allCourseVideosCompleted = course.videos.every(vid => allWatchedVideos.has(vid));

            if (allCourseVideosCompleted) {
                await updateDoc(enrollmentRef, {
                    completedAt: serverTimestamp()
                });
                toast({
                    title: "Course Completed!",
                    description: `You've already finished all videos for ${course.title}.`,
                });
            } else {
                 toast({
                    title: "Enrolled Successfully!",
                    description: `You can now start learning ${course.title}.`,
                });
            }

            if (onUnenroll) { // This will trigger a refresh on the parent component
              onUnenroll(course.id);
            } else {
              refreshUser(); // Fallback refresh
            }

        } catch (error) {
            toast({
                variant: 'destructive',
                title: "Enrollment Failed",
                description: "Could not enroll in the course. Please try again.",
            });
        } finally {
            setIsEnrolling(false);
        }
    }

     const handleUnenroll = async (e?: React.MouseEvent<HTMLElement>) => {
        e?.preventDefault();
        e?.stopPropagation();

        if (!user) return;

        setIsUnenrolling(true);
        const result = await unenrollUserFromCourse(user.uid, course.id);
        if (result.success) {
            toast({ title: 'Successfully unenrolled' });
            if (onUnenroll) onUnenroll(course.id);
        } else {
            toast({ variant: 'destructive', title: 'Unenrollment failed', description: result.message });
        }
        setIsUnenrolling(false);
    };
    
    const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
      if (
        (e.target as HTMLElement).closest('button') ||
        (e.target as HTMLElement).closest('a')
      ) {
        return;
      }
       
       if (isAdminView) {
            if (onEdit) {
                onEdit();
            }
        }
    };
    
    const getInitials = (name?: string | null) => {
        if (!name) return 'U';
        const names = name.split(' ');
        const initials = names.map(n => n[0]).join('');
        return initials.toUpperCase();
    }
    
    const EnrollButton = () => {
<<<<<<< HEAD
=======
      if(showEnroll) {
        return (
          <Button onClick={handleEnroll} disabled={authLoading || isEnrolling || !firstVideoId} className="w-full">
            {isEnrolling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enroll Now
          </Button>
        );
      }
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
      if (isLocked) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button disabled className="w-full">
                  <Lock className="mr-2 h-4 w-4" />
                  Locked
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Complete "{course.prerequisiteCourse?.title}" to unlock.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return (
        <Button onClick={handleEnroll} disabled={authLoading || isEnrolling || !firstVideoId} className="w-full">
          {isEnrolling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Enroll Now
        </Button>
      );
    };

    const resumeLink = `/courses/${course.id}/video/${course.lastWatchedVideoId || firstVideoId}`;

    return (
    <>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogTrigger asChild>
            <div className="group cursor-pointer">
                 <Card className="h-full overflow-hidden transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1 flex flex-col">
                    <CardHeader className="p-0">
                        <div className="relative h-48 w-full">
                            <Image
                                src={course["Image ID"] || "https://placehold.co/600x400.png"}
                                alt={course.title || "Course thumbnail"}
                                fill
                                style={{objectFit:"cover"}}
                                data-ai-hint={`${course.Category} course`}
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
                                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); }}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview
                                </Button>
                            </div>
                            {isAdminView && (
                                <Badge 
                                    variant={course.status === 'published' ? 'default' : 'secondary'} 
                                    className="absolute top-2 left-2"
                                >
                                    {course.status === 'published' ? 'Published' : 'Draft'}
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 flex-grow">
                        <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                            <div className="flex flex-wrap gap-1">
                                {(Array.isArray(course.Category) ? course.Category : [course.Category]).map((category, index) => (
                                    <Badge key={`${category}-${index}`} variant="secondary">{category}</Badge>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1 justify-end">
                                {course.ladders?.map((ladder, index) => (
                                    <Badge key={`${ladder}-${index}`} variant="outline">{ladder}</Badge>
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
                                        <AvatarImage src={speaker.photoURL || ''} alt={speaker.name || ''} />
                                        <AvatarFallback>{getInitials(speaker.name)}</AvatarFallback>
                                    </Avatar>
                                    <span>{speaker.name}</span>
                                </div>
                            )}
                        </div>
                        {isAdminView && onEdit && onDelete && (
                             <div className="flex w-full gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="flex-1"
                                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="flex-1"
                                    onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicate
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button 
                                            size="sm" 
                                            variant="destructive"
                                            className="flex-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
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
                                        <AlertDialogAction onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}
<<<<<<< HEAD
                        {authLoading ? (
                            <div className="w-full"><div className="h-10 w-full bg-muted rounded-md animate-pulse" /></div>
                        ) : !isEnrolled ? (
=======
                        {authLoading && !showEnroll ? (
                            <div className="w-full"><div className="h-10 w-full bg-muted rounded-md animate-pulse" /></div>
                        ) : !isEnrolled || showEnroll ? (
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
                            <div className="flex w-full gap-2">
                                <EnrollButton />
                            </div>
                        ) : isCompleted ? (
<<<<<<< HEAD
                             <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="w-full" variant="outline" onClick={(e) => e.stopPropagation()}>View Certificate</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                        <DialogTitle>Certificate of Completion</DialogTitle>
                                    </DialogHeader>
                                    <CertificatePrint userName={user?.displayName || "Valued Student"} course={course} />
                                </DialogContent>
                            </Dialog>
=======
                            <Button asChild className="w-full" variant="outline">
                                <Link href={`/certificate/${course.id}`} target="_blank">
                                    View Certificate
                                </Link>
                            </Button>
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
                        ) : isInProgress ? (
                           <div className="w-full">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-muted-foreground">Progress</span>
                                    <span className="text-sm font-bold">{progressPercentage}%</span>
                                </div>
                                <Progress value={progressPercentage} className="w-full h-2 [&>div]:bg-gradient-to-r from-pink-500 to-orange-400" />
                                <div className="flex w-full gap-2 mt-4">
                                    <Button asChild className="flex-1" disabled={!firstVideoId}>
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
                                                    Are you sure you want to un-enroll from "{course.title}"? Your progress will be saved if you decide to enroll again later.
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
