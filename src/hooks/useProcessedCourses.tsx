
// src/hooks/useProcessedCourses.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, documentId, orderBy, Timestamp } from 'firebase/firestore';
import type { Course, Enrollment, UserProgress as UserProgressType, Ladder, Video } from '../lib/types';

interface CourseWithStatus extends Course {
  isEnrolled?: boolean;
  isCompleted?: boolean;
  completedAt?: string;
  totalProgress?: number;
  lastWatchedVideoId?: string;
  isLocked?: boolean;
  prerequisiteCourse?: { id:string; title: string; };
}

export function useProcessedCourses(forAllCoursesPage: boolean = false) {
  const { user } = useAuth();
  const [processedCourses, setProcessedCourses] = useState<CourseWithStatus[]>([]);
  const [allLadders, setAllLadders] = useState<Ladder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndProcessCourses = useCallback(async () => {
    setLoading(true);
    try {
      const coursesQuery = query(collection(db, 'courses'), where('status', '==', 'published'));
      const laddersQuery = query(collection(db, "courseLevels"), orderBy("order"));
      
      const [coursesSnapshot, laddersSnapshot] = await Promise.all([
        getDocs(coursesQuery),
        getDocs(laddersQuery)
      ]);
      
      const coursesList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      const laddersList = laddersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder));
      
      setAllLadders(laddersList);

      if (!user) {
        setProcessedCourses(coursesList.map(c => ({ ...c, isEnrolled: false, isCompleted: false, isLocked: false, totalProgress: 0 })));
        setLoading(false);
        return;
      }

      const allVideoIds = coursesList.flatMap(course => course.videos || []);
      if (allVideoIds.length === 0) {
        setProcessedCourses(coursesList.map(c => ({ ...c, isEnrolled: false, isCompleted: false, isLocked: false, totalProgress: 0 })));
        setLoading(false);
        return;
      }
      
      const videoIdChunks: string[][] = [];
      for (let i = 0; i < allVideoIds.length; i += 30) {
          videoIdChunks.push(allVideoIds.slice(i, i + 30));
      }

      const videoPromises = videoIdChunks.map(chunk => 
          getDocs(query(collection(db, 'Contents'), where(documentId(), 'in', chunk), where('status', '==', 'published')))
      );
      const videoSnapshots = await Promise.all(videoPromises);
      const publishedVideosMap = new Map<string, Video>();
      videoSnapshots.flatMap(snapshot => snapshot.docs).forEach(doc => {
          publishedVideosMap.set(doc.id, { id: doc.id, ...doc.data() } as Video);
      });

      const enrollmentsQuery = query(collection(db, 'enrollments'), where('userId', '==', user.uid));
      const progressQuery = query(collection(db, 'userVideoProgress'), where('userId', '==', user.uid));

      const [enrollmentsSnapshot, progressSnapshot] = await Promise.all([
        getDocs(enrollmentsQuery),
        getDocs(progressQuery)
      ]);

      const enrollmentData = new Map(enrollmentsSnapshot.docs.map(doc => {
        const data = doc.data() as Enrollment;
        return [data.courseId, data];
      }));

      const progressMap = new Map<string, UserProgressType>(
        progressSnapshot.docs.map(doc => [doc.data().courseId, doc.data() as UserProgressType])
      );
      
      const completedCourseIds = new Set<string>();
      coursesList.forEach(course => {
        const progress = progressMap.get(course.id);
        const publishedVideoIdsForCourse = course.videos?.filter(vid => publishedVideosMap.has(vid)) || [];
        
        if (publishedVideoIdsForCourse.length === 0) {
          if (enrollmentData.has(course.id) && enrollmentData.get(course.id)?.completedAt) {
            completedCourseIds.add(course.id);
          }
          return;
        }

        const completedVideosCount = progress?.videoProgress?.filter(v => v.completed && publishedVideoIdsForCourse.includes(v.videoId)).length || 0;
        
        if (completedVideosCount === publishedVideoIdsForCourse.length) {
          completedCourseIds.add(course.id);
        }
      });

      const sortedCourses = [...coursesList].sort((a, b) => {
        const orderA = a.order ?? Infinity;
        const orderB = b.order ?? Infinity;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      });

      const coursesWithStatus: CourseWithStatus[] = sortedCourses.map(course => {
        const enrollment = enrollmentData.get(course.id);
        const progress = progressMap.get(course.id);
        const publishedVideoIdsForCourse = course.videos?.filter(vid => publishedVideosMap.has(vid)) || [];
        const totalVideos = publishedVideoIdsForCourse.length;
        
        const completedVideosCount = progress?.videoProgress?.filter(v => v.completed && publishedVideoIdsForCourse.includes(v.videoId)).length || 0;
        
        const isCompleted = completedCourseIds.has(course.id);
        
        return {
          ...course,
          isEnrolled: !!enrollment,
          isCompleted,
          isLocked: false, 
          totalProgress: totalVideos > 0 ? Math.round((completedVideosCount / totalVideos) * 100) : 0,
          lastWatchedVideoId: progress?.lastWatchedVideoId || publishedVideoIdsForCourse[0],
          completedAt: (enrollment?.completedAt as Timestamp)?.toDate().toISOString(),
        };
      });
      
      setProcessedCourses(coursesWithStatus);
    } catch (error) {
      console.error("Error fetching and processing courses:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAndProcessCourses();
  }, [fetchAndProcessCourses]);
  
  const refresh = () => {
    fetchAndProcessCourses();
  }

  return { processedCourses, allLadders, loading, refresh };
}
