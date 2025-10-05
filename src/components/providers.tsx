
"use client";

import React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { AudioPlayerProvider } from "@/hooks/use-audio-player";
import { Toaster } from "@/components/ui/toaster";
import StickyAudioPlayer from "./sticky-audio-player";
import AppContent from "@/app/app-content";

export function Providers({ 
    children,
}: { 
    children: React.ReactNode,
}) {
  return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
          <AuthProvider>
            <AudioPlayerProvider>
                <AppContent>{children}</AppContent>
                <StickyAudioPlayer />
                <Toaster />
            </AudioPlayerProvider>
          </AuthProvider>
      </ThemeProvider>
  );
}
