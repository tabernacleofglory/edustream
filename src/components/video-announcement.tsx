
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import ReactPlayer from 'react-player/lazy';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';
import { VolumeX, Volume1, Volume2 } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Slider } from './ui/slider';

interface VideoAnnouncementData {
    videoId: string;
    videoTitle: string;
    videoThumbnail: string;
    isActive: boolean;
}

interface VideoData {
    url: string;
    type: 'video' | 'youtube' | 'googledrive';
}

export default function VideoAnnouncement() {
    const [announcement, setAnnouncement] = useState<VideoAnnouncementData | null>(null);
    const [video, setVideo] = useState<VideoData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false); // Changed to start unmuted
    const [volume, setVolume] = useState(0.25); // Set initial volume to 25%

    useEffect(() => {
        const docRef = doc(db, 'siteSettings', 'videoAnnouncement');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().isActive) {
                setAnnouncement(docSnap.data() as VideoAnnouncementData);
            } else {
                setAnnouncement(null);
            }
            setLoading(false);
        }, () => setLoading(false));

        return unsubscribe;
    }, [db]);

    useEffect(() => {
        if (!announcement?.videoId) {
            setVideo(null);
            return;
        }

        const videoRef = doc(db, 'Contents', announcement.videoId);
        const unsubscribe = onSnapshot(videoRef, (docSnap) => {
            if (docSnap.exists()) {
                setVideo(docSnap.data() as VideoData);
            } else {
                setVideo(null);
            }
        });

        return unsubscribe;
    }, [announcement, db]);

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setVolume(newVolume);
        if (newVolume === 0) {
            setIsMuted(true);
        } else {
            setIsMuted(false);
        }
    };
    
    const getVolumeIcon = () => {
        if (isMuted || volume === 0) return <VolumeX className="h-5 w-5" />;
        if (volume < 0.5) return <Volume1 className="h-5 w-5" />;
        return <Volume2 className="h-5 w-5" />;
    };


    if (loading) {
        return <Skeleton className="h-64 w-full" />;
    }

    if (!announcement || !video) {
        return null;
    }

    return (
        <Card>
            <CardContent className="p-0 relative aspect-video">
                <ReactPlayer
                    url={video.url}
                    playing={true}
                    loop={true}
                    muted={isMuted}
                    volume={volume}
                    controls={false}
                    width="100%"
                    height="100%"
                    playsinline={true}
                    className="absolute top-0 left-0"
                />
                 <div className="absolute bottom-4 right-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="secondary"
                                size="icon"
                                className="rounded-full bg-black/50 text-white hover:bg-black/70"
                            >
                               {getVolumeIcon()}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-28 p-2 mb-2" align="end">
                            <Slider 
                                defaultValue={[volume]}
                                max={1}
                                step={0.05}
                                onValueChange={handleVolumeChange}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </CardContent>
        </Card>
    );
}
