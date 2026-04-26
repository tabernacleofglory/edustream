"use client";

import { useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { SiteSettings } from "@/lib/types";
import { runEnrollmentSync } from "@/lib/automation-actions";

export function AutomationRunner() {
  const { user, hasPermission } = useAuth();
  const isRunning = useRef(false);

  useEffect(() => {
    // Only authorized admins run the background automation tasks
    if (!user || !hasPermission("manageAutomation")) return;

    console.log("[Automation Runner] Initialized for user:", user.email);

    const unsub = onSnapshot(doc(db, "siteSettings", "main"), async (snapshot) => {
      if (!snapshot.exists()) return;
      
      const settings = snapshot.data() as SiteSettings;
      const automation = settings.automation;

      // Check if enabled and not already running locally
      if (!automation?.enrollmentSyncEnabled || isRunning.current) {
        return;
      }

      const lastRun = automation.lastRunAt?.toDate() || new Date(0);
      const intervalMinutes = automation.enrollmentSyncIntervalMinutes || 60;
      const intervalMs = intervalMinutes * 60 * 1000;
      const now = new Date();

      // Check if it's time to run
      if (now.getTime() - lastRun.getTime() >= intervalMs) {
        isRunning.current = true;
        try {
          await runEnrollmentSync();
        } catch (error) {
          console.error("[Automation Runner] Execution failed:", error);
        } finally {
          isRunning.current = false;
        }
      }
    });

    return () => unsub();
  }, [user, hasPermission]);

  return null; 
}
