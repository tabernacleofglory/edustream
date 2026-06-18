"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Loader2,
  LogOut,
  Video,
} from "lucide-react";

interface GloryParticipantProps {
  roomId: string;
  password: string;
  eventTitle?: string;
  onLeave: () => void;
}

export function GloryParticipant({
  roomId,
  password,
  eventTitle,
  onLeave,
}: GloryParticipantProps) {
  const [step, setStep] = useState<"join" | "connecting" | "connected">("join");
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((d) => d.kind === "videoinput"));
        setMics(devices.filter((d) => d.kind === "audioinput"));
        if (devices.filter((d) => d.kind === "videoinput").length > 0) {
          setSelectedCamera(devices.filter((d) => d.kind === "videoinput")[0].deviceId);
        }
        if (devices.filter((d) => d.kind === "audioinput").length > 0) {
          setSelectedMic(devices.filter((d) => d.kind === "audioinput")[0].deviceId);
        }
      } catch {
        // Permissions not granted yet — handled by button click
      }
    };
    enumerateDevices();
  }, []);

  const handleJoin = useCallback(async () => {
    setStep("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCamera ? { deviceId: selectedCamera } : true,
        audio: selectedMic ? { deviceId: selectedMic } : true,
      });
      stream.getTracks().forEach((t) => t.stop());
      setStep("connected");
    } catch {
      setStep("connected");
    }
  }, [selectedCamera, selectedMic]);

  const handleLeave = useCallback(() => {
    setStep("join");
    onLeave();
  }, [onLeave]);

  const participateSrc = roomId && password
    ? `https://vdo.ninja/?director=${roomId}&password=${password}`
    : "";

  if (step === "join") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background p-6 text-center space-y-6">
        <div className="rounded-full bg-primary/10 p-4">
          <Video className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Join as Participant</h2>
          <p className="text-muted-foreground max-w-md">
            {eventTitle
              ? `You are joining "${eventTitle}" with your camera and microphone.`
              : "Choose your devices below to join the session."}
          </p>
        </div>

        {cameras.length > 0 && (
          <div className="w-full max-w-xs space-y-2 text-left">
            <Label htmlFor="camera-select">Camera</Label>
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger id="camera-select">
                <Camera className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((cam) => (
                  <SelectItem key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${cameras.indexOf(cam) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {mics.length > 0 && (
          <div className="w-full max-w-xs space-y-2 text-left">
            <Label htmlFor="mic-select">Microphone</Label>
            <Select value={selectedMic} onValueChange={setSelectedMic}>
              <SelectTrigger id="mic-select">
                <Mic className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {mics.map((m) => (
                  <SelectItem key={m.deviceId} value={m.deviceId}>
                    {m.label || `Microphone ${mics.indexOf(m) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onLeave}>
            <LogOut className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleJoin} disabled={step === "connecting"}>
            {step === "connecting" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Video className="mr-2 h-4 w-4" />
            )}
            Join Session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black text-foreground">
      <header className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Participating</span>
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCameraOn((prev) => !prev)}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
              isCameraOn ? "bg-white/20 text-white" : "bg-red-600/80 text-white"
            }`}
            aria-label={isCameraOn ? "Turn off camera" : "Turn on camera"}
          >
            {isCameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsMicOn((prev) => !prev)}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
              isMicOn ? "bg-white/20 text-white" : "bg-red-600/80 text-white"
            }`}
            aria-label={isMicOn ? "Mute mic" : "Unmute mic"}
          >
            {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLeave}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Leave
          </Button>
        </div>
      </header>

      <div className="flex-1">
        <iframe
          src={participateSrc}
          allow="camera;microphone;display-capture;autoplay;clipboard-write;"
          className="w-full h-full border-0"
          allowFullScreen
        />
      </div>
    </div>
  );
}
