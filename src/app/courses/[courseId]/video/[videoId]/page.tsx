
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

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }

    (async () => {
      setBusy(true);
      const cRef = doc(db, "courses", courseId);
      const cSnap = await getDoc(cRef);
      if (!cSnap.exists() || cSnap.data()?.status !== "published") { router.replace("/courses"); return; }

      const eSnap = await getDoc(doc(db, "enrollments", `${user.uid}_${courseId}`));
      if (!eSnap.exists()) { router.replace("/dashboard"); return; }

      const c = { id: cSnap.id, ...cSnap.data() } as Course;
      setCourse(c);

      if (c.speakerId) {
        const sSnap = await getDoc(doc(db, "speakers", c.speakerId));
        if (sSnap.exists()) setSpeaker({ id: sSnap.id, ...sSnap.data() } as Speaker);
      }

      const ids = (c.videos || []) as string[];
      if (ids.length) {
        const q = query(collection(db, "Contents"), where(documentId(), "in", ids), where("status", "==", "published"));
        const qs = await getDocs(q);
        const list = qs.docs.map(d => ({ id: d.id, ...d.data() } as Video));
        const ordered = ids.map(id => list.find(v => v.id === id)).filter(Boolean) as Video[];
        setVideos(ordered);
      }

      setBusy(false);
    })();
  }, [loading, user, db, courseId, videoId, router]); // Added videoId to re-fetch if it changes

  const currentVideo = useMemo(() => videos.find(v => v.id === videoId) || null, [videos, videoId]);
  const videoIndex = useMemo(() => currentVideo ? videos.findIndex(v => v.id === currentVideo.id) : -1, [videos, currentVideo]);

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
