
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
  getDoc,
  doc,
  collectionGroup,
} from "firebase/firestore";
import type {
  Course,
  Enrollment,
  UserProgress as UserProgressType,
  Ladder,
  Video,
  UserQuizResult,
} from "../lib/types";
import { useI18n } from "./use-i18n";
import allLanguages from "@/lib/languages.json";

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
  const { currentLanguage } = useI18n();
  const [processedCourses, setProcessedCourses] = useState<CourseWithStatus[]>([]);
  const [allLadders, setAllLadders] = useState<Ladder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndProcessCourses = useCallback(async () => {
    if (processedCourses.length === 0) setLoading(true);
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
      
      const coursesSnapshot = await getDocs(coursesQuery);
      
      const coursesList: Course[] = coursesSnapshot.docs.map((doc) => {
        const raw = { id: doc.id, ...doc.data() } as Course;
        const ladderIds = getLadderIds(raw);
        return { ...raw, ladderIds };
      });

      const sortedCourses = [...coursesList].sort(
        (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)
      );

      const targetLangName = user?.language || allLanguages.find(l => l.code === currentLanguage)?.name;
      const coursesInLanguage = sortedCourses.filter(c => !targetLangName || c.language === targetLangName);

      if (!user) {
        setProcessedCourses(
          coursesInLanguage.map((c) => ({
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
      
      const enrollmentsQuery = query(collection(db, "enrollments"), where("userId", "==", user.uid));
      const progressQuery = query(collection(db, "userVideoProgress"), where("userId", "==", user.uid));
      const quizResultsQuery = query(collection(db, 'userQuizResults'), where('userId', '==', user.uid), where('passed', '==', true));
      const formSubmissionsQuery = query(collectionGroup(db, 'submissions'), where('userId', '==', user.uid));
      const globalProgressQuery = getDoc(doc(db, "userContentProgress", user.uid));

      const [enrollmentsSnapshot, progressSnapshot, quizResultsSnapshot, globalProgressSnapshot, formSubmissionsSnapshot] = await Promise.all([
        getDocs(enrollmentsQuery),
        getDocs(progressQuery),
        getDocs(quizResultsQuery),
        globalProgressQuery,
        getDocs(formSubmissionsQuery),
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
      
      const globalCompletedItems = new Set<string>(
          globalProgressSnapshot.exists() ? Object.keys(globalProgressSnapshot.data()?.completedItems || {}) : []
      );

      // Add extra robustness by also checking the actual sub-collections in case global log is out of sync
      quizResultsSnapshot.docs.forEach(doc => {
          globalCompletedItems.add(doc.data().quizId);
      });
      formSubmissionsSnapshot.docs.forEach(doc => {
          globalCompletedItems.add(doc.data().formId);
      });
      progressSnapshot.docs.forEach(doc => {
          doc.data().videoProgress?.forEach((vp: any) => { if (vp.completed) globalCompletedItems.add(vp.videoId); });
      });

      const completedCourseIds = new Set<string>();

      for (const course of coursesInLanguage) {
        if (!course.id) continue;
        
        // Primary Check: Course is explicitly marked as complete in the global log
        if (globalCompletedItems.has(course.id)) {
            completedCourseIds.add(course.id);
            continue;
        }

        // Secondary Check: Primitives (Videos, Quizzes, Forms)
        const requiredVideos = course.videos || [];
        const requiredQuizzes = course.quizIds || [];
        const requiredForm = course.formId;

        const allVideosDone = requiredVideos.every(id => globalCompletedItems.has(id));
        const allQuizzesDone = requiredQuizzes.every(id => globalCompletedItems.has(id));
        const formDone = !requiredForm || globalCompletedItems.has(requiredForm);

        const hasRequirements = requiredVideos.length > 0 || requiredQuizzes.length > 0 || !!requiredForm;

        if (allVideosDone && allQuizzesDone && formDone && hasRequirements) {
            completedCourseIds.add(course.id);
        } else {
            // Also check formal enrollment completion timestamp
            const enroll = enrollmentData.get(course.id);
            if (enroll?.completedAt) completedCourseIds.add(course.id);
        }
      }

      const userLadder = laddersList.find((l) => l.id === (user as any)?.classLadderId) ?? null;
      const userLadderOrder = userLadder?.order ?? 0;

      const coursesWithStatus: CourseWithStatus[] = coursesInLanguage.map((course) => {
        const enrollment = enrollmentData.get(course.id!);
        const progressData = progressMap.get(course.id!);
        
        const totalVideos = course.videos?.length || 0;
        const completedVideosCount = (course.videos || []).filter(id => globalCompletedItems.has(id)).length;
        
        let isLocked = false;
        let prerequisiteCourse: CourseWithStatus['prerequisiteCourse'] | undefined;
        
        const courseLadderObjs = (course.ladderIds || []).map(id => laddersList.find(l => l.id === id)).filter(Boolean) as Ladder[];
        const courseMinLadderOrder = courseLadderObjs.length > 0 
            ? Math.min(...courseLadderObjs.map(l => l.order))
            : Infinity;

        if (courseMinLadderOrder > userLadderOrder) {
          isLocked = true;
        }
        
        if (!isLocked && course.order !== undefined && course.order > 0) {
            const trackCourses = coursesInLanguage.filter(c => 
                c.id !== course.id &&
                c.ladderIds?.some(lId => course.ladderIds.includes(lId)) &&
                (c.order ?? 0) < course.order!
            );
            
            const unfinishedTrackCourses = trackCourses.filter(c => !completedCourseIds.has(c.id));
            
            if (unfinishedTrackCourses.length > 0) {
                isLocked = true;
                const immediatePrereq = unfinishedTrackCourses.sort((a,b) => (b.order ?? 0) - (a.order ?? 0))[0];
                prerequisiteCourse = { id: immediatePrereq.id, title: immediatePrereq.title };
            }
        }

        return {
          ...course,
          isEnrolled: !!enrollment,
          isCompleted: completedCourseIds.has(course.id!),
          isLocked,
          prerequisiteCourse,
          totalProgress: totalVideos > 0 ? Math.round((completedVideosCount / totalVideos) * 100) : 0,
          lastWatchedVideoId: progressData?.lastWatchedVideoId,
          completedAt: (enrollment?.completedAt as Timestamp | undefined)?.toDate().toISOString(),
        };
      });
      setProcessedCourses(coursesWithStatus);
    } catch (error) {
      console.error("Error fetching and processing courses:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, currentLanguage, db, processedCourses.length]);

  useEffect(() => {
      fetchAndProcessCourses();
  }, [fetchAndProcessCourses]);

  const refresh = () => {
    fetchAndProcessCourses();
  };

  return { processedCourses, allLadders, loading, refresh };
}
