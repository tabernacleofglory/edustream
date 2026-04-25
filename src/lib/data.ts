
import type { Course, User, UserProgress, SiteSettings as SiteSettingsType } from "@/lib/types";
import { getFirebaseFirestore } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export type SiteSettings = SiteSettingsType;

export async function getSiteSettings(): Promise<SiteSettings | null> {
    const db = getFirebaseFirestore();
    const docRef = doc(db, "siteSettings", "main");
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Ensure seoKeywords is an array, converting from string if necessary
            if (typeof data.seoKeywords === 'string') {
                data.seoKeywords = data.seoKeywords.split(',').map((k: string) => k.trim()).filter(Boolean);
            } else if (!Array.isArray(data.seoKeywords)) {
                data.seoKeywords = [];
            }
            return data as SiteSettings;
        }
        return null;
    } catch (error) {
        console.error("Error fetching site settings:", error);
        return null;
    }
}


export const categories = ["Web Development", "AI/ML", "Design", "Marketing", "Faith"];

export const allCourses: Course[] = [];

export const allUsers: User[] = [
    {
        id: "devuser1",
        uid: "devuser1",
        fullName: "Developer User",
        displayName: "Developer User",
        charge: "Developer",
        email: "tgdr.media@tabernacleofglory.net",
        photoURL: "https://placehold.co/100x100",
        membershipStatus: "premium",
        role: "admin",
    }
];

// This will need to be replaced with a real authentication system.
export const mockUser: User = {
    id: "devuser1",
    uid: "devuser1",
    fullName: "Developer User",
    displayName: "Developer User",
    charge: "Developer",
    email: "tgdr.media@tabernacleofglory.net",
    photoURL: "https://placehold.co/100x100",
    membershipStatus: "premium",
    role: "admin",
};

export const userProgressData: UserProgress[] = [];
