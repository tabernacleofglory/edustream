
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
      const laddersQuery = query(collection(db, "courseLevels"), orderBy("order"));
      const laddersSnapshot = await getDocs(laddersQuery);
      const laddersList = laddersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder));
      setAllLadders(laddersList);

      const videosQuery = query(collection(db, 'Contents'), where('status', '==', 'published'), where('Type', '==', 'video'));
      const videosSnapshot = await getDocs(videosQuery);
      const allPublishedVideosMap = new Map(videosSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Video]));
      
      // Always fetch all published courses for logged-in users.
      const coursesQuery = query(collection(db, 'courses'), where('status', '==', 'published'));
      const coursesSnapshot = await getDocs(coursesQuery);
      const coursesList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      
      let coursesToProcess = coursesList;

      if (!user) {
        setProcessedCourses(coursesList.map(c => ({ ...c, isEnrolled: false, isCompleted: false, isLocked: false, totalProgress: 0 })));
        setLoading(false);
        return;
      }
      
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
      const coursesInProgress = new Set<string>();
      
      coursesToProcess.forEach(course => {
        const enrollment = enrollmentData.get(course.id);
        const progress = progressMap.get(course.id);
        const publishedVideoIdsForCourse = course.videos?.filter(vid => allPublishedVideosMap.has(vid)) || [];
        
        if (publishedVideoIdsForCourse.length === 0) {
          if (enrollment?.completedAt) {
            completedCourseIds.add(course.id);
          }
          return;
        }

        const completedVideosCount = progress?.videoProgress?.filter(v => v.completed && publishedVideoIdsForCourse.includes(v.videoId)).length || 0;
        
        if (completedVideosCount === publishedVideoIdsForCourse.length) {
          completedCourseIds.add(course.id);
        } else if (enrollment) {
          coursesInProgress.add(course.id);
        }
      });
      
      const sortedCourses = [...coursesToProcess].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
      
      const userLadder = laddersList.find(l => l.id === user.classLadderId);
      const userLadderOrder = userLadder ? userLadder.order : -1;
      const lowestLadderOrder = laddersList.length > 0 ? laddersList[0].order : 0;
      const isLowestLadder = userLadderOrder === lowestLadderOrder;
      
      const coursesWithStatus: CourseWithStatus[] = sortedCourses.map(course => {
        const enrollment = enrollmentData.get(course.id);
        const progress = progressMap.get(course.id);
        const publishedVideoIdsForCourse = course.videos?.filter(vid => allPublishedVideosMap.has(vid)) || [];
        const totalVideos = publishedVideoIdsForCourse.length;
        
        const completedVideosCount = progress?.videoProgress?.filter(v => v.completed && publishedVideoIdsForCourse.includes(v.videoId)).length || 0;
        const isCompleted = completedCourseIds.has(course.id);

        let isLocked = false;
        let prerequisiteCourse = undefined;
        
        // Rule: Lock courses in ladders above the user's current ladder.
        const courseLadders = (course.ladderIds || [])
          .map(id => laddersList.find(l => l.id === id))
          .filter(Boolean) as Ladder[];
        
        if (courseLadders.length > 0) {
          const highestCourseLadderOrder = Math.max(...courseLadders.map(l => l.order));
          if (highestCourseLadderOrder > userLadderOrder) {
            isLocked = true;
          }
        }
        
        // Rule: Sequential unlocking within a ladder.
        if (!isLocked && course.order !== undefined && course.order > 0) {
            const prereqOrder = course.order - 1;
            // Find a course in the same ladder with the preceding order number
            const prereq = sortedCourses.find(c =>
                c.order === prereqOrder &&
                c.ladderIds?.some(id => course.ladderIds?.includes(id))
            );

            if (prereq && !completedCourseIds.has(prereq.id)) {
                isLocked = true;
                prerequisiteCourse = { id: prereq.id, title: prereq.title };
            }
        }
        
        // Rule: Lowest ladder users can only enroll in one course at a time.
        if (isLowestLadder && coursesInProgress.size > 0 && !coursesInProgress.has(course.id) && !isCompleted) {
            isLocked = true;
        }

        return {
          ...course,
          isEnrolled: !!enrollment,
          isCompleted,
          isLocked,
          prerequisiteCourse,
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
