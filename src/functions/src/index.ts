
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail";


admin.initializeApp();
const db = admin.firestore();

export const sendCertificateEmail = functions.https.onCall(async (data, context) => {
    const sendgridApiKey = functions.config().sendgrid?.key;
    if (!sendgridApiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key is not set in the environment configuration.');
    }
    sgMail.setApiKey(sendgridApiKey);

    const msg = {
        to: data.email,
        from: 'glorytraining@tabernacleofglory.net', // TODO: Add your verified SendGrid email address
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

export const syncVideos = functions.https.onCall(async (data, context) => {
    const bucket = admin.storage().bucket("edustream-5t6z4.appspot.com");
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
        if (count % 499 === 0) {
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

// We will export the new functions from a different file to isolate them.
export * from './transcoding';
    
