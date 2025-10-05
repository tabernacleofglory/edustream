
import React from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Course } from '@/lib/types';
import { notFound } from 'next/navigation';
import CertificatePrint from '@/components/certificate-print';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import CertificatePageClient from '@/components/certificate-page-client';

// Helper to convert Firestore Timestamps to a serializable format for props
const convertTimestamps = (data: any) => {
  if (data && typeof data === 'object') {
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        if (data[key] instanceof Timestamp) {
          data[key] = data[key].toDate().toISOString();
        } else if (Array.isArray(data[key])) {
          data[key] = data[key].map(item => convertTimestamps(item));
        } else if (typeof data[key] === 'object' && data[key] !== null) {
          convertTimestamps(data[key]);
        }
      }
    }
  }
  return data;
}

// Data fetching function on the server
async function getCourse(courseId: string): Promise<Course | null> {
    const courseRef = doc(db, 'courses', courseId);
    const courseSnap = await getDoc(courseRef);
    if (!courseSnap.exists()) {
        return null;
    }
    const courseData = courseSnap.data();
    // Ensure data is serializable before passing to client component
    const serializableCourse = convertTimestamps({ id: courseSnap.id, ...courseData });
    return serializableCourse as Course;
}

// This is now a Server Component
export default async function CertificatePage({ params }: { params: { courseId: string } }) {
    const { courseId } = params;
    const course = await getCourse(courseId);

    if (!course) {
        notFound();
    }
    
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-4xl p-4">
                 <CertificatePageClient course={course} />
            </div>
        </div>
    );
}
