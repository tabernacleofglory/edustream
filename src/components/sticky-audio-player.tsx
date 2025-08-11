
"use client";

import { useAudioPlayer } from "@/hooks/use-audio-player";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Play, Pause, X, Repeat, Shuffle, Repeat1, SkipForward, SkipBack, Volume2, VolumeX, Music } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function StickyAudioPlayer() {
    const { 
        currentTrack, 
        isPlaying, 
        progress, 
        duration, 
        currentTime, 
        togglePlayPause, 
        seek,
        closePlayer,
        playNext,
        playPrevious,
        hasNext,
        hasPrevious,
        repeatMode,
        isShuffled,
        toggleRepeat,
        toggleShuffle,
        volume,
        setVolume,
        isMuted,
        toggleMute,
    } = useAudioPlayer();
    
    if (currentTrack === null) {
        return null;
    }

    const formatTime = (seconds: number) => {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    };

    const handleSeek = (value: number[]) => {
        seek(value[0]);
    };
    
    const handleVolumeChange = (value: number[]) => {
        setVolume(value[0]);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 border-t border-border backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-3 items-center h-20">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="relative h-12 w-12 flex-shrink-0 bg-muted rounded-md flex items-center justify-center">
                             {currentTrack.thumbnailUrl ? (
                                <Image 
                                    src={currentTrack.thumbnailUrl}
                                    alt={currentTrack.title}
                                    fill
                                    style={{objectFit:"cover"}}
                                    className="rounded-md"
                                />
                            ) : (
                                <Music className="h-6 w-6 text-muted-foreground" />
                            )}
                        </div>
                        <div className="hidden sm:block">
                            <p className="font-semibold truncate">{currentTrack.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{currentTrack.artist || "Unknown Artist"}</p>
                        </div>
                    </div>
                    
                    <div className="flex-grow flex flex-col items-center gap-2 justify-center">
                         <div className="flex items-center gap-1 sm:gap-4">
                            <Button variant="ghost" size="icon" onClick={toggleShuffle} className={cn("hidden sm:inline-flex text-muted-foreground", isShuffled && "text-primary")}>
                                <Shuffle className="h-5 w-5" />
                            </Button>
                             <Button variant="ghost" size="icon" onClick={playPrevious} disabled={!hasPrevious}>
                                <SkipBack className="h-5 w-5" />
                            </Button>
                            <Button size="icon" className="h-12 w-12" onClick={togglePlayPause}>
                                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                            </Button>
                             <Button variant="ghost" size="icon" onClick={playNext} disabled={!hasNext}>
                                <SkipForward className="h-5 w-5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={toggleRepeat} className={cn("hidden sm:inline-flex text-muted-foreground", repeatMode !== 'off' && "text-primary")}>
                                {repeatMode === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                            </Button>
                         </div>
                         <div className="w-full flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
                            <Slider
                                value={[progress]}
                                onValueChange={handleSeek}
                                max={100}
                                step={0.1}
                                className="w-full"
                            />
                            <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
                         </div>
                    </div>

                     <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={toggleMute} className="hidden md:inline-flex">
                            {isMuted || volume === 0 ? <VolumeX className="h-5 w-5 text-muted-foreground" /> : <Volume2 className="h-5 w-5 text-muted-foreground" />}
                        </Button>
                        <Slider 
                            value={[isMuted ? 0 : volume]}
                            onValueChange={handleVolumeChange}
                            max={1}
                            step={0.05}
                            className="w-24 hidden md:block"
                        />
                        <Button variant="ghost" size="icon" onClick={closePlayer}>
                            <X className="h-5 w-5" />
                        </Button>
                     </div>
                </div>
            </div>
        </div>
    );
}
