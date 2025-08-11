
'use client';

import { useParams, useRouter } from 'next/navigation';
import { FC, Suspense, useState, useEffect } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CirclePlay, MicVocal, Tv } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { LiveEvent } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const GloryLiveUserViewContent: FC = () => {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'join' | 'watch' | 'participate' | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!roomId) return;
      setLoading(true);
      try {
        const eventsRef = collection(db, 'liveEvents');
        const q = query(eventsRef, where("gloryLiveRoomId", "==", roomId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const eventDoc = querySnapshot.docs[0];
            setEvent({ id: eventDoc.id, ...eventDoc.data() } as LiveEvent);
            setMode('join'); // Set initial mode after fetching data
        } else {
            console.error("Event not found");
        }
      } catch (err) {
        console.error("Error fetching event:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [roomId]);

  if (loading) {
    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-24" />
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-24" />
                </div>
            </header>
            <main className="flex-1 bg-black flex items-center justify-center">
                <Skeleton className="h-24 w-64" />
            </main>
        </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Event not found.</p>
      </div>
    );
  }

  const participateSrc = `https://vdo.ninja/?director=${event.gloryLiveRoomId}&password=${event.gloryLiveRoomPassword}`;
  const watchSrc = `https://vdo.ninja/?view=${event.gloryLiveRoomId}&solo&room=${event.gloryLiveRoomId}&password=${event.gloryLiveRoomPassword}`;


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>
            <Logo />
        </div>
        <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold hidden sm:block">{event.title}</h1>
            <Badge variant="destructive" className="animate-pulse">
                <Tv className="mr-2 h-4 w-4" />
                LIVE
            </Badge>
        </div>
      </header>
      <main className="flex-1 bg-muted/40">
        {mode === 'join' && (
          <div className="flex flex-col items-center justify-center p-4 text-center gap-6 h-full">
            <h2 className="text-4xl font-bold font-headline">Join the Event</h2>
            <p className="text-muted-foreground max-w-xl">
              You can join the session as a viewer or participate with your camera and microphone if you have permission.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" onClick={() => setMode('watch')}>
                <CirclePlay className="mr-2 h-5 w-5" />
                Watch Live
              </Button>
              {hasPermission('participateInLiveEvents') && (
                <Button size="lg" variant="outline" onClick={() => setMode('participate')}>
                  <MicVocal className="mr-2 h-5 w-5" />
                  Participate
                </Button>
              )}
            </div>
          </div>
        )}

        {(mode === 'watch' || mode === 'participate') && (
            <iframe
                src={mode === 'watch' ? watchSrc : participateSrc}
                allow="camera;microphone;display-capture;autoplay;clipboard-write;"
                className="w-full h-full border-0"
                allowFullScreen
            ></iframe>
        )}
      </main>
    </div>
  );
};

const GloryLiveUserView: FC = (props) => (
  <Suspense fallback={<div>Loading...</div>}>
    <GloryLiveUserViewContent {...props} />
  </Suspense>
);


export default GloryLiveUserView;
