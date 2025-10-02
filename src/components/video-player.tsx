
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Hls from "hls.js";
import ReactPlayer from 'react-player/lazy';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Lock,
  CheckCircle2,
  FileText,
  Award,
  Link as LinkIcon,
  Maximize,
  Repeat,
  Minimize,
  Share2,
  Heart,
  Volume2,
  VolumeX,
  Download,
  ToggleLeft,
  ToggleRight,
  PictureInPicture,
  FileQuestion,
} from "lucide-react";
import type {
  Course,
  Video,
  UserProgress as UserProgressType,
  VideoProgress,
  Speaker,
  Quiz,
  UserQuizResult,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Slider } from "@/components/ui/slider";
import { getFirebaseFirestore, getFirebaseApp } from "@/lib/firebase";
import {
  collection, addDoc, onSnapshot, serverTimestamp, doc, getDoc, runTransaction, writeBatch, setDoc, query, where, getDocs, documentId,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import CertificatePrint from "@/components/certificate-print";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CourseCard } from "./course-card";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-is-mobile";
import CommentSection, { CommentForm } from "./video/comment-section";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { Progress } from "./ui/progress";


interface PlaylistAndResourcesProps {
  course: Course;
  courseVideos: Video[];
  currentVideo: Video;
  watchedVideos: Set<string>;
  relatedCourses: (Course & {
    isEnrolled?: boolean;
    isCompleted?: boolean;
    isLocked?: boolean;
    prerequisiteCourse?: { id: string; title: string };
    totalProgress?: number;
    lastWatchedVideoId?: string;
  })[];
  onRelatedChange: () => void;
  quizzes: Quiz[];
  quizResults: UserQuizResult[];
}

const PlaylistAndResources = ({
  course,
  courseVideos,
  currentVideo,
  watchedVideos,
  relatedCourses,
  onRelatedChange,
  quizzes,
  quizResults = [],
}: PlaylistAndResourcesProps) => {
  let lastUnlockedIndex = -1;
  courseVideos.forEach((video, index) => {
    if (watchedVideos.has(video.id)) {
      lastUnlockedIndex = index;
    }
  });

  return (
    <Accordion
      type="multiple"
      defaultValue={["playlist", "resources", "related", "quizzes"]}
      className="w-full"
    >
      <AccordionItem value="playlist">
        <AccordionTrigger className="px-4 font-semibold">
          {course.title}
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-1">
            {courseVideos.map((video, index) => {
              const isLocked =
                index > 0 && !watchedVideos.has(courseVideos[index - 1].id);
              const isCompleted = watchedVideos.has(video.id);

              return (
                <Link
                  key={video.id}
                  href={!isLocked ? `/courses/${course.id}/video/${video.id}` : "#"}
                  className={cn(
                    "flex items-center gap-3 p-3 text-sm transition-colors",
                    isLocked && "opacity-50 cursor-not-allowed",
                    video.id === currentVideo.id && !isLocked
                      ? "bg-primary/10 text-primary font-semibold"
                      : !isLocked
                      ? "hover:bg-muted"
                      : ""
                  )}
                  onClick={(e) => {
                    if (isLocked) e.preventDefault();
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : isLocked ? (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Play className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="flex-1">{video.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {video.duration ? `${Math.round(video.duration / 60)} min` : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>

      {quizzes.length > 0 && (
        <AccordionItem value="quizzes">
            <AccordionTrigger className="px-4 font-semibold">
                Quizzes
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-2">
                 {quizzes.map((quiz) => {
                    const result = quizResults.find(r => r.quizId === quiz.id);
                    const isCompleted = !!result && result.passed;
                    
                    return (
                        <Link
                            key={quiz.id}
                            href={`/courses/${course.id}/quiz/${quiz.id}`}
                            className="block p-3 rounded-md hover:bg-muted"
                        >
                             <div className="flex items-start gap-3">
                                {isCompleted ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                                ) : (
                                    <FileQuestion className="h-5 w-5 text-muted-foreground mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold">{quiz.title}</p>
                                        {result && <span className="text-xs font-bold text-primary">{result.score.toFixed(0)}%</span>}
                                    </div>
                                    {result && <Progress value={result.score} className="h-1 mt-1" />}
                                </div>
                            </div>
                        </Link>
                    )
                 })}
            </AccordionContent>
        </AccordionItem>
      )}

      <AccordionItem value="resources">
        <AccordionTrigger className="px-4 font-semibold">
          Resources
        </AccordionTrigger>
        <AccordionContent className="px-4 space-y-2">
          {course["Resource Doc"]?.map((url, index) => {
            const fileName =
              url.split("/").pop()?.split("?")[0].split("%2F").pop() || "Resource";
            return (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted"
              >
                <FileText className="h-5 w-5" />
                <span>{decodeURIComponent(fileName)}</span>
              </a>
            );
          })}
          {course.attendanceLinks?.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted"
            >
              <LinkIcon className="h-5 w-5" />
              <span>{link.title}</span>
            </a>
          ))}
        </AccordionContent>
      </AccordionItem>

      {relatedCourses.length > 0 && (
        <AccordionItem value="related">
          <AccordionTrigger className="px-4 font-semibold">
            Related Courses
          </AccordionTrigger>
          <AccordionContent className="p-2 space-y-2">
            {relatedCourses.map((rc) => (
              <div key={rc.id} className="w-full px-2">
                <CourseCard course={rc} onChange={onRelatedChange} />
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
};


interface VideoPlayerClientProps {
  course: Course;
  courseVideos: Video[];
  currentVideo: Video;
  videoIndex: number;
  speaker: Speaker | null;
}

export default function VideoPlayerClient({
  course,
  courseVideos,
  currentVideo,
  videoIndex,
  speaker,
}: VideoPlayerClientProps) {
  const { user, refreshUser, hasPermission } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const reactPlayerRef = useRef<ReactPlayer | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gradientFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const farthestTimeWatchedRef = useRef<number>(0);
  const lastSavedRef = useRef<{ time: number; percent: number; atMs: number }>({
    time: 0,
    percent: 0,
    atMs: 0,
  });

  const db = getFirebaseFirestore();
  const functions = getFunctions(getFirebaseApp());
  const isMobile = useIsMobile();

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
  const [showGradientOverlay, setShowGradientOverlay] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(currentVideo.likeCount || 0);
  const [shareCount, setShareCount] = useState(currentVideo.shareCount || 0);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizResults, setQuizResults] = useState<UserQuizResult[]>([]);

  const isYouTube = currentVideo.type === 'youtube' || (currentVideo.url && (currentVideo.url.includes('youtube.com') || currentVideo.url.includes('youtu.be')));
  const isGoogleDrive = currentVideo.type === 'googledrive';

  const canDownload = hasPermission("downloadContent") && !isYouTube && !isGoogleDrive;
  const canRightClick = hasPermission("allowRightClick");

  const { processedCourses, loading: processedLoading, refresh } =
    useProcessedCourses(true);

  const relatedCourses = useMemo(() => {
    if (!processedCourses?.length || !course.ladderIds?.length) return [];
    return processedCourses.filter(
      (c) =>
        c.id !== course.id &&
        Array.isArray(c.ladderIds) &&
        c.ladderIds.some((id) => course.ladderIds!.includes(id))
    );
  }, [processedCourses, course.id, course.ladderIds]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

    useEffect(() => {
        const fetchQuizzesAndResults = async () => {
            if (!course.quizIds || course.quizIds.length === 0) {
                setQuizzes([]);
                return;
            }
            const q = query(collection(db, 'quizzes'), where(documentId(), 'in', course.quizIds));
            const snapshot = await getDocs(q);
            const fetchedQuizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
            setQuizzes(fetchedQuizzes);

            if(user) {
                const resultsQuery = query(
                    collection(db, 'userQuizResults'), 
                    where('userId', '==', user.uid),
                    where('courseId', '==', course.id),
                    where('quizId', 'in', course.quizIds)
                );
                const resultsSnapshot = await getDocs(resultsQuery);
                const fetchedResults = resultsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as UserQuizResult);
                setQuizResults(fetchedResults);
            }
        }
        fetchQuizzesAndResults();
    }, [course.quizIds, course.id, user, db]);


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
    if (!user) {
      setIsLiked(false);
      return;
    }
    const likeRef = doc(db, "Contents", currentVideo.id, "likes", user.uid);
    const unsub = onSnapshot(likeRef, (d) => setIsLiked(d.exists()));
    return () => unsub();
  }, [user, currentVideo.id, db]);

  useEffect(() => {
    const likesCol = collection(db, "Contents", currentVideo.id, "likes");
    const sharesCol = collection(db, "Contents", currentVideo.id, "shares");

    const unsubLikes = onSnapshot(likesCol, (qs) => setLikeCount(qs.size));
    const unsubShares = onSnapshot(sharesCol, (qs) => setShareCount(qs.size));

    return () => {
      unsubLikes();
      unsubShares();
    };
  }, [currentVideo.id, db]);

  useEffect(() => {
    if (!user) {
      setIsLoadingEnrollment(false);
      return;
    }
    setIsLoadingEnrollment(true);

    const enrollmentRef = doc(db, "enrollments", `${user.uid}_${course.id}`);
    const unsubscribeEnrollment = onSnapshot(enrollmentRef, (d) => {
      const enrolled = d.exists();
      setIsEnrolled(enrolled);
      setIsCompleted(!!d.data()?.completedAt);
      setIsLoadingEnrollment(false);
    });

    const progressRef = doc(db, "userVideoProgress", `${user.uid}_${course.id}`);
    const unsubscribeProgress = onSnapshot(progressRef, (d) => {
      if (d.exists()) {
        const pd = d.data() as UserProgressType;
        const completedIds = (pd.videoProgress || [])
          .filter((vp) => vp.completed)
          .map((vp) => vp.videoId);
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
    const videoElement = playerRef.current;
    
    // Common setup for both video types
    const resume = async () => {
        if (!user || !isEnrolled) return;
        const progressRef = doc(db, "userVideoProgress", `${user.uid}_${course.id}`);
        const snap = await getDoc(progressRef);
        if (snap.exists()) {
            const vp = (snap.data() as UserProgressType).videoProgress?.find(
                (x) => x.videoId === currentVideo.id
            );
            if (vp && typeof vp.timeSpent === "number") {
                const resumeTime = vp.timeSpent;
                farthestTimeWatchedRef.current = resumeTime;
                
                if ((isYouTube || isGoogleDrive) && reactPlayerRef.current) {
                    reactPlayerRef.current.seekTo(resumeTime, 'seconds');
                } else if (videoElement) {
                    const setTime = () => {
                        try {
                            videoElement.currentTime = resumeTime;
                        } catch {}
                    };
                    if (videoElement.readyState >= 1) setTime();
                    else videoElement.addEventListener("loadedmetadata", setTime, { once: true });
                }
            }
        }
    };
    resume();

    if (isYouTube || isGoogleDrive) return; // Skip HLS and native video setup for YouTube/Drive
    
    if (!videoElement) return;

    const videoUrl = currentVideo.hlsUrl || currentVideo.url;

    let hls: Hls | null = null;
    if (videoUrl) {
      if (Hls.isSupported() && (videoUrl.includes(".m3u8") || currentVideo.hlsUrl)) {
        hls = new Hls();
        hls.loadSource(videoUrl);
        hls.attachMedia(videoElement);
      } else {
        videoElement.src = videoUrl;
      }
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);

    const tryAutoplay = async () => {
      if (!isEnrolled) return;
      try {
        await videoElement.play();
      } catch {
        setIsPlaying(false);
      }
    };
    tryAutoplay();

    if (currentVideo.duration) {
      setDuration(currentVideo.duration);
    }

    return () => {
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      if (hls) hls.destroy();
    };
  }, [currentVideo.id, currentVideo.url, currentVideo.hlsUrl, isEnrolled, user, course.id, isYouTube, isGoogleDrive]);
  
  useEffect(() => {
    if (isYouTube || isGoogleDrive) {
        if(reactPlayerRef.current) {
            // handle volume for react-player if needed
        }
    } else {
        const v = playerRef.current;
        if (!v) return;
        v.volume = volume;
        v.muted = isMuted;
    }
  }, [volume, isMuted, isYouTube, isGoogleDrive]);

  const saveProgressToFirestore = useCallback(
    async (time: number, completed: boolean, immediate = false) => {
      if (!user || !isEnrolled) return;
      
      const currentDuration = (isYouTube || isGoogleDrive)
        ? reactPlayerRef.current?.getDuration() ?? 0
        : playerRef.current?.duration ?? 0;

      if(currentDuration === 0) return; // Don't save if duration is not known

      const farthest = Math.max(time, farthestTimeWatchedRef.current || 0);
      const percent = Math.min(100, (farthest / currentDuration) * 100);

      const now = Date.now();
      const sinceLastMs = now - lastSavedRef.current.atMs;
      const timeDelta = Math.abs(farthest - lastSavedRef.current.time);
      const percentDelta = Math.abs(percent - lastSavedRef.current.percent);

      const shouldWrite =
        immediate ||
        completed ||
        timeDelta >= 5 || 
        percentDelta >= 2 ||
        sinceLastMs >= 15000; 

      if (!shouldWrite) return;

      const progressRef = doc(db, "userVideoProgress", `${user.uid}_${course.id}`);
      const enrollmentRef = doc(db, "enrollments", `${user.uid}_${course.id}`);

      try {
        const snap = await getDoc(progressRef);
        let currentProgress: VideoProgress[] = [];
        if (snap.exists()) {
          currentProgress = (snap.data() as UserProgressType).videoProgress || [];
        }

        const idx = currentProgress.findIndex((p) => p.videoId === currentVideo.id);
        if (idx > -1) {
          currentProgress[idx].timeSpent = Math.max(
            currentProgress[idx].timeSpent || 0,
            farthest
          );
          if (completed) currentProgress[idx].completed = true;
        } else {
          currentProgress.push({
            videoId: currentVideo.id,
            timeSpent: farthest,
            completed: !!completed,
          });
        }

        const batch = writeBatch(db);
        const dataToSave: Partial<UserProgressType> = {
          userId: user.uid,
          courseId: course.id,
          videoProgress: currentProgress,
          lastWatchedVideoId: currentVideo.id,
          updatedAt: serverTimestamp() as any,
          percent: Math.round(percent),
        };
        batch.set(progressRef, dataToSave, { merge: true });

        if (completed) {
          const publishedVideoIds: string[] = Array.isArray(course.videos) ? course.videos : [];
          const allVideosCompleted = publishedVideoIds.every(vid => currentProgress.some(p => p.videoId === vid && p.completed));
          const allQuizzesCompleted = (course.quizIds || []).every(quizId => 
            quizResults.some(res => res.quizId === quizId && res.passed)
          );

          if (allVideosCompleted && allQuizzesCompleted) {
            batch.set(enrollmentRef, { completedAt: serverTimestamp() as any }, { merge: true });
          }
        }

        await batch.commit();

        lastSavedRef.current = { time: farthest, percent, atMs: now };
      } catch (error) {
        console.error("Failed to save progress:", error);
        toast({
          variant: "destructive",
          title: "We couldn't save your progress. Please try again.",
        });
      }
    },
    [user, isEnrolled, db, currentVideo.id, course.id, course.videos, course.quizIds, quizResults, isYouTube, isGoogleDrive, toast]
  );
  
  const flushProgress = useCallback(() => {
    let t = 0;
    if (isYouTube || isGoogleDrive) {
        if(reactPlayerRef.current) t = reactPlayerRef.current.getCurrentTime();
    } else if (playerRef.current) {
        t = playerRef.current.currentTime;
    }
    const finalTime = Math.max(t || 0, farthestTimeWatchedRef.current || 0);
    return saveProgressToFirestore(finalTime, false, true);
  }, [saveProgressToFirestore, isYouTube, isGoogleDrive]);

  useEffect(() => {
    const onPageHide = () => flushProgress();
    const onVisibility = () => {
      if (document.hidden) flushProgress();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushProgress]);

  useEffect(() => {
    if(isYouTube || isGoogleDrive) return;
    const v = playerRef.current;
    if (!v) return;

    const onPause = () => flushProgress();
    
    // Disable fast-forwarding
    const onSeeking = () => {
        if (!v) return;
        if (v.currentTime > farthestTimeWatchedRef.current) {
            v.currentTime = farthestTimeWatchedRef.current;
            toast({
              title: "Fast-forwarding is disabled",
              description: "You must watch the video to proceed.",
              duration: 2000,
            });
        }
    };
    const onSeeked = () => {
      if (!v) return;
      if (v.currentTime > farthestTimeWatchedRef.current) {
        farthestTimeWatchedRef.current = v.currentTime;
      }
      flushProgress();
    };
    const onLoadedMetadata = () => {
      if (Number.isFinite(v.duration)) setDuration(v.duration);
    };

    v.addEventListener("pause", onPause);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [flushProgress, isYouTube, isGoogleDrive, toast]);

  const nextVideo = courseVideos[videoIndex + 1];

  const handleEnded = async () => {
    if (isLooping) {
        if(isYouTube || isGoogleDrive) reactPlayerRef.current?.seekTo(0);
        else if(playerRef.current) playerRef.current.currentTime = 0;
        return;
    }
    setIsPlaying(false);
    setProgress(100);

    const currentDuration = (isYouTube || isGoogleDrive) ? reactPlayerRef.current?.getDuration() ?? 0 : playerRef.current?.duration ?? duration;
    if (user && currentDuration > 0) {
      await saveProgressToFirestore(currentDuration, true, true);
    }
    refresh();

    if (isAutoNextEnabled && nextVideo) {
      router.push(`/courses/${course.id}/video/${nextVideo.id}`);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const handleShare = async () => {
    const shareData = {
      title: `${course.title} - ${currentVideo.title}`,
      text: `Check out this video from the course "${course.title}" on Glory Training Hub!`,
      url: window.location.href,
    };

    const recordShare = async () => {
      if (!user) return;
      const sharesCol = collection(db, "Contents", currentVideo.id, "shares");
      await addDoc(sharesCol, { uid: user.uid, createdAt: serverTimestamp() });
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        await recordShare();
      } catch (error: any) {
        if (error.name !== "NotAllowedError" && error.name !== "AbortError") {
          console.error("Error sharing:", error);
        }
        await navigator.clipboard.writeText(shareData.url);
        await recordShare();
        toast({ title: "Link copied to clipboard!" });
      }
    } else {
      await navigator.clipboard.writeText(shareData.url);
      await recordShare();
      toast({ title: "Link copied to clipboard!" });
    }
  };

  const handleLike = async () => {
    if (!user) return;
    const likeRef = doc(db, "Contents", currentVideo.id, "likes", user.uid);
    await runTransaction(db, async (transaction) => {
      const likeDoc = await transaction.get(likeRef);
      if (likeDoc.exists()) transaction.delete(likeRef);
      else transaction.set(likeRef, { uid: user.uid, createdAt: serverTimestamp() });
    });
  };

  const handleFullScreen = () => {
    const playerContainer = videoContainerRef.current;
    if (!playerContainer) return;
    if (!document.fullscreenElement) {
      playerContainer.requestFullscreen().catch((err) => {
        alert(`Error attempting to enable full-screen: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullScreenChange);
  }, []);

  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) return;

    const handleInteraction = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isYouTube && !isGoogleDrive && playerRef.current && !playerRef.current.paused) {
          setShowControls(false);
        } else if ((isYouTube || isGoogleDrive) && isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    container.addEventListener("mousemove", handleInteraction);
    container.addEventListener("click", handleInteraction);
    return () => {
      container.removeEventListener("mousemove", handleInteraction);
      container.removeEventListener("click", handleInteraction);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, isYouTube, isGoogleDrive]);
  
  // Logic for the gradient overlay
  useEffect(() => {
    if (gradientFadeTimeoutRef.current) {
        clearTimeout(gradientFadeTimeoutRef.current);
    }

    if (isPlaying) {
        // When playing starts, wait 5 seconds before hiding the gradient
        gradientFadeTimeoutRef.current = setTimeout(() => {
            setShowGradientOverlay(false);
        }, 5000);
    } else {
        // When paused, show the gradient immediately
        setShowGradientOverlay(true);
    }

    return () => {
        if (gradientFadeTimeoutRef.current) {
            clearTimeout(gradientFadeTimeoutRef.current);
        }
    };
  }, [isPlaying]);


  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    return parts.map((n) => n[0]).join("").toUpperCase();
  };
  
   const handlePlayerProgress = (state: { played: number, playedSeconds: number }) => {
    const t = state.playedSeconds;
    const d = reactPlayerRef.current?.getDuration() ?? 0;
    
    if (t > farthestTimeWatchedRef.current) {
        farthestTimeWatchedRef.current = t;
    }
    
    const pct = d > 0 ? (t / d) * 100 : 0;
    setProgress(pct);
    setCurrentTime(t);
    
    if (user && isEnrolled) {
        saveProgressToFirestore(farthestTimeWatchedRef.current, false, false);
    }
  };
  
  const handlePlayerSeek = (seconds: number) => {
    if (seconds > farthestTimeWatchedRef.current) {
        reactPlayerRef.current?.seekTo(farthestTimeWatchedRef.current, 'seconds');
        toast({ title: "Fast-forwarding is disabled", description: "You must watch the video to proceed." });
    }
  };

  return (
    <div
      className="flex flex-col lg:flex-row flex-1"
      onContextMenu={!canRightClick ? (e) => e.preventDefault() : undefined}
    >
      <div className="flex-1 flex flex-col lg:h-screen">
        <div className="lg:px-8 lg:pt-8 flex-shrink-0">
          <div
            ref={videoContainerRef}
            className={cn(
              "relative aspect-video w-full overflow-hidden bg-slate-900",
              isFullScreen ? "rounded-none" : "lg:rounded-lg"
            )}
          >
            {isYouTube || isGoogleDrive ? (
                <div className="relative w-full h-full">
                    <ReactPlayer
                        ref={reactPlayerRef}
                        url={currentVideo.url}
                        playing={isPlaying}
                        controls={false}
                        loop={isLooping}
                        volume={volume}
                        muted={isMuted}
                        width="100%"
                        height="100%"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={handleEnded}
                        onProgress={handlePlayerProgress}
                        onDuration={setDuration}
                        onSeek={handlePlayerSeek}
                        config={{
                            youtube: {
                                playerVars: { 
                                    showinfo: 0,
                                    modestbranding: 1,
                                    rel: 0,
                                    controls: 0,
                                    disablekb: 1, // Disable keyboard controls
                                }
                            }
                        }}
                    />
                    {/* Click Interceptor Overlay */}
                    <div className="absolute inset-0" onClick={togglePlayPause} />
                    {(isYouTube || isGoogleDrive) && showGradientOverlay && (
                      <>
                        <div className="absolute top-0 left-0 right-0 h-1/5 bg-gradient-to-b from-black/95 via-black/80 to-transparent pointer-events-none transition-opacity duration-300" />
                        <div className="absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-t from-black/95 via-black/80 to-transparent pointer-events-none transition-opacity duration-300" />
                      </>
                    )}
                    {!isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Button variant="ghost" size="icon" className="h-20 w-20 bg-black/50 text-white hover:bg-black/70 hover:text-white">
                                <Play className="h-12 w-12" />
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <video
                    ref={playerRef}
                    className="w-full h-full"
                    onClick={togglePlayPause}
                    onTimeUpdate={(e) => {
                      const target = e.target as HTMLVideoElement;
                      const t = target.currentTime || 0;
                      const d = (target.duration && Number.isFinite(target.duration)) ? target.duration : duration;
                      if (t > farthestTimeWatchedRef.current) farthestTimeWatchedRef.current = t;
                      const pct = d > 0 ? (t / d) * 100 : 0;
                      setProgress(pct);
                      setCurrentTime(t);
                      if (user && isEnrolled) saveProgressToFirestore(farthestTimeWatchedRef.current, false, false);
                    }}
                    onLoadedMetadata={(e) => {
                      const dur = (e.target as HTMLVideoElement).duration;
                      if (Number.isFinite(dur)) setDuration(dur);
                    }}
                    onEnded={handleEnded}
                    playsInline
                    preload="metadata"
                />
            )}

            {!isEnrolled && !isLoadingEnrollment && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4 text-center">
                <Lock className="h-12 w-12 mb-4" />
                <h2 className="text-xl font-bold">Enroll to watch this video</h2>
                <p className="text-muted-foreground mb-4">
                  Gain access to this lesson and the full course by enrolling.
                </p>
                <Button onClick={() => router.push(`/courses`)}>Explore Courses</Button>
              </div>
            )}

            <div
            className={cn(
                "video-controls absolute bottom-0 left-0 right-0 p-2 md:p-4 bg-gradient-to-t from-black/50 to-transparent transition-opacity",
                showControls ? "opacity-100" : "opacity-0"
            )}
            >
            <Slider
                value={[progress]}
                onValueChange={(value) => {
                    const newTime = (value[0] / 100) * duration;
                    // Fast-forward prevention
                    if (newTime > farthestTimeWatchedRef.current) {
                        toast({ title: "Fast-forwarding is disabled", description: "You must watch the video to proceed.", duration: 2000 });
                        if (isYouTube || isGoogleDrive) reactPlayerRef.current?.seekTo(farthestTimeWatchedRef.current, 'seconds');
                        else if (playerRef.current) playerRef.current.currentTime = farthestTimeWatchedRef.current;
                        return;
                    }

                    if (isYouTube || isGoogleDrive) {
                        reactPlayerRef.current?.seekTo(newTime, 'seconds');
                    } else if (playerRef.current) {
                        playerRef.current.currentTime = newTime;
                    }
                    setProgress(value[0]);
                }}
                max={100}
                step={0.1}
                className="w-full"
            />
            <div className="flex items-center justify-between text-sm text-white mt-2">
                <div className="flex items-center gap-1 md:gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlayPause}
                    className="text-white hover:text-white hover:bg-white/20"
                >
                    {isPlaying ? <Pause /> : <Play />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:text-white hover:bg-white/20"
                    disabled={videoIndex === 0}
                >
                    <Link
                    href={
                        videoIndex > 0
                        ? `/courses/${course.id}/video/${courseVideos[videoIndex - 1].id}`
                        : "#"
                    }
                    >
                    <SkipBack />
                    </Link>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:text-white hover:bg-white/20"
                    disabled={videoIndex === courseVideos.length - 1}
                >
                    <Link
                    href={
                        videoIndex < courseVideos.length - 1
                        ? `/courses/${course.id}/video/${courseVideos[videoIndex + 1].id}`
                        : "#"
                    }
                    >
                    <SkipForward />
                    </Link>
                </Button>
                <div className="hidden md:flex items-center gap-2">
                    <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="text-white hover:text-white hover:bg-white/20"
                    >
                    {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                    </Button>
                    <Slider
                    value={[isMuted ? 0 : volume]}
                    onValueChange={(v) => handleVolumeChange(v as number[])}
                    max={1}
                    step={0.05}
                    className="w-24"
                    />
                </div>
                </div>
                <div className="flex items-center text-xs">
                {new Date(currentTime * 1000).toISOString().substr(14, 5)} /{" "}
                {new Date((duration || 0) * 1000).toISOString().substr(14, 5)}
                </div>
                <div className="flex items-center justify-center gap-1 md:gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsLooping(!isLooping)}
                    className={cn(
                    "text-white hover:text-white hover:bg-white/20",
                    isLooping && "bg-white/20"
                    )}
                >
                    <Repeat />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsAutoNextEnabled(!isAutoNextEnabled)}
                    className="text-white hover:text-white hover:bg-white/20"
                >
                    {isAutoNextEnabled ? <ToggleRight /> : <ToggleLeft />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => (playerRef.current as any)?.requestPictureInPicture?.().catch(() => {})}
                    className="text-white hover:text-white hover:bg-white/20 hidden md:flex"
                >
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

        <div className="flex flex-col flex-1 lg:h-screen">
          <ScrollArea className="flex-1 p-4 md:p-6 lg:p-8 lg:pb-0">
            <div className={cn(isMobile && "pb-20")}>
              <h1 className="text-2xl md:text-3xl font-bold font-headline">
                {currentVideo.title}
              </h1>

              {isCompleted && (
                 <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div>
                      <h3 className="font-bold text-green-800 dark:text-green-300">
                        Congratulations! You've completed the course.
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-400">
                        You can now view and download your certificate.
                      </p>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                      >
                        <Award className="mr-2 h-4 w-4" />
                        View Certificate
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Certificate of Completion</DialogTitle>
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
                    <AvatarFallback>{getInitials(speaker?.name || "GTH")}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {speaker?.name || "Glory Training Hub"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {course.enrollmentCount || 0} Learners
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={handleLike} variant="outline" size="sm" disabled={!user}>
                    <Heart
                      className={cn(
                        "mr-2 h-4 w-4",
                        isLiked && "fill-destructive text-destructive"
                      )}
                    />
                    {likeCount}
                  </Button>
                  <Button onClick={handleShare} variant="outline" size="sm">
                    <Share2 className="mr-2 h-4 w-4" />
                    {shareCount}
                  </Button>
                  {canDownload && (
                    <a
                      href={currentVideo.url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              <div className="lg:hidden mt-6">
                <PlaylistAndResources
                  course={course}
                  courseVideos={courseVideos}
                  currentVideo={currentVideo}
                  watchedVideos={watchedVideos}
                  relatedCourses={relatedCourses}
                  onRelatedChange={refresh}
                  quizzes={quizzes}
                  quizResults={quizResults}
                />
              </div>

              <CommentSection videoId={currentVideo.id} />
            </div>
          </ScrollArea>
          {!isMobile && <CommentForm videoId={currentVideo.id} />}
        </div>
      </div>

      <div className="w-full lg:w-[420px] lg:flex-shrink-0 lg:border-l flex-col lg:h-screen lg:sticky lg:top-0 bg-background hidden lg:flex">
        <ScrollArea className="flex-1">
          <PlaylistAndResources
            course={course}
            courseVideos={courseVideos}
            currentVideo={currentVideo}
            watchedVideos={watchedVideos}
            relatedCourses={relatedCourses}
            onRelatedChange={refresh}
            quizzes={quizzes}
            quizResults={quizResults}
          />
        </ScrollArea>
      </div>

      {isMobile && <CommentForm videoId={currentVideo.id} />}
    </div>
  );
}
