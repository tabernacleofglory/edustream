
import { db } from "./firebase";
import { 
    collection, 
    addDoc, 
    getDoc, 
    doc, 
    query, 
    where, 
    getDocs, 
    limit 
} from "firebase/firestore";
import type { User as AppUser } from "./types";

/**
 * Notifies the author of a post when someone replies to it.
 */
export async function notifyReply(parentAuthorId: string, replyAuthorName: string, content: string, postId: string) {
    try {
        if (!parentAuthorId) return;

        // Fetch parent author's email and settings
        const userDoc = await getDoc(doc(db, "users", parentAuthorId));
        if (!userDoc.exists()) return;
        
        const parentUser = userDoc.data() as AppUser;
        if (!parentUser.email) return;

        // Check opt-out settings (enabled by default)
        if (parentUser.notificationSettings?.communityReplies === false) {
            console.log(`[notifyReply] User ${parentAuthorId} has opted out of reply notifications.`);
            return;
        }

        const postUrl = `${window.location.origin}/community?post=${postId}`;

        await addDoc(collection(db, "mail"), {
            to: [parentUser.email],
            message: {
                subject: `${replyAuthorName} replied to your post`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 20px;">
                        <h2 style="color: #333;">New Reply in Community</h2>
                        <p><strong>${replyAuthorName}</strong> replied to your post:</p>
                        <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0; white-space: pre-wrap;">
                            ${content}
                        </div>
                        <a href="${postUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Reply</a>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #777;">You received this because someone replied to your post on Glory Training Hub. You can disable these in your settings.</p>
                    </div>
                `
            }
        });
    } catch (error) {
        console.error("Error in notifyReply:", error);
    }
}

/**
 * Parses content for @mentions and notifies the tagged users.
 */
export async function notifyMentions(content: string, authorName: string, postId: string) {
    try {
        const mentionRegex = /@([a-zA-Z0-9_ ]+)/g;
        let match;
        const potentialNames = new Set<string>();

        while ((match = mentionRegex.exec(content)) !== null) {
            const name = match[1].trim();
            if (name.length > 2) {
                potentialNames.add(name);
            }
        }

        if (potentialNames.size === 0) return;

        const postUrl = `${window.location.origin}/community?post=${postId}`;

        for (const name of potentialNames) {
            // Search for user by displayName
            const userQuery = query(
                collection(db, "users"), 
                where("displayName", "==", name), 
                limit(1)
            );
            const querySnapshot = await getDocs(userQuery);
            
            if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                const mentionedUser = docSnap.data() as AppUser;
                
                if (mentionedUser.email) {
                    // Check opt-out settings (enabled by default)
                    if (mentionedUser.notificationSettings?.communityMentions === false) {
                        console.log(`[notifyMentions] User ${docSnap.id} has opted out of mention notifications.`);
                        continue;
                    }

                    await addDoc(collection(db, "mail"), {
                        to: [mentionedUser.email],
                        message: {
                            subject: `You were mentioned by ${authorName}`,
                            html: `
                                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 20px;">
                                    <h2 style="color: #333;">New Mention in Community</h2>
                                    <p><strong>${authorName}</strong> mentioned you in a post:</p>
                                    <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0; white-space: pre-wrap;">
                                        ${content}
                                    </div>
                                    <a href="${postUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Post</a>
                                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                                    <p style="font-size: 12px; color: #777;">You received this because you were mentioned in the Glory Training Hub community. You can disable these in your settings.</p>
                                </div>
                            `
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error in notifyMentions:", error);
    }
}
