"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import {
  Maximize,
  Minimize,
  Tv,
  ArrowLeft,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";

interface GloryViewerProps {
  roomId: string;
  password: string;
  eventTitle?: string;
  onBack: () => void;
}

export function GloryViewer({
  roomId,
  password,
  eventTitle,
  onBack,
}: GloryViewerProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Vdo.Ninja URL with all native UI hidden
  const watchSrc = [
    `https://vdo.ninja/?view=${roomId}`,
    `&solo&room=${roomId}`,
    `&password=${password}`,
    "&cleanoutput",
    "&cleanviewer",
    "&nocontrols",
    "&nosettings",
    "&transparent",
    "&nohangupbutton",
    "&tallyoff",
    "&obsoff",
  ].join("");

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);

  const handleFullScreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    iframeRef.current?.contentWindow?.postMessage({ speaker: "toggle" }, "*");
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-black text-foreground"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo />
        </div>
        <div className="flex items-center gap-3">
          {eventTitle && (
            <h1 className="text-sm font-semibold text-white hidden sm:block truncate max-w-[200px]">
              {eventTitle}
            </h1>
          )}
          <Badge variant="destructive" className="animate-pulse">
            <Tv className="mr-1.5 h-3.5 w-3.5" />
            LIVE
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullScreen}
            className="text-white hover:bg-white/20"
            aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullScreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Video area */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center text-white space-y-3">
              <Loader2 className="h-10 w-10 animate-spin mx-auto" />
              <p className="text-sm font-medium">Connecting to live stream...</p>
            </div>
          </div>
        )}

        {/* Vdo.Ninja iframe — completely invisible to the user */}
        <iframe
          ref={iframeRef}
          src={watchSrc}
          allow="autoplay;clipboard-write;"
          className="absolute inset-0 w-full h-full border-0"
          style={{ opacity: 0, pointerEvents: "none" }}
          allowFullScreen
        />

        {/* Bottom overlay — mute toggle */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <button
            onClick={handleToggleMute}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
