
import { getFirebaseFirestore } from "@/lib/firebase";
import { Course, Video, Enrollment, Speaker, Ladder } from "@/lib/types";
import { doc, getDoc, collection, getDocs, query, where, documentId, Timestamp, orderBy } from "firebase/firestore";
import { notFound, redirect } from "next/navigation";
import VideoPlayer from "@/components/video-player";
import { getFirebaseAuth } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";


// Disable caching for this page to ensure fresh data
export const revalidate = 0;
export const dynamic = 'force-dynamic';

type VideoPageProps = {
  params: {
    courseId: string;
    videoId: string;
  };
};

// Helper to convert Firestore Timestamps to a serializable format
const convertTimestamps = (data: any) => {
  if (data && typeof data === 'object') {
    for (const key in data) {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate().toISOString();
      } else if (typeof data[key] === 'object') {
        convertTimestamps(data[key]);
      }
    }
  }
  return data;
}

async function getCourseAndVideos(courseId: string, user: FirebaseUser | null) {
    const db = getFirebaseFirestore();
    const courseRef = doc(db, 'courses', courseId);
    const courseSnap = await getDoc(courseRef);

    if (!courseSnap.exists() || courseSnap.data()?.status !== 'published') {
        return { course: null, videos: [], speaker: null };
    }

    const courseData = courseSnap.data() as Course;
    const serializableCourse = convertTimestamps({ id: courseSnap.id, ...courseData });

    const course = serializableCourse as Course;
    
    let speaker: Speaker | null = null;
    if (course.speakerId) {
        const speakerRef = doc(db, 'speakers', course.speakerId);
        const speakerSnap = await getDoc(speakerRef);
        if (speakerSnap.exists()) {
            speaker = convertTimestamps({ id: speakerSnap.id, ...speakerSnap.data() }) as Speaker;
        }
    }
    
    if (!course.videos || course.videos.length === 0) {
        return { course, videos: [], speaker };
    }

    const videosQuery = query(
        collection(db, 'Contents'), 
        where(documentId(), 'in', course.videos),
        where('status', '==', 'published') // Only fetch published videos
    );
    const videosSnapshot = await getDocs(videosQuery);
    
    const videos = videosSnapshot.docs.map(doc => {
        const videoData = doc.data();
        return convertTimestamps({ id: doc.id, ...videoData }) as Video;
    });

    // Preserve the order from the course.videos array
    const orderedVideos = course.videos
        .map(id => videos.find(v => v.id === id))
        .filter(Boolean) as Video[];

    return { course, videos: orderedVideos, speaker };
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { courseId, videoId } = await params;
  
  // This part is a placeholder for getting the current user on the server.
  // In a real app with proper auth, you'd get this from the session or token.
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  const { course, videos, speaker } = await getCourseAndVideos(courseId, user);

  if (!course) {
    notFound();
  }
  
  const currentVideo = videos.find((v) => v.id === videoId);

  if (!currentVideo) {
    notFound();
  }

  const videoIndex = videos.findIndex((v) => v.id === currentVideo.id);

  // The `isEnrolled` prop is now removed. The VideoPlayer will determine this on the client.
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
