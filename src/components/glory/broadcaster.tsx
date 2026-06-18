"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Monitor,
  MonitorOff,
  Tv,
  ArrowLeft,
  Loader2,
  RadioTower,
} from "lucide-react";

interface GloryBroadcasterProps {
  roomId: string;
  password: string;
  eventTitle?: string;
  onEndStream: () => void;
  onBack: () => void;
}

export function GloryBroadcaster({
  roomId,
  password,
  eventTitle,
  onEndStream,
  onBack,
}: GloryBroadcasterProps) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Vdo.Ninja URL with all native UI hidden
  const vdoNinjaSrc = [
    `https://vdo.ninja/?director=${roomId}`,
    `&password=${password}`,
    "&cleanoutput",      // Hides most UI elements
    "&nocontrols",       // Hides video control bar
    "&nosettings",       // Hides settings button
    "&transparent",      // Transparent background
    "&hideheader",       // Hides top header
    "&nopreview",        // Disables self-preview (we have our own)
    "&nohangupbutton",   // Hides hangup button
    "&nomicbutton",      // Hides native mic button
    "&novideobutton",    // Hides native camera button
    "&tallyoff",         // Disables tally light
    "&nocursor",         // Hides mouse cursor
    "&autostart",        // Auto-start camera/mic
  ].join("");

  // Listen for messages from Vdo.Ninja iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.action === "push-connection") {
        setParticipantCount((prev) =>
          event.data.value === true ? prev + 1 : Math.max(0, prev - 1)
        );
      }
      if (event.data?.action === "guest-connected") {
        setParticipantCount((prev) => prev + 1);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Loading timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsLive(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const postToVdo = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  const handleToggleMic = useCallback(() => {
    setIsMicOn((prev) => !prev);
    postToVdo({ mic: "toggle" });
  }, [postToVdo]);

  const handleToggleCamera = useCallback(() => {
    setIsCameraOn((prev) => !prev);
    postToVdo({ camera: "toggle" });
  }, [postToVdo]);

  const handleToggleScreenShare = useCallback(() => {
    if (!isScreenSharing) {
      postToVdo({ function: "publishScreen" });
      setIsScreenSharing(true);
    }
  }, [isScreenSharing, postToVdo]);

  const handleEndStream = useCallback(() => {
    if (confirm("Are you sure you want to end this live stream?")) {
      postToVdo({ close: true });
      setIsLive(false);
      onEndStream();
    }
  }, [onEndStream, postToVdo]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo />
        </div>
        <div className="flex items-center gap-3">
          {eventTitle && (
            <h1 className="text-sm font-semibold hidden sm:block truncate max-w-[200px]">
              {eventTitle}
            </h1>
          )}
          <Badge
            variant={isLive ? "destructive" : "secondary"}
            className={isLive ? "animate-pulse" : ""}
          >
            <Tv className="mr-1.5 h-3.5 w-3.5" />
            {isLive ? "LIVE" : "OFFLINE"}
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:block">
            {participantCount > 0
              ? `${participantCount} viewer${participantCount !== 1 ? "s" : ""}`
              : "No viewers"}
          </span>
        </div>
      </header>

      {/* Main video area */}
      <main className="flex-1 bg-black relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center text-white space-y-3">
              <Loader2 className="h-10 w-10 animate-spin mx-auto" />
              <p className="text-sm font-medium">Connecting to stream...</p>
              <p className="text-xs text-white/60">Room: {roomId}</p>
            </div>
          </div>
        )}

        {/* Vdo.Ninja iframe — completely invisible to the user */}
        <iframe
          ref={iframeRef}
          src={vdoNinjaSrc}
          allow="camera;microphone;display-capture;autoplay;clipboard-write;"
          className="absolute inset-0 w-full h-full border-0"
          style={{ opacity: 0, pointerEvents: "none" }}
          allowFullScreen
        />

        {/* Bottom overlay controls — fully custom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center gap-3 max-w-lg mx-auto">
            <button
              onClick={handleToggleMic}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                isMicOn
                  ? "bg-white/20 hover:bg-white/30 text-white"
                  : "bg-red-600/80 hover:bg-red-600 text-white"
              }`}
              aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
            >
              {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>

            <button
              onClick={handleToggleCamera}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                isCameraOn
                  ? "bg-white/20 hover:bg-white/30 text-white"
                  : "bg-red-600/80 hover:bg-red-600 text-white"
              }`}
              aria-label={isCameraOn ? "Turn off camera" : "Turn on camera"}
            >
              {isCameraOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
            </button>

            <button
              onClick={handleToggleScreenShare}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                isScreenSharing
                  ? "bg-blue-600 text-white"
                  : "bg-white/20 hover:bg-white/30 text-white"
              }`}
              aria-label={isScreenSharing ? "Stop sharing" : "Share screen"}
            >
              {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </button>

            <button
              onClick={handleEndStream}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
              aria-label="End stream"
            >
              <RadioTower className="h-6 w-6" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
