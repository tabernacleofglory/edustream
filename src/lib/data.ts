
import type { Course, User, UserProgress, SiteSettings as SiteSettingsType, EmailLayoutSettings } from "@/lib/types";
import { getFirebaseFirestore } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export type SiteSettings = SiteSettingsType;

const SITE_SETTINGS_CACHE_KEY = 'gloryhub_site_settings';
const SITE_SETTINGS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

const DEFAULT_EMAIL_LAYOUT: EmailLayoutSettings = {
    headerGradientStart: '#1e40af',
    headerGradientEnd: '#3b82f6',
    headerLogoUrl: '',
    headerTitle: 'Glory Training Hub',
    headerSlogan: 'Transforming lives through Christ-centered learning.',
    footerText: '© 2026 Tabernacle of Glory. All rights reserved.',
    buttonColor: '#3b82f6',
    buttonTextColor: '#ffffff',
    bodyBgColor: '#f4f4f5',
    cardBgColor: '#ffffff',
    preHeaderText: 'Glory Training Hub - Grow in faith and leadership.',
    buttonText: 'Visit Dashboard',
    buttonUrl: 'https://gloryhub.net/dashboard',
};

const DEFAULT_SITE_SETTINGS: SiteSettings = {
    websiteName: 'Glory Training Hub',
    metaDescription: 'Transforming lives through Christ-centered learning. Join Glory Training Hub for world-class training and resources.',
    seoKeywords: 'christian education, bible study, leadership training, faith, spiritual growth, online courses',
    homepageTitle: 'Unlock Your Potential.',
    homepageSubtitle: 'Join Glory Training Hub for world-class training and resources to help you grow in your faith and leadership.',
    enrollButtonText: 'Start Your Journey',
    enrollButtonLink: '/signup',
    exploreButtonText: 'Explore Courses',
    exploreButtonLink: '/courses',
    faviconUrl: '/favicon.ico',
    homepageBackgroundImageUrl: '',
    featuresTitle: 'Why Choose Us?',
    featuresSubtitle: 'Everything you need for your spiritual growth.',
    feature1Icon: 'BookOpen',
    feature1Title: 'Expert-Led Courses',
    feature1Description: 'Learn from experienced pastors and leaders on a variety of biblical topics.',
    feature2Icon: 'Users',
    feature2Title: 'Community',
    feature2Description: 'Connect with a global community of believers and grow together.',
    feature3Icon: 'Video',
    feature3Title: 'On-Demand Video',
    feature3Description: 'Access our extensive library of video resources anytime, anywhere.',
    cert_title: 'Certificate of Completion',
    cert_title_size: 24,
    cert_show_title: true,
    cert_subtitle: 'Glory Training Hub',
    cert_subtitle_size: 18,
    cert_show_subtitle: true,
    cert_decoration_icon: 'graduation-cap',
    cert_decoration_icon_size: 48,
    cert_show_decoration: true,
    cert_showLineUnderUserName: true,
    cert_presentedToText: 'Presented to',
    cert_presentedToText_size: 16,
    cert_show_presentedToText: true,
    cert_completionText: 'Has successfully completed the course',
    cert_completionText_size: 14,
    cert_show_completionText: true,
    cert_userName_size: 32,
    cert_courseName_size: 20,
    cert_date_size: 12,
    cert_show_date: true,
    cert_signatureName: 'Pastor',
    cert_signatureName_size: 16,
    cert_signatureTitle: 'Lead Pastor',
    cert_signatureTitle_size: 12,
    cert_show_signatures: true,
    cert_defaultLogoUrl: '',
    cert_defaultBackgroundUrl: '',
    cert_spacing_title_subtitle: 8,
    cert_spacing_subtitle_decoration: 8,
    cert_spacing_decoration_presentedTo: 8,
    cert_spacing_presentedTo_userName: 8,
    cert_spacing_userName_completionText: 8,
    cert_spacing_completionText_courseName: 8,
    cert_spacing_courseName_signatures: 8,
    quiz_pass_threshold: 70,
    emailLayout: DEFAULT_EMAIL_LAYOUT,
    maintenanceModeEnabled: false,
    automation: {
        enrollmentSyncEnabled: false,
        enrollmentSyncIntervalMinutes: 60,
    },
};

function getCachedSiteSettings(): SiteSettings | null {
    if (typeof window === 'undefined') return null;
    try {
        const cached = sessionStorage.getItem(SITE_SETTINGS_CACHE_KEY);
        if (!cached) return null;
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > SITE_SETTINGS_CACHE_TTL) {
            sessionStorage.removeItem(SITE_SETTINGS_CACHE_KEY);
            return null;
        }
        return data as SiteSettings;
    } catch {
        return null;
    }
}

function setCachedSiteSettings(settings: SiteSettings): void {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(SITE_SETTINGS_CACHE_KEY, JSON.stringify({
            data: settings,
            timestamp: Date.now(),
        }));
    } catch {
        // sessionStorage full or blocked — ignore
    }
}

function mergeWithDefaults(data: Partial<SiteSettings>): SiteSettings {
    return { ...DEFAULT_SITE_SETTINGS, ...data };
}

export async function getSiteSettings(): Promise<SiteSettings> {
    // 1. Check cache first
    const cached = getCachedSiteSettings();
    if (cached) return cached;

    // 2. Fetch from Firestore
    const db = getFirebaseFirestore();
    const docRef = doc(db, "siteSettings", "main");
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as Partial<SiteSettings>;
            // Ensure seoKeywords is normalized
            if (typeof data.seoKeywords === 'string') {
                (data as any).seoKeywords = data.seoKeywords.split(',').map((k: string) => k.trim()).filter(Boolean);
            } else if (!Array.isArray(data.seoKeywords)) {
                (data as any).seoKeywords = [];
            }
            const merged = mergeWithDefaults(data);
            setCachedSiteSettings(merged);
            return merged;
        }
    } catch (error) {
        console.error("Error fetching site settings:", error);
    }

    // 3. Fallback to defaults
    return DEFAULT_SITE_SETTINGS;
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
