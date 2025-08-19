<<<<<<< HEAD

import { HomePage } from '@/components/home-page';

export default async function Home() {
  return (
      <HomePage />
=======
'use server';

import { getAdminDb } from "@/lib/firebase-admin";
import type { NavLink, SiteSettings } from "@/lib/types";
import { collection, getDocs, query, orderBy, limit, doc } from "firebase/firestore";
import HomepageClient from "@/components/homepage-client";

async function getSiteSettings(): Promise<SiteSettings | null> {
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
        console.error("Error fetching site settings:", error);
        throw error;
    }
}


export default async function Home() {
  const settings = await getSiteSettings();
  const db = await getAdminDb();
  
  let navLinks: NavLink[] = [];
  try {
    const q = query(collection(db, "navLinks"), orderBy("order"), limit(10));
    const querySnapshot = await getDocs(q);
    navLinks = querySnapshot.docs.map(doc => doc.data() as NavLink);
  } catch (error) {
    console.error("Error fetching nav links: ", error);
  }

  return (
    <HomepageClient settings={settings} navLinks={navLinks} />
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
  );
}
