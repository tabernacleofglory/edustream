"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { Course, Enrollment } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import CertificatePageClient from "@/components/certificate-page-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function CertificatePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const db = getFirebaseFirestore();
  const [course, setCourse] = useState<Course | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }

    (async () => {
      setBusy(true);
      const cSnap = await getDoc(doc(db, "courses", courseId));
      if (!cSnap.exists()) { router.replace("/courses"); return; }
      const eSnap = await getDoc(doc(db, "enrollments", `${user.uid}_${courseId}`));
      const completed = !!(eSnap.exists() && (eSnap.data() as Enrollment).completedAt);
      if (!completed) { router.replace("/courses"); return; }
      setCourse({ id: cSnap.id, ...cSnap.data() } as Course);
      setBusy(false);
    })();
  }, [loading, user, db, courseId, router]);

  if (busy || loading) {
    return <div className="min-h-screen p-8"><Skeleton className="h-[60vh] max-w-4xl mx-auto" /></div>;
  }

  if (!course) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-4xl p-4">
        <CertificatePageClient course={course} />
      </div>
    </div>
  );
}
