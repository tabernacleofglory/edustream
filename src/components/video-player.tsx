"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Hls from "hls.js";
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
  Printer,
  Minimize,
  Share2,
  Heart,
  Volume2,
  VolumeX,
  Download,
  PictureInPicture,
} from "lucide-react";
import type {
  Course,
  Video,
  UserProgress as UserProgressType,
  VideoProgress,
  Speaker,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Slider } from "@/components/ui/slider";
import { getFirebaseFirestore, getFirebaseApp } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  runTransaction,
  getDocs,
  where,
  writeBatch,
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
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import CommentSection, { CommentForm } from "./video/comment-section";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";

interface VideoPlayerProps {
  course: Course;
  courseVideos: Video[];
  currentVideo: Video;
  videoIndex: number;
  speaker: Speaker | null;
}

function getLadderIds(c: Partial<Course> & { [k: string]: any }): string[] {
  const a = Array.isArray(c.ladderIds) ? (c.ladderIds as string[]) : [];
  const b = Array.isArray((c as any).ladders) ? ((c as any).ladders as string[]) : [];
  return a.length ? a : b;
}

const PlaylistAndResources = ({
  course,
  courseVideos,
  currentVideo,
  watchedVideos,
  relatedCourses,
  onRelatedChange,
}: {
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
}) => {
  return (
    <Accordion type="multiple" defaultValue={["playlist", "resources", "related"]} className="w-full">
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

      <AccordionItem value="resources">
        <AccordionTrigger className="px-4 font-semibold">Resources</AccordionTrigger>
        <AccordionContent className="px-4 space-y-2">
          {course["Resource Doc"]?.map((url, index) => {
            const fileName = url.split("/").pop()?.split("?")[0].split("%2F").pop() || "Resource";
            return (
              <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                <FileText className="h-5 w-5" />
                <span>{decodeURIComponent(fileName)}</span>
              </a>
            );
          })}
          {course.attendanceLinks?.map((link, index) => (
            <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
              <LinkIcon className="h-5 w-5" />
              <span>{link.title}</span>
            </a>
          ))}
        </AccordionContent>
      </AccordionItem>

      {relatedCourses.length > 0 && (
        <AccordionItem value="related">
          <AccordionTrigger className="px-4 font-semibold">Related Courses</AccordionTrigger>
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

export default function VideoPlayer({
  course,
  courseVideos,
  currentVideo,
  videoIndex,
  speaker,
}: VideoPlayerProps) {
  const { user, refreshUser, hasPermission } = useAuth();
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

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
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

  const canDownload = hasPermission("downloadContent");
  const canRightClick = hasPermission("allowRightClick");

  // Single source of truth for lock/prereq/in-progress (used by Related Courses)
  const { processedCourses, refresh } = useProcessedCourses(true);

  const relatedCourses = useMemo(() => {
    if (!processedCourses?.length) return [];
    const currentLids = getLadderIds(course);
    return processedCourses.filter((c) => {
      const lids = getLadderIds(c);
      return c.id !== course.id && lids.some((id) => currentLids.includes(id));
    });
  }, [processedCourses, course]);

  const togglePlayPause = useCallback(() => {
    const video = playerRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video.play().catch(() => {});
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

    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);

    const startPlayback = async () => {
      try {
        await videoElement.play();
      } catch {
        setIsPlaying(false);
      }
    };
    startPlayback();

    return () => {
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
    };
  }, [isEnrolled, currentVideo.id]);

  useEffect(() => {
    const videoElement = playerRef.current;
    if (!videoElement) return;
    videoElement.volume = volume;
    videoElement.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    const videoElement = playerRef.current;
    if (!videoElement) return;

    const videoUrl = currentVideo.url;
    if (videoUrl) {
      if (Hls.isSupported() && videoUrl.includes(".m3u8")) {
        const hls = new Hls();
        hls.loadSource(videoUrl);
        hls.attachMedia(videoElement);
        return () => hls.destroy();
      } else {
        videoElement.src = videoUrl;
      }
    }

    if (currentVideo.duration) setDuration(currentVideo.duration);

    const fetchLastPosition = async () => {
      if (!user || !isEnrolled) return;
      const progressRef = doc(db, "userVideoProgress", `${user.uid}_${course.id}`);
      const progressSnap = await getDoc(progressRef);
      if (progressSnap.exists()) {
        const videoProgress = (progressSnap.data() as UserProgressType).videoProgress?.find(
          (vp) => vp.videoId === currentVideo.id
        );
        if (videoProgress && videoProgress.timeSpent && videoElement) {
          videoElement.currentTime = videoProgress.timeSpent;
          farthestTimeWatchedRef.current = videoProgress.timeSpent;
        }
      }
    };
    fetchLastPosition();
  }, [currentVideo.id, currentVideo.url, isEnrolled, user, course.id, db]);

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

  const saveProgressToFirestore = useCallback(
    async (time: number, completed: boolean) => {
      if (!user || !isEnrolled) return;
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

      debounceTimeoutRef.current = setTimeout(async () => {
        const batch = writeBatch(db);

        const enrollmentsQuery = query(collection(db, "enrollments"), where("userId", "==", user.uid));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        const enrolledCourseIds = enrollmentsSnapshot.docs.map((doc) => doc.data().courseId);

        const coursesWithVideoQuery = query(
          collection(db, "courses"),
          where("videos", "array-contains", currentVideo.id),
          where("status", "==", "published")
        );
        const coursesWithVideoSnapshot = await getDocs(coursesWithVideoQuery);

        for (const courseDoc of coursesWithVideoSnapshot.docs) {
          const courseIdToUpdate = courseDoc.id;
          if (!enrolledCourseIds.includes(courseIdToUpdate)) continue;

          const docId = `${user.uid}_${courseIdToUpdate}`;
          const progressRef = doc(db, "userVideoProgress", docId);
          const progressDoc = await getDoc(progressRef);

          let currentProgress: VideoProgress[] = [];
          if (progressDoc.exists()) {
            currentProgress = (progressDoc.data() as UserProgressType).videoProgress || [];
          }

          const idx = currentProgress.findIndex((vp) => vp.videoId === currentVideo.id);
          let needsUpdate = false;

          if (idx > -1) {
            if (time > (currentProgress[idx].timeSpent || 0)) {
              currentProgress[idx].timeSpent = time;
              needsUpdate = true;
            }
            if (completed && !currentProgress[idx].completed) {
              currentProgress[idx].completed = true;
              needsUpdate = true;
            }
          } else {
            currentProgress.push({ videoId: currentVideo.id, timeSpent: time, completed });
            needsUpdate = true;
          }

          if (needsUpdate) {
            batch.set(
              progressRef,
              {
                userId: user.uid,
                courseId: courseIdToUpdate,
                videoProgress: currentProgress,
                lastWatchedVideoId: currentVideo.id,
              },
              { merge: true }
            );
          }
        }

        try {
          await batch.commit();
        } catch (error) {
          console.error("Failed to save progress to Firestore:", error);
          toast({ variant: "destructive", title: "We couldn't save your progress. Please try again." });
        }
      }, 1000);
    },
    [user, isEnrolled, db, currentVideo.id, toast]
  );

  useEffect(() => {
    if (!user) {
      setIsLoadingEnrollment(false);
      return;
    }
    setIsLoadingEnrollment(true);

    const enrollmentRef = doc(db, "enrollments", `${user.uid}_${course.id}`);
    const unsubscribeEnrollment = onSnapshot(enrollmentRef, (doc) => {
      const enrolled = doc.exists();
      setIsEnrolled(enrolled);
      setIsCompleted(!!doc.data()?.completedAt);
      setIsLoadingEnrollment(false);
    });

    const progressRef = doc(db, "userVideoProgress", `${user.uid}_${course.id}`);
    const unsubscribeProgress = onSnapshot(progressRef, (doc) => {
      if (doc.exists()) {
        const progressData = doc.data() as UserProgressType;
        const completedIds = (progressData.videoProgress || []).filter((vp) => vp.completed).map((vp) => vp.videoId);
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

  const nextVideo = courseVideos[videoIndex + 1];

  const handleEnded = async () => {
    if (isLooping) return;
    setIsPlaying(false);
    setProgress(100);

    if (user && playerRef.current) {
      await saveProgressToFirestore(playerRef.current.duration, true);
      refreshUser();
      refresh(); // refresh processedCourses so related cards reflect new state
    }

    if (nextVideo) {
      router.push(`/courses/${course.id}/video/${nextVideo.id}`);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    const currentlyMuted = isMuted || volume === 0;
    if (currentlyMuted) {
      const newVolume = volume > 0 ? volume : 0.5;
      setVolume(newVolume);
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
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
      } catch {
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
      playerContainer.requestFullscreen().catch(() => {});
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
        if (playerRef.current && !playerRef.current.paused) setShowControls(false);
      }, 3000);
    };
    container.addEventListener("mousemove", handleInteraction);
    container.addEventListener("click", handleInteraction);
    return () => {
      container.removeEventListener("mousemove", handleInteraction);
      container.removeEventListener("click", handleInteraction);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const handleDownloadCertificate = async () => {
    const el = certificateRef.current;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: null });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${user?.displayName}-${course.title}-certificate.pdf`);
    } catch {
      toast({ variant: "destructive", title: "Failed to download certificate." });
    }
  };

  const handleScreenshot = async () => {
    const el = certificateRef.current;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: null });
      const link = document.createElement("a");
      link.download = `${user?.displayName}-${course.title}-certificate.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast({ variant: "destructive", title: "Failed to generate screenshot." });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row flex-1" onContextMenu={!canRightClick ? (e) => e.preventDefault() : undefined}>
      <div className="flex-1 flex flex-col lg:h-screen">
        <div className="lg:px-8 lg:pt-8 flex-shrink-0">
          <div ref={videoContainerRef} className={cn("relative aspect-video w-full overflow-hidden bg-slate-900", isFullScreen ? "rounded-none" : "lg:rounded-lg")}>
            <video
              ref={playerRef}
              className="w-full h-full"
              onClick={togglePlayPause}
              onTimeUpdate={(e) => {
                const target = (e.target as HTMLVideoElement);
                if (target.currentTime > farthestTimeWatchedRef.current) {
                  farthestTimeWatchedRef.current = target.currentTime;
                }
                setProgress((target.currentTime / target.duration) * 100);
                setCurrentTime(target.currentTime);
                if (user && isEnrolled) {
                  saveProgressToFirestore(target.currentTime, false);
                }
              }}
              onLoadedData={(e) => setDuration((e.target as HTMLVideoElement).duration)}
              onEnded={handleEnded}
              loop={isLooping}
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
                    <Link href={videoIndex > 0 ? `/courses/${course.id}/video/${courseVideos[videoIndex - 1].id}` : "#"}>
                      <SkipBack />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/20" disabled={videoIndex === courseVideos.length - 1}>
                    <Link href={videoIndex < courseVideos.length - 1 ? `/courses/${course.id}/video/${courseVideos[videoIndex + 1].id}` : "#"}>
                      <SkipForward />
                    </Link>
                  </Button>
                  <div className="hidden md:flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setIsLooping((v) => !v)} className={cn("text-white hover:text-white hover:bg-white/20", isLooping && "bg-white/20")}>
                      <Repeat />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:text-white hover:bg-white/20">
                      {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                    </Button>
                    <Slider value={[isMuted ? 0 : volume]} onValueChange={(v) => setVolume(v[0])} max={1} step={0.05} className="w-24" />
                  </div>
                </div>
                <div className="flex items-center text-xs">
                  {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date(duration * 1000).toISOString().substr(14, 5)}
                </div>
                <div className="flex items-center justify-center gap-1 md:gap-2">
                  <Button variant="ghost" size="icon" onClick={() => playerRef.current?.requestPictureInPicture()} className="text-white hover:text-white hover:bg-white/20 hidden md:flex">
                    <PictureInPicture />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleFullScreen} className="text-white hover:text-white hover:bg-white/20">
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
              <h1 className="text-2xl md:text-3xl font-bold font-headline">{currentVideo.title}</h1>

              {isCompleted && (
                <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div>
                      <h3 className="font-bold text-green-800 dark:text-green-300">Congratulations! You've completed the course.</h3>
                      <p className="text-sm text-green-700 dark:text-green-400">You can now view and download your certificate.</p>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="default" className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0">
                        <Award className="mr-2 h-4 w-4" />
                        View Certificate
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Certificate of Completion</DialogTitle>
                      </DialogHeader>
                      <CertificatePrint userName={user?.displayName || "Valued Student"} course={course} />
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Avatar>
                    <AvatarImage src={speaker?.photoURL || undefined} />
                    <AvatarFallback>
                      {(() => {
                        const n = speaker?.name || "GTH";
                        return n.trim().split(/\s+/).map((s) => s[0]).join("").toUpperCase();
                      })()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{speaker?.name || "Glory Training Hub"}</p>
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
                  {canDownload && (
                    <a href={currentVideo.url} download target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </a>
                  )}
                  {/* Unenroll button intentionally removed */}
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
          />
        </ScrollArea>
      </div>

      {isMobile && <CommentForm videoId={currentVideo.id} />}
    </div>
  );
}
//End of Code