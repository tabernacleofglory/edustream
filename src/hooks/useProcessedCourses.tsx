
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
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type {
  Course,
  Enrollment,
  UserProgress as UserProgressType,
  Ladder,
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

  /** ---------- READ + DERIVE ---------- */
  const fetchAndProcessCourses = useCallback(async () => {
    setLoading(true);
    try {
      /** LADDERS */
      const laddersQuery = query(collection(db, "courseLevels"), orderBy("order"));
      const laddersSnapshot = await getDocs(laddersQuery);
      const laddersList = laddersSnapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Ladder)
      );
      setAllLadders(laddersList);

      /** PUBLISHED COURSES (language-filtered) */
      let coursesQuery = query(collection(db, "courses"), where("status", "==", "published"));

      // If a user is logged in, filter by their language. Otherwise, default to English for guests.
      const languageToFilter = user?.language || "English";
      coursesQuery = query(coursesQuery, where("language", "==", languageToFilter));

      const coursesSnapshot = await getDocs(coursesQuery);
      const coursesList: Course[] = coursesSnapshot.docs.map((docSnap) => {
        const raw = { id: docSnap.id, ...docSnap.data() } as Course;
        const ladderIds = getLadderIds(raw);
        return { ...raw, ladderIds };
      });

      const sortedCourses = [...coursesList].sort(
        (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)
      );

      if (!user) {
        // Guests: no progress/locks
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

      // Fetch user-related collections in parallel
      const enrollmentsQuery = query(collection(db, "enrollments"), where("userId", "==", user.uid));
      const progressQuery = query(collection(db, "userVideoProgress"), where("userId", "==", user.uid));
      const quizResultsQuery = query(collection(db, "userQuizResults"), where("userId", "==", user.uid));

      const [enrollmentsSnapshot, progressSnapshot, quizResultsSnapshot] = await Promise.all([
        getDocs(enrollmentsQuery),
        getDocs(progressQuery),
        getDocs(quizResultsQuery),
      ]);

      const enrollmentData = new Map<string, Enrollment>(
        enrollmentsSnapshot.docs.map((d) => {
          const data = d.data() as Enrollment;
          return [data.courseId, data];
        })
      );

      const progressMap = new Map<string, UserProgressType>(
        progressSnapshot.docs.map((d) => [
          (d.data() as UserProgressType).courseId,
          d.data() as UserProgressType,
        ])
      );

      const passedQuizzesByCourse = new Map<string, Set<string>>();
      quizResultsSnapshot.docs.forEach((d) => {
        const result = d.data() as UserQuizResult;
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

        const completedVideosCount = progress?.videoProgress?.filter((p) => p.completed).length || 0;
        const allVideosCompleted =
          videosInCourse.length > 0 ? completedVideosCount >= videosInCourse.length : true;

        const passedQuizzesSet = passedQuizzesByCourse.get(course.id) || new Set();
        const allQuizzesCompleted =
          quizzesInCourse.length > 0 ? quizzesInCourse.every((qid) => passedQuizzesSet.has(qid)) : true;

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
        const completedVideosCount = progress?.videoProgress?.filter((v) => v.completed).length || 0;

        let isLocked = false;
        let prerequisiteCourse: CourseWithStatus["prerequisiteCourse"] | undefined;

        const courseMinLadderOrder = Math.min(
          ...(course.ladderIds || []).map((id) => laddersList.find((l) => l.id === id)?.order ?? Infinity)
        );

        if (userLadder) {
          // Rule 1: Lock if the course's ladder is strictly higher than the user's ladder.
          if (courseMinLadderOrder > userLadderOrder) {
            isLocked = true;
          }
          
          // Rule 2: If the course's ladder is the same as the user's, check prerequisites.
          // This rule does NOT apply if the user's ladder is higher than the course's ladder.
          if (courseMinLadderOrder === userLadderOrder) {
             // Prerequisite: previous order in same ladder(s) AND SAME LANGUAGE
            if (course.order !== undefined && course.order > 0) {
              const prereq = sortedCourses.find(
                (c) =>
                  c.language === course.language && // MUST BE SAME LANGUAGE
                  c.ladderIds?.some((lId) => course.ladderIds?.includes(lId)) && // MUST BE IN SAME LADDER
                  c.order === course.order - 1
              );

              if (prereq && !completedCourseIds.has(prereq.id)) {
                isLocked = true;
                prerequisiteCourse = { id: prereq.id, title: prereq.title };
              }
            }
          }
        } else {
            // If user has no ladder, assume they are at the lowest level and lock everything not at that level
            if (courseMinLadderOrder > 0) {
                 isLocked = true;
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

  /** Manual refresh for callers */
  const refresh = () => {
    fetchAndProcessCourses();
  };

  /** ---------- ENROLL / UNENROLL (Rule-compliant) ---------- */

  // Creates enrollments/${uid}_${courseId} with { userId, courseId, enrolledAt }
  // Updates courses/${courseId}.enrollmentCount = old + 1
  const enrollInCourse = useCallback(async (courseId: string) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error("Not signed in");

    const enrollmentRef = doc(db, "enrollments", `${uid}_${courseId}`);
    const courseRef = doc(db, "courses", courseId);

    await runTransaction(db, async (tx) => {
      // Create/merge enrollment (ID + payload must match rules)
      tx.set(
        enrollmentRef,
        {
          userId: uid,
          courseId,
          enrolledAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Bump enrollmentCount by exactly +1 (no FieldValue.increment)
      const courseSnap = await tx.get(courseRef);
      const current =
        ((courseSnap.exists() ? (courseSnap.data() as any).enrollmentCount : 0) as number) || 0;
      tx.update(courseRef, { enrollmentCount: current + 1 });
    });

    // Refresh local state after successful write
    refresh();
  }, [refresh]);

  // Deletes enrollments/${uid}_${courseId}
  // Updates courses/${courseId}.enrollmentCount = old - 1 (not below 0)
  const unenrollFromCourse = useCallback(async (courseId: string) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error("Not signed in");

    const enrollmentRef = doc(db, "enrollments", `${uid}_${courseId}`);
    const courseRef = doc(db, "courses", courseId);

    await runTransaction(db, async (tx) => {
      // Delete enrollment (owner/admin permitted by rules)
      tx.delete(enrollmentRef);

      // Decrement enrollmentCount by exactly -1
      const courseSnap = await tx.get(courseRef);
      const current =
        ((courseSnap.exists() ? (courseSnap.data() as any).enrollmentCount : 0) as number) || 0;
      tx.update(courseRef, { enrollmentCount: Math.max(0, current - 1) });
    });

    refresh();
  }, [refresh]);

  return {
    processedCourses,
    allLadders,
    loading,
    refresh,
    enrollInCourse,      // ← use this in your Enroll button
    unenrollFromCourse,  // ← optional
  };
}
