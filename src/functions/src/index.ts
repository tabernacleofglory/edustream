
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
