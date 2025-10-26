
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Hls from "hls.js";
import ReactPlayer from 'react-player/lazy';
import {
  Play, Pause, SkipBack, SkipForward, Maximize, Minimize, Volume2, VolumeX, Repeat, ToggleLeft, ToggleRight, MessageCircle, FileText, Link as LinkIcon
} from "lucide-react";
import type { Course, Video, Speaker, Quiz, UserQuizResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import CommentSection, { CommentForm } from "./video/comment-section";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { TeachingCard } from "./teaching-card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface UnrestrictedVideoPlayerProps {
  course: Course;
  courseVideos: Video[];
  currentVideo: Video;
  videoIndex: number;
  speaker: Speaker | null;
}

const getInitials = (name?: string | null) => {
  if (!name) return "U";
  return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase();
};

const PlaylistAndResources = ({
  course,
  courseVideos,
  currentVideo,
}: {
  course: Course;
  courseVideos: Video[];
  currentVideo: Video;
}) => {
  const { processedCourses, refresh } = useProcessedCourses();

  const relatedCourses = processedCourses.filter(
    (c) =>
      c.id !== course.id &&
      Array.isArray(c.ladderIds) &&
      c.ladderIds.some((id) => course.ladderIds.includes(id))
  );

  return (
    <Accordion
      type="multiple"
      defaultValue={["playlist", "resources", "related"]}
      className="w-full"
    >
      <AccordionItem value="playlist">
        <AccordionTrigger className="px-4 font-semibold">
          {course.title}
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-1">
            {courseVideos.map((video, index) => (
              <Link
                key={video.id}
                href={`/admin/courses/player?courseId=${course.id}&videoId=${video.id}`}
                className={cn(
                  "flex items-center gap-3 p-3 text-sm transition-colors",
                  video.id === currentVideo.id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted"
                )}
              >
                <Play className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1">{video.title}</span>
                <span className="text-xs text-muted-foreground">
                  {video.duration ? `${Math.round(video.duration / 60)} min` : ""}
                </span>
              </Link>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
      
      { (course["Resource Doc"]?.length > 0 || course.attendanceLinks?.length > 0) && (
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
                <TeachingCard course={rc} />
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
};

export default function UnrestrictedVideoPlayer({
  course,
  courseVideos,
  currentVideo,
  videoIndex,
  speaker,
}: UnrestrictedVideoPlayerProps) {
  const router = useRouter();
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const reactPlayerRef = useRef<ReactPlayer | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gradientFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showGradientOverlay, setShowGradientOverlay] = useState(true);
  const [isLooping, setIsLooping] = useState(false);
  const [isAutoNextEnabled, setIsAutoNextEnabled] = useState(true);

  const isMobile = useIsMobile();
  const isYouTube = currentVideo?.type === 'youtube' || (currentVideo?.url && (currentVideo.url.includes('youtube.com') || currentVideo.url.includes('youtu.be')));
  const isGoogleDrive = currentVideo?.type === 'googledrive';

  const togglePlayPause = () => setIsPlaying(prev => !prev);
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };
  const toggleMute = () => setIsMuted(prev => !prev);

  useEffect(() => {
    const videoElement = playerRef.current;
    if (isYouTube || isGoogleDrive || !videoElement || !currentVideo?.url) return;

    let hls: Hls | null = null;
    if (Hls.isSupported() && currentVideo.url.includes('.m3u8')) {
      hls = new Hls();
      hls.loadSource(currentVideo.url);
      hls.attachMedia(videoElement);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoElement.play().catch(console.error));
    } else {
      videoElement.src = currentVideo.url;
      videoElement.play().catch(console.error);
    }
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    return () => {
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      if (hls) hls.destroy();
    };
  }, [currentVideo.id, currentVideo.url, isYouTube, isGoogleDrive]);
  
  useEffect(() => {
      const v = isYouTube || isGoogleDrive ? reactPlayerRef.current?.getInternalPlayer() : playerRef.current;
      if (!v) return;
      if ('volume' in v) v.volume = volume;
      if ('muted' in v) v.muted = isMuted;
  }, [volume, isMuted, isYouTube, isGoogleDrive]);

  const nextVideo = courseVideos[videoIndex + 1];

  const handleEnded = () => {
    if (isLooping) {
        if(isYouTube || isGoogleDrive) reactPlayerRef.current?.seekTo(0);
        else if(playerRef.current) playerRef.current.currentTime = 0;
        return;
    }
    if (isAutoNextEnabled && nextVideo) {
      router.push(`/admin/courses/player?courseId=${course.id}&videoId=${nextVideo.id}`);
    } else {
      setIsPlaying(false);
    }
  };

  const handleFullScreen = () => {
    const container = videoContainerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) container.requestFullscreen().catch(console.error);
    else document.exitFullscreen();
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
        if (isPlaying) setShowControls(false);
      }, 3000);
    };
    container.addEventListener("mousemove", handleInteraction);
    container.addEventListener("click", handleInteraction);
    return () => {
      container.removeEventListener("mousemove", handleInteraction);
      container.removeEventListener("click", handleInteraction);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);
  
  useEffect(() => {
    if (gradientFadeTimeoutRef.current) clearTimeout(gradientFadeTimeoutRef.current);
    if (isPlaying) {
        gradientFadeTimeoutRef.current = setTimeout(() => setShowGradientOverlay(false), 5000);
    } else {
        setShowGradientOverlay(true);
    }
    return () => { if (gradientFadeTimeoutRef.current) clearTimeout(gradientFadeTimeoutRef.current); };
  }, [isPlaying]);

  return (
    <div className="flex flex-col lg:flex-row flex-1">
      <div className="flex-1 flex flex-col lg:h-screen">
        <div className="lg:px-8 lg:pt-8 flex-shrink-0">
          <div ref={videoContainerRef} className={cn("relative aspect-video w-full overflow-hidden bg-slate-900", isFullScreen ? "rounded-none" : "lg:rounded-lg")}>
          {(isYouTube || isGoogleDrive) ? (
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
                  onProgress={state => { setProgress(state.played * 100); setCurrentTime(state.playedSeconds); }}
                  onDuration={setDuration}
              />
          ) : (
              <video
                  ref={playerRef}
                  className="w-full h-full"
                  onClick={togglePlayPause}
                  onTimeUpdate={(e) => {
                    const target = e.target as HTMLVideoElement;
                    const t = target.currentTime || 0;
                    const d = target.duration || duration;
                    if (d > 0) setProgress((t / d) * 100);
                    setCurrentTime(t);
                  }}
                  onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration)}
                  onEnded={handleEnded}
                  playsInline
                  preload="metadata"
              />
          )}

          <div
            className={cn("video-controls absolute bottom-0 left-0 right-0 p-2 md:p-4 bg-gradient-to-t from-black from-10% via-black/70 to-transparent transition-opacity", showControls ? "opacity-100" : "opacity-0")}
          >
            <Slider
              value={[progress]}
              onValueChange={(value) => {
                const newTime = (value[0] / 100) * duration;
                if (isYouTube || isGoogleDrive) reactPlayerRef.current?.seekTo(newTime, 'seconds');
                else if (playerRef.current) playerRef.current.currentTime = newTime;
                setProgress(value[0]);
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
                        <Link href={videoIndex > 0 ? `/admin/courses/player?courseId=${course.id}&videoId=${courseVideos[videoIndex - 1].id}`: "#"}>
                            <SkipBack />
                        </Link>
                    </Button>
                     <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/20" disabled={videoIndex >= courseVideos.length - 1}>
                        <Link href={videoIndex < courseVideos.length - 1 ? `/admin/courses/player?courseId=${course.id}&videoId=${courseVideos[videoIndex + 1].id}`: "#"}>
                            <SkipForward />
                        </Link>
                    </Button>
                    <div className="hidden md:flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:text-white hover:bg-white/20">
                            {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                        </Button>
                        <Slider value={[isMuted ? 0 : volume]} onValueChange={(v) => handleVolumeChange(v as number[])} max={1} step={0.05} className="w-24" />
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
                <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={speaker?.photoURL || undefined} />
                      <AvatarFallback>{getInitials(speaker?.name || "GTH")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{speaker?.name || "Glory Training Hub"}</p>
                      <p className="text-sm text-muted-foreground">{course.enrollmentCount || 0} Learners</p>
                    </div>
                  </div>
              </div>
              <div className="lg:hidden mt-6">
                <PlaylistAndResources course={course} courseVideos={courseVideos} currentVideo={currentVideo} />
              </div>
              <CommentSection videoId={currentVideo.id} />
             </div>
          </ScrollArea>
           <CommentForm videoId={currentVideo.id} />
        </div>
      </div>
      <div className="w-full lg:w-[420px] lg:flex-shrink-0 lg:border-l flex-col lg:h-screen lg:sticky lg:top-0 bg-background hidden lg:flex">
        <ScrollArea className="flex-1">
          <PlaylistAndResources course={course} courseVideos={courseVideos} currentVideo={currentVideo} />
        </ScrollArea>
      </div>
    </div>
  );
}
