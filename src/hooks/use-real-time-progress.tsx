
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Course, VideoProgress } from '../lib/types';

const useRealTimeProgress = (userId: string, courseId: string) => {
  const [progress, setProgress] = useState<VideoProgress[] | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    if (!userId || !courseId) return;
    const progressRef = doc(db, 'userVideoProgress', `${userId}_${courseId}`);

    const unsubscribe = onSnapshot(progressRef, (doc) => {
      if (doc.exists()) {
        setProgress(doc.data()?.videoProgress || []);
      }
    });

    return () => unsubscribe();
  }, [userId, courseId]);

  useEffect(() => {
    if (!courseId) return;
    const courseRef = doc(db, 'courses', courseId);
    const unsubscribe = onSnapshot(courseRef, (doc) => {
      if (doc.exists()) {
        setCourse({ id: doc.id, ...doc.data() } as Course);
      }
    });
    return () => unsubscribe();
  }, [courseId]);

  useEffect(() => {
    if (progress && course && course.videos) {
      const totalVideos = course.videos.length;
      if(totalVideos === 0) {
        setPercentage(0);
        return;
      }
      const completedVideos = progress.filter(p => p.completed).length;
      setPercentage(Math.round((completedVideos / totalVideos) * 100));
    }
  }, [progress, course]);

  return { progress, percentage };
};

export default useRealTimeProgress;
