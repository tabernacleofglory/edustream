
// src/hooks/useProcessedCourses.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  documentId,
} from "firebase/firestore";
import type {
  Course,
  Enrollment,
  UserProgress as UserProgressType,
  Ladder,
  Video,
  UserQuizResult,
} from "../lib/types";

/** Normalize schema differences (some docs use `ladders`, others `ladderIds`) */
function getLadderIds(c: Partial<Course> & Record<string, any>): string[] {
  const a = Array.isArray(c.ladderIds) ? (c.ladderIds as string[]) : [];
  const b = Array.isArray((c as any).ladders) ? ((c as any).ladders as string[]) : [];
  return a.length ? a : b;
}

/** The processed course we expose everywhere (extends your base Course) */
export type CourseWithStatus = Course & {
  isEnrolled?: boolean;
  isCompleted?: boolean;
  completedAt?: string;
  totalProgress?: number;
  lastWatchedVideoId?: string;
  isLocked?: boolean;
  prerequisiteCourse?: { id: string; title: string } | undefined;
};

export function useProcessedCourses(forAllCoursesPage: boolean = false) {
  const { user } = useAuth();
  const [processedCourses, setProcessedCourses] = useState<CourseWithStatus[]>([]);
  const [allLadders, setAllLadders] = useState<Ladder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndProcessCourses = useCallback(async () => {
    setLoading(true);
    try {
      /** LADDERS */
      const laddersQuery = query(collection(db, "courseLevels"), orderBy("order"));
      const laddersSnapshot = await getDocs(laddersQuery);
      const laddersList = laddersSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Ladder)
      );
      setAllLadders(laddersList);

      /** PUBLISHED COURSES */
      let coursesQuery = query(
        collection(db, "courses"),
        where("status", "==", "published")
      );
      
      // If a user is logged in, filter by their language. Otherwise, default to English for guests.
      const languageToFilter = user?.language || 'English';
      coursesQuery = query(coursesQuery, where("language", "==", languageToFilter));
      
      const coursesSnapshot = await getDocs(coursesQuery);

      const coursesList: Course[] = coursesSnapshot.docs.map((doc) => {
        const raw = { id: doc.id, ...doc.data() } as Course;
        const ladderIds = getLadderIds(raw);
        return { ...raw, ladderIds };
      });

      const sortedCourses = [...coursesList].sort(
        (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)
      );

      if (!user) {
        // For guest users, just show the courses without any progress or lock status.
        setProcessedCourses(
          sortedCourses.map((c) => ({
            ...c,
            isEnrolled: false,
            isCompleted: false,
            isLocked: false,
            totalProgress: 0,
          }))
        );
        setLoading(false);
        return;
      }
      
      // Fetch all necessary user data in parallel
      const enrollmentsQuery = query(collection(db, "enrollments"), where("userId", "==", user.uid));
      const progressQuery = query(collection(db, "userVideoProgress"), where("userId", "==", user.uid));
      const quizResultsQuery = query(collection(db, 'userQuizResults'), where('userId', '==', user.uid));

      const [enrollmentsSnapshot, progressSnapshot, quizResultsSnapshot] = await Promise.all([
        getDocs(enrollmentsQuery),
        getDocs(progressQuery),
        getDocs(quizResultsQuery),
      ]);

      const enrollmentData = new Map<string, Enrollment>(
        enrollmentsSnapshot.docs.map((doc) => {
          const data = doc.data() as Enrollment;
          return [data.courseId, data];
        })
      );
      
      const progressMap = new Map<string, UserProgressType>(
        progressSnapshot.docs.map((doc) => [
          (doc.data() as UserProgressType).courseId,
          doc.data() as UserProgressType,
        ])
      );
      
      const passedQuizzesByCourse = new Map<string, Set<string>>();
      quizResultsSnapshot.docs.forEach(doc => {
          const result = doc.data() as UserQuizResult;
          if (result.passed) {
              if (!passedQuizzesByCourse.has(result.courseId)) {
                passedQuizzesByCourse.set(result.courseId, new Set());
              }
              passedQuizzesByCourse.get(result.courseId)!.add(result.quizId);
          }
      });
      
      const completedCourseIds = new Set<string>();
      const coursesInProgress = new Set<string>();

      for (const course of sortedCourses) {
        if (!course.id) continue;
        const progress = progressMap.get(course.id);
        const videosInCourse = course.videos || [];
        const quizzesInCourse = course.quizIds || [];
        
        const completedVideosCount = progress?.videoProgress?.filter(p => p.completed).length || 0;
        const allVideosCompleted = videosInCourse.length > 0 ? completedVideosCount >= videosInCourse.length : true;
        
        const passedQuizzesSet = passedQuizzesByCourse.get(course.id) || new Set();
        const allQuizzesCompleted = quizzesInCourse.length > 0 ? quizzesInCourse.every(qid => passedQuizzesSet.has(qid)) : true;

        if (allVideosCompleted && allQuizzesCompleted) {
          completedCourseIds.add(course.id);
        } else if (enrollmentData.has(course.id)) {
          coursesInProgress.add(course.id);
        }
      }

      const userLadder = laddersList.find((l) => l.id === (user as any)?.classLadderId) ?? null;
      const userLadderOrder = userLadder?.order ?? 0;

      const coursesWithStatus: CourseWithStatus[] = sortedCourses.map((course) => {
        const enrollment = enrollmentData.get(course.id!);
        const progress = progressMap.get(course.id!);
        
        const totalVideos = course.videos?.length || 0;
        const completedVideosCount = progress?.videoProgress?.filter(v => v.completed).length || 0;
        
        let isLocked = false;
        let prerequisiteCourse: CourseWithStatus['prerequisiteCourse'] | undefined;
        
        const courseMinLadderOrder = Math.min(...(course.ladderIds || []).map(id => laddersList.find(l => l.id === id)?.order ?? Infinity));

        if (userLadder && course.ladderIds) {
          if (courseMinLadderOrder > userLadderOrder) {
            isLocked = true;
          }
        }
        
        // Find prerequisite if any
        if (!isLocked && course.order !== undefined && course.order > 0 && userLadderOrder <= courseMinLadderOrder) {
            const prereq = sortedCourses.find(c => 
                c.ladderIds?.some(lId => course.ladderIds.includes(lId)) && // Must be in the same ladder
                c.order === course.order - 1
            );
            
            // Only enforce prerequisite lock if user is in the same or lower ladder
            if (prereq && !completedCourseIds.has(prereq.id)) {
                isLocked = true;
                prerequisiteCourse = { id: prereq.id, title: prereq.title };
            }
        }

        return {
          ...course,
          isEnrolled: !!enrollment,
          isCompleted: completedCourseIds.has(course.id!),
          isLocked,
          prerequisiteCourse,
          totalProgress: totalVideos > 0 ? Math.round((completedVideosCount / totalVideos) * 100) : 0,
          lastWatchedVideoId: progress?.lastWatchedVideoId,
          completedAt: (enrollment?.completedAt as Timestamp | undefined)?.toDate().toISOString(),
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
  }, [fetchAndProcessCourses, user]);

  const refresh = () => {
    fetchAndProcessCourses();
  };

  return { processedCourses, allLadders, loading, refresh };
}
