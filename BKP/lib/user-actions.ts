import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, serverTimestamp, increment, deleteDoc, writeBatch, orderBy } from 'firebase/firestore';
import type { Course, Ladder, UserProgress, PromotionRequest } from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export async function checkAndPromoteUser(userId: string, currentLadder: string) {
  if (!currentLadder) {
    return { status: 'no-ladder', promoted: false };
  }

  const laddersSnapshot = await getDocs(query(collection(db, 'courseLevels'), orderBy('order')));
  const allLadders = laddersSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...(doc.data() as any) } as Ladder)
  );

  const currentLadderDoc = allLadders.find((l) => l.name === currentLadder);
  if (!currentLadderDoc) {
    return { status: 'no-ladder-doc', promoted: false };
  }

  const nextLadder = allLadders.find((l) => l.order > currentLadderDoc.order);
  if (!nextLadder) {
    return { status: 'last-ladder', promoted: false };
  }

  const coursesSnapshot = await getDocs(query(
    collection(db, 'courses'),
    where('ladderIds', 'array-contains', currentLadderDoc.id)
  ));

  const requiredCourses = coursesSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...(doc.data() as any) } as Course)
  );

  if (requiredCourses.length === 0) {
    const userRef = doc(db, 'users', userId);
    updateDoc(userRef, {
        classLadder: nextLadder.name,
        classLadderId: nextLadder.id,
    });
    return { status: 'promoted', newLadder: nextLadder.name, promoted: true };
  }

  const progressSnapshot = await getDocs(query(
    collection(db, 'userVideoProgress'),
    where('userId', '==', userId)
  ));

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

export async function requestPromotion(
  userId: string,
  userName: string,
  userEmail: string,
  currentLadder: Ladder,
  requestedLadder: Ladder
): Promise<{ success: boolean; message: string }> {
  try {
    const requestRef = collection(db, 'promotionRequests');

    const pendingSnap = await getDocs(query(
      requestRef,
      where('userId', '==', userId),
      where('status', '==', 'pending')
    ));

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
      requestedAt: serverTimestamp() as any,
    };

    addDoc(requestRef, newRequest).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'promotionRequests',
            operation: 'create',
            requestResourceData: newRequest,
        }));
    });

    return { success: true, message: 'Promotion request submitted successfully.' };
  } catch (error: any) {
    console.error('Error requesting promotion:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function unenrollUserFromCourse(
  userId: string,
  courseId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const enrollmentId = `${userId}_${courseId}`;
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    const courseRef = doc(db, 'courses', courseId);
    const progressRef = doc(db, 'userVideoProgress', `${userId}_${courseId}`);
    
    const quizResultsQuery = query(collection(db, 'userQuizResults'), where('userId', '==', userId), where('courseId', '==', courseId));
    const quizResultsSnapshot = await getDocs(quizResultsQuery);

    const batch = writeBatch(db);
    batch.delete(enrollmentRef);
    batch.delete(progressRef);
    quizResultsSnapshot.forEach(d => batch.delete(d.ref));
    batch.update(courseRef, { enrollmentCount: increment(-1) });

    batch.commit().catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'batch',
            operation: 'delete',
        }));
    });
    
    return { success: true, message: 'Successfully unenrolled from the course and all related progress was deleted.' };
  } catch (error: any) {
    console.error('Error unenrolling user:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}
