
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail";
import { onVideoDeleted, onVideoUpdate, transcodeVideo, updateVideoOnTranscodeComplete } from "./transcoding";

admin.initializeApp();
const db = admin.firestore();

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
  .https.onCall(async (data, context) => {
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

// ---- enroll in course -------------------------------------------

export const enrollInCourse = functions
  .runWith({ memory: "512MB" })
  .region(REGION)
  .https.onCall(async (data, context) => {
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
  .https.onCall(async (data, context) => {
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
  .https.onCall(async (data, context) => {
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

// ---- completions ------------------------------------------------

export const setCourseCompletions = functions
  .runWith({ memory: "512MB" })
  .region(REGION)
  .https.onCall(async (data, context) => {
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

      for (const completion of newCompletions) {
        const courseData: any = coursesMap.get(completion.courseId);
        if (!courseData || !courseData.videos) {
          functions.logger.warn(
            `Course data or videos not found for courseId: ${completion.courseId}. Skipping.`
          );
          continue;
        }

        const enrollmentRef = db.collection("enrollments").doc(`${userId}_${completion.courseId}`);
        const enrollmentDoc = await enrollmentRef.get();

        // Mark enrollment and completion
        batch.set(
          enrollmentRef,
          {
            userId,
            courseId: completion.courseId,
            enrolledAt: enrollmentDoc.exists
              ? enrollmentDoc.data()?.enrolledAt
              : admin.firestore.FieldValue.serverTimestamp(),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Mark all videos as complete
        const progressRef = db.collection("userVideoProgress").doc(`${userId}_${completion.courseId}`);
        const videoProgress = (courseData.videos as string[]).map((videoId: string) => ({
          videoId,
          completed: true,
          timeSpent: 1,
        }));
        batch.set(
          progressRef,
          {
            userId,
            courseId: completion.courseId,
            videoProgress,
            totalProgress: 100,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // If marked as onsite, create a log entry
        if (completion.isOnsite) {
          const onsiteRef = db.collection("onsiteCompletions").doc();
          batch.set(onsiteRef, {
            userId,
            userName: userData?.displayName,
            userCampus: userData?.campus,
            courseId: completion.courseId,
            courseName: courseData.title,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            markedBy: adminUser.displayName || adminUser.email,
          });
        }

        // Grant badge if enabled
        if (courseData.badgeEnabled) {
          const badgeRef = db.collection("userBadges").doc(`${userId}_${completion.courseId}`);
          batch.set(
            badgeRef,
            {
              userId,
              courseId: completion.courseId,
              badgeTitle: courseData.title,
              badgeIconUrl: courseData["Image ID"],
              earnedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        // Only increment enrollment count if it's a new enrollment
        if (!enrollmentDoc.exists) {
          const courseRef = coursesRef.doc(completion.courseId);
          batch.update(courseRef, { enrollmentCount: admin.firestore.FieldValue.increment(1) });
        }
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

export const syncVideos = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
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
