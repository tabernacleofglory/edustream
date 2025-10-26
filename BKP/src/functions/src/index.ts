

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail";
import { onVideoDeleted, onVideoUpdate, transcodeVideo, updateVideoOnTranscodeComplete } from "./transcoding";

admin.initializeApp();
const db = admin.firestore();

export const deleteUserAccount = functions.https.onCall(async (data, context) => {
    if (!context.auth || !['admin', 'developer'].includes(context.auth.token.role || '')) {
        throw new functions.https.HttpsError('permission-denied', 'You must be an admin to perform this action.');
    }

    const uid = data.uid;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "uid" argument.');
    }

    try {
        // Delete user from Authentication
        await admin.auth().deleteUser(uid);
        
        // Delete user document from Firestore
        await db.collection('users').doc(uid).delete();
        
        return { success: true, message: `Successfully deleted user ${uid}` };
    } catch (error) {
        console.error('Error deleting user:', error);
        throw new functions.https.HttpsError('internal', 'An error occurred while deleting the user.');
    }
});


export const enrollInCourse = functions.runWith({ memory: '512MB' }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to enroll.');
    }

    const userId = context.auth.uid;
    const courseId = data.courseId;

    if (!courseId) {
        throw new functions.https.HttpsError('invalid-argument', 'Course ID is required.');
    }

    try {
        const enrollmentRef = db.collection('enrollments').doc(`${userId}_${courseId}`);
        const courseRef = db.collection('courses').doc(courseId);

        // Use a transaction to ensure atomicity
        await db.runTransaction(async (transaction) => {
            const enrollmentDoc = await transaction.get(enrollmentRef);
            if (enrollmentDoc.exists) {
                // User is already enrolled, do nothing.
                return;
            }

            // Create enrollment document
            transaction.set(enrollmentRef, {
                userId: userId,
                courseId: courseId,
                enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Increment enrollment count on the course
            transaction.update(courseRef, { enrollmentCount: admin.firestore.FieldValue.increment(1) });
        });
        
        return { success: true, message: 'Successfully enrolled in the course.' };

    } catch (error) {
        console.error("Error enrolling in course:", error);
        throw new functions.https.HttpsError('internal', 'An error occurred while enrolling in the course.');
    }
});


export const sendCertificateEmail = functions.https.onCall(async (data, context) => {
    const sendgridApiKey = functions.config().sendgrid?.key;
    if (!sendgridApiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key is not set in the environment configuration.');
    }
    sgMail.setApiKey(sendgridApiKey);

    const msg = {
        to: data.email,
        from: 'glorytraining@tabernacleofglory.net', // Ensure this is a verified SendGrid sender
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
        console.error("Error sending email:", error);
        throw new functions.https.HttpsError('internal', 'An error occurred while trying to send the email.');
    }
});

export const sendHpFollowUp = functions.https.onCall(async (data, context) => {
    const sendgridApiKey = functions.config().sendgrid?.key;
    if (!sendgridApiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key is not set in the environment configuration.');
    }
    sgMail.setApiKey(sendgridApiKey);

    const msg = {
        to: data.email,
        from: 'glorytraining@tabernacleofglory.net', // Ensure this is a verified SendGrid sender
        subject: 'HP Placement Request Received',
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
        return { success: true, message: 'Follow-up email sent successfully.' };
    } catch (error) {
        console.error("Error sending HP follow-up email:", error);
        throw new functions.https.HttpsError('internal', 'An error occurred while trying to send the email.');
    }
});

export const setCourseCompletions = functions.runWith({ memory: '512MB' }).https.onCall(async (data, context) => {
    if (!context.auth || !['admin', 'developer'].includes(context.auth.token.role || '')) {
        throw new functions.https.HttpsError('permission-denied', 'You must be an admin to perform this action.');
    }

    const { userId, completions } = data;
    if (!userId || !Array.isArray(completions)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid data provided. "userId" and "completions" array are required.');
    }
    
    const adminUser = await admin.auth().getUser(context.auth.uid);
    
    try {
        const batch = db.batch();
        const coursesRef = db.collection('courses');
        const userRef = db.collection('users').doc(userId);
        
        const [allCoursesSnap, userDoc] = await Promise.all([
            coursesRef.get(),
            userRef.get()
        ]);
        
        const coursesMap = new Map(allCoursesSnap.docs.map(doc => [doc.id, doc.data()]));
        const userData = userDoc.data();

        const newCompletions = completions.filter((c: any) => c.isCompleted);

        for (const completion of newCompletions) {
            const courseData = coursesMap.get(completion.courseId);
            if (!courseData || !courseData.videos) {
                console.warn(`Course data or videos not found for courseId: ${completion.courseId}. Skipping.`);
                continue;
            }

            const enrollmentRef = db.collection('enrollments').doc(`${userId}_${completion.courseId}`);
            const enrollmentDoc = await enrollmentRef.get(); // Check if enrollment exists

            // Mark enrollment and completion
            batch.set(enrollmentRef, {
                userId,
                courseId: completion.courseId,
                enrolledAt: enrollmentDoc.exists ? enrollmentDoc.data()?.enrolledAt : admin.firestore.FieldValue.serverTimestamp(),
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            // Mark all videos as complete
            const progressRef = db.collection('userVideoProgress').doc(`${userId}_${completion.courseId}`);
            const videoProgress = courseData.videos.map((videoId: string) => ({
                videoId,
                completed: true,
                timeSpent: 1, // Mark as watched
            }));
            batch.set(progressRef, {
                userId,
                courseId: completion.courseId,
                videoProgress,
                totalProgress: 100,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // If marked as onsite, create a log entry
            if (completion.isOnsite) {
                const onsiteRef = db.collection('onsiteCompletions').doc();
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
                const badgeRef = db.collection('userBadges').doc(`${userId}_${completion.courseId}`);
                batch.set(badgeRef, {
                    userId,
                    courseId: completion.courseId,
                    badgeTitle: courseData.title,
                    badgeIconUrl: courseData['Image ID'], // Using course thumbnail as badge icon
                    earnedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
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
        console.error("Error setting course completions: ", error);
        throw new functions.https.HttpsError('internal', 'An internal error occurred while updating completions.');
    }
});


export const syncVideos = functions.https.onCall(async (data, context) => {
    const bucket = admin.storage().bucket();
    const videoFolderPath = 'contents/videos/';
    const [files] = await bucket.getFiles({ prefix: videoFolderPath });
    
    const contentsCollection = db.collection('Contents');
    const existingVideosSnapshot = await contentsCollection.where('Type', '==', 'video').get();
    const existingVideoPaths = new Set(existingVideosSnapshot.docs.map(doc => doc.data().path));

    const batch = db.batch();
    let count = 0;

    for (const file of files) {
        if (file.name.endsWith('/') || existingVideoPaths.has(file.name)) {
            continue; // Skip folders and existing videos
        }

        const fileName = file.name.split('/').pop() || '';
        const newContentRef = db.collection('Contents').doc();
        
        const [url] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });

        batch.set(newContentRef, {
            title: fileName.substring(0, fileName.lastIndexOf('.')),
            path: file.name,
            url: url,
            'File name': fileName,
            Type: 'video',
            status: 'published',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        count++;
        if (count > 0 && count % 499 === 0) { // commit every 499 operations
            await batch.commit();
        }
    }

    if (count > 0 && count % 499 !== 0) {
        await batch.commit();
    }

    const message = `Successfully created Firestore documents for ${count} new videos.`;
    functions.logger.log(message);
    return { status: 'success', message: message };
});
    
export { onVideoDeleted, onVideoUpdate, transcodeVideo, updateVideoOnTranscodeComplete };

