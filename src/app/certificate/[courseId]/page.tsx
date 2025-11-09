
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { Course, Enrollment, CourseGroup, SiteSettings } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import CertificatePageClient from "@/components/certificate-page-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getSiteSettings } from "@/lib/data";

export default function CertificatePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const db = getFirebaseFirestore();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseGroup, setCourseGroup] = useState<CourseGroup | null>(null);
  const [completionDate, setCompletionDate] = useState<string | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }

    (async () => {
      setBusy(true);
      try {
        const [cSnap, settings] = await Promise.all([
            getDoc(doc(db, "courses", courseId)),
            getSiteSettings()
        ]);
        setSiteSettings(settings);

        if (!cSnap.exists()) { router.replace("/courses"); return; }
        
        const courseData = { id: cSnap.id, ...cSnap.data() } as Course;
        setCourse(courseData);

        // Check enrollment and completion
        const eSnap = await getDoc(doc(db, "enrollments", `${user.uid}_${courseId}`));
        const enrollmentData = eSnap.data() as Enrollment | undefined;
        const completedAt = enrollmentData?.completedAt as Timestamp | undefined;
        
        if (!eSnap.exists() || !completedAt) { 
            router.replace("/courses"); 
            return; 
        }
        setCompletionDate(completedAt.toDate().toISOString());

        if (courseData.ladderIds && courseData.ladderIds.length > 0) {
          const courseGroupsQuery = query(
            collection(db, "courseGroups"),
            where("courseIds", "array-contains", courseId)
          );
          const courseGroupsSnapshot = await getDocs(courseGroupsQuery);
          if (!courseGroupsSnapshot.empty) {
            const groupDoc = courseGroupsSnapshot.docs[0];
            setCourseGroup({ id: groupDoc.id, ...groupDoc.data() } as CourseGroup);
          }
        }
      } catch (error) {
        console.error("Error fetching certificate data:", error);
        router.replace("/courses");
      } finally {
        setBusy(false);
      }
    })();
  }, [loading, user, db, courseId, router]);

  if (busy || loading) {
    return <div className="min-h-screen p-8"><Skeleton className="h-[60vh] max-w-4xl mx-auto" /></div>;
  }

  if (!course || !siteSettings) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-4xl p-4">
        <CertificatePageClient 
            course={course} 
            courseGroup={courseGroup} 
            settings={siteSettings}
            completionDate={completionDate}
        />
      </div>
    </div>
  );
}
