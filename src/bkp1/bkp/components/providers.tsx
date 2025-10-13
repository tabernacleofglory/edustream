
"use client";

import React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { AudioPlayerProvider } from "@/hooks/use-audio-player";
import { Toaster } from "@/components/ui/toaster";
import StickyAudioPlayer from "./sticky-audio-player";
import AppContent from "@/app/app-content";
import { I18nProvider } from "@/hooks/use-i18n";

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
        <I18nProvider>
          <AuthProvider>
            <AudioPlayerProvider>
                <AppContent>{children}</AppContent>
                <StickyAudioPlayer />
                <Toaster />
            </AudioPlayerProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
  );
}
