
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { TranscoderServiceClient } from "@google-cloud/video-transcoder";

const db = admin.firestore();
const transcoderServiceClient = new TranscoderServiceClient();

const PROJECT_NUMBER = "97402238606";
const LOCATION = "us-central1";
const BUCKET_NAME = "edustream-videos-uscentral1";


export const transcodeVideo = functions.storage.object().onFinalize(async (object) => {
    if (!PROJECT_NUMBER) {
        functions.logger.error("Google Cloud Project Number is not set.");
        return;
    }
    if (!object.name || !object.name.startsWith('contents/videos/')) {
        functions.logger.log('Not a video, skipping.');
        return;
    }
    
    if (object.metadata?.transcode !== 'true') {
        functions.logger.log('Transcoding not requested for this video on upload, skipping.');
        return;
    }

    const querySnapshot = await db.collection('Contents').where('path', '==', object.name).limit(1).get();
    if (querySnapshot.empty) {
        functions.logger.error(`No Firestore document found for video path: ${object.name}`);
        return;
    }
    const videoDocRef = querySnapshot.docs[0].ref;
    
    const inputUri = `gs://${BUCKET_NAME}/${object.name}`;
    const outputUri = `gs://${BUCKET_NAME}/transcoded-videos/${object.name.split('/').pop()}/`;

    const request = {
        parent: `projects/${PROJECT_NUMBER}/locations/${LOCATION}`,
        job: {
            inputUri: inputUri,
            outputUri: outputUri,
            config: {
                elementaryStreams: [
                    {
                        key: 'video-stream-360p',
                        videoStream: { h264: { heightPixels: 360, widthPixels: 640, bitrateBps: 550000, frameRate: 30 } },
                    },
                    {
                        key: 'video-stream-720p',
                        videoStream: { h264: { heightPixels: 720, widthPixels: 1280, bitrateBps: 2500000, frameRate: 30 } },
                    },
                    {
                        key: 'audio-stream',
                        audioStream: { codec: 'aac', bitrateBps: 128000 },
                    },
                ],
                muxStreams: [
                    { key: '360p', container: 'fmp4', elementaryStreams: ['video-stream-360p', 'audio-stream'] },
                    { key: '720p', container: 'fmp4', elementaryStreams: ['video-stream-720p', 'audio-stream'] },
                ],
                manifests: [{ fileName: 'manifest.m3u8', type: 'HLS' as const, muxStreams: ['360p', '720p'] }]
            },
        },
    };
    
    try {
        await videoDocRef.update({ transcodeStatus: 'processing', errorMessage: admin.firestore.FieldValue.delete() });
        const [operation] = await transcoderServiceClient.createJob(request);
        functions.logger.log(`Transcoding job created: ${operation.name}`);
        await videoDocRef.update({ transcodeJobName: operation.name });
    } catch (error: any) {
        const errorMessage = String(error.message || 'Unknown error during job creation.');
        functions.logger.error('Transcoding job creation failed:', errorMessage, error);
        await videoDocRef.update({ transcodeStatus: 'failed', errorMessage: errorMessage });
    }
});

export const updateVideoOnTranscodeComplete = functions.pubsub.topic('transcoding-events').onPublish(async (message) => {
    try {
        const payload = JSON.parse(Buffer.from(message.data, 'base64').toString());
        const job = payload.job;

        if (job.state === 'SUCCEEDED' && job.outputUri) {
            const videoPath = job.inputUri.replace(`gs://${BUCKET_NAME}/`, '');
            const querySnapshot = await db.collection('Contents').where('path', '==', videoPath).limit(1).get();
            
            if (!querySnapshot.empty) {
                const videoDocRef = querySnapshot.docs[0].ref;
                await videoDocRef.update({
                    transcodeStatus: 'succeeded',
                    hlsUrl: `${job.outputUri}manifest.m3u8`
                });
                functions.logger.log(`Successfully updated Firestore for transcoded video: ${videoPath}`);
            }
        } else if (job.state === 'FAILED') {
             const videoPath = job.inputUri.replace(`gs://${BUCKET_NAME}/`, '');
             const querySnapshot = await db.collection('Contents').where('path', '==', videoPath).limit(1).get();
            
             if (!querySnapshot.empty) {
                const videoDocRef = querySnapshot.docs[0].ref;
                const errorMessage = String(job.error?.message || 'Unknown transcoding failure.');
                await videoDocRef.update({
                    transcodeStatus: 'failed',
                    errorMessage: errorMessage,
                });
                 functions.logger.error(`Transcoding failed for ${videoPath}: ${errorMessage}`);
            }
        }
    } catch (error: any) {
        const errorMessage = String(error.message || 'Unknown error processing Pub/Sub message.');
        functions.logger.error('Error processing transcode Pub/Sub message:', errorMessage, error);
    }
});

export const onVideoUpdate = functions.firestore.document('Contents/{videoId}').onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Trigger for manual re-transcoding
    if (afterData.transcodeTrigger === 'manual' && beforeData.transcodeTrigger !== 'manual') {
        functions.logger.log(`Manual transcode triggered for ${context.params.videoId}`);
        
        const inputUri = `gs://${BUCKET_NAME}/${afterData.path}`;
        const outputUri = `gs://${BUCKET_NAME}/transcoded-videos/${afterData.path.split('/').pop()}/`;
        
        const request = {
            parent: `projects/${PROJECT_NUMBER}/locations/${LOCATION}`,
            job: {
                inputUri,
                outputUri,
                config: {
                     elementaryStreams: [
                        { key: 'video-stream-360p', videoStream: { h264: { heightPixels: 360, widthPixels: 640, bitrateBps: 550000, frameRate: 30 } } },
                        { key: 'video-stream-720p', videoStream: { h264: { heightPixels: 720, widthPixels: 1280, bitrateBps: 2500000, frameRate: 30 } } },
                        { key: 'audio-stream', audioStream: { codec: 'aac', bitrateBps: 128000 } },
                    ],
                    muxStreams: [
                        { key: '360p', container: 'fmp4', elementaryStreams: ['video-stream-360p', 'audio-stream'] },
                        { key: '720p', container: 'fmp4', elementaryStreams: ['video-stream-720p', 'audio-stream'] },
                    ],
                    manifests: [{ fileName: 'manifest.m3u8', type: 'HLS' as const, muxStreams: ['360p', '720p'] }]
                },
            },
        };
        try {
            await change.after.ref.update({
                errorMessage: admin.firestore.FieldValue.delete(),
                transcodeTrigger: admin.firestore.FieldValue.delete()
            });
            const [operation] = await transcoderServiceClient.createJob(request);
            await change.after.ref.update({ transcodeJobName: operation.name });
            functions.logger.log(`Transcoding job created: ${operation.name}`);
        } catch (error: any) {
            const errorMessage = String(error.message || 'Unknown error creating transcoding job.');
            functions.logger.error(`Error creating manual transcode job for ${context.params.videoId}:`, errorMessage, error);
            await change.after.ref.update({ 
                transcodeStatus: 'failed', 
                errorMessage: errorMessage,
                transcodeTrigger: admin.firestore.FieldValue.delete()
            });
        }
    }
    
    // Trigger for cancellation
    if (afterData.transcodeTrigger === 'cancel' && beforeData.transcodeTrigger !== 'cancel') {
        const jobName = afterData.transcodeJobName;
        if (jobName) {
            try {
                functions.logger.log(`Attempting to cancel job ${jobName}`);
                await transcoderServiceClient.deleteJob({ name: jobName });
                functions.logger.log(`API call to delete job ${jobName} successful.`);
            } catch (error: any) {
                const errorMessage = String(error.details || error.message || 'Unknown cancellation error');
                functions.logger.error(`Failed to cancel job ${jobName}:`, errorMessage, error);
            } finally {
                await change.after.ref.update({ 
                    transcodeStatus: 'cancelled', 
                    transcodeTrigger: admin.firestore.FieldValue.delete(),
                    errorMessage: admin.firestore.FieldValue.delete(),
                });
                 functions.logger.log(`Firestore document updated for cancelled job ${jobName}.`);
            }
        } else {
             functions.logger.warn(`Cancellation trigger for ${context.params.videoId} found, but no transcodeJobName was present.`);
             await change.after.ref.update({ transcodeTrigger: admin.firestore.FieldValue.delete() });
        }
    }
});


export const onVideoDeleted = functions.firestore.document('Contents/{videoId}').onDelete(async (snap, context) => {
    const data = snap.data();
    if (!data || data.Type !== 'video' || !data.path) {
        return;
    }

    const bucket = admin.storage().bucket(BUCKET_NAME);
    const transcodedVideoFolder = `transcoded-videos/${data.path.split('/').pop()}/`;

    try {
        await bucket.deleteFiles({ prefix: transcodedVideoFolder });
        functions.logger.log(`Successfully deleted transcoded folder: ${transcodedVideoFolder}`);
    } catch (error: any) {
        const errorMessage = String(error.message || 'Unknown error deleting transcoded files.');
        functions.logger.error(`Failed to delete transcoded files for path ${data.path}:`, errorMessage);
    }
});
