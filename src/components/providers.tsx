
"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/toaster";
import { AudioPlayerProvider } from "@/hooks/use-audio-player";
import StickyAudioPlayer from "@/components/sticky-audio-player";
import AppContent from "@/app/app-content";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
      <AuthProvider>
        <AudioPlayerProvider>
          <AppContent>
            {children}
          </AppContent>
          <StickyAudioPlayer />
        </AudioPlayerProvider>
      </AuthProvider>
  );
}
