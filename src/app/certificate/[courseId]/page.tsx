<<<<<<< HEAD
=======

>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
"use client";

import React from "react";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
<<<<<<< HEAD
import { Course } from "@/lib/types";
=======
import { Course, SiteSettings } from "@/lib/types";
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
import { notFound, useParams } from "next/navigation";
import CertificatePrint from "@/components/certificate-print";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, use } from "react";
import { Skeleton } from "@/components/ui/skeleton";

<<<<<<< HEAD
=======

>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
// Helper to convert Firestore Timestamps to a serializable format
const convertTimestamps = (data: any) => {
  if (data && typeof data === 'object') {
    for (const key in data) {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate().toISOString();
<<<<<<< HEAD
      } else if (Array.isArray(data[key])) {
        data[key] = data[key].map(item => convertTimestamps(item));
=======
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        convertTimestamps(data[key]);
      }
    }
  }
  return data;
}

<<<<<<< HEAD
async function getCourse(courseId: string): Promise<Course | null> {
    const courseRef = doc(db, 'courses', courseId);
    const courseSnap = await getDoc(courseRef);
    if (!courseSnap.exists()) {
        return null;
    }
    const courseData = courseSnap.data();
    const serializableCourse = convertTimestamps({ id: courseSnap.id, ...courseData });
    return serializableCourse as Course;
}


function CertificatePageClient({ coursePromise }: { coursePromise: Promise<Course | null> }) {
    const { user } = useAuth();
    const course = use(coursePromise);
=======
async function getCourseAndSettings(courseId: string): Promise<{ course: Course | null, settings: SiteSettings | null }> {
    const courseRef = doc(db, 'courses', courseId);
    const settingsRef = doc(db, "siteSettings", "main");
    
    const [courseSnap, settingsSnap] = await Promise.all([
        getDoc(courseRef),
        getDoc(settingsRef)
    ]);
    
    const settings = settingsSnap.exists() ? settingsSnap.data() as SiteSettings : null;

    if (!courseSnap.exists()) {
        return { course: null, settings };
    }
    const courseData = courseSnap.data();
    const serializableCourse = convertTimestamps({ id: courseSnap.id, ...courseData });
    return { course: serializableCourse as Course, settings };
}


function CertificatePageClient({ dataPromise }: { dataPromise: Promise<{ course: Course | null; settings: SiteSettings | null; }> }) {
    const { user } = useAuth();
    const { course, settings } = use(dataPromise);
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)

    if (!course) {
        notFound();
    }
    
    if (!user) {
        // Or redirect to login
        return <p>Please log in to view your certificate.</p>
    }
    
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-4xl p-4">
<<<<<<< HEAD
                 <CertificatePrint userName={user.displayName || "Student"} course={course} />
=======
                 <CertificatePrint 
                    userName={user.displayName || "Student"} 
                    course={course}
                    settings={settings}
                />
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
            </div>
        </div>
    );
}


export default function CertificatePage({ params }: { params: { courseId: string } }) {
    const { courseId } = params;
<<<<<<< HEAD
    const coursePromise = getCourse(courseId);
=======
    const dataPromise = getCourseAndSettings(courseId);
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)

    return (
      <React.Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="w-full max-w-4xl p-4">
                    <Skeleton className="w-full aspect-[11/8.5]" />
                </div>
            </div>
      }>
<<<<<<< HEAD
        <CertificatePageClient coursePromise={coursePromise} />
      </React.Suspense>
    );
}
=======
        <CertificatePageClient dataPromise={dataPromise} />
      </React.Suspense>
    );
}
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
