
'use client';

import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { FC, Suspense, useCallback } from 'react';
import { updateLiveEvent } from '@/lib/live-events';
import { GloryBroadcaster } from '@/components/glory/broadcaster';

interface GloryLiveAdminViewProps {}

const GloryLiveAdminViewContent: FC<GloryLiveAdminViewProps> = () => {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const searchParams = useSearchParams();
  const password = searchParams.get('password');

  const handleEndStream = useCallback(async () => {
    try {
      await updateLiveEvent(roomId, { status: 'ended' });
    } catch {
      // Error already handled by live-events.ts
    }
    router.push('/admin/live');
  }, [roomId, router]);

  const handleBack = useCallback(() => {
    router.push('/admin/live');
  }, [router]);

  if (!roomId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">No Room ID specified.</p>
      </div>
    );
  }

  return (
    <GloryBroadcaster
      roomId={roomId}
      password={password || ''}
      eventTitle="Director Console"
      onEndStream={handleEndStream}
      onBack={handleBack}
    />
  );
};

const GloryLiveAdminView: FC<GloryLiveAdminViewProps> = (props) => (
  <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>}>
    <GloryLiveAdminViewContent {...props} />
  </Suspense>
);

export default GloryLiveAdminView;
