
import { db } from './firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { Course, Ladder } from './types';

// Mock function to get the next ladder
const getNextLadder = (currentLadder: string): Ladder | null => {
    // In a real app, you'd fetch this from Firestore
    if (currentLadder === 'Beginner') {
        return { id: '2', name: 'Intermediate' };
    }
    return null;
};

// Mock function to get required courses for a ladder
const getRequiredCoursesForLadder = async (ladder: string): Promise<Course[]> => {
    // In a real app, you'd fetch this from Firestore
    return [];
};

const getCompletedCoursesForUser = async (userId: string): Promise<Set<string>> => {
    const q = query(collection(db, 'userVideoProgress'), where('userId', '==', userId), where('totalProgress', '==', 100));
    const querySnapshot = await getDocs(q);
    const completedCourses = new Set<string>();
    querySnapshot.forEach((doc) => {
        completedCourses.add(doc.data().courseId);
    });
    return completedCourses;
};

export async function checkAndPromoteUser(userId: string, currentLadder: string) {
    const requiredCourses = await getRequiredCoursesForLadder(currentLadder);
    const completedCourses = await getCompletedCoursesForUser(userId);

    const allRequiredCompleted = requiredCourses.every(course => completedCourses.has(course.id));

    if (allRequiredCompleted) {
        const nextLadder = getNextLadder(currentLadder);
        if (nextLadder) {
            await updateDoc(doc(db, 'users', userId), {
                classLadder: nextLadder.name,
                classLadderId: nextLadder.id,
            });
            return { status: 'promoted', newLadder: nextLadder.name, promoted: true };
        }
    }

    return { status: 'in-progress', promoted: false };
}
