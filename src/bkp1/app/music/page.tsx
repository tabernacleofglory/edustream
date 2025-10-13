
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAudioPlayer, type Track } from '@/hooks/use-audio-player';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Play, Pause, Music, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function MusicPage() {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);
    const { playTrack, togglePlayPause, currentTrack, isPlaying } = useAudioPlayer();
    const { hasPermission, loading: authLoading } = useAuth();
    
    const canViewPage = hasPermission('viewMusicPage');

    useEffect(() => {
        if (authLoading) return;
        if (!canViewPage) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'Contents'),
            where('Type', '==', 'audio'),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const audioTracks = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.title || 'Untitled',
                    url: data.url,
                    artist: data.uploaderName || 'Unknown Artist',
                    thumbnailUrl: data.thumbnailUrl,
                } as Track;
            });
            setTracks(audioTracks);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [canViewPage, authLoading]);

    const handlePlayClick = (track: Track) => {
        if (currentTrack?.id === track.id) {
            togglePlayPause();
        } else {
            playTrack(track, tracks);
        }
    }

    const TrackCardSkeleton = () => (
        <Card className="flex items-center p-4 gap-4">
            <Skeleton className="h-16 w-16 rounded-md" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
        </Card>
    );
    
    if (authLoading) {
        return <div>Loading...</div>;
    }

    if (!canViewPage) {
        return (
            <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>You do not have permission to view this page.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="container mx-auto py-8">
             <h1 className="text-3xl font-bold mb-2">Music Library</h1>
            <p className="text-muted-foreground mb-8">Enjoy a collection of uplifting music and teachings.</p>

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => <TrackCardSkeleton key={i} />)}
                </div>
            ) : tracks.length > 0 ? (
                <div className="space-y-4">
                    {tracks.map(track => (
                        <Card key={track.id} className="flex items-center p-4 gap-4">
                             <div className="relative h-16 w-16 flex-shrink-0 bg-muted rounded-md flex items-center justify-center">
                                {track.thumbnailUrl ? (
                                    <Image 
                                        src={track.thumbnailUrl} 
                                        alt={track.title}
                                        layout="fill"
                                        objectFit="cover"
                                        className="rounded-md"
                                    />
                                ) : (
                                    <Music className="h-8 w-8 text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold">{track.title}</p>
                                <p className="text-sm text-muted-foreground">{track.artist}</p>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => handlePlayClick(track)}>
                                {isPlaying && currentTrack?.id === track.id ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                            </Button>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
                    <Music className="h-12 w-12" />
                    <p className="mt-4">No music tracks have been published yet.</p>
                </div>
            )}
        </div>
    );
}
