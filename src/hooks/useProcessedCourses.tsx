
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
      
      const coursesSnapshot = await getDocs(coursesQuery);
      
      const coursesList: Course[] = coursesSnapshot.docs.map((doc) => {
        const raw = { id: doc.id, ...doc.data() } as Course;
        const ladderIds = getLadderIds(raw);
        return { ...raw, ladderIds };
      });

      const sortedCourses = [...coursesList].sort(
        (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)
      );

      // Determine Target Language for filtering
      const targetLangName = user?.language || allLanguages.find(l => l.code === currentLanguage)?.name;
      
      // Single Source of Truth: Filter by language here so all components see consistent data
      const coursesInLanguage = sortedCourses.filter(c => !targetLangName || c.language === targetLangName);

      if (!user) {
        // For guest users, just show the courses without any progress or lock status.
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
      
      // Fetch all necessary user data in parallel
      const enrollmentsQuery = query(collection(db, "enrollments"), where("userId", "==", user.uid));
      const progressQuery = query(collection(db, "userVideoProgress"), where("userId", "==", user.uid));
      const quizResultsQuery = query(collection(db, 'userQuizResults'), where('userId', '==', user.uid));
      const formSubmissionsQuery = query(collectionGroup(db, 'submissions'), where('userId', '==', user.uid));
      const globalProgressQuery = getDoc(doc(db, "userContentProgress", user.uid)); // New global progress

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
      
      const submittedFormsByCourse = new Map<string, Set<string>>();
      formSubmissionsSnapshot.docs.forEach(doc => {
          const submission = doc.data();
          if (submission.courseId && submission.formId) {
              if (!submittedFormsByCourse.has(submission.courseId)) {
                  submittedFormsByCourse.set(submission.courseId, new Set());
              }
              submittedFormsByCourse.get(submission.courseId)!.add(submission.formId);
          }
      });

      const globalCompletedItems = new Set<string>(
          globalProgressSnapshot.exists() ? Object.keys(globalProgressSnapshot.data().completedItems || {}) : []
      );
      
      const completedCourseIds = new Set<string>();
      const coursesInProgress = new Set<string>();

      for (const course of coursesInLanguage) {
        if (!course.id) continue;
        
        // NEW MODEL CHECK
        if (course.contentItems && course.contentItems.length > 0) {
            const allContentCompleted = course.contentItems.every(item => globalCompletedItems.has(item.contentId));
            if (allContentCompleted) {
                completedCourseIds.add(course.id);
            } else if (enrollmentData.has(course.id)) {
                coursesInProgress.add(course.id);
            }
        // OLD MODEL FALLBACK
        } else {
            const progress = progressMap.get(course.id!);
            const videosInCourse = course.videos || [];
            const quizzesInCourse = course.quizIds || [];
            
            const completedVideosCount = progress?.videoProgress?.filter(p => p.completed).length || 0;
            const allVideosCompleted = videosInCourse.length > 0 ? completedVideosCount >= videosInCourse.length : true;
            
            const passedQuizzesSet = passedQuizzesByCourse.get(course.id) || new Set();
            const allQuizzesCompleted = quizzesInCourse.length > 0 ? quizzesInCourse.every(qid => passedQuizzesSet.has(qid)) : true;
            
            const formInCourse = course.formId;
            const submittedFormsSet = submittedFormsByCourse.get(course.id!) || new Set();
            const formCompleted = formInCourse ? submittedFormsSet.has(formInCourse) : true;

            if (allVideosCompleted && allQuizzesCompleted && formCompleted) {
              completedCourseIds.add(course.id!);
            } else if (enrollmentData.has(course.id)) {
              coursesInProgress.add(course.id!);
            }
        }
      }

      const userLadder = laddersList.find((l) => l.id === (user as any)?.classLadderId) ?? null;
      const userLadderOrder = userLadder?.order ?? 0;

      const coursesWithStatus: CourseWithStatus[] = coursesInLanguage.map((course) => {
        const enrollment = enrollmentData.get(course.id!);
        const progress = progressMap.get(course.id!);
        
        const totalVideos = course.videos?.length || 0;
        const completedVideosCount = progress?.videoProgress?.filter(v => v.completed).length || 0;
        
        let isLocked = false;
        let prerequisiteCourse: CourseWithStatus['prerequisiteCourse'] | undefined;
        
        const courseLadderObjs = (course.ladderIds || []).map(id => laddersList.find(l => l.id === id)).filter(Boolean) as Ladder[];
        const courseMinLadderOrder = courseLadderObjs.length > 0 
            ? Math.min(...courseLadderObjs.map(l => l.order))
            : Infinity;

        // Ladder-level security: Lock if user is not yet at the required ladder order
        // We always apply this check for logged-in users, even if their profile is missing a ladder (defaults to order 0)
        if (courseMinLadderOrder > userLadderOrder) {
          isLocked = true;
        }
        
        // Course-level prerequisite (sequential track within the same ladder)
        if (!isLocked && course.order !== undefined && course.order > 0) {
            // Find all courses in the same ladder track that come BEFORE this one
            const trackCourses = coursesInLanguage.filter(c => 
                c.id !== course.id &&
                c.ladderIds?.some(lId => course.ladderIds.includes(lId)) &&
                (c.order ?? 0) < course.order!
            );
            
            // Check if any of those preceding courses are incomplete
            const unfinishedTrackCourses = trackCourses.filter(c => !completedCourseIds.has(c.id));
            
            if (unfinishedTrackCourses.length > 0) {
                isLocked = true;
                // Suggest the highest-order incomplete course as the immediate prerequisite
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
  }, [user, currentLanguage, db]);

  useEffect(() => {
      fetchAndProcessCourses();
  }, [fetchAndProcessCourses]);

  const refresh = () => {
    fetchAndProcessCourses();
  };

  return { processedCourses, allLadders, loading, refresh };
}
