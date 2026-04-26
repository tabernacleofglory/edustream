import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  doc,
  updateDoc,
  where,
  documentId,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { Course } from "./types";

export async function runEnrollmentSync() {
  console.log("[Automation] Starting Enrollment Sync...");
  try {
    const [enrollSnap, coursesSnap] = await Promise.all([
      getDocs(collection(db, "enrollments")),
      getDocs(collection(db, "courses")),
    ]);

    const coursesMap = new Map();
    coursesSnap.docs.forEach((d) => coursesMap.set(d.id, { id: d.id, ...d.data() }));

    const enrollments = enrollSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as any[];

    const userIds = Array.from(new Set(enrollments.map(e => e.userId)));
    const progressMap = new Map<string, any>();

    const userIdChunks = [];
    for (let i = 0; i < userIds.length; i += 30) {
      userIdChunks.push(userIds.slice(i, i + 30));
    }

    for (const chunk of userIdChunks) {
      const snap = await getDocs(query(collection(db, "userContentProgress"), where(documentId(), "in", chunk)));
      snap.docs.forEach(d => progressMap.set(d.id, d.data()));
    }

    let batch = writeBatch(db);
    let opCount = 0;
    let updatesCount = 0;

    for (const enrollment of enrollments) {
      const course = coursesMap.get(enrollment.courseId) as Course;
      if (!course) continue;

      const progressData = progressMap.get(enrollment.userId) || { completedItems: {} };
      const completedItems = progressData.completedItems || {};

      const requiredIds = [
        ...(course.videos || []),
        ...(course.quizIds || []),
        ...(course.formId ? [course.formId] : [])
      ].filter(Boolean);

      if (requiredIds.length === 0) continue;

      const allCompleted = requiredIds.every(id => !!completedItems[id]);

      if (allCompleted) {
        let latestTimestamp = null;
        for (const id of requiredIds) {
          const ts = completedItems[id];
          if (!latestTimestamp || (ts && ts.toMillis() > latestTimestamp.toMillis())) {
            latestTimestamp = ts;
          }
        }

        const currentCompletedAt = enrollment.completedAt;
        const getMillis = (ts: any) => {
            if (!ts) return 0;
            if (typeof ts.toMillis === 'function') return ts.toMillis();
            if (ts instanceof Date) return ts.getTime();
            return 0;
        };

        const isDifferent = getMillis(latestTimestamp) !== getMillis(currentCompletedAt);

        if (isDifferent) {
          const enrollRef = doc(db, "enrollments", enrollment.id);
          batch.update(enrollRef, { completedAt: latestTimestamp });
          updatesCount++;
          opCount++;
          
          if (opCount >= 499) {
              await batch.commit();
              batch = writeBatch(db);
              opCount = 0;
          }
        }
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    // Update last run time in siteSettings/main
    await updateDoc(doc(db, "siteSettings", "main"), {
        "automation.lastRunAt": Timestamp.now()
    });

    console.log(`[Automation] Enrollment Sync Complete. Updated ${updatesCount} enrollments.`);
    return { success: true, updatesCount };
  } catch (error: any) {
    console.error("[Automation] Enrollment sync error:", error);
    return { success: false, error: error.message };
  }
}
