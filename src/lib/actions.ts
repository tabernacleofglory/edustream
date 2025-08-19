'use server';

import * as nodemailer from 'nodemailer';

export async function sendCertificateEmailAction(email: string, certificateUrl: string) {
    const gmailEmail = process.env.GMAIL_EMAIL;
    const gmailPassword = process.env.GMAIL_PASSWORD;

    if (!gmailEmail || !gmailPassword) {
        console.error('Gmail credentials are not set in the environment variables.');
        return { success: false, error: 'Server configuration error.' };
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailEmail,
            pass: gmailPassword,
        },
    });

    const mailOptions = {
        from: `Glory Training Hub <${gmailEmail}>`,
        to: email,
        subject: 'Your Certificate of Completion',
        html: `
            <h1>Congratulations!</h1>
            <p>You have successfully completed the course. You can view your certificate here:</p>
            <a href="${certificateUrl}">View Certificate</a>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error: 'Failed to send email.' };
    }
}
