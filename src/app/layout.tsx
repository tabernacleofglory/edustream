<<<<<<< HEAD
=======

>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
import type { Metadata } from "next";
import { Inter, Space_Grotesk, Dancing_Script, Great_Vibes, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
<<<<<<< HEAD
import { getSiteSettings } from "@/lib/data";
=======
import { getAdminDb } from "@/lib/firebase-admin";
import type { SiteSettings } from "@/lib/types";
import AppContent from "./app-content";
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)

// This tells Next.js to always re-evaluate this page and not cache it.
export const revalidate = 0;
export const dynamic = 'force-dynamic';

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dancing-script",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-great-vibes",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-serif",
});

<<<<<<< HEAD
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
=======
async function getSiteSettingsForLayout(): Promise<SiteSettings | null> {
    try {
        const db = await getAdminDb();
        const docRef = db.collection("siteSettings").doc("main");
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data() as SiteSettings;
            if (typeof data.seoKeywords === 'string') {
                data.seoKeywords = data.seoKeywords.split(',').map((k: string) => k.trim()).filter(Boolean);
            } else if (!Array.isArray(data.seoKeywords)) {
                data.seoKeywords = [];
            }
            return data;
        }
        return null;
    } catch (error) {
        console.error("Error fetching site settings for layout:", error);
        return null;
    }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettingsForLayout();
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)

  return {
    title: settings?.websiteName || "Glory Training Hub",
    description: settings?.metaDescription || "Transforming lives through Christ-centered learning.",
    keywords: settings?.seoKeywords || "",
    icons: {
      icon: settings?.faviconUrl || '/favicon.ico',
    },
  };
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${dancingScript.variable} ${greatVibes.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
<<<<<<< HEAD
      <body>
        <Providers>
          {children}
=======
      <body className="font-body">
        <Providers>
          <AppContent>{children}</AppContent>
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
        </Providers>
      </body>
    </html>
  );
}
