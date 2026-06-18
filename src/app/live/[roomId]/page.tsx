
'use client';

import { useParams, useRouter } from 'next/navigation';
import { FC, Suspense, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CirclePlay, MicVocal } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { LiveEvent } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { GloryViewer } from '@/components/glory/viewer';
import { GloryParticipant } from '@/components/glory/participant';

const GloryLiveUserViewContent: FC = () => {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'join' | 'watch' | 'participate'>('join');

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
        }
      } catch (err) {
        console.error("Error fetching event:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [roomId]);

  const handleBack = () => {
    if (mode === 'join') {
      router.push('/live');
    } else {
      setMode('join');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-6 w-32" />
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

  if (mode === 'watch') {
    return (
      <GloryViewer
        roomId={event.gloryLiveRoomId || ''}
        password={event.gloryLiveRoomPassword || ''}
        eventTitle={event.title}
        onBack={handleBack}
      />
    );
  }

  if (mode === 'participate') {
    return (
      <GloryParticipant
        roomId={event.gloryLiveRoomId || ''}
        password={event.gloryLiveRoomPassword || ''}
        eventTitle={event.title}
        onLeave={() => setMode('join')}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleBack}>
                <CirclePlay className="mr-2 h-4 w-4" />
                Back
            </Button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center p-4 text-center gap-6 max-w-lg">
          <h2 className="text-4xl font-bold font-headline">Join the Event</h2>
          <p className="text-muted-foreground max-w-xl">
            You can join the session as a viewer or participate with your camera and microphone.
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
      </main>
    </div>
  );
};

const GloryLiveUserView: FC = (props) => (
  <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>}>
    <GloryLiveUserViewContent {...props} />
  </Suspense>
);

export default GloryLiveUserView;
