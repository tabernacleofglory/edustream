
'use client';

import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { FC, Suspense } from 'react';
import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Tv } from 'lucide-react';

interface GloryLiveAdminViewProps {}

const GloryLiveAdminViewContent: FC<GloryLiveAdminViewProps> = () => {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const searchParams = useSearchParams();
  const password = searchParams.get('password');

  if (!roomId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">No Room ID specified.</p>
      </div>
    );
  }

  const src = `https://vdo.ninja/?director=${roomId}&password=${password}&showdirector`;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Events
                </Button>
                <Logo />
            </div>
            <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold hidden sm:block">Director Console</h1>
                <Badge variant="destructive" className="animate-pulse">
                    <Tv className="mr-2 h-4 w-4" />
                    LIVE
                </Badge>
            </div>
        </header>
        <main className="flex-1 bg-black">
            <iframe
                src={src}
                allow="camera;microphone;display-capture;autoplay;clipboard-write;"
                className="w-full h-full border-0"
                allowFullScreen
            ></iframe>
        </main>
    </div>
  );
};

const GloryLiveAdminView: FC<GloryLiveAdminViewProps> = (props) => (
  <Suspense fallback={<div>Loading...</div>}>
    <GloryLiveAdminViewContent {...props} />
  </Suspense>
);

export default GloryLiveAdminView;
