"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NavLink, HomepageMenuLink } from "@/lib/types";

const NAV_LINKS_CACHE_KEY = "gloryhub_nav_links";

const DEFAULT_NAV_LINKS: NavLink[] = [
  { id: "default-courses", title: "Courses", url: "/courses", order: 1 },
  { id: "default-live", title: "Live", url: "/live", order: 2 },
  { id: "default-music", title: "Music", url: "/music", order: 3 },
  { id: "default-community", title: "Community", url: "/community", order: 4 },
  { id: "default-certificates", title: "My Certificates", url: "/my-certificates", order: 5 },
];

interface NavLinksContextType {
  navLinks: NavLink[];
  loading: boolean;
}

const NavLinksContext = createContext<NavLinksContextType>({
  navLinks: DEFAULT_NAV_LINKS,
  loading: false,
});

function navLinkFromMenuLink(link: HomepageMenuLink): NavLink {
  return {
    id: `menu-${link.order}`,
    title: link.title,
    url: link.url,
    order: link.order,
  };
}

function getCachedNavLinks(): NavLink[] | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(NAV_LINKS_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as NavLink[];
  } catch {
    return null;
  }
}

function setCachedNavLinks(links: NavLink[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NAV_LINKS_CACHE_KEY, JSON.stringify(links));
  } catch {
    // sessionStorage full or blocked — ignore
  }
}

export function NavLinksProvider({ children }: { children: React.ReactNode }) {
  const [navLinks, setNavLinks] = useState<NavLink[]>(() => {
    return getCachedNavLinks() ?? DEFAULT_NAV_LINKS;
  });
  const [loading, setLoading] = useState(() => {
    return getCachedNavLinks() === null;
  });

  const fetchNavLinks = useCallback(async () => {
    const cached = getCachedNavLinks();
    if (cached) {
      setNavLinks(cached);
      setLoading(false);
      return;
    }

    try {
      // 1. Check siteSettings for homepageMenuLinks (admin-defined)
      const settingsDoc = await getDoc(doc(db, "siteSettings", "main"));
      const menuLinks = settingsDoc.data()?.homepageMenuLinks as HomepageMenuLink[] | undefined;
      if (menuLinks && menuLinks.length > 0) {
        const links = menuLinks.map(navLinkFromMenuLink);
        setNavLinks(links);
        setCachedNavLinks(links);
        setLoading(false);
        return;
      }

      // 2. Fall back to navLinks Firestore collection
      const q = query(collection(db, "navLinks"), orderBy("order"), limit(10));
      const querySnapshot = await getDocs(q);
      const links = querySnapshot.docs.map((doc) => doc.data() as NavLink);
      if (links.length > 0) {
        setNavLinks(links);
        setCachedNavLinks(links);
      }
      // 3. If both are empty/undefined, keep DEFAULT_NAV_LINKS
    } catch (error) {
      console.error("Error fetching nav links: ", error);
      // Keep defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNavLinks();
  }, [fetchNavLinks]);

  return (
    <NavLinksContext.Provider value={{ navLinks, loading }}>
      {children}
    </NavLinksContext.Provider>
  );
}

export function useNavLinks(): NavLinksContextType {
  return useContext(NavLinksContext);
}
