
"use client";

import { notifyReply, notifyMentions } from "@/lib/community-notifications";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function TestNotificationsPage() {
    const { user } = useAuth();
    const [status, setStatus] = useState("");

    const handleTestMention = async () => {
        setStatus("Testing mention...");
        try {
            // Mentioning the current user (if logged in) or a known name
            const testName = user?.displayName || "Glory Training Team";
            await notifyMentions(`Hello @${testName}, this is a test of the mention system.`, "System Tester", "test-post-id");
            setStatus("Mention test triggered! Check Firestore 'mail' collection.");
        } catch (e) {
            setStatus("Error: " + e);
        }
    };

    const handleTestReply = async () => {
        setStatus("Testing reply...");
        try {
            if (!user) {
                setStatus("Please log in first.");
                return;
            }
            await notifyReply(user.uid, "System Tester", "This is a test reply to your post.", "test-post-id");
            setStatus("Reply test triggered! Check Firestore 'mail' collection.");
        } catch (e) {
            setStatus("Error: " + e);
        }
    };

    return (
        <div className="p-10 space-y-4">
            <h1 className="text-2xl font-bold">Notification Test Page</h1>
            <p className="text-muted-foreground">This page triggers community notifications for testing purposes.</p>
            <div className="flex gap-4">
                <Button onClick={handleTestMention}>Test Mention (@${user?.displayName || "Glory Training Team"})</Button>
                <Button onClick={handleTestReply} variant="outline">Test Reply (to your own UID)</Button>
            </div>
            {status && (
                <div className="p-4 bg-muted rounded-md">
                    {status}
                </div>
            )}
        </div>
    );
}
