

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail";
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

// ---- helpers ----------------------------------------------------

const REGION = "us-central1"; // change if you deploy elsewhere

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

// ---- user management functions ----------------------------------

export const deleteUserAccount = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const requesterUid = context.auth?.uid;
    if (!requesterUid) {
      throw new functions.https.HttpsError("unauthenticated", "You must be signed in to perform this action.");
    }

    await assertAdminOrDeveloper(requesterUid);

    const uidToDelete = String(data?.uid || "");
    if (!uidToDelete) {
      throw new functions.https.HttpsError("invalid-argument", 'The function must be called with a "uid" argument.');
    }

    if (uidToDelete === requesterUid) {
      throw new functions.https.HttpsError("failed-precondition", "You cannot delete your own account.");
    }

    try {
      await admin.auth().deleteUser(uidToDelete);
      functions.logger.log(`Successfully deleted user ${uidToDelete} from Firebase Authentication.`);
      
      await db.doc(`users/${uidToDelete}`).delete();
      functions.logger.log(`Successfully deleted user document for ${uidToDelete} from Firestore.`);
      
      return { success: true, message: `Successfully deleted user ${uidToDelete}.` };

    } catch (err: any) {
      functions.logger.error(`Error during deletion of user ${uidToDelete}:`, err);
      if (err instanceof functions.https.HttpsError) throw err;
      throw new functions.https.HttpsError("internal", err.message || "An unknown error occurred during deletion.");
    }
  });

// ---- Manual Quiz Re-evaluation ----

export const reevaluateQuizSubmissions = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }
    await assertAdminOrDeveloper(context.auth.uid);

    const resultIds: string[] = data.resultIds;
    if (!Array.isArray(resultIds) || resultIds.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "An array of resultIds must be provided.");
    }

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
            if (quizDoc.exists) {
                quizData = quizDoc.data();
                quizCache.set(submission.quizId, quizData);
            } else {
                continue; // Skip if quiz doesn't exist
            }
        }

        const newPassThreshold = quizData.passThreshold ?? 70;
        const newStatus = submission.score >= newPassThreshold;

        if (newStatus !== submission.passed) {
            batch.update(resultRef, { passed: newStatus });
            updatedCount++;
            if (newStatus === true) {
                if (!usersAndCoursesToRecheck.has(submission.userId)) {
                    usersAndCoursesToRecheck.set(submission.userId, new Set());
                }
                usersAndCoursesToRecheck.get(submission.userId)!.add(submission.courseId);
            }
        }
    }

    if (updatedCount > 0) {
        await batch.commit();
        functions.logger.log(`Manually re-evaluated and updated ${updatedCount} submissions.`);
    }

    // Now, re-check course completions if any statuses were changed to 'passed'.
    if (usersAndCoursesToRecheck.size > 0) {
        const courseCompletionBatch = db.batch();
        for (const [userId, courseIds] of usersAndCoursesToRecheck.entries()) {
            for (const courseId of courseIds) {
                 const courseDoc = await db.doc(`courses/${courseId}`).get();
                if (!courseDoc.exists) continue;
                
                const courseData = courseDoc.data() as any;
                const requiredVideos = courseData.videos || [];
                const requiredQuizzes = courseData.quizIds || [];

                // Check video progress
                let allVideosWatched = false;
                if (requiredVideos.length > 0) {
                    const progressDoc = await db.doc(`userVideoProgress/${userId}_${courseId}`).get();
                    if (progressDoc.exists) {
                        const videoProgress = progressDoc.data()?.videoProgress || [];
                        const completedVideos = videoProgress.filter((v: any) => v.completed).map((v: any) => v.videoId);
                        allVideosWatched = requiredVideos.every((vid: string) => completedVideos.includes(vid));
                    }
                } else {
                    allVideosWatched = true;
                }

                if (!allVideosWatched) continue;

                // Check quiz progress
                let allQuizzesPassed = false;
                if (requiredQuizzes.length > 0) {
                    const quizResultsSnap = await db.collection('userQuizResults')
                        .where('userId', '==', userId)
                        .where('courseId', '==', courseId)
                        .where('passed', '==', true)
                        .get();
                    const passedQuizIds = new Set(quizResultsSnap.docs.map(d => d.data().quizId));
                    allQuizzesPassed = requiredQuizzes.every((qid: string) => passedQuizIds.has(qid));
                } else {
                    allQuizzesPassed = true;
                }

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

  
// ---- Quiz Pass/Fail Re-evaluation ----

export const onQuizUpdate = functions.firestore
  .document('quizzes/{quizId}')
  .onUpdate(async (change: functions.Change<FirebaseFirestore.DocumentSnapshot>, context: functions.EventContext) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const { quizId } = context.params;

    // Check if passThreshold has changed
    if (beforeData.passThreshold === afterData.passThreshold) {
      functions.logger.log(`Quiz ${quizId} updated, but passThreshold did not change. Skipping re-evaluation.`);
      return null;
    }

    const newPassThreshold = afterData.passThreshold ?? 70;
    functions.logger.log(`Re-evaluating submissions for quiz ${quizId} with new pass threshold: ${newPassThreshold}%`);

    const submissionsQuery = db.collection('userQuizResults').where('quizId', '==', quizId);
    
    try {
      const snapshot = await submissionsQuery.get();
      if (snapshot.empty) {
        functions.logger.log(`No submissions found for quiz ${quizId}.`);
        return null;
      }
      
      const batch = db.batch();
      let updatedCount = 0;
      const usersAndCoursesToRecheck = new Map<string, Set<string>>();


      snapshot.forEach(doc => {
        const submission = doc.data();
        const currentScore = submission.score;
        const currentStatus = submission.passed;

        const newStatus = currentScore >= newPassThreshold;

        if (newStatus !== currentStatus) {
          batch.update(doc.ref, { passed: newStatus });
          updatedCount++;
           if (newStatus === true) { // Only re-check course completion if they now pass
              if (!usersAndCoursesToRecheck.has(submission.userId)) {
                usersAndCoursesToRecheck.set(submission.userId, new Set());
              }
              usersAndCoursesToRecheck.get(submission.userId)!.add(submission.courseId);
          }
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
        functions.logger.log(`Successfully re-evaluated and updated ${updatedCount} submissions for quiz ${quizId}.`);
      } else {
        functions.logger.log(`No submission statuses needed to be changed for quiz ${quizId}.`);
      }

      if (usersAndCoursesToRecheck.size === 0) {
        return null; // No need to check course completions
      }

      // --- Re-check overall course completion for affected users ---
      functions.logger.log(`Found ${usersAndCoursesToRecheck.size} users whose course completion status may have changed.`);
      const courseCompletionBatch = db.batch();
      
      for (const [userId, courseIds] of usersAndCoursesToRecheck.entries()) {
          for (const courseId of courseIds) {
              const courseDoc = await db.doc(`courses/${courseId}`).get();
              if (!courseDoc.exists) continue;

              const courseData = courseDoc.data() as any;
              const requiredVideos = courseData.videos || [];
              const requiredQuizzes = courseData.quizIds || [];

              // 1. Check video progress
              let allVideosWatched = false;
              if (requiredVideos.length > 0) {
                  const progressDoc = await db.doc(`userVideoProgress/${userId}_${courseId}`).get();
                  if (progressDoc.exists) {
                      const videoProgress = progressDoc.data()?.videoProgress || [];
                      const completedVideos = videoProgress.filter((v: any) => v.completed).map((v: any) => v.videoId);
                      allVideosWatched = requiredVideos.every((vid: string) => completedVideos.includes(vid));
                  }
              } else {
                  allVideosWatched = true; // No videos required
              }
              
              if (!allVideosWatched) continue; // If videos aren't done, no need to check quizzes

              // 2. Check quiz progress
              let allQuizzesPassed = false;
              if (requiredQuizzes.length > 0) {
                  const quizResultsSnap = await db.collection('userQuizResults')
                      .where('userId', '==', userId)
                      .where('courseId', '==', courseId)
                      .where('passed', '==', true)
                      .get();
                  const passedQuizIds = new Set(quizResultsSnap.docs.map(d => d.data().quizId));
                  allQuizzesPassed = requiredQuizzes.every((qid: string) => passedQuizIds.has(qid));
              } else {
                  allQuizzesPassed = true; // No quizzes required
              }

              // 3. If all conditions met, update enrollment
              if (allVideosWatched && allQuizzesPassed) {
                  const enrollmentRef = db.doc(`enrollments/${userId}_${courseId}`);
                  courseCompletionBatch.set(enrollmentRef, { completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                  functions.logger.log(`Marking course ${courseId} as complete for user ${userId}.`);
              }
          }
      }

      await courseCompletionBatch.commit();


    } catch (error) {
      functions.logger.error(`Error re-evaluating quiz submissions for ${quizId}:`, error);
    }
    
    return null;
  });


// ---- enroll in course -------------------------------------------

export const enrollInCourse = functions
  .runWith({ memory: "512MB" })
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to enroll.");
    }

    const userId = context.auth.uid;
    const courseId = data.courseId;

    if (!courseId) {
      throw new functions.https.HttpsError("invalid-argument", "Course ID is required.");
    }

    try {
      const enrollmentRef = db.collection("enrollments").doc(`${userId}_${courseId}`);
      const courseRef = db.collection("courses").doc(courseId);

      await db.runTransaction(async (transaction) => {
        const enrollmentDoc = await transaction.get(enrollmentRef);
        if (enrollmentDoc.exists) return;
        transaction.set(enrollmentRef, {
          userId,
          courseId,
          enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(courseRef, { enrollmentCount: admin.firestore.FieldValue.increment(1) });
      });

      return { success: true, message: "Successfully enrolled in the course." };
    } catch (error) {
      functions.logger.error("Error enrolling in course:", error);
      throw new functions.https.HttpsError("internal", "An error occurred while enrolling in the course.");
    }
  });

// ---- email functions --------------------------------------------

export const sendCertificateEmail = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const sendgridApiKey = functions.config().sendgrid?.key;
    if (!sendgridApiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "SendGrid API key is not set in the environment configuration."
      );
    }
    sgMail.setApiKey(sendgridApiKey);

    const msg = {
      to: data.email,
      from: "glorytraining@tabernacleofglory.net",
      subject: `Your Certificate for ${data.courseName}`,
      html: `
            <h1>Congratulations, ${data.userName}!</h1>
            <p>You have successfully completed the course: <strong>${data.courseName}</strong>.</p>
            <p>You can view and download your certificate of completion here:</p>
            <a href="${data.certificateUrl}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Certificate</a>
            <br/><br/>
            <p>Thank you for your dedication and hard work!</p>
        `,
    };

    try {
      await sgMail.send(msg);
      return { success: true };
    } catch (error) {
      functions.logger.error("Error sending certificate email:", error);
      throw new functions.https.HttpsError("internal", "An error occurred while trying to send the email.");
    }
  });

export const sendHpFollowUp = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const sendgridApiKey = functions.config().sendgrid?.key;
    if (!sendgridApiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "SendGrid API key is not set in the environment configuration."
      );
    }
    sgMail.setApiKey(sendgridApiKey);

    const msg = {
      to: data.email,
      from: "glorytraining@tabernacleofglory.net", // verified sender
      subject: "HP Placement Request Received",
      html: `
            <h1>Hello, ${data.name}!</h1>
            <p>We are happy to inform you that we have received your request and are beginning the follow-up process to place you in an HP (Prayer Group).</p>
            <p>We will be in touch with further updates soon.</p>
            <br/>
            <p>Thank you!</p>
            <p>The Glory Training Hub Team</p>
        `,
    };

    try {
      await sgMail.send(msg);
      return { success: true, message: "Follow-up email sent successfully." };
    } catch (error) {
      functions.logger.error("Error sending HP follow-up email:", error);
      throw new functions.https.HttpsError("internal", "An error occurred while trying to send the email.");
    }
  });

export const sendEmailViaAppsheet = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const requesterUid = context.auth?.uid;
    if (!requesterUid) {
      throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
    }
    await assertAdminOrDeveloper(requesterUid);

    const { userId, templateId } = data;
    if (!userId || !templateId) {
      throw new functions.https.HttpsError("invalid-argument", "Both userId and templateId are required.");
    }

    const appsheetWebhookUrl = functions.config().appsheet?.webhook_url;
    if (!appsheetWebhookUrl) {
      throw new functions.https.HttpsError("failed-precondition", "AppSheet webhook URL is not configured.");
    }

    try {
      // Fetch user data
      const userDoc = await db.doc(`users/${userId}`).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found.");
      }
      const userData = userDoc.data()!;

      // Fetch email template
      const templateDoc = await db.doc(`emailTemplates/${templateId}`).get();
      if (!templateDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Email template not found.");
      }
      const templateData = templateDoc.data()!;

      // Basic variable substitution
      let subject = templateData.subject || "";
      let body = templateData.body || "";
      for (const key in userData) {
        const regex = new RegExp(`{{${key}}}`, "g");
        subject = subject.replace(regex, userData[key]);
        body = body.replace(regex, userData[key]);
      }
      // Add a special case for userName
      subject = subject.replace(/{{userName}}/g, userData.displayName || userData.firstName || '');
      body = body.replace(/{{userName}}/g, userData.displayName || userData.firstName || '');


      // Prepare data payload for AppSheet
      const payload = {
        to: userData.email,
        subject: subject,
        body: body,
        // You can add any other user data AppSheet might need
        userData: userData,
      };

      // Send data to AppSheet webhook
      const response = await fetch(appsheetWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new functions.https.HttpsError("internal", `AppSheet API returned status ${response.status}`);
      }

      return { success: true, message: "Email request sent to AppSheet successfully." };
    } catch (error) {
      functions.logger.error("Error sending email via AppSheet:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "An internal error occurred.");
    }
  });


// ---- completions ------------------------------------------------

export const setCourseCompletions = functions
  .runWith({ memory: "512MB" })
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
    }
    await assertAdminOrDeveloper(context.auth.uid);

    const { userId, completions } = data;
    if (!userId || !Array.isArray(completions)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        'Invalid data provided. "userId" and "completions" array are required.'
      );
    }

    const adminUser = await admin.auth().getUser(context.auth.uid);

    try {
      const batch = db.batch();
      const coursesRef = db.collection("courses");
      const userRef = db.collection("users").doc(userId);

      const [allCoursesSnap, userDoc] = await Promise.all([coursesRef.get(), userRef.get()]);

      const coursesMap = new Map(allCoursesSnap.docs.map((doc) => [doc.id, doc.data()]));
      const userData = userDoc.data();

      const newCompletions = completions.filter((c: any) => c.isCompleted);

      const videoIdsToFetch = new Set<string>();
      newCompletions.forEach((c: any) => {
        const courseData: any = coursesMap.get(c.courseId);
        if (courseData?.videos) {
          (courseData.videos as string[]).forEach((v: string) => videoIdsToFetch.add(v));
        }
      });
      const videoDurationCache = await getVideoDurationMap(Array.from(videoIdsToFetch));

      for (const completion of newCompletions) {
        const courseData: any = coursesMap.get(completion.courseId);
        if (!courseData) {
          functions.logger.warn(
            `Course data not found for courseId: ${completion.courseId}. Skipping.`
          );
          continue;
        }

        // If marked as onsite, create a log entry
        if (completion.isOnsite) {
          const onsiteRef = db.collection("onsiteCompletions").doc();
          batch.set(onsiteRef, {
            userId,
            userName: userData?.displayName,
            userCampus: userData?.campus,
            courseId: completion.courseId,
            courseName: courseData.title,
            completedAt: FieldValue.serverTimestamp(),
            markedBy: adminUser.displayName || adminUser.email,
          });
        }

        await addFullCreditWrites({
          batch,
          userId,
          courseId: completion.courseId,
          courseData,
          videoDurationCache,
        });
      }

      await batch.commit();
      return { success: true, message: "User's course completions have been updated." };
    } catch (error) {
      functions.logger.error("Error setting course completions:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An internal error occurred while updating completions."
      );
    }
  });

// ---- video sync/transcoding exports -----------------------------

export const onOnsiteCompletionCreate = functions
  .region(REGION)
  .firestore.document("onsiteCompletions/{completionId}")
  .onCreate(async (snap: FirebaseFirestore.DocumentSnapshot, context: functions.EventContext) => {
    const data = snap.data() || {};
    const userId = data.userId as string | undefined;
    const courseId = data.courseId as string | undefined;

    if (!userId || !courseId) {
      functions.logger.warn("onsiteCompletions entry missing userId or courseId; skipping credit application.");
      return null;
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      functions.logger.warn(`Course ${courseId} not found while applying onsite credit.`);
      return null;
    }

    const courseData = courseDoc.data() || {};
    const videoIds: string[] = Array.isArray(courseData.videos) ? courseData.videos : [];
    const videoDurationCache = await getVideoDurationMap(videoIds);

    const batch = db.batch();
    await addFullCreditWrites({
      batch,
      userId,
      courseId,
      courseData,
      videoDurationCache,
    });
    await batch.commit();
    return null;
  });

export const syncVideos = functions
  .region(REGION)
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    const bucket = admin.storage().bucket();
    const videoFolderPath = "contents/videos/";
    const [files] = await bucket.getFiles({ prefix: videoFolderPath });

    const contentsCollection = db.collection("Contents");
    const existingVideosSnapshot = await contentsCollection.where("Type", "==", "video").get();
    const existingVideoPaths = new Set(existingVideosSnapshot.docs.map((doc) => doc.data().path));

    let batch = db.batch();
    let count = 0;

    for (const file of files) {
      if (file.name.endsWith("/") || existingVideoPaths.has(file.name)) {
        continue; // Skip folders and existing videos
      }

      const fileName = file.name.split("/").pop() || "";
      const newContentRef = db.collection("Contents").doc();

      const [url] = await file.getSignedUrl({ action: "read", expires: "03-09-2491" });

      batch.set(newContentRef, {
        title: fileName.substring(0, fileName.lastIndexOf(".")),
        path: file.name,
        url: url,
        "File name": fileName,
        Type: "video",
        status: "published",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      count++;

      // Commit every 450 to stay well under the 500 limit
      if (count % 450 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }

    if (count % 450 !== 0) {
      await batch.commit();
    }

    const message = `Successfully created Firestore documents for ${count} new videos.`;
    functions.logger.log(message);
    return { status: "success", message };
  });

export { onVideoDeleted, onVideoUpdate, transcodeVideo, updateVideoOnTranscodeComplete };

    
    
