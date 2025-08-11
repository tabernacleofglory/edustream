// src/components/video-player.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Hls from "hls.js";
import {
  Play, Pause, SkipBack, SkipForward, Lock, CheckCircle2, FileText, Award,
  Link as LinkIcon, FileType, FileImage, File as FileIcon, Maximize, MessageCircle,
  Repeat, Printer, Minimize, Smile, Send, Edit, Trash2, Reply, X, ChevronDown,
  PlusCircle, Settings, Check, PictureInPicture, ToggleLeft, ToggleRight, Share2,
  Heart, UserPlus, Volume2, VolumeX, Pin, Download, Camera, ThumbsUp, UserMinus, BookCopy
} from "lucide-react";
import type { Course, Video, Comment, Enrollment, UserProgress as UserProgressType, VideoProgress, Speaker } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { getFirebaseFirestore, getFirebaseApp } from "@/lib/firebase";
import {
  collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, Timestamp,
  doc, deleteDoc, updateDoc, getDoc, runTransaction, getDocs, where, setDoc, increment, arrayUnion, arrayRemove, writeBatch, documentId
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import CertificatePrint from "@/components/certificate-print";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { CourseCard } from "./course-card";
import { useToast } from "@/hooks/use-toast";
import { unenrollUserFromCourse } from "@/lib/user-actions";
import { useReactToPrint } from "react-to-print";
import { useIsMobile } from "@/hooks/use-is-mobile";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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


interface VideoPlayerProps {
    course: Course;
    courseVideos: Video[];
    currentVideo: Video;
    videoIndex: number;
    speaker: Speaker | null;
}
  
interface CourseWithStatus extends Course {
    isEnrolled?: boolean;
    isCompleted?: boolean;
}

const ReplyFormComponent = ({ parentComment, videoId, onReplyPosted }: { parentComment: Comment, videoId: string, onReplyPosted: () => void }) => {
    const [replyText, setReplyText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();
    const db = getFirebaseFirestore();

    const handleReplySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !user) return;
        setIsSubmitting(true);

        const replyData: Omit<Comment, 'id'> = {
            userId: user.uid,
            userName: user.displayName,
            userAvatar: user.photoURL,
            text: replyText.trim(),
            createdAt: serverTimestamp(),
            reactions: {},
            parentId: parentComment.id,
            parentAuthor: parentComment.userName,
        };

        try {
            await addDoc(collection(db, "Contents", videoId, "comments"), replyData);
            setReplyText('');
            onReplyPosted();
        } catch(err) {
            console.error("Error posting reply: ", err);
            toast({ variant: 'destructive', title: 'Failed to post reply.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <form onSubmit={handleReplySubmit} className="flex items-start gap-2 pt-2">
            <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <Textarea
                    placeholder={`Replying to ${parentComment.userName}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full text-sm"
                    rows={1}
                    disabled={isSubmitting}
                />
                <div className="flex justify-end items-center mt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onReplyPosted}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={isSubmitting || !replyText.trim()}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Reply
                    </Button>
                </div>
            </div>
        </form>
    );
};

const CommentComponent = ({ 
    comment, 
    isModerator, 
    isAdmin, 
    onDelete, 
    onPin, 
    isPinned,
    replies,
    videoId,
}: { 
    comment: Comment, 
    isModerator: boolean,
    isAdmin: boolean,
    onDelete: (commentId: string) => void,
    onPin: (comment: Comment) => void,
    isPinned?: boolean
    replies: Comment[],
    videoId: string,
}) => {
    const { user } = useAuth();
    const [showActions, setShowActions] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const db = getFirebaseFirestore();
    const { toast } = useToast();

    const likes = comment.reactions?.['👍'] || [];
    const userHasLiked = user ? likes.includes(user.uid) : false;

    const handleCommentLike = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in to like comments.' });
            return;
        }
        const commentRef = doc(db, 'Contents', videoId, 'comments', comment.id);
        await updateDoc(commentRef, {
            'reactions.👍': userHasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
        });
    };
    
    const getInitials = (name?: string | null) => {
        if (!name) return 'U';
        const names = name.split(' ');
        const initials = names.map(n => n[0]).join('');
        return initials.toUpperCase();
    }

    return (
        <div 
            className="relative flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50"
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            {isPinned && <Pin className="h-4 w-4 text-amber-500 flex-shrink-0 mt-1" />}
            <Avatar className="h-8 w-8">
                <AvatarImage src={comment.userAvatar || undefined} />
                <AvatarFallback>{getInitials(comment.userName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">{comment.userName}</span>
                    <span className="text-xs text-muted-foreground">
                        {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt.seconds * 1000), { addSuffix: true }) : 'just now'}
                    </span>
                </div>
                {comment.parentAuthor && (
                    <p className="text-xs text-muted-foreground">
                        Replying to <span className="font-semibold">@{comment.parentAuthor}</span>
                    </p>
                )}
                <p className="text-sm">{comment.text}</p>
                 <div className="flex items-center gap-1 mt-1">
                     <Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground" onClick={handleCommentLike}>
                        <ThumbsUp className={cn("h-3 w-3 mr-1", userHasLiked && "fill-primary text-primary")} />
                        {likes.length > 0 && <span>{likes.length}</span>}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setIsReplying(true)}>
                        <Reply className="h-3 w-3 mr-1" />
                        Reply
                    </Button>
                </div>

                {isReplying && (
                    <ReplyFormComponent parentComment={comment} videoId={videoId} onReplyPosted={() => setIsReplying(false)} />
                )}

                {replies.length > 0 && (
                    <div className="mt-2 space-y-3 pl-4 border-l-2">
                        {replies.map(reply => (
                            <CommentComponent 
                                key={reply.id} 
                                comment={reply} 
                                isModerator={isModerator}
                                isAdmin={isAdmin}
                                onDelete={onDelete}
                                onPin={onPin}
                                replies={[]} // Replies to replies are not shown to keep it simple for now
                                videoId={videoId}
                            />
                        ))}
                    </div>
                )}
            </div>
             {showActions && (isModerator || isAdmin) && (
                <div className="absolute top-1 right-1 z-20 bg-background border rounded-lg shadow-lg flex">
                    {isModerator && (
                        <Button variant="ghost" size="icon" className="p-0 h-8 w-8" onClick={() => onPin(comment)}>
                            <Pin className="h-4 w-4" />
                        </Button>
                    )}
                    {isAdmin && (
                        <Button variant="ghost" size="icon" className="p-0 h-8 w-8 text-destructive" onClick={() => onDelete(comment.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

const PlaylistAndResources = ({ course, courseVideos, currentVideo, watchedVideos, relatedCourses }: { course: Course, courseVideos: Video[], currentVideo: Video, watchedVideos: Set<string>, relatedCourses: CourseWithStatus[] }) => {
    
    let lastUnlockedIndex = -1;
    courseVideos.forEach((video, index) => {
        if (watchedVideos.has(video.id)) {
            lastUnlockedIndex = index;
        }
    });

    return (
        <Accordion type="multiple" defaultValue={['playlist', 'resources', 'related']} className="w-full">
            <AccordionItem value="playlist">
                <AccordionTrigger className="px-4 font-semibold">{course.title}</AccordionTrigger>
                <AccordionContent>
                   <div className="space-y-1">
                        {courseVideos.map((video, index) => {
                            const isLocked = index > 0 && !watchedVideos.has(courseVideos[index - 1].id);
                            const isCompleted = watchedVideos.has(video.id);

                            return (
                                <Link 
                                    key={video.id} 
                                    href={!isLocked ? `/courses/${course.id}/video/${video.id}` : '#'}
                                    className={cn(
                                        "flex items-center gap-3 p-3 text-sm transition-colors",
                                        isLocked && "opacity-50 cursor-not-allowed",
                                        video.id === currentVideo.id && !isLocked
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : !isLocked ? "hover:bg-muted" : ""
                                    )}
                                    onClick={(e) => { if(isLocked) e.preventDefault(); }}
                                >
                                    {isCompleted ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : isLocked ? (
                                        <Lock className="h-5 w-5 text-muted-foreground" />
                                    ) : (
                                        <Play className="h-5 w-5 text-muted-foreground" />
                                    )}
                                    <span className="flex-1">{video.title}</span>
                                    <span className="text-xs text-muted-foreground">{video.duration ? `${Math.round(video.duration / 60)} min` : ''}</span>
                                </Link>
                            )
                        })}
                   </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="resources">
                <AccordionTrigger className="px-4 font-semibold">Resources</AccordionTrigger>
                <AccordionContent className="px-4 space-y-2">
                    {course["Resource Doc"]?.map((url, index) => {
                        const fileName = url.split('/').pop()?.split('?')[0].split('%2F').pop() || "Resource";
                        return (
                            <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                                <FileText className="h-5 w-5" />
                                <span>{decodeURIComponent(fileName)}</span>
                            </a>
                        )
                    })}
                     {course.attendanceLinks?.map((link, index) => (
                        <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                            <LinkIcon className="h-5 w-5" />
                            <span>{link.title}</span>
                        </a>
                    ))}
                    <Link href={`/documentation`} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                        <BookCopy className="h-5 w-5" />
                        <span>Platform Documentation</span>
                    </Link>
                </AccordionContent>
            </AccordionItem>
            {relatedCourses.length > 0 && (
                 <AccordionItem value="related">
                    <AccordionTrigger className="px-4 font-semibold">Related Courses</AccordionTrigger>
                    <AccordionContent className="p-2 space-y-2">
                         {relatedCourses.map(relatedCourse => (
                            <div key={relatedCourse.id} className="w-full px-2">
                                <CourseCard course={relatedCourse} />
                            </div>
                        ))}
                    </AccordionContent>
                </AccordionItem>
            )}
        </Accordion>
    );
};


export default function VideoPlayer({
  course,
  courseVideos,
  currentVideo,
  videoIndex,
  speaker
}: VideoPlayerProps) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const playerRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const certificateRef = useRef<HTMLDivElement>(null);
  const db = getFirebaseFirestore();
  const functions = getFunctions(getFirebaseApp());
  const isMobile = useIsMobile();
  const farthestTimeWatchedRef = useRef<number>(0);


  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(false);
  const [isAutoNextEnabled, setIsAutoNextEnabled] = useState(true);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoadingEnrollment, setIsLoadingEnrollment] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(currentVideo.likeCount || 0);
  const [shareCount, setShareCount] = useState(currentVideo.shareCount || 0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [pinnedComment, setPinnedComment] = useState<Comment | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [relatedCourses, setRelatedCourses] = useState<CourseWithStatus[]>([]);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  
  const isModerator = user?.role === 'admin' || user?.role === 'developer' || user?.charge === 'moderator';
  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  const togglePlayPause = useCallback(() => {
    const video = playerRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch(error => console.warn("Play interrupted:", error));
    } else {
      video.pause();
    }
  }, []);
  
  useEffect(() => {
    if (isMobile) {
      setVolume(1);
      setIsMuted(false);
    } else {
      setVolume(0.5);
      setIsMuted(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const videoElement = playerRef.current;
    if (!videoElement || !isEnrolled) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    
    videoElement.muted = false;

    if (isPlaying) {
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Autoplay was prevented:", error);
                setIsPlaying(false);
            });
        }
    } else {
        videoElement.pause();
    }

    return () => {
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
    }
  }, [isEnrolled, currentVideo.id, isPlaying]);

  useEffect(() => {
    const videoElement = playerRef.current;
    if (!videoElement) return;
    videoElement.volume = volume;
  }, [volume]);
  
  useEffect(() => {
    const videoElement = playerRef.current;
    if (!videoElement) return;
    
    // Always load the video source regardless of enrollment for direct link access
    const videoUrl = currentVideo.url;
    if (videoUrl) {
        if (Hls.isSupported() && videoUrl.includes('.m3u8')) {
            const hls = new Hls();
            hls.loadSource(videoUrl);
            hls.attachMedia(videoElement);
            return () => hls.destroy();
        } else {
            videoElement.src = videoUrl;
        }
    }

    if (currentVideo.duration) {
        setDuration(currentVideo.duration);
    }

    const fetchLastPosition = async () => {
        if (!user || !isEnrolled) return; // Only fetch position if enrolled
        const progressRef = doc(db, 'userVideoProgress', `${user.uid}_${course.id}`);
        const progressSnap = await getDoc(progressRef);
        if (progressSnap.exists()) {
            const videoProgress = (progressSnap.data() as UserProgressType).videoProgress?.find(vp => vp.videoId === currentVideo.id);
            if (videoProgress && videoProgress.timeSpent && videoElement) {
                videoElement.currentTime = videoProgress.timeSpent;
                farthestTimeWatchedRef.current = videoProgress.timeSpent;
            }
        }
    };
    fetchLastPosition();
    
  }, [currentVideo.id, currentVideo.url, isEnrolled, user, course.id, db]);


  useEffect(() => {
    if (!user) return;
    const likeRef = doc(db, 'Contents', currentVideo.id, 'likes', user.uid);
    const unsubscribe = onSnapshot(likeRef, (doc) => {
        setIsLiked(doc.exists());
    });
    
    const videoRef = doc(db, 'Contents', currentVideo.id);
    const unsubscribeVideo = onSnapshot(videoRef, (doc) => {
        if(doc.exists()){
            const data = doc.data();
            setLikeCount(data.likeCount || 0);
            setShareCount(data.shareCount || 0);
        }
    });

    return () => {
        unsubscribe();
        unsubscribeVideo();
    }
  }, [user, currentVideo.id, db]);

   useEffect(() => {
    const fetchRelatedCourses = async () => {
        if (!course.ladderIds || course.ladderIds.length === 0 || !user) return;

        const coursesRef = collection(db, 'courses');
        const q = query(
            coursesRef, 
            where('ladderIds', 'array-contains-any', course.ladderIds), 
            where('status', '==', 'published')
        );
        
        const querySnapshot = await getDocs(q);
        const coursesFromDB = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Course))
            .filter(c => c.id !== course.id); // Exclude current course

        // Fetch enrollment status for related courses
        const enrollmentQuery = query(collection(db, 'enrollments'), where('userId', '==', user.uid));
        const enrollmentSnapshot = await getDocs(enrollmentQuery);
        const enrolledCourseIds = new Set(enrollmentSnapshot.docs.map(doc => doc.data().courseId));

        const coursesWithStatus = coursesFromDB.map(c => ({
            ...c,
            isEnrolled: enrolledCourseIds.has(c.id)
        }));

        setRelatedCourses(coursesWithStatus);
    };

    if(user) {
        fetchRelatedCourses();
    }
  }, [course.id, course.ladderIds, user, db]);
  
   const saveProgressToFirestore = useCallback(async (time: number, completed: boolean) => {
        if (!user || !isEnrolled) return;
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        debounceTimeoutRef.current = setTimeout(async () => {
            const batch = writeBatch(db);

            // Fetch all enrollments for the user to find other courses with this video
            const enrollmentsQuery = query(collection(db, 'enrollments'), where('userId', '==', user.uid));
            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
            const enrolledCourseIds = enrollmentsSnapshot.docs.map(doc => doc.data().courseId);

            // Fetch course data for all enrolled courses
            const coursesWithVideoQuery = query(collection(db, 'courses'), 
                where('videos', 'array-contains', currentVideo.id),
                where(documentId(), 'in', enrolledCourseIds.length > 0 ? enrolledCourseIds : ['dummy-id']) // Avoid empty 'in' query
            );
            const coursesWithVideoSnapshot = await getDocs(coursesWithVideoQuery);

            for (const courseDoc of coursesWithVideoSnapshot.docs) {
                const courseToUpdate = courseDoc.data() as Course;
                const courseIdToUpdate = courseDoc.id;
                
                const docId = `${user.uid}_${courseIdToUpdate}`;
                const progressRef = doc(db, 'userVideoProgress', docId);

                const progressDoc = await getDoc(progressRef);
                let currentProgress: VideoProgress[] = [];

                if (progressDoc.exists()) {
                    currentProgress = (progressDoc.data() as UserProgressType).videoProgress || [];
                }

                const videoProgressIndex = currentProgress.findIndex(vp => vp.videoId === currentVideo.id);
                let needsUpdate = false;

                if (videoProgressIndex > -1) {
                    if (time > (currentProgress[videoProgressIndex].timeSpent || 0)) {
                        currentProgress[videoProgressIndex].timeSpent = time;
                        needsUpdate = true;
                    }
                    if (completed && !currentProgress[videoProgressIndex].completed) {
                        currentProgress[videoProgressIndex].completed = true;
                        needsUpdate = true;
                    }
                } else {
                    currentProgress.push({ videoId: currentVideo.id, timeSpent: time, completed });
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    const dataToSave: Partial<UserProgressType> = {
                        userId: user.uid,
                        courseId: courseIdToUpdate,
                        videoProgress: currentProgress,
                        lastWatchedVideoId: currentVideo.id,
                    };

                    batch.set(progressRef, dataToSave, { merge: true });

                    if (completed) {
                        const publishedVideoIds = courseToUpdate.videos; // Assume all videos in array are published
                        const completedCount = currentProgress.filter(p => p.completed && publishedVideoIds.includes(p.videoId)).length;
                        
                        if (publishedVideoIds.length > 0 && completedCount === publishedVideoIds.length) {
                             const enrollmentRef = doc(db, 'enrollments', `${user.uid}_${courseIdToUpdate}`);
                             batch.update(enrollmentRef, { completedAt: serverTimestamp() });
                        }
                    }
                }
            }
            
            try {
                await batch.commit();
            } catch (error) {
                console.error("Failed to save progress to Firestore:", error);
                toast({ variant: 'destructive', title: "We couldn't save your progress. Please try again." });
            }
        }, 1000);
    }, [user, isEnrolled, db, currentVideo.id, toast]);
  
   useEffect(() => {
    if (!user) {
        setIsLoadingEnrollment(false);
        return;
    }
    setIsLoadingEnrollment(true);
    
    // Subscribe to enrollment status
    const enrollmentRef = doc(db, 'enrollments', `${user.uid}_${course.id}`);
    const unsubscribeEnrollment = onSnapshot(enrollmentRef, (doc) => {
        const enrolled = doc.exists();
        setIsEnrolled(enrolled);
        setIsCompleted(!!doc.data()?.completedAt);
        setIsLoadingEnrollment(false);
    });
    
    // Subscribe to video progress
    const progressRef = doc(db, 'userVideoProgress', `${user.uid}_${course.id}`);
    const unsubscribeProgress = onSnapshot(progressRef, (doc) => {
        if (doc.exists()) {
            const progressData = doc.data() as UserProgressType;
            const completedIds = (progressData.videoProgress || [])
                .filter(vp => vp.completed)
                .map(vp => vp.videoId);
            setWatchedVideos(new Set(completedIds));
        } else {
            setWatchedVideos(new Set());
        }
    });

    return () => {
        unsubscribeEnrollment();
        unsubscribeProgress();
    };
  }, [user, course.id, db]);

  useEffect(() => {
    if (!currentVideo.id) return;

    const commentsColRef = collection(db, "Contents", currentVideo.id, "comments");
    const q = query(commentsColRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let commentsData: Comment[] = [];
      let pinned: Comment | null = null;
      querySnapshot.forEach((doc) => {
        const comment = { id: doc.id, ...doc.data() } as Comment;
        if (comment.isPinned) {
          pinned = comment;
        }
        commentsData.push(comment);
      });
      setComments(commentsData);
      setPinnedComment(pinned);
    });

    return () => unsubscribe();
  }, [currentVideo.id, db]);
  
  const handleTogglePin = async (comment: Comment) => {
    if (!isModerator) return;
    const commentRef = doc(db, "Contents", currentVideo.id, "comments", comment.id);
    await updateDoc(commentRef, { isPinned: !comment.isPinned });
    toast({ title: comment.isPinned ? "Comment unpinned" : "Comment pinned" });
  };
  
  const handleDeleteComment = async (commentId: string) => {
    if (!isAdmin) return;
    if(window.confirm("Are you sure you want to delete this comment?")){
        const commentRef = doc(db, "Contents", currentVideo.id, "comments", commentId);
        await deleteDoc(commentRef);
        toast({ title: "Comment deleted" });
    }
  }

  const nextVideo = courseVideos[videoIndex + 1];

  const handleEnded = async () => {
    if (isLooping) return;
    setIsPlaying(false);
    setProgress(100);
    
    if (user && playerRef.current) {
        await saveProgressToFirestore(playerRef.current.duration, true);
        refreshUser();
    }
    
    if (isAutoNextEnabled && nextVideo) {
        router.push(`/courses/${course.id}/video/${nextVideo.id}`);
    }
  }
  
  const handleVolumeChange = (value: number[]) => {
      const newVolume = value[0];
      setVolume(newVolume);
      if (playerRef.current) {
          playerRef.current.volume = newVolume;
      }
      setIsMuted(newVolume === 0);
  }

  const toggleMute = () => {
      const player = playerRef.current;
      if (!player) return;
      if (isMuted || volume === 0) {
          const newVolume = volume > 0 ? volume : 0.5;
          setVolume(newVolume);
          player.volume = newVolume;
          setIsMuted(false);
      } else {
          player.volume = 0;
          setIsMuted(true);
      }
  }
  
  const handleShare = async () => {
    const shareData = {
        title: `${course.title} - ${currentVideo.title}`,
        text: `Check out this video from the course "${course.title}" on Glory Training Hub!`,
        url: window.location.href,
    };
    
    const updateShareCount = async () => {
        const videoRef = doc(db, 'Contents', currentVideo.id);
        await updateDoc(videoRef, { shareCount: increment(1) });
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
            await updateShareCount();
        } catch (error: any) {
            // Silently fall back to clipboard if permission is denied
            if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
                 console.error('Error sharing:', error);
            }
            navigator.clipboard.writeText(shareData.url);
            await updateShareCount();
            toast({ title: 'Link copied to clipboard!' });
        }
    } else {
        navigator.clipboard.writeText(shareData.url);
        await updateShareCount();
        toast({ title: 'Link copied to clipboard!' });
    }
};


  const handleLike = async () => {
    if (!user) return;
    const videoRef = doc(db, 'Contents', currentVideo.id);
    const likeRef = doc(db, 'Contents', currentVideo.id, 'likes', user.uid);
    
    await runTransaction(db, async (transaction) => {
        const likeDoc = await transaction.get(likeRef);
        if (likeDoc.exists()) {
            transaction.delete(likeRef);
            transaction.update(videoRef, { likeCount: increment(-1) });
        } else {
            transaction.set(likeRef, { userId: user.uid });
            transaction.update(videoRef, { likeCount: increment(1) });
        }
    });
  };
  
   const handleFullScreen = () => {
    const playerContainer = videoContainerRef.current;
    if (!playerContainer) return;

    if (!document.fullscreenElement) {
        playerContainer.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullScreenChange);
  }, []);

  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) return;

    const handleInteraction = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (playerRef.current && !playerRef.current.paused) {
                setShowControls(false);
            }
        }, 3000);
    };

    container.addEventListener('mousemove', handleInteraction);
    container.addEventListener('click', handleInteraction);

    return () => {
        container.removeEventListener('mousemove', handleInteraction);
        container.removeEventListener('click', handleInteraction);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
    };
  }, []);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    setIsSubmittingComment(true);

    const commentData: Omit<Comment, 'id' | 'replies'> = {
        userId: user.uid,
        userName: user.displayName,
        userAvatar: user.photoURL,
        text: newComment.trim(),
        createdAt: serverTimestamp(),
        reactions: {},
    };

    try {
        await addDoc(collection(db, "Contents", currentVideo.id, "comments"), commentData);
        setNewComment('');
    } catch(err) {
        console.error("Error posting comment: ", err);
        toast({ variant: 'destructive', title: 'Failed to post comment.' });
    } finally {
        setIsSubmittingComment(false);
    }
  };
  
    const handleDownloadCertificate = async () => {
        const certificateElement = certificateRef.current;
        if (!certificateElement) return;

        try {
            const canvas = await html2canvas(certificateElement, {
                scale: 3,
                useCORS: true,
                backgroundColor: null,
            });

            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${user?.displayName}-${course.title}-certificate.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ variant: 'destructive', title: 'Failed to download certificate.' });
        }
    };
    
    const handleScreenshot = async () => {
        const certificateElement = certificateRef.current;
        if (!certificateElement) return;
        try {
            const canvas = await html2canvas(certificateElement, {
                scale: 3,
                useCORS: true,
                backgroundColor: null,
            });
            const link = document.createElement('a');
            link.download = `${user?.displayName}-${course.title}-certificate.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error("Error generating screenshot:", error);
            toast({ variant: 'destructive', title: 'Failed to generate screenshot.' });
        }
    };

    const handleUnenroll = async () => {
      if (!user) return;
      setIsUnenrolling(true);
      const result = await unenrollUserFromCourse(user.uid, course.id);
      if (result.success) {
        toast({ title: "Successfully unenrolled" });
        router.push("/courses");
      } else {
        toast({ variant: "destructive", title: "Unenrollment failed", description: result.message });
      }
      setIsUnenrolling(false);
    };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names.map(n => n[0]).join("").toUpperCase();
  };

  const commentTree = useMemo(() => {
    const commentMap: { [id: string]: Comment & { replies: Comment[] } } = {};
    const topLevelComments: (Comment & { replies: Comment[] })[] = [];

    // First pass: create a map of all comments and initialize replies array
    for (const comment of comments) {
      commentMap[comment.id] = { ...comment, replies: [] };
    }

    // Second pass: build the tree
    for (const comment of comments) {
      if (comment.parentId && commentMap[comment.parentId]) {
        // This is a reply, add it to its parent's replies array
        commentMap[comment.parentId].replies.push(commentMap[comment.id]);
      } else {
        // This is a top-level comment
        topLevelComments.push(commentMap[comment.id]);
      }
    }

    // Sort top-level comments and replies within each comment
    const sortComments = (c: Comment[]) => c.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

    topLevelComments.forEach(comment => {
        sortComments(comment.replies);
    });
    
    // Sort top-level comments newest first
    return topLevelComments.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  }, [comments]);


  return (
    <div className="flex flex-col lg:flex-row flex-1">
        <div className="flex-1 flex flex-col lg:h-screen">
             <div className="lg:px-8 lg:pt-8 flex-shrink-0">
                <div 
                    ref={videoContainerRef} 
                    className={cn("relative aspect-video w-full overflow-hidden bg-slate-900", isFullScreen ? "rounded-none" : "lg:rounded-lg")}
                >
                    <video
                        ref={playerRef}
                        className="w-full h-full"
                        onClick={togglePlayPause}
                        onTimeUpdate={(e) => {
                            const target = e.target as HTMLVideoElement;
                            if (target.currentTime > farthestTimeWatchedRef.current) {
                                farthestTimeWatchedRef.current = target.currentTime;
                            }
                            setProgress((target.currentTime / target.duration) * 100);
                            setCurrentTime(target.currentTime);
                            if(user && isEnrolled) {
                              saveProgressToFirestore(target.currentTime, false);
                            }
                        }}
                        onLoadedData={(e) => setDuration((e.target as HTMLVideoElement).duration)}
                        onEnded={handleEnded}
                        loop={isLooping}
                        autoPlay
                        playsInline
                    />
                    
                     {!isEnrolled && !isLoadingEnrollment && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4 text-center">
                            <Lock className="h-12 w-12 mb-4" />
                            <h2 className="text-xl font-bold">Enroll to watch this video</h2>
                            <p className="text-muted-foreground mb-4">Gain access to this lesson and the full course by enrolling.</p>
                            <Button onClick={() => router.push(`/courses`)}>Explore Courses</Button>
                        </div>
                    )}

                    <div className={cn("video-controls absolute bottom-0 left-0 right-0 p-2 md:p-4 bg-gradient-to-t from-black/50 to-transparent transition-opacity", showControls ? "opacity-100" : "opacity-0")}>
                        <Slider
                            value={[progress]}
                            onValueChange={(value) => {
                                if (!playerRef.current) return;
                                const newTime = (value[0] / 100) * duration;
                                if (isEnrolled && (newTime <= farthestTimeWatchedRef.current || newTime - farthestTimeWatchedRef.current < 1)) {
                                    playerRef.current.currentTime = newTime;
                                    setProgress(value[0]);
                                } else if (!isEnrolled) {
                                     playerRef.current.currentTime = newTime;
                                     setProgress(value[0]);
                                }
                            }}
                            max={100}
                            step={0.1}
                            className="w-full"
                        />
                        <div className="flex items-center justify-between text-sm text-white mt-2">
                            <div className="flex items-center gap-1 md:gap-2">
                               <Button variant="ghost" size="icon" onClick={togglePlayPause} className="text-white hover:text-white hover:bg-white/20">
                                    {isPlaying ? <Pause /> : <Play />}
                               </Button>
                                <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/20" disabled={videoIndex === 0}>
                                    <Link href={videoIndex > 0 ? `/courses/${course.id}/video/${courseVideos[videoIndex - 1].id}` : '#'}>
                                        <SkipBack />
                                    </Link>
                                </Button>
                                <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/20" disabled={videoIndex === courseVideos.length - 1}>
                                    <Link href={videoIndex < courseVideos.length - 1 ? `/courses/${course.id}/video/${courseVideos[videoIndex + 1].id}` : '#'}>
                                        <SkipForward />
                                    </Link>
                                </Button>
                                 <div className="hidden md:flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:text-white hover:bg-white/20">
                                        {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                                    </Button>
                                    <Slider
                                        value={[isMuted ? 0 : volume]}
                                        onValueChange={handleVolumeChange}
                                        max={1}
                                        step={0.05}
                                        className="w-24"
                                    />
                                </div>
                            </div>
                             <div className="flex items-center text-xs">
                                {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date(duration * 1000).toISOString().substr(14, 5)}
                            </div>
                            <div className="flex items-center justify-center gap-1 md:gap-2">
                                 <Button variant="ghost" size="icon" onClick={() => setIsLooping(!isLooping)} className={cn("text-white hover:text-white hover:bg-white/20", isLooping && "bg-white/20")}>
                                    <Repeat />
                                </Button>
                                 <Button variant="ghost" size="icon" onClick={() => setIsAutoNextEnabled(!isAutoNextEnabled)} className="text-white hover:text-white hover:bg-white/20">
                                    {isAutoNextEnabled ? <ToggleRight /> : <ToggleLeft />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => playerRef.current?.requestPictureInPicture()} className="text-white hover:text-white hover:bg-white/20 hidden md:flex">
                                    <PictureInPicture />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={handleFullScreen}
                                    className="text-white hover:text-white hover:bg-white/20"
                                >
                                    {isFullScreen ? <Minimize /> : <Maximize />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4 md:p-6 lg:p-8 lg:pb-0">
                <h1 className="text-2xl md:text-3xl font-bold font-headline">{currentVideo.title}</h1>
                 {isCompleted && (
                    <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className='flex items-center gap-3'>
                            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                            <div>
                                <h3 className="font-bold text-green-800 dark:text-green-300">Congratulations! You've completed the course.</h3>
                                <p className="text-sm text-green-700 dark:text-green-400">You can now view and download your certificate.</p>
                            </div>
                        </div>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="default" className='bg-green-600 hover:bg-green-700 text-white flex-shrink-0'>
                                    <Award className="mr-2 h-4 w-4" />
                                    View Certificate
                                </Button>
                            </DialogTrigger>
                             <DialogContent className="max-w-fit p-0 border-0">
                                <DialogHeader>
                                    <DialogTitle className="sr-only">Certificate of Completion</DialogTitle>
                                </DialogHeader>
                                <CertificatePrint 
                                    userName={user?.displayName || "Valued Student"} 
                                    course={course}
                                />
                             </DialogContent>
                        </Dialog>
                    </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                    <div className="flex items-center gap-2">
                         <Avatar>
                            <AvatarImage src={speaker?.photoURL || undefined} />
                            <AvatarFallback>{getInitials(speaker?.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{speaker?.name || 'Glory Training Hub'}</p>
                            <p className="text-sm text-muted-foreground">{course.enrollmentCount || 0} Learners</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleLike} variant="outline" size="sm" disabled={!user}>
                            <Heart className={cn("mr-2 h-4 w-4", isLiked && "fill-destructive text-destructive")} />
                            {likeCount}
                        </Button>
                        <Button onClick={handleShare} variant="outline" size="sm">
                            <Share2 className="mr-2 h-4 w-4" />
                            {shareCount}
                        </Button>
                        {isEnrolled && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" disabled={isUnenrolling}>
                                {isUnenrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure you want to un-enroll?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Your progress in this course will be saved if you choose to re-enroll later.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleUnenroll}>Un-enroll</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                    </div>
                </div>

                <div className="lg:hidden mt-6">
                    <PlaylistAndResources course={course} courseVideos={courseVideos} currentVideo={currentVideo} watchedVideos={watchedVideos} relatedCourses={relatedCourses} />
                </div>
                 
                <div className="mt-6 border-t pt-6">
                    <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
                        <MessageCircle />
                        Live Chat ({comments.length})
                    </h2>
                     {/* Comment form for Desktop */}
                    <form onSubmit={handleCommentSubmit} className="hidden lg:flex items-start gap-2">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={user?.photoURL || undefined} />
                            <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <Textarea
                                placeholder="Add a comment..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                className="w-full"
                                disabled={isSubmittingComment}
                            />
                            <div className="flex justify-end items-center mt-2">
                                 <Popover>
                                    <PopoverTrigger asChild>
                                        <Button size="icon" variant="ghost" type="button"><Smile className="h-5 w-5 text-muted-foreground" /></Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <EmojiPicker onEmojiClick={(emojiData: EmojiClickData) => setNewComment(prev => prev + emojiData.emoji)} />
                                    </PopoverContent>
                                </Popover>
                                <Button type="submit" size="sm" disabled={isSubmittingComment || !newComment.trim()}>
                                    {isSubmittingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Comment
                                </Button>
                            </div>
                        </div>
                    </form>
                    <div className="mt-6 space-y-4 lg:mb-24">
                        {pinnedComment && <CommentComponent comment={pinnedComment} replies={[]} isPinned onDelete={handleDeleteComment} onPin={handleTogglePin} isModerator={isModerator} isAdmin={isAdmin} videoId={currentVideo.id}/>}
                        {commentTree.map(comment => (
                            comment.id !== pinnedComment?.id && <CommentComponent key={comment.id} comment={comment} replies={comment.replies} onDelete={handleDeleteComment} onPin={handleTogglePin} isModerator={isModerator} isAdmin={isAdmin} videoId={currentVideo.id}/>
                        ))}
                    </div>
                </div>
            </ScrollArea>
             {/* Comment form for Mobile (Sticky) */}
            <form onSubmit={handleCommentSubmit} className="lg:hidden sticky bottom-0 left-0 right-0 flex items-start gap-2 p-2 bg-background border-t">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.photoURL || undefined} />
                    <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <Textarea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="w-full"
                        disabled={isSubmittingComment}
                        rows={1}
                    />
                </div>
                <Button type="submit" size="icon" disabled={isSubmittingComment || !newComment.trim()}>
                    {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4"/>}
                </Button>
            </form>
        </div>
        <div className="w-full lg:w-[420px] lg:flex-shrink-0 lg:border-l flex-col lg:h-screen lg:sticky lg:top-0 bg-background hidden lg:flex">
            <ScrollArea className="flex-1">
                <PlaylistAndResources course={course} courseVideos={courseVideos} currentVideo={currentVideo} watchedVideos={watchedVideos} relatedCourses={relatedCourses} />
            </ScrollArea>
        </div>
    </div>
  );
}
