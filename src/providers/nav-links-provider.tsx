"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NavLink } from "@/lib/types";

const NAV_LINKS_CACHE_KEY = "gloryhub_nav_links";

interface NavLinksContextType {
  navLinks: NavLink[];
  loading: boolean;
}

const NavLinksContext = createContext<NavLinksContextType>({
  navLinks: [],
  loading: true,
});

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
    return getCachedNavLinks() ?? [];
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
      const q = query(collection(db, "navLinks"), orderBy("order"), limit(10));
      const querySnapshot = await getDocs(q);
      const links = querySnapshot.docs.map((doc) => doc.data() as NavLink);
      setNavLinks(links);
      setCachedNavLinks(links);
    } catch (error) {
      console.error("Error fetching nav links: ", error);
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
