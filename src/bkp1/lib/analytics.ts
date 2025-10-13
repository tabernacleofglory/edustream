
import { analytics } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";

// Track video engagement
export const trackVideoEngagement = (event: string, videoId: string, time: number) => {
    if (!analytics) return;
    logEvent(analytics, event, {
        videoId: videoId,
        time: time,
    });
};
