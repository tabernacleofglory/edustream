
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

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
