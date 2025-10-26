
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { Course, Speaker, Video } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import UnrestrictedVideoPlayer from "@/components/unrestricted-video-player";

function UnrestrictedPlayerPage() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');
  const videoId = searchParams.get('videoId');

  const { hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const db = getFirebaseFirestore();

  const [course, setCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [speaker, setSpeaker] = useState<Speaker | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!hasPermission('viewCourseManagement')) {
      router.replace("/admin/analytics");
      return;
    }
    if (!courseId || !videoId) {
      router.replace("/admin/courses/teaching");
      return;
    }

    const fetchUnrestrictedData = async () => {
      setBusy(true);
      try {
        const courseSnap = await getDoc(doc(db, "courses", courseId));
        if (!courseSnap.exists()) {
          router.replace("/admin/courses/teaching");
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
        if (videoIds.length === 0) {
            setVideos([]);
            setBusy(false);
            return;
        }
        
        const videoChunks: string[][] = [];
        for (let i = 0; i < videoIds.length; i += 30) {
            videoChunks.push(videoIds.slice(i, i + 30));
        }

        const videoPromises = videoChunks.map(chunk => getDocs(query(collection(db, 'Contents'), where(documentId(), 'in', chunk))));
        const videoSnapshots = await Promise.all(videoPromises);
        const allVideoDocs = videoSnapshots.flatMap(s => s.docs);

        const videoMap = new Map(allVideoDocs.map(d => [d.id, { id: d.id, ...d.data() } as Video]));
        const orderedVideos = videoIds.map(id => videoMap.get(id)).filter(Boolean) as Video[];
        
        setVideos(orderedVideos);

      } catch (error) {
        console.error("Error fetching unrestricted video data:", error);
        router.replace("/admin/courses/teaching");
      } finally {
        setBusy(false);
      }
    };

    fetchUnrestrictedData();
  }, [authLoading, hasPermission, courseId, videoId, router, db]);

  if (busy || authLoading) {
    return (
      <div className="min-h-screen p-8">
        <Skeleton className="h-[60vh] max-w-5xl mx-auto" />
      </div>
    );
  }

  const currentVideo = videos.find((v) => v.id === videoId);
  const videoIndex = currentVideo ? videos.findIndex((v) => v.id === videoId) : -1;

  if (!course || !currentVideo || videoIndex < 0) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <p>Could not load video data.</p>
        </div>
    );
  }

  return (
    <UnrestrictedVideoPlayer
      course={course}
      courseVideos={videos}
      currentVideo={currentVideo}
      videoIndex={videoIndex}
      speaker={speaker}
    />
  );
}


export default function UnrestrictedPlayerPageWrapper() {
    return (
        <Suspense fallback={<div>Loading Player...</div>}>
            <UnrestrictedPlayerPage />
        </Suspense>
    )
}
