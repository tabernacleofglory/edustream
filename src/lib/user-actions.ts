
'use server';

import { db } from './firebase-admin';
import { collection, getDocs, query, where, orderBy, doc, getDoc, writeBatch, runTransaction, addDoc, serverTimestamp, deleteDoc, increment } from 'firebase/firestore';
import type { Course, Ladder, UserProgress, PromotionRequest } from './types';

export async function checkAndPromoteUser(userId: string, currentLadder: string) {
  if (!currentLadder) {
    return { status: 'no-ladder', promoted: false };
  }

  const laddersQuery = query(collection(db, 'courseLevels'), orderBy('order'));
  const laddersSnapshot = await getDocs(laddersQuery);
  const allLadders = laddersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder));
  
  const currentLadderDoc = allLadders.find(l => l.name === currentLadder);
  if (!currentLadderDoc) {
    console.warn(`Current ladder "${currentLadder}" not found in courseLevels.`);
    return { status: 'no-ladder-doc', promoted: false };
  }
  
  const nextLadder = allLadders.find(l => l.order > currentLadderDoc.order);
  
  if (!nextLadder) {
    return { status: 'last-ladder', promoted: false };
  }

  const coursesQuery = query(collection(db, 'courses'), where('ladders', 'array-contains', currentLadder));
  const coursesSnapshot = await getDocs(coursesQuery);
  const requiredCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));

  if (requiredCourses.length === 0) {
    // No courses required for the current ladder, so auto-promote.
    // This part might need reconsideration based on the new manual promotion flow.
    // For now, let's assume if there are no courses, promotion is possible.
    return { status: 'promoted', newLadder: nextLadder.name, promoted: true };
  }
  
  const progressQuery = query(collection(db, 'userVideoProgress'), where('userId', '==', userId));
  const progressSnapshot = await getDocs(progressQuery);
  
  const completedCourses = new Set<string>();

  for (const progressDoc of progressSnapshot.docs) {
    const progressData = progressDoc.data() as UserProgress;
    const course = requiredCourses.find(c => c.id === progressData.courseId);
    if (course && course.videos && course.videos.length > 0) {
      const completedVideosForCourse = progressData.videoProgress?.filter(p => p.completed).length || 0;
      if (completedVideosForCourse === course.videos.length) {
        completedCourses.add(progressData.courseId);
      }
    }
  }
  
  const allRequiredCompleted = requiredCourses.every(course => completedCourses.has(course.id));

  if (allRequiredCompleted) {
    // This is where auto-promotion happened. Now it just confirms eligibility.
    return { status: 'eligible', newLadder: nextLadder.name, promoted: false };
  }

  return { status: 'in-progress', promoted: false };
}

export async function requestPromotion(userId: string, userName: string, userEmail: string, currentLadder: Ladder, requestedLadder: Ladder): Promise<{ success: boolean; message: string }> {
    try {
        const requestRef = collection(db, 'promotionRequests');

        // Check for an existing pending request
        const existingRequestQuery = query(requestRef, 
            where('userId', '==', userId), 
            where('status', '==', 'pending')
        );
        const existingRequestSnapshot = await getDocs(existingRequestQuery);
        if (!existingRequestSnapshot.empty) {
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
            requestedAt: serverTimestamp(),
        };

        await addDoc(requestRef, newRequest);

        return { success: true, message: 'Promotion request submitted successfully.' };
    } catch (error: any) {
        console.error('Error requesting promotion:', error);
        const message = error.message || 'An unexpected error occurred.';
        return { success: false, message };
    }
}


export async function unenrollUserFromCourse(userId: string, courseId: string): Promise<{ success: boolean; message: string }> {
  try {
    const enrollmentRef = doc(db, 'enrollments', `${userId}_${courseId}`);
    const enrollmentDoc = await getDoc(enrollmentRef);

    if (!enrollmentDoc.exists()) {
      return { success: false, message: 'Enrollment not found.' };
    }

    const courseRef = doc(db, 'courses', courseId);
    
    // Use a transaction to ensure atomicity
    await runTransaction(db, async (transaction) => {
        transaction.delete(enrollmentRef);
        transaction.update(courseRef, { enrollmentCount: increment(-1) });
    });
    
    return { success: true, message: 'Successfully unenrolled from the course.' };

  } catch (error: any) {
    console.error('Error unenrolling user:', error);
    const message = error.message || 'An unexpected error occurred.';
    return { success: false, message };
  }
}
