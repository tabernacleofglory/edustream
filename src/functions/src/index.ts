
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail";
import { marked } from "marked";
import { onVideoDeleted, onVideoUpdate, transcodeVideo, updateVideoOnTranscodeComplete } from "./transcoding";

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const FieldPath = admin.firestore.FieldPath;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function getVideoDurationMap(videoIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!videoIds.length) return map;

  for (const chunk of chunkArray(videoIds, 10)) {
    const snap = await db
      .collection("Contents")
      .where(FieldPath.documentId(), "in", chunk)
      .get();
    snap.forEach((doc) => {
      const dur = doc.get("duration");
      if (typeof dur === "number") {
        map.set(doc.id, Math.max(1, Math.round(dur)));
      }
    });
  }
  return map;
}

async function addFullCreditWrites(params: {
  batch: FirebaseFirestore.WriteBatch;
  userId: string;
  courseId: string;
  courseData: any;
  videoDurationCache: Map<string, number>;
}) {
  const { batch, userId, courseId, courseData, videoDurationCache } = params;

  const enrollmentRef = db.collection("enrollments").doc(`${userId}_${courseId}`);
  const enrollmentDoc = await enrollmentRef.get();

  const videoIds: string[] = Array.isArray(courseData.videos) ? courseData.videos : [];
  const videoProgress = videoIds.map((videoId: string) => ({
    videoId,
    completed: true,
    timeSpent: Math.max(1, videoDurationCache.get(videoId) ?? 1),
  }));

  batch.set(
    enrollmentRef,
    {
      userId,
      courseId,
      enrolledAt: enrollmentDoc.exists
        ? enrollmentDoc.data()?.enrolledAt ?? FieldValue.serverTimestamp()
        : FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const progressRef = db.collection("userVideoProgress").doc(`${userId}_${courseId}`);
  batch.set(
    progressRef,
    {
      userId,
      courseId,
      videoProgress,
      totalProgress: 100,
      percent: 100,
      lastWatchedVideoId: videoIds.length ? videoIds[videoIds.length - 1] : null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const quizIds: string[] = Array.isArray(courseData.quizIds) ? courseData.quizIds : [];
  quizIds.forEach((quizId) => {
    const quizResultRef = db.collection("userQuizResults").doc(`${userId}_${courseId}_${quizId}_onsite`);
    batch.set(
      quizResultRef,
      {
        userId,
        courseId,
        quizId,
        answers: null,
        score: 100,
        passed: true,
        attemptedAt: FieldValue.serverTimestamp(),
        source: "onsite",
      },
      { merge: true }
    );
  });

  if (courseData.formId) {
    const formSubmissionRef = db
      .collection("forms")
      .doc(courseData.formId)
      .collection("submissions")
      .doc(`${userId}_${courseId}_onsite`);
    batch.set(
      formSubmissionRef,
      {
        userId,
        courseId,
        formId: courseData.formId,
        submittedAt: FieldValue.serverTimestamp(),
        source: "onsite",
        data: { autoCompleted: true }
      },
      { merge: true }
    );
  }

  if (courseData.badgeEnabled) {
    const badgeRef = db.collection("userBadges").doc(`${userId}_${courseId}`);
    batch.set(
      badgeRef,
      {
        userId,
        courseId,
        badgeTitle: courseData.title,
        badgeIconUrl: courseData["Image ID"],
        earnedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  if (!enrollmentDoc.exists) {
    const courseRef = db.collection("courses").doc(courseId);
    batch.update(courseRef, { enrollmentCount: FieldValue.increment(1) });
  }
}

const REGION = "us-central1";

async function assertAdminOrDeveloper(requesterUid: string) {
  const snap = await db.doc(`users/${requesterUid}`).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("permission-denied", "Requester profile not found.");
  }
  const role = snap.get("role");
  const ok = role === "admin" || role === "developer";
  if (!ok) {
    throw new functions.https.HttpsError("permission-denied", "Only admins or developers can perform this action.");
  }
}

export const createUsersFromSubmissions = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to perform this action."
      );
    }
    await assertAdminOrDeveloper(context.auth.uid);

    const formId = String(data?.formId || "").trim();
    const submissionIds: string[] = Array.isArray(data?.submissionIds)
      ? data.submissionIds.map((x: any) => String(x || "").trim()).filter(Boolean)
      : [];

    if (!formId || submissionIds.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "formId and an array of submissionIds are required."
      );
    }

    const formDoc = await db.doc(`forms/${formId}`).get();
    if (!formDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Form configuration not found."
      );
    }
    const formConfig = formDoc.data()!;
    const fields: any[] = Array.isArray(formConfig.fields) ? formConfig.fields : [];

    const emailField = fields.find((f: any) => f?.userProfileField === "email");
    if (!emailField?.fieldId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Form has no linked email field."
      );
    }
    
    const laddersSnap = await db.collection("courseLevels").orderBy("order").get();
    const allLadders = laddersSnap.docs.map(d => ({id: d.id, ...d.data()}));
    const defaultLadder = allLadders.length > 0 ? allLadders[0] : null;

    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const errors: Array<{ submissionId: string; error: string }> = [];
    const results: Array<{
      submissionId: string;
      status: "created" | "updated" | "skipped";
      uid: string;
      email: string;
      passwordResetLink?: string | null;
    }> = [];

    for (const submissionId of submissionIds) {
      try {
        const submissionRef = db.doc(`forms/${formId}/submissions/${submissionId}`);
        const submissionDoc = await submissionRef.get();

        if (!submissionDoc.exists) {
          errors.push({ submissionId, error: "Submission not found." });
          errorCount++;
          continue;
        }

        const submissionData = submissionDoc.data()!;

        if (submissionData.userId) {
          skippedCount++;
          results.push({
            submissionId,
            status: "skipped",
            uid: submissionData.userId,
            email: String(submissionData?.data?.[emailField.fieldId] || "").trim(),
          });
          continue;
        }

        const emailRaw = submissionData.data?.[emailField.fieldId];
        const email = String(emailRaw || "").trim().toLowerCase();

        if (!email) {
          errors.push({ submissionId, error: "Email not provided in submission." });
          errorCount++;
          continue;
        }

        const userProfileUpdates: Record<string, any> = {};
        fields.forEach((field: any) => {
          if (field?.userProfileField && submissionData.data?.[field.fieldId] !== undefined) {
            userProfileUpdates[field.userProfileField] = submissionData.data[field.fieldId];
          }
        });

        const displayName = `${userProfileUpdates.firstName || ""} ${userProfileUpdates.lastName || ""}`.trim();

        let existingUser: admin.auth.UserRecord | null = null;
        try {
          existingUser = await admin.auth().getUserByEmail(email);
        } catch (e: any) {
          if (e?.code !== "auth/user-not-found") throw e;
        }

        if (existingUser) {
          const uid = existingUser.uid;
          if (displayName) {
            await admin.auth().updateUser(uid, { displayName });
          }
          const userRef = db.doc(`users/${uid}`);
          const userSnap = await userRef.get();
          const existingProfile = userSnap.exists ? (userSnap.data() || {}) : {};
          
          const finalUpdate = {...userProfileUpdates};
          if (finalUpdate.classLadderId) {
            let ladder = allLadders.find(l => l.id === finalUpdate.classLadderId);
            if (!ladder) {
                ladder = allLadders.find(l => l.name === finalUpdate.classLadderId);
            }
            if(ladder) {
                finalUpdate.classLadder = ladder.name;
                finalUpdate.classLadderId = ladder.id;
            }
          }

          await userRef.set(
            {
              ...finalUpdate,
              uid,
              id: uid,
              email,
              displayName: displayName || existingProfile.displayName || null,
              updatedAt: FieldValue.serverTimestamp(),
              role: existingProfile.role ?? "user",
              createdAt: existingProfile.createdAt ?? FieldValue.serverTimestamp(),
              classLadderId: finalUpdate.classLadderId ?? existingProfile.classLadderId ?? (defaultLadder?.id || null),
              classLadder: finalUpdate.classLadder ?? existingProfile.classLadder ?? (defaultLadder?.name || "New Member"),
            },
            { merge: true }
          );

          await submissionRef.update({
            userId: uid,
            updatedBy: context.auth.uid,
            linkedAt: FieldValue.serverTimestamp(),
          });

          updatedCount++;
          successCount++;
          results.push({ submissionId, status: "updated", uid, email });
          continue;
        }

        const password = Math.random().toString(36).slice(-10);
        const newUserRecord = await admin.auth().createUser({
          email,
          password,
          displayName: displayName || undefined,
        });

        const uid = newUserRecord.uid;
        let finalLadderId = userProfileUpdates.classLadderId || defaultLadder?.id || null;
        let finalLadderName = "New Member";
        let ladder = allLadders.find(l => l.id === finalLadderId);
        if (!ladder) ladder = allLadders.find(l => l.name === finalLadderId);
        if (ladder) {
            finalLadderId = ladder.id;
            finalLadderName = ladder.name;
        } else if (defaultLadder) {
            finalLadderId = defaultLadder.id;
            finalLadderName = defaultLadder.name;
        }

        const newUserProfile = {
          ...userProfileUpdates,
          uid,
          id: uid,
          email,
          displayName: displayName || null,
          role: "user",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          classLadderId: finalLadderId,
          classLadder: finalLadderName,
        };

        await db.doc(`users/${uid}`).set(newUserProfile, { merge: true });
        await submissionRef.update({
          userId: uid,
          createdBy: context.auth.uid,
          linkedAt: FieldValue.serverTimestamp(),
        });

        let passwordResetLink: string | null = null;
        try {
          passwordResetLink = await admin.auth().generatePasswordResetLink(email);
        } catch (linkErr) {
          functions.logger.warn(`User ${uid} created, but failed to generate reset link.`, linkErr);
        }

        createdCount++;
        successCount++;
        results.push({ submissionId, status: "created", uid, email, passwordResetLink });
      } catch (error: any) {
        errorCount++;
        errors.push({ submissionId, error: error?.message || String(error) });
        functions.logger.error(`Failed to process submission ${submissionId}:`, error);
      }
    }

    return { success: true, successCount, createdCount, updatedCount, skippedCount, errorCount, errors, results };
  });

export const deleteUserAccount = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const requesterUid = context.auth?.uid;
    if (!requesterUid) {
      throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
    }
    await assertAdminOrDeveloper(requesterUid);
    const uidToDelete = String(data?.uid || "");
    if (!uidToDelete) {
      throw new functions.https.HttpsError("invalid-argument", 'Missing "uid".');
    }
    if (uidToDelete === requesterUid) {
      throw new functions.https.HttpsError("failed-precondition", "Cannot delete self.");
    }
    try {
      await admin.auth().deleteUser(uidToDelete);
      await db.doc(`users/${uidToDelete}`).delete();
      return { success: true };
    } catch (err: any) {
      throw new functions.https.HttpsError("internal", err.message);
    }
  });
  
export const syncUserGlobalProgress = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Unauthenticated.");
    await assertAdminOrDeveloper(context.auth.uid);
    const { userId } = data;
    if (!userId) throw new functions.https.HttpsError("invalid-argument", "Missing userId.");
    try {
      const videoProgressSnap = await db.collection("userVideoProgress").where("userId", "==", userId).get();
      const quizResultsSnap = await db.collection("userQuizResults").where("userId", "==", userId).where("passed", "==", true).get();
      const legacyCompletions = new Set<string>();
      videoProgressSnap.forEach(doc => {
        const progressData = doc.data();
        if (Array.isArray(progressData.videoProgress)) {
          progressData.videoProgress.forEach((vp: any) => { if (vp.completed) legacyCompletions.add(vp.videoId); });
        }
      });
      quizResultsSnap.forEach(doc => { legacyCompletions.add(doc.data().quizId); });
      const globalProgressRef = db.doc(`userContentProgress/${userId}`);
      const globalProgressSnap = await globalProgressRef.get();
      const globalCompletedItems = new Set<string>(globalProgressSnap.exists ? Object.keys(globalProgressSnap.data()?.completedItems || {}) : []);
      const itemsToMigrate: Record<string, any> = {};
      let migratedCount = 0;
      legacyCompletions.forEach(id => {
        if (!globalCompletedItems.has(id)) {
          itemsToMigrate[`completedItems.${id}`] = FieldValue.serverTimestamp();
          migratedCount++;
        }
      });
      if (migratedCount > 0) await globalProgressRef.set(itemsToMigrate, { merge: true });
      return { success: true, migratedCount };
    } catch (error) {
      throw new functions.https.HttpsError("internal", "Sync failed.");
    }
  });

export const reevaluateQuizSubmissions = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Unauthenticated.");
    await assertAdminOrDeveloper(context.auth.uid);
    const resultIds: string[] = data.resultIds;
    if (!Array.isArray(resultIds) || resultIds.length === 0) throw new functions.https.HttpsError("invalid-argument", "Missing resultIds.");
    const batch = db.batch();
    const quizCache = new Map<string, any>();
    let updatedCount = 0;
    const usersAndCoursesToRecheck = new Map<string, Set<string>>();
    for (const resultId of resultIds) {
        const resultRef = db.doc(`userQuizResults/${resultId}`);
        const resultDoc = await resultRef.get();
        if (!resultDoc.exists) continue;
        const submission = resultDoc.data()!;
        let quizData = quizCache.get(submission.quizId);
        if (!quizData) {
            const quizDoc = await db.doc(`quizzes/${submission.quizId}`).get();
            if (quizDoc.exists) { quizData = quizDoc.data(); quizCache.set(submission.quizId, quizData); }
            else continue;
        }
        const newPassThreshold = quizData.passThreshold ?? 70;
        const newStatus = submission.score >= newPassThreshold;
        if (newStatus !== submission.passed) {
            batch.update(resultRef, { passed: newStatus });
            updatedCount++;
            if (newStatus === true) {
                if (!usersAndCoursesToRecheck.has(submission.userId)) usersAndCoursesToRecheck.set(submission.userId, new Set());
                usersAndCoursesToRecheck.get(submission.userId)!.add(submission.courseId);
            }
        }
    }
    if (updatedCount > 0) await batch.commit();
    if (usersAndCoursesToRecheck.size > 0) {
        const courseCompletionBatch = db.batch();
        for (const [userId, courseIds] of usersAndCoursesToRecheck.entries()) {
            for (const courseId of courseIds) {
                 const courseDoc = await db.doc(`courses/${courseId}`).get();
                if (!courseDoc.exists) continue;
                const courseData = courseDoc.data() as any;
                const requiredVideos = courseData.videos || [];
                const requiredQuizzes = courseData.quizIds || [];
                let allVideosWatched = false;
                if (requiredVideos.length > 0) {
                    const progressDoc = await db.doc(`userVideoProgress/${userId}_${courseId}`).get();
                    if (progressDoc.exists) {
                        const videoProgress = progressDoc.data()?.videoProgress || [];
                        const completedVideos = videoProgress.filter((v: any) => v.completed).map((v: any) => v.videoId);
                        allVideosWatched = requiredVideos.every((vid: string) => completedVideos.includes(vid));
                    }
                } else allVideosWatched = true;
                if (!allVideosWatched) continue;
                let allQuizzesPassed = false;
                if (requiredQuizzes.length > 0) {
                    const quizResultsSnap = await db.collection('userQuizResults').where('userId', '==', userId).where('courseId', '==', courseId).where('passed', '==', true).get();
                    const passedQuizIds = new Set(quizResultsSnap.docs.map(d => d.data().quizId));
                    allQuizzesPassed = requiredQuizzes.every((qid: string) => passedQuizIds.has(qid));
                } else allQuizzesPassed = true;
                if (allVideosWatched && allQuizzesPassed) {
                    const enrollmentRef = db.doc(`enrollments/${userId}_${courseId}`);
                    courseCompletionBatch.set(enrollmentRef, { completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                }
            }
        }
        await courseCompletionBatch.commit();
    }
    return { success: true, updatedCount };
});

export const processFormSubmission = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    try {
      const { formId, submissionId: explicitSubmissionId } = data;
      if (!formId) throw new functions.https.HttpsError("invalid-argument", "formId required.");
      
      const db = admin.firestore();
      
      const submissionsCol = db.collection('forms').doc(formId).collection('submissions');
      let submissionDoc;
      if (explicitSubmissionId) {
          submissionDoc = await submissionsCol.doc(explicitSubmissionId).get();
      } else {
          const snap = await submissionsCol.orderBy('submittedAt', 'desc').limit(1).get();
          if (!snap.empty) submissionDoc = snap.docs[0];
      }

      if (!submissionDoc?.exists) {
        functions.logger.warn(`No submission found for form ${formId}`);
        return { success: false, message: "No submission found." };
      }
      const submissionData = submissionDoc.data()!;
      const submissionFields = submissionData.data || submissionData;

      const formDoc = await db.doc(`forms/${formId}`).get();
      if (!formDoc.exists) throw new functions.https.HttpsError("not-found", "Form not found.");
      const formConfig = formDoc.data()!;

      const emailFieldConfig = formConfig.fields.find((f: any) => f.userProfileField === 'email' || f.type === 'email');
      const email = String(submissionFields[emailFieldConfig?.fieldId] || submissionData.userEmail || '').trim().toLowerCase();

      let userId = submissionData.userId;
      let userProfile: any = null;

      if (formConfig.autoSignup && email) {
          let userRecord;
          try { userRecord = await admin.auth().getUserByEmail(email); } catch (e) {}

          const profileUpdates: Record<string, any> = {};
          formConfig.fields.forEach((f: any) => {
              if (f.userProfileField && submissionFields[f.fieldId] !== undefined) {
                  profileUpdates[f.userProfileField] = submissionFields[f.fieldId];
              }
          });

          if (userRecord) {
              userId = userRecord.uid;
              await db.doc(`users/${userId}`).update(profileUpdates);
              const updatedSnap = await db.doc(`users/${userId}`).get();
              userProfile = updatedSnap.data();
          } else {
              const pwd = Math.random().toString(36).slice(-8);
              const newUser = await admin.auth().createUser({
                  email, password: pwd,
                  displayName: `${profileUpdates.firstName || ''} ${profileUpdates.lastName || ''}`.trim()
              });
              userId = newUser.uid;
              const defaultLadder = (await db.collection("courseLevels").orderBy("order").limit(1).get()).docs[0]?.data();
              userProfile = {
                  ...profileUpdates, uid: userId, id: userId, email, role: 'user',
                  createdAt: FieldValue.serverTimestamp(),
                  classLadderId: profileUpdates.classLadderId || defaultLadder?.id || null,
                  classLadder: profileUpdates.classLadder || defaultLadder?.name || "New Member"
              };
              await db.doc(`users/${userId}`).set(userProfile);
          }
          await submissionDoc.ref.update({ userId });
      } else if (userId) {
          const userSnap = await db.doc(`users/${userId}`).get();
          if (userSnap.exists) userProfile = userSnap.data();
      }

      if (formConfig.emailConfirmationEnabled && formConfig.emailTemplateId && email) {
          const templateSnap = await db.doc(`emailTemplates/${formConfig.emailTemplateId}`).get();
          if (templateSnap.exists) {
              const template = templateSnap.data()!;
              let subject = template.subject || '';
              let body = template.body || '';

              const resolve = (text: string) => {
                  let t = text;
                  const placeholders: any = {
                      userName: userProfile?.displayName || userProfile?.firstName || 'User',
                      firstName: userProfile?.firstName || '',
                      lastName: userProfile?.lastName || '',
                      email: userProfile?.email || email,
                      phoneNumber: userProfile?.phoneNumber || '',
                      campus: userProfile?.campus || '',
                      classLadder: userProfile?.classLadder || '',
                  };
                  Object.entries(placeholders).forEach(([k, v]) => {
                      t = t.replace(new RegExp(`{{${k}}}`, "g"), String(v || ''));
                  });
                  t = t.replace(/{{form:[^:]+:([^}]+)}}/g, (match, fieldId) => {
                      const v = submissionFields[fieldId];
                      return v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v);
                  });
                  t = t.replace(/{{formTitle:[^}]+}}/g, formConfig.title || '');
                  return t;
              };

              const resolvedSubject = resolve(subject);
              const resolvedBody = resolve(body);
              const htmlContent = marked.parse(resolvedBody, { breaks: true });

              const layoutSnap = await db.doc("siteSettings/emailLayout").get();
              const layout = layoutSnap.exists ? layoutSnap.data() as any : null;

              let finalHtml = `<div style="font-family:sans-serif;line-height:1.5;color:#2d3748;">${htmlContent}</div>`;
              
              if (layout) {
                  const headerTitle = layout.headerTitle || "Glory Training Hub";
                  const headerSlogan = layout.headerSlogan || "Forming Solid disciples for Christ";
                  const headerLogo = layout.headerLogoUrl || "";
                  const bgStart = layout.headerGradientStart || "#004d40";
                  const bgEnd = layout.headerGradientEnd || "#00897b";
                  const bodyBg = layout.bodyBgColor || "#f4f4f4";
                  const cardBg = layout.cardBgColor || "#ffffff";
                  const btnColor = layout.buttonColor || "#00897b";
                  const btnTextColor = layout.buttonTextColor || "#ffffff";
                  const footer = layout.footerText || "";
                  const preHeader = layout.preHeaderText || "";
                  const btnText = layout.buttonText || "Continue Courses";
                  const btnUrl = layout.buttonUrl || "https://gloryhub.net/dashboard";

                  finalHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${headerTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${bodyBg}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <div style="padding: 40px 20px;">
        ${preHeader ? `<div style="text-align: center; margin-bottom: 20px; font-weight: bold; color: ${bgStart}; text-transform: uppercase; font-size: 12px;">${preHeader}</div>` : ''}
        <div style="max-width: 600px; margin: 0 auto; background-color: ${cardBg}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(to right, ${bgStart}, ${bgEnd}); padding: 40px 20px; text-align: center; color: #ffffff;">
                <img src="${headerLogo}" alt="Logo" style="height: 60px; margin-bottom: 20px;">
                <h1 style="margin: 0; font-size: 24px;">${headerTitle}</h1>
                <p style="margin: 10px 0 0; font-style: italic; font-size: 14px;">${headerSlogan}</p>
            </div>
            <div style="padding: 40px; line-height: 1.6; color: #333333;">
                ${htmlContent}
                <div style="text-align: center; margin-top: 40px;">
                    <a href="${btnUrl}" style="background-color: ${btnColor}; color: ${btnTextColor}; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">${btnText}</a>
                </div>
            </div>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #888888; font-size: 12px;">
            ${footer}
        </div>
    </div>
</body>
</html>
                  `;
              }

              const sgMail = require("@sendgrid/mail");
              sgMail.setApiKey(functions.config().sendgrid.key);

              try {
                await sgMail.send({
                  to: email,
                  from: template.fromEmail || "glorytraining@tabernacleofglory.net",
                  subject: resolvedSubject,
                  html: finalHtml,
                });
                functions.logger.log("Email sent to", email);
              } catch (error: any) {
                functions.logger.error("Error sending email:", error.message, error);
                throw new functions.https.HttpsError("internal", "Failed to send email.");
              }
          }
      }

      return { success: true };
    } catch (error: any) {
      functions.logger.error("Error processing form submission:", error.message, error);
      throw new functions.https.HttpsError("internal", error.message || "An unexpected error occurred.");
    }
});
  
export const enrollInCourse = functions
  .runWith({ memory: "512MB" })
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required.");
    const userId = context.auth.uid;
    const courseId = data.courseId;
    if (!courseId) throw new functions.https.HttpsError("invalid-argument", "Missing ID.");
    try {
      const enrollmentRef = db.collection("enrollments").doc(`${userId}_${courseId}`);
      const courseRef = db.collection("courses").doc(courseId);
      await db.runTransaction(async (transaction) => {
        const enrollmentDoc = await transaction.get(enrollmentRef);
        if (enrollmentDoc.exists) return;
        transaction.set(enrollmentRef, { userId, courseId, enrolledAt: admin.firestore.FieldValue.serverTimestamp() });
        transaction.update(courseRef, { enrollmentCount: admin.firestore.FieldValue.increment(1) });
      });
      return { success: true };
    } catch (error) { throw new functions.https.HttpsError("internal", "Enroll failed."); }
  });

export const sendCertificateEmail = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const sgKey = functions.config().sendgrid?.key;
    if (!sgKey) throw new functions.https.HttpsError("failed-precondition", "Missing SG key.");
    sgMail.setApiKey(sgKey);
    const msg = {
      to: data.email, from: "glorytraining@tabernacleofglory.net",
      subject: `Your Certificate for ${data.courseName}`,
      html: `<h1>Congratulations!</h1><p>You completed ${data.courseName}.</p><a href="${data.certificateUrl}">View Certificate</a>`
    };
    try { await sgMail.send(msg); return { success: true }; }
    catch (error) { throw new functions.https.HttpsError("internal", "Email failed."); }
  });

export { onVideoDeleted, onVideoUpdate, transcodeVideo, updateVideoOnTranscodeComplete };
