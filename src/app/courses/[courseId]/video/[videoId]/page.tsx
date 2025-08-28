"use client";

import { getFirebaseFirestore } from "@/lib/firebase";
import { Course, Video, Speaker } from "@/lib/types";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  documentId,
  Timestamp,
} from "firebase/firestore";
import { notFound } from "next/navigation";
import VideoPlayer from "@/components/video-player";
import { getFirebaseAuth } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";

// Disable caching for this page to ensure fresh data
export const revalidate = 0;
export const dynamic = "force-dynamic";

type VideoPageProps = {
  params: {
    courseId: string;
    videoId: string;
  };
};

// Helper to convert Firestore Timestamps to a serializable format
const convertTimestamps = (data: any) => {
  if (data && typeof data === "object") {
    for (const key in data) {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate().toISOString();
      } else if (typeof data[key] === "object" && data[key] !== null) {
        convertTimestamps(data[key]);
      }
    }
  }
  return data;
};

async function getCourseAndVideos(courseId: string, _user: FirebaseUser | null) {
  const db = getFirebaseFirestore();
  const courseRef = doc(db, "courses", courseId);
  const courseSnap = await getDoc(courseRef);

  if (!courseSnap.exists() || courseSnap.data()?.status !== "published") {
    return { course: null, videos: [], speaker: null as Speaker | null };
  }

  const courseData = courseSnap.data() as Course;
  const course = convertTimestamps({ id: courseSnap.id, ...courseData }) as Course;

  // Speaker (optional)
  let speaker: Speaker | null = null;
  if (course.speakerId) {
    const speakerRef = doc(db, "speakers", course.speakerId);
    const speakerSnap = await getDoc(speakerRef);
    if (speakerSnap.exists()) {
      speaker = convertTimestamps({ id: speakerSnap.id, ...speakerSnap.data() }) as Speaker;
    }
  }

  // No videos?
  if (!course.videos || course.videos.length === 0) {
    return { course, videos: [], speaker };
  }

  // Firestore 'in' queries max 10 IDs — chunk to be safe.
  const ids = course.videos as string[];
  const chunkSize = 10;
  const allDocs: Video[] = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const videosQuery = query(
      collection(db, "Contents"),
      where(documentId(), "in", slice),
      where("status", "==", "published")
    );
    const videosSnapshot = await getDocs(videosQuery);
    const videos = videosSnapshot.docs.map((d) =>
      convertTimestamps({ id: d.id, ...d.data() })
    ) as Video[];
    allDocs.push(...videos);
  }

  // Preserve original order from course.videos
  const orderedVideos = ids
    .map((id) => allDocs.find((v) => v.id === id))
    .filter(Boolean) as Video[];

  return { course, videos: orderedVideos, speaker };
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { courseId, videoId } = await params;

  // Server-side "best effort" auth read; actual gating happens client-side.
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  const { course, videos, speaker } = await getCourseAndVideos(courseId, user);
  if (!course) notFound();

  const currentVideo = videos.find((v) => v.id === videoId);
  if (!currentVideo) notFound();

  const videoIndex = videos.findIndex((v) => v.id === currentVideo.id);

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
