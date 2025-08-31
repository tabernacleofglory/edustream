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
} from "firebase/firestore";
import type {
  Course,
  Enrollment,
  UserProgress as UserProgressType,
  Ladder,
  Video,
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

      /** PUBLISHED VIDEOS (map by id for quick inclusion checks) */
      const videosQuery = query(
        collection(db, "Contents"),
        where("status", "==", "published"),
        where("Type", "==", "video")
      );
      const videosSnapshot = await getDocs(videosQuery);
      const allPublishedVideosMap = new Map<string, (Video & { id: string })>(
        videosSnapshot.docs.map((doc) => [
          doc.id,
          { id: doc.id, ...(doc.data() as Video) },
        ])
      );

      /** PUBLISHED COURSES */
      const coursesQuery = query(
        collection(db, "courses"),
        where("status", "==", "published")
      );
      const coursesSnapshot = await getDocs(coursesQuery);

      // Normalize ladderIds so downstream logic always has them
      const coursesList: Course[] = coursesSnapshot.docs.map((doc) => {
        const raw = { id: doc.id, ...doc.data() } as Course;
        const ladderIds = getLadderIds(raw);
        return { ...raw, ladderIds };
      });

      // Sort once (null/undefined orders to the end)
      const sortedCourses = [...coursesList].sort(
        (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)
      );

      // Guests: browse freely; no progress/locks enforced.
      if (!user) {
        setProcessedCourses(
          sortedCourses.map((c) => ({
            ...c,
            isEnrolled: false,
            isCompleted: false,
            isLocked: false, // allow browsing
            totalProgress: 0,
            lastWatchedVideoId: c.videos?.find((vid) =>
              allPublishedVideosMap.has(vid as string)
            ),
          }))
        );
        setLoading(false);
        return;
      }

      /** USER DATA: enrollments + progress */
      const enrollmentsQuery = query(
        collection(db, "enrollments"),
        where("userId", "==", user.uid)
      );
      const progressQuery = query(
        collection(db, "userVideoProgress"),
        where("userId", "==", user.uid)
      );

      const [enrollmentsSnapshot, progressSnapshot] = await Promise.all([
        getDocs(enrollmentsQuery),
        getDocs(progressQuery),
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

      /** Identify completed + in-progress courses based on published videos only */
      const completedCourseIds = new Set<string>();
      const coursesInProgress = new Set<string>();

      for (const course of sortedCourses) {
        const enrollment = enrollmentData.get(course.id!);
        const progress = progressMap.get(course.id!);

        const publishedVideoIdsForCourse: string[] =
          course.videos?.filter((vid) => allPublishedVideosMap.has(vid as string)) ??
          [];

        if (publishedVideoIdsForCourse.length === 0) {
          if (enrollment?.completedAt) completedCourseIds.add(course.id!);
          continue;
        }

        const completedVideosCount =
          progress?.videoProgress?.filter(
            (v) => v.completed && publishedVideoIdsForCourse.includes(v.videoId)
          ).length ?? 0;

        if (completedVideosCount === publishedVideoIdsForCourse.length) {
          completedCourseIds.add(course.id!);
        } else if (enrollment) {
          coursesInProgress.add(course.id!);
        }
      }

      /** USER LADDER CONTEXT */
      const lowestLadderOrder = laddersList.length > 0 ? laddersList[0].order : 0;
      const userLadder =
        laddersList.find((l) => l.id === (user as any)?.classLadderId) ?? null;
      const userLadderOrder = userLadder?.order ?? (laddersList[0]?.order ?? 0);
      const isLowestLadder = userLadderOrder === lowestLadderOrder;

      /** Precompute per-ladder ordering for prereq lookups */
      const orderByLadder = new Map<string, Course[]>();
      for (const c of sortedCourses) {
        for (const lid of c.ladderIds ?? []) {
          if (!orderByLadder.has(lid)) orderByLadder.set(lid, []);
          orderByLadder.get(lid)!.push(c);
        }
      }
      for (const [, arr] of orderByLadder) {
        arr.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
      }

      function findNearestLowerPrereq(course: Course, ladderId: string) {
        if (course.order == null) return undefined;
        const arr = orderByLadder.get(ladderId) ?? [];
        let candidate: Course | undefined;
        for (const c of arr) {
          if ((c.order ?? Infinity) < course.order) candidate = c;
          else break;
        }
        return candidate;
      }

      /** Build final course states (with corrected locking + prereq logic) */
      const coursesWithStatus: CourseWithStatus[] = sortedCourses.map((course) => {
        const enrollment = enrollmentData.get(course.id!);
        const progress = progressMap.get(course.id!);

        const publishedVideoIdsForCourse: string[] =
          course.videos?.filter((vid) => allPublishedVideosMap.has(vid as string)) ?? [];
        const totalVideos = publishedVideoIdsForCourse.length;

        const completedVideosCount =
          progress?.videoProgress?.filter(
            (v) => v.completed && publishedVideoIdsForCourse.includes(v.videoId)
          ).length ?? 0;

        const isCompleted = completedCourseIds.has(course.id!);

        const courseLadders = (course.ladderIds || [])
          .map((id) => laddersList.find((l) => l.id === id))
          .filter(Boolean) as Ladder[];

        let isLocked = false;
        let prerequisiteCourse: CourseWithStatus["prerequisiteCourse"] = undefined;

        if (userLadder && courseLadders.length > 0) {
          // 🔒 Lock ONLY if *all* ladders for this course are higher than the user's ladder
          const minCourseLadderOrder = Math.min(...courseLadders.map((l) => l.order));
          if (minCourseLadderOrder > userLadderOrder) {
            isLocked = true; // course entirely above the user's ladder -> locked
          } else {
            // ✅ At least one ladder for this course is <= user ladder, so the course is eligible.
            // Enforce prerequisites within the appropriate ladder:
            // - If course is in the user's ladder, use that.
            // - Else, pick the nearest ladder for the course whose order <= user ladder.
            let ladderForPrereq: Ladder | undefined =
              courseLadders.find((l) => l.id === userLadder.id) ||
              courseLadders
                .filter((l) => l.order <= userLadderOrder)
                .sort((a, b) => b.order - a.order)[0]; // closest lower/equal ladder

            if (ladderForPrereq && course.order !== undefined) {
              const prereq = findNearestLowerPrereq(course, ladderForPrereq.id);
              if (prereq && !completedCourseIds.has(prereq.id!)) {
                isLocked = true;
                prerequisiteCourse = { id: prereq.id!, title: prereq.title };
              }
            }
          }
        }

        // Lowest ladder: only one in-progress course at a time in that *user* ladder
        if (!isLocked && isLowestLadder && userLadder) {
          const inProgressInUserLadder = [...coursesInProgress].some((cid) => {
            const cc = sortedCourses.find((c) => c.id === cid);
            return (cc?.ladderIds || []).includes(userLadder.id);
          });
          const thisInUserLadder = (course.ladderIds || []).includes(userLadder.id);
          if (inProgressInUserLadder && thisInUserLadder && !isCompleted && !enrollment) {
            isLocked = true;
          }
        }

        const lastWatchedVideoId =
          progress?.lastWatchedVideoId ??
          (publishedVideoIdsForCourse.length > 0
            ? (publishedVideoIdsForCourse[0] as string)
            : undefined);

        return {
          ...course,
          isEnrolled: !!enrollment,
          isCompleted,
          isLocked,
          prerequisiteCourse,
          totalProgress:
            totalVideos > 0
              ? Math.round((completedVideosCount / totalVideos) * 100)
              : 0,
          lastWatchedVideoId,
          completedAt: (enrollment?.completedAt as Timestamp | undefined)
            ? (enrollment!.completedAt as Timestamp).toDate().toISOString()
            : undefined,
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
  };

  return { processedCourses, allLadders, loading, refresh };
}
