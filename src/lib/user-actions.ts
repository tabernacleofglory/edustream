
'use server';

import { db } from './firebase-admin'; // Admin SDK Firestore (FirebaseFirestore.Firestore)
import { FieldValue } from 'firebase-admin/firestore';
import type { Course, Ladder, UserProgress, PromotionRequest } from './types';

/**
 * CHECK & PROMOTE USER
 * (Uses Admin SDK query syntax throughout.)
 */
export async function checkAndPromoteUser(userId: string, currentLadder: string) {
  if (!currentLadder) {
    return { status: 'no-ladder', promoted: false };
  }

  // Ladders ordered
  const laddersSnapshot = await db.collection('courseLevels').orderBy('order').get();
  const allLadders = laddersSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...(doc.data() as any) } as Ladder)
  );

  const currentLadderDoc = allLadders.find((l) => l.name === currentLadder);
  if (!currentLadderDoc) {
    console.warn(`Current ladder "${currentLadder}" not found in courseLevels.`);
    return { status: 'no-ladder-doc', promoted: false };
  }

  const nextLadder = allLadders.find((l) => l.order > currentLadderDoc.order);
  if (!nextLadder) {
    return { status: 'last-ladder', promoted: false };
  }

  // Courses that belong to this ladder name
  const coursesSnapshot = await db
    .collection('courses')
    .where('ladderIds', 'array-contains', currentLadderDoc.id)
    .get();

  const requiredCourses = coursesSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...(doc.data() as any) } as Course)
  );

  if (requiredCourses.length === 0) {
    // No required courses for that ladder
    return { status: 'promoted', newLadder: nextLadder.name, promoted: true };
  }

  // All progress for the user
  const progressSnapshot = await db
    .collection('userVideoProgress')
    .where('userId', '==', userId)
    .get();

  const completedCourses = new Set<string>();

  for (const progressDoc of progressSnapshot.docs) {
    const progressData = progressDoc.data() as UserProgress;
    const course = requiredCourses.find((c) => c.id === progressData.courseId);
    if (course && Array.isArray(course.videos) && course.videos.length > 0) {
      const completedVideosForCourse =
        (progressData.videoProgress?.filter((p) => p.completed).length ?? 0);
      if (completedVideosForCourse === course.videos.length) {
        completedCourses.add(progressData.courseId);
      }
    }
  }

  const allRequiredCompleted = requiredCourses.every((c) => completedCourses.has(c.id));
  if (allRequiredCompleted) {
    return { status: 'eligible', newLadder: nextLadder.name, promoted: false };
  }

  return { status: 'in-progress', promoted: false };
}

/**
 * REQUEST PROMOTION
 */
export async function requestPromotion(
  userId: string,
  userName: string,
  userEmail: string,
  currentLadder: Ladder,
  requestedLadder: Ladder
): Promise<{ success: boolean; message: string }> {
  try {
    const requestRef = db.collection('promotionRequests');

    // Check existing pending request
    const pendingSnap = await requestRef
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    if (!pendingSnap.empty) {
      return { success: false, message: 'You already have a pending promotion request.' };
    }

    const newRequest: Omit<PromotionRequest, 'id'> = {
      userId,
      userName,
      userEmail,
      currentLadderId: currentLadder.id,
      currentLadderName: currentLadder.name,
      requestedLadderId: requestedLadder.id,
      requestedLadderName: requestedLadder.name,
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp() as any,
    };

    await requestRef.add(newRequest);

    return { success: true, message: 'Promotion request submitted successfully.' };
  } catch (error: any) {
    console.error('Error requesting promotion:', error);
    const message = error.message || 'An unexpected error occurred.';
    return { success: false, message };
  }
}

/**
 * UNENROLL USER FROM COURSE
 * - Deletes enrollment doc
 * - Deletes progress doc
 * - Decrements courses/{courseId}.enrollmentCount by exactly 1
 *   (your rules explicitly allow +/- 1 for non-admins)
 */
export async function unenrollUserFromCourse(
  userId: string,
  courseId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const enrollmentId = `${userId}_${courseId}`;
    const enrollmentRef = db.doc(`enrollments/${enrollmentId}`);
    const progressRef   = db.doc(`userVideoProgress/${enrollmentId}`);
    const courseRef     = db.doc(`courses/${courseId}`);

    const enrollmentDoc = await enrollmentRef.get();
    if (!enrollmentDoc.exists) {
      return { success: false, message: 'Enrollment not found.' };
    }

    // Try transaction first for atomic behavior
    await db.runTransaction(async (tx) => {
      const courseSnap = await tx.get(courseRef);
      if (courseSnap.exists) {
        const currentCount = (courseSnap.data()?.enrollmentCount ?? 0) as number;
        tx.update(courseRef, { enrollmentCount: currentCount - 1 });
      }
      tx.delete(enrollmentRef);
      tx.delete(progressRef);
    });

    return { success: true, message: 'Successfully unenrolled from the course.' };
  } catch (error: any) {
    console.error('Error unenrolling user:', error);
    // Best-effort fallback if transaction failed mid-way
    try {
      const courseRef = db.doc(`courses/${courseId}`);
      await courseRef.update({ enrollmentCount: FieldValue.increment(-1) });
    } catch {}
    try { await db.doc(`enrollments/${userId}_${courseId}`).delete(); } catch {}
    try { await db.doc(`userVideoProgress/${userId}_${courseId}`).delete(); } catch {}

    const message = error.message || 'An unexpected error occurred.';
    return { success: false, message };
  }
}
