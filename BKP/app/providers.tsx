
"use client";

import React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { AuthProvider } from "@/hooks/use-auth";
import { AudioPlayerProvider } from "@/hooks/use-audio-player";
import { Toaster } from "@/components/ui/toaster";
import StickyAudioPlayer from "@/components/sticky-audio-player";
import AppContent from "@/app/app-content";
import { I18nProvider } from "@/hooks/use-i18n";
import type { ThemeProviderProps } from "next-themes/dist/types";

function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

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
