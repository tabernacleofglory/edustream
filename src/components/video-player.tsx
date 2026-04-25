
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Hls from "hls.js";
import ReactPlayer from "react-player/lazy";
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
  MessageCircle,
} from "lucide-react";
import type {
  Course,
  Video,
  UserProgress as UserProgressType,
  VideoProgress,
  Speaker,
  Quiz,
  UserQuizResult,
  CustomForm,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Slider } from "@/components/ui/slider";
import { getFirebaseFirestore, getFirebaseApp } from "@/lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  runTransaction,
  writeBatch,
  setDoc,
  query,
  where,
  getDocs,
  documentId,
  collectionGroup,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CourseCard } from "@/components/course-card";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-is-mobile";
import CommentSection, { CommentForm } from "@/components/video/comment-section";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { Progress } from "./ui/progress";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const STILL_WATCHING_INTERVAL_SECONDS = 60 * 60; // 1 hour

const getInitials = (name?: string | null) => {
  if (!name) return "U";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

const formatTimeWithHours = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const sStr = secs < 10 ? `0${secs}` : `${secs}`;

  if (hours > 0) {
    const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${mStr}:${sStr}`;
  }

  return `${minutes}:${sStr}`;
};

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
  forms: CustomForm[];
  formSubmissions: any[];
  lastVideoCompleted: boolean;
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
  forms,
  formSubmissions = [],
  lastVideoCompleted,
}: PlaylistAndResourcesProps) => {
  return (
    <Accordion
      type="multiple"
      defaultValue={["playlist", "resources", "related", "quizzes", "forms"]}
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
            {quizzes.map((quiz, index) => {
              const prevQuizId = index > 0 ? quizzes[index - 1].id : null;
              const prevQuizPassed = prevQuizId
                ? watchedVideos.has(prevQuizId) || quizResults.some((r) => r.quizId === prevQuizId && r.passed)
                : true;

              const isQuizLocked = !lastVideoCompleted || !prevQuizPassed;

              const result = quizResults.find((r) => r.quizId === quiz.id);
              const isCompleted = watchedVideos.has(quiz.id) || (!!result && result.passed);

              return (
                <Link
                  key={quiz.id}
                  href={!isQuizLocked ? `/courses/${course.id}/quiz/${quiz.id}` : "#"}
                  onClick={(e) => isQuizLocked && e.preventDefault()}
                  className={cn(
                    "block p-3 rounded-md hover:bg-muted",
                    isQuizLocked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : isQuizLocked ? (
                      <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    ) : (
                      <FileQuestion className="h-5 w-5 text-muted-foreground mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold">{quiz.title}</p>
                        {result && (
                          <span className="text-xs font-bold text-primary">
                            {result.score.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {result && <Progress value={result.score} className="h-1 mt-1" />}
                    </div>
                  </div>
                </Link>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      )}

      {forms.length > 0 && (
        <AccordionItem value="forms">
          <AccordionTrigger className="px-4 font-semibold">Forms</AccordionTrigger>
          <AccordionContent className="px-4 space-y-2">
            {forms.map((form) => {
              const allQuizzesCompleted = (course.quizIds || []).every((qid) =>
                watchedVideos.has(qid) || quizResults.some((r) => r.quizId === qid && r.passed)
              );
              const isFormLocked = !lastVideoCompleted || !allQuizzesCompleted;
              const isSubmitted = watchedVideos.has(form.id) || formSubmissions.some(
                (s) => s.formId === form.id && s.courseId === course.id
              );

              return (
                <Link
                  key={form.id}
                  href={
                    !isFormLocked
                      ? `/courses/${course.id}/form/${form.id}?videoId=${currentVideo.id}`
                      : "#"
                  }
                  onClick={(e) => isFormLocked && e.preventDefault()}
                  className={cn(
                    "block p-3 rounded-md hover:bg-muted",
                    isFormLocked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {isSubmitted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : isFormLocked ? (
                      <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    )}
                    <p className="font-semibold">{form.title}</p>
                  </div>
                </Link>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      )}

      {(course["Resource Doc"]?.length > 0 || (course.attendanceLinks?.length ?? 0) > 0) && (
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
      )}

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
  const { user, refreshUser, hasPermission, isCurrentUserAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const reactPlayerRef = useRef<ReactPlayer | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gradientFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const farthestTimeWatchedRef = useRef<number>(0);
  const lastSavedRef = useRef<{ time: number; percent: number; atMs: number }>({
    time: 0,
    percent: 0,
    atMs: 0,
  });

  const db = getFirebaseFirestore();
  const isMobile = useIsMobile();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
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
  const [likeCount, setLikeCount] = useState(currentVideo?.likeCount || 0);
  const [shareCount, setShareCount] = useState(currentVideo?.shareCount || 0);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizResults, setQuizResults] = useState<UserQuizResult[]>([]);
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  const [isStillWatchingPromptVisible, setIsStillWatchingPromptVisible] =
    useState(false);
  const promptCheckpointsRef = useRef(new Set<number>());
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const { currentTrack } = useAudioPlayer();

  const isYouTube =
    currentVideo?.type === "youtube" ||
    (currentVideo?.url &&
      (currentVideo.url.includes("youtube.com") ||
        currentVideo.url.includes("youtu.be")));
  const isGoogleDrive = currentVideo?.type === "googledrive";

  const canDownload =
    hasPermission("downloadContent") && !isYouTube && !isGoogleDrive;
  const canRightClick = hasPermission("allowRightClick");

  const { processedCourses, refresh } =
    useProcessedCourses(true);

  const relatedCourses = useMemo(() => {
    return processedCourses.filter(
      (c) =>
        c.id !== course.id &&
        Array.isArray(c.ladderIds) &&
        Array.isArray(course.ladderIds) &&
        c.ladderIds.some((id) => course.ladderIds.includes(id))
    );
  }, [processedCourses, course.id, course.ladderIds]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!user) return;

    if (course.quizIds && course.quizIds.length > 0) {
      const q = query(
        collection(db, "quizzes"),
        where(documentId(), "in", course.quizIds)
      );
      getDocs(q).then((snapshot) => {
        const fetchedQuizzes = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Quiz
        );
        setQuizzes(
          fetchedQuizzes.sort(
            (a, b) => (a.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
          )
        );
      });

      const resultsQuery = query(
        collection(db, "userQuizResults"),
        where("userId", "==", user.uid),
        where("courseId", "==", course.id),
        where("quizId", "in", course.quizIds)
      );
      getDocs(resultsQuery).then((resultsSnapshot) => {
        setQuizResults(
          resultsSnapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as UserQuizResult
          )
        );
      });
    }

    if (course.formId) {
      getDoc(doc(db, "forms", course.formId)).then((formSnap) => {
        if (formSnap.exists()) {
          setForms([{ id: formSnap.id, ...formSnap.data() } as CustomForm]);
          const submissionQuery = query(
            collection(db, "forms", course.formId!, "submissions"),
            where("userId", "==", user.uid),
            where("courseId", "==", course.id)
          );
          getDocs(submissionQuery).then((submissionSnapshot) => {
            setFormSubmissions(submissionSnapshot.docs.map((d) => d.data()));
          });
        }
      });
    }
  }, [course.quizIds, course.formId, course.id, user?.uid, db]);

  useEffect(() => {
    if (!user?.uid) {
      setIsLoadingEnrollment(false);
      return;
    }

    setIsLoadingEnrollment(true);
    promptCheckpointsRef.current.clear();
    setShowEndOverlay(false);
    setCurrentTime(0);
    setProgress(0);
    setIsReady(false);
    setIsPlaying(false);

    const enrollmentRef = doc(db, "enrollments", `${user.uid}_${course.id}`);
    const unsubscribeEnrollment = onSnapshot(enrollmentRef, (d) => {
      const enrolled = d.exists();
      setIsEnrolled(enrolled);
      setIsCompleted(!!d.data()?.completedAt);
      setIsLoadingEnrollment(false);
    });

    const progressRef = doc(db, "userVideoProgress", `${user.uid}_${course.id}`);
    const quizResultsQuery = query(collection(db, 'userQuizResults'), where('userId', '==', user.uid), where('passed', '==', true));
    const globalProgressRef = doc(db, "userContentProgress", user.uid);
    const formSubmissionsQuery = query(collectionGroup(db, 'submissions'), where('userId', '==', user.uid));

    const unsubscribeProgress = onSnapshot(progressRef, (progressSnap) => {
      onSnapshot(globalProgressRef, (globalSnap) => {
          onSnapshot(quizResultsQuery, (quizSnap) => {
              onSnapshot(formSubmissionsQuery, (formSnap) => {
                  const completedIds = new Set<string>(
                    globalSnap.exists() ? Object.keys(globalSnap.data().completedItems || {}) : []
                  );
                  
                  // Sync with actual granular records
                  quizSnap.docs.forEach(d => completedIds.add(d.data().quizId));
                  formSnap.docs.forEach(d => completedIds.add(d.data().formId));
                  if (progressSnap.exists()) {
                      (progressSnap.data() as UserProgressType).videoProgress?.forEach(vp => {
                          if (vp.completed) completedIds.add(vp.videoId);
                      });
                  }

                  setWatchedVideos(completedIds);
              });
          });
      });
    });

    return () => {
      unsubscribeEnrollment();
      unsubscribeProgress();
    };
  }, [user?.uid, course.id, db, currentVideo.id]);

  const handleReady = useCallback(async () => {
    setIsReady(true);
    if (!user?.uid || !isEnrolled) return;

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
          reactPlayerRef.current.seekTo(resumeTime, "seconds");
        } else if (playerRef.current) {
          playerRef.current.currentTime = resumeTime;
        }
      }
    }
  }, [user?.uid, isEnrolled, db, course.id, currentVideo.id, isYouTube, isGoogleDrive]);

  const saveProgressToFirestore = useCallback(
    async (time: number, completed: boolean, immediate = false) => {
      if (!user?.uid || !isEnrolled) return;

      const currentDuration =
        isYouTube || isGoogleDrive
          ? reactPlayerRef.current?.getDuration() ?? 0
          : playerRef.current?.duration ?? 0;

      if (currentDuration === 0) return;

      const farthest = Math.max(time, farthestTimeWatchedRef.current || 0);
      const percent = Math.min(100, (farthest / currentDuration) * 100);

      const now = Date.now();
      const sinceLastMs = now - lastSavedRef.current.atMs;
      const timeDelta = Math.abs(farthest - lastSavedRef.current.time);
      const percentDelta = Math.abs(percent - lastSavedRef.current.percent);

      const shouldWrite =
        immediate || completed || timeDelta >= 5 || percentDelta >= 2 || sinceLastMs >= 15000;

      if (!shouldWrite) return;

      const progressRef = doc(db, "userVideoProgress", `${user.uid}_${course.id}`);
      const enrollmentRef = doc(db, "enrollments", `${user.uid}_${course.id}`);
      const globalProgressRef = doc(db, "userContentProgress", user.uid);

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
          totalProgress: Math.round(percent),
        };

        batch.set(progressRef, dataToSave, { merge: true });

        if (completed) {
          batch.set(
            globalProgressRef,
            {
              completedItems: { [currentVideo.id]: serverTimestamp() },
            },
            { merge: true }
          );

          // Verify all components for formal course completion
          const publishedVideoIds: string[] = Array.isArray(course.videos) ? course.videos : [];
          const allVideosCompleted = publishedVideoIds.every((vid) =>
            completed || watchedVideos.has(vid) || currentProgress.some((p) => p.videoId === vid && p.completed)
          );
          const allQuizzesCompleted = (course.quizIds || []).every((quizId) =>
            watchedVideos.has(quizId) || quizResults.some((res) => res.quizId === quizId && res.passed)
          );
          const allFormsCompleted = (forms || []).every((form) =>
            watchedVideos.has(form.id) || formSubmissions.some((sub) => sub.formId === form.id)
          );

          if (allVideosCompleted && allQuizzesCompleted && allFormsCompleted) {
            batch.set(enrollmentRef, { completedAt: serverTimestamp() as any }, { merge: true });
            batch.set(globalProgressRef, { completedItems: { [course.id]: serverTimestamp() } }, { merge: true });
          }
        }

        await batch.commit();
        lastSavedRef.current = { time: farthest, percent, atMs: now };
      } catch (error) {
        console.error("Failed to save progress:", error);
      }
    },
    [
      user?.uid,
      isEnrolled,
      db,
      currentVideo.id,
      course.id,
      course.videos,
      course.quizIds,
      quizResults,
      forms,
      formSubmissions,
      isYouTube,
      isGoogleDrive,
      watchedVideos
    ]
  );

  const flushProgress = useCallback(() => {
    let t = 0;
    if (isYouTube || isGoogleDrive) {
      if (reactPlayerRef.current) t = reactPlayerRef.current.getCurrentTime();
    } else if (playerRef.current) {
      t = playerRef.current.currentTime;
    }
    const finalTime = Math.max(t || 0, farthestTimeWatchedRef.current || 0);
    return saveProgressToFirestore(finalTime, false, true);
  }, [saveProgressToFirestore, isYouTube, isGoogleDrive]);

  const handlePlayerProgress = useCallback(
    (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => {
      const t = state.playedSeconds || 0;
      if (t > farthestTimeWatchedRef.current) farthestTimeWatchedRef.current = t;
      setProgress(state.played * 100);
      setCurrentTime(t);
      if (user?.uid && isEnrolled) {
        saveProgressToFirestore(farthestTimeWatchedRef.current, false, false);
      }
    },
    [user?.uid, isEnrolled, saveProgressToFirestore]
  );

  const handlePlayerSeek = useCallback((seconds: number) => {
    //
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    saveProgressToFirestore(farthestTimeWatchedRef.current || duration, true, true);
    
    if (isAutoNextEnabled && videoIndex < courseVideos.length - 1) {
      router.push(`/courses/${course.id}/video/${courseVideos[videoIndex + 1].id}`);
    } else {
      setShowEndOverlay(true);
    }
  }, [saveProgressToFirestore, duration, isAutoNextEnabled, videoIndex, courseVideos, course.id, router]);

  const handleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const lastVideoId = courseVideos[courseVideos.length - 1]?.id;
  const lastVideoCompleted = watchedVideos.has(lastVideoId);

  return (
    <div
      className="flex flex-col lg:flex-row flex-1"
      onContextMenu={!canRightClick ? (e) => e.preventDefault() : undefined}
    >
      <div className={cn("flex-1 flex flex-col lg:h-screen", currentTrack && "pb-16 lg:pb-0")}>
        <div className="lg:px-8 lg:pt-8 flex-shrink-0">
          <div
            ref={videoContainerRef}
            className={cn(
              "relative aspect-video w-full overflow-hidden bg-slate-900",
              isFullScreen ? "rounded-none" : "lg:rounded-lg"
            )}
          >
            {isYouTube || isGoogleDrive ? (
              currentVideo?.url && (
                <div className="relative w-full h-full">
                  <ReactPlayer
                    ref={reactPlayerRef}
                    url={currentVideo.url}
                    playing={isReady && isPlaying}
                    controls={false}
                    loop={isLooping}
                    volume={volume}
                    muted={isMuted}
                    width="100%"
                    height="100%"
                    onReady={handleReady}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={handleEnded}
                    onProgress={handlePlayerProgress}
                    onDuration={setDuration}
                    onSeek={handlePlayerSeek}
                  />
                  <div className="absolute inset-0 z-10" onClick={togglePlayPause} />
                </div>
              )
            ) : (
              <video
                ref={playerRef}
                className="w-full h-full"
                onClick={togglePlayPause}
                onTimeUpdate={(e) => {
                  const target = e.target as HTMLVideoElement;
                  const t = target.currentTime || 0;
                  const d = Number.isFinite(target.duration) ? target.duration : duration;
                  if (t > farthestTimeWatchedRef.current) farthestTimeWatchedRef.current = t;
                  const pct = d > 0 ? (t / d) * 100 : 0;
                  setProgress(pct);
                  setCurrentTime(t);
                  if (user?.uid && isEnrolled) saveProgressToFirestore(farthestTimeWatchedRef.current, false, false);
                }}
                onLoadedMetadata={(e) => {
                  const dur = (e.target as HTMLVideoElement).duration;
                  if (Number.isFinite(dur)) setDuration(dur);
                  setIsReady(true);
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
                <Button onClick={() => router.push(`/courses`)} className="mt-4">
                  Explore Courses
                </Button>
              </div>
            )}

            <div className={cn("video-controls absolute bottom-0 left-0 right-0 z-20 p-2 md:p-4 bg-gradient-to-t from-black via-black/70 to-transparent transition-opacity", showControls ? "opacity-100" : "opacity-0")}>
              <Slider
                value={[progress]}
                onValueChange={(value) => {
                  const newTime = (value[0] / 100) * duration;
                  if (newTime > farthestTimeWatchedRef.current) {
                    toast({ title: "Fast-forwarding is disabled", duration: 2000 });
                    return;
                  }
                  if (isYouTube || isGoogleDrive) reactPlayerRef.current?.seekTo(newTime, "seconds");
                  else if (playerRef.current) playerRef.current.currentTime = newTime;
                  setProgress(value[0]);
                }}
                max={100}
                step={0.1}
                className="w-full"
              />
              <div className="flex items-center justify-between text-sm text-white mt-2">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={togglePlayPause} className="text-white hover:bg-white/20">
                    {isPlaying ? <Pause /> : <Play />}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" disabled={videoIndex === 0}>
                    <Link href={videoIndex > 0 ? `/courses/${course.id}/video/${courseVideos[videoIndex - 1].id}` : "#"}><SkipBack /></Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" disabled={videoIndex >= courseVideos.length - 1 || !watchedVideos.has(currentVideo.id)}>
                    <Link href={videoIndex < courseVideos.length - 1 && watchedVideos.has(currentVideo.id) ? `/courses/${course.id}/video/${courseVideos[videoIndex + 1].id}` : "#"}><SkipForward /></Link>
                  </Button>
                </div>
                <div className="text-xs">{formatTimeWithHours(currentTime)} / {formatTimeWithHours(duration || 0)}</div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setIsAutoNextEnabled(!isAutoNextEnabled)} className="text-white hover:bg-white/20">
                    {isAutoNextEnabled ? <ToggleRight /> : <ToggleLeft />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleFullScreen} className="text-white hover:bg-white/20">
                    {isFullScreen ? <Minimize /> : <Maximize />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col flex-1">
          <ScrollArea className="flex-1 p-4 md:p-6 lg:p-8 lg:pb-0">
            <div className={cn(isMobile && "pb-20")}>
              <h1 className="text-2xl md:text-3xl font-bold font-headline">{currentVideo.title}</h1>
              {isCompleted && (
                <Alert className="mt-4 bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Course Complete!</AlertTitle>
                    <AlertDescription className="text-green-700">
                        You have finished all requirements.
                        <Button asChild variant="link" className="h-auto p-0 ml-2 text-green-800 font-bold"><Link href={`/certificate/${course.id}`}>View Certificate</Link></Button>
                    </AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-2 mt-4">
                <Avatar><AvatarImage src={speaker?.photoURL || undefined} /><AvatarFallback>{getInitials(speaker?.name || "GTH")}</AvatarFallback></Avatar>
                <div>
                  <p className="font-semibold">{speaker?.name || "Glory Training Hub"}</p>
                  <p className="text-sm text-muted-foreground">{Math.max(0, course.enrollmentCount || 0)} Learners</p>
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
                  forms={forms}
                  formSubmissions={formSubmissions}
                  lastVideoCompleted={lastVideoCompleted}
                />
              </div>
              <div className="mt-6"><CommentSection videoId={currentVideo.id} /></div>
            </div>
          </ScrollArea>
          <CommentForm videoId={currentVideo.id} />
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
            forms={forms}
            formSubmissions={formSubmissions}
            lastVideoCompleted={lastVideoCompleted}
          />
        </ScrollArea>
      </div>
    </div>
  );
}
