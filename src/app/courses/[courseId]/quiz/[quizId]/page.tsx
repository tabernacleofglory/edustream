
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Course, Quiz } from '@/lib/types';
import QuizPanel from '@/components/quiz-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useProcessedCourses } from '@/hooks/useProcessedCourses';

export default function QuizPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { refresh } = useProcessedCourses();

    const courseId = params.courseId as string;
    const quizId = params.quizId as string;

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!courseId || !quizId) return;

        const fetchQuizAndCourse = async () => {
            try {
                const quizDocRef = doc(db, 'quizzes', quizId);
                const courseDocRef = doc(db, 'courses', courseId);
                
                const [quizSnap, courseSnap] = await Promise.all([
                    getDoc(quizDocRef),
                    getDoc(courseDocRef)
                ]);

                if (quizSnap.exists()) {
                    setQuiz({ id: quizSnap.id, ...quizSnap.data() } as Quiz);
                } else {
                    console.error("Quiz not found");
                }
                
                if(courseSnap.exists()) {
                    setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
                } else {
                     console.error("Course not found");
                }

            } catch (error) {
                console.error("Error fetching quiz data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchQuizAndCourse();
    }, [courseId, quizId]);

    const handleQuizComplete = () => {
        refresh(); // Refresh course processing hook
        router.push(`/courses`); // Navigate back to the main course page
    };
    
    if (loading) {
        return (
             <div className="p-4 md:p-8 h-full bg-background overflow-y-auto">
                <Skeleton className="max-w-3xl mx-auto h-[60vh]" />
             </div>
        );
    }
    
    if (!quiz || !course) {
        return <div>Quiz or Course not found.</div>;
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40">
           <QuizPanel
            quizData={{...quiz, type: 'quiz'} as any}
            courseId={courseId}
            onQuizComplete={handleQuizComplete}
          />
        </div>
    );
}

