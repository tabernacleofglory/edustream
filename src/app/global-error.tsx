
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkLoadError = error.name === 'ChunkLoadError';

  useEffect(() => {
    // For some specific errors, a hard reload is the best solution.
    if (isChunkLoadError) {
        // You can optionally log this error to your monitoring service
        console.error("Caught ChunkLoadError, prompting user for reload.");
    }
  }, [isChunkLoadError]);

  if (isChunkLoadError) {
    return (
        <html>
            <body>
                 <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-background">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-center gap-2">
                                <AlertTriangle className="h-6 w-6 text-amber-500" />
                                Application Update
                            </CardTitle>
                            <CardDescription>A new version of the application is available.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>Please reload the page to get the latest updates and continue.</p>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={() => window.location.reload()}>
                                Reload Page
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </body>
        </html>
    );
  }

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-background">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                       Something Went Wrong
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>An unexpected error occurred. Please try again.</p>
                </CardContent>
                <CardFooter>
                    <Button className="w-full" onClick={() => reset()}>
                        Try Again
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </body>
    </html>
  );
}
