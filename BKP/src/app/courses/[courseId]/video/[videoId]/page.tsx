
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
    if (!user) {
      router.replace("/login");
      return;
    }

    const fetchVideoData = async () => {
      setBusy(true);
      try {
        // ----- Course (public read) -----
        const courseRef = doc(db, "courses", courseId);
        const courseSnap = await getDoc(courseRef);

        if (!courseSnap.exists() || courseSnap.data()?.status !== "published") {
          router.replace("/courses");
          return;
        }

        // ----- Enrollment (owner-only read) -----
        const enrollmentSnap = await getDoc(doc(db, "enrollments", `${user.uid}_${courseId}`));
        if (!enrollmentSnap.exists()) {
          // not enrolled -> bounce to dashboard
          router.replace("/dashboard");
          return;
        }

        const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
        setCourse(courseData);

        // ----- Speaker (public read) -----
        if (courseData.speakerId) {
          const speakerSnap = await getDoc(doc(db, "speakers", courseData.speakerId));
          if (speakerSnap.exists()) {
            setSpeaker({ id: speakerSnap.id, ...speakerSnap.data() } as Speaker);
          }
        }

        // ----- Videos (published only) with chunking for >10 IDs -----
        const videoIds = (courseData.videos || []) as string[];
        if (videoIds.length === 0) {
          router.replace(`/courses/${courseId}`);
          return;
        }

        if (!videoIds.includes(videoId)) {
          router.replace(`/courses/${courseId}`);
          return;
        }

        const chunkSize = 30; // Firestore 'in' query limit
        const allVideoDocs: Video[] = [];
        for (let i = 0; i < videoIds.length; i += chunkSize) {
          const slice = videoIds.slice(i, i + chunkSize);
          const q = query(
            collection(db, "Contents"),
            where(documentId(), "in", slice)
          );
          const snap = await getDocs(q);
          allVideoDocs.push(
            ...snap.docs.map((d) => ({ id: d.id, ...d.data() } as Video))
          );
        }

        // Filter for published and keep original order
        const publishedIds = new Set(allVideoDocs.filter(v => v.status === 'published').map(v => v.id));
        const orderedVideos = videoIds
          .map((id) => allVideoDocs.find((v) => v.id === id))
          .filter((v): v is Video => !!v && publishedIds.has(v.id));


        if (orderedVideos.length === 0) {
          router.replace(`/courses/${courseId}`);
          return;
        }
        setVideos(orderedVideos);

        const foundVideo = orderedVideos.find((v) => v.id === videoId) || null;
        if (!foundVideo) {
          router.replace(`/courses/${courseId}`);
          return;
        }
        setCurrentVideo(foundVideo);
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
    return videos.findIndex((v) => v.id === currentVideo.id);
  }, [videos, currentVideo]);

  if (busy || loading || !course || !currentVideo || videoIndex < 0) {
    return (
      <div className="min-h-screen p-8">
        <Skeleton className="h-[60vh] max-w-5xl mx-auto" />
      </div>
    );
  }

  const VideoPlayer = require("@/components/video-player").default;

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
