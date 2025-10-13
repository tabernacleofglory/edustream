"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where, documentId } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { Course, Speaker, Video } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import VideoPlayer from "@/components/video-player";
import { Skeleton } from "@/components/ui/skeleton";

export default function VideoPage() {
  const { courseId, videoId } = useParams<{ courseId: string; videoId: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const db = getFirebaseFirestore();

  const [course, setCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [speaker, setSpeaker] = useState<Speaker | null>(null);
  const [busy, setBusy] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }

    const fetchVideoData = async () => {
      setBusy(true);
      try {
        const courseRef = doc(db, "courses", courseId);
        const courseSnap = await getDoc(courseRef);

        if (!courseSnap.exists() || courseSnap.data()?.status !== "published") {
          router.replace("/courses");
          return;
        }

        const enrollmentSnap = await getDoc(doc(db, "enrollments", `${user.uid}_${courseId}`));
        if (!enrollmentSnap.exists()) {
          router.replace("/dashboard");
          return;
        }

        const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
        setCourse(courseData);

        if (courseData.speakerId) {
          const speakerSnap = await getDoc(doc(db, "speakers", courseData.speakerId));
          if (speakerSnap.exists()) {
            setSpeaker({ id: speakerSnap.id, ...speakerSnap.data() } as Speaker);
          }
        }

        const videoIds = (courseData.videos || []) as string[];
        if (videoIds.length > 0) {
          if (!videoIds.includes(videoId)) {
            router.replace(`/courses/${courseId}`);
            return;
          }
          
          const q = query(collection(db, "Contents"), where(documentId(), "in", videoIds), where("status", "==", "published"));
          const videosSnap = await getDocs(q);
          const videosData = videosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Video));
          
          const orderedVideos = videoIds.map(id => videosData.find(v => v.id === id)).filter(Boolean) as Video[];
          setVideos(orderedVideos);

          const foundVideo = orderedVideos.find(v => v.id === videoId);
          if (foundVideo) {
            setCurrentVideo(foundVideo);
          } else {
            // If the videoId in URL is not in the fetched list, redirect
            router.replace(`/courses/${courseId}`);
          }
        } else {
            // No videos in course, redirect
            router.replace(`/courses/${courseId}`);
        }

      } catch (error) {
        console.error("Error fetching video page data:", error);
        router.replace("/courses");
      } finally {
        setBusy(false);
      }
    };
    
    fetchVideoData();
  }, [loading, user, db, courseId, videoId, router]);

  const videoIndex = useMemo(() => {
    if (!currentVideo || videos.length === 0) return -1;
    return videos.findIndex(v => v.id === currentVideo.id);
  }, [videos, currentVideo]);

  // Render a skeleton while any data is loading or if data is inconsistent
  if (busy || loading || !course || !currentVideo || videoIndex < 0) {
    return <div className="min-h-screen p-8"><Skeleton className="h-[60vh] max-w-5xl mx-auto" /></div>;
  }
  
  return (
    <VideoPlayer
      course={course}
      courseVideos={videos}
      currentVideo={currentVideo}
      videoIndex={videoIndex}
      speaker={speaker}
    />
  );
}
