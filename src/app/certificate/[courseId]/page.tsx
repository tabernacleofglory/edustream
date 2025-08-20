"use client";

import React from "react";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Course } from "@/lib/types";
import { notFound, useParams } from "next/navigation";
import CertificatePrint from "@/components/certificate-print";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, use } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Helper to convert Firestore Timestamps to a serializable format
const convertTimestamps = (data: any) => {
  if (data && typeof data === 'object') {
    for (const key in data) {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate().toISOString();
      } else if (Array.isArray(data[key])) {
        data[key] = data[key].map(item => convertTimestamps(item));
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        convertTimestamps(data[key]);
      }
    }
  }
  return data;
}

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
                 <CertificatePrint userName={user.displayName || "Student"} course={course} />
            </div>
        </div>
    );
}


export default function CertificatePage({ params }: { params: { courseId: string } }) {
    const { courseId } = params;
    const coursePromise = getCourse(courseId);

    return (
      <React.Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="w-full max-w-4xl p-4">
                    <Skeleton className="w-full aspect-[11/8.5]" />
                </div>
            </div>
      }>
        <CertificatePageClient coursePromise={coursePromise} />
      </React.Suspense>
    );
}