'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkLoadError = 
    error.name === 'ChunkLoadError' || 
    error.message?.includes('Loading chunk') || 
    error.message?.includes('Failed to fetch');

  if (isChunkLoadError) {
    return (
      <html lang="en">
        <body className="antialiased">
          <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-background">
            <Card className="w-full max-w-md border-amber-200 bg-amber-50 dark:bg-amber-900/10">
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-6 w-6" />
                  Application Update
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-300">
                  A new version of the application is available or the connection was lost.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-amber-800 dark:text-amber-200">
                <p className="text-sm">Please reload the page to receive the latest updates and continue your session.</p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white border-none" 
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
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
    <html lang="en">
      <body className="antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-background">
          <Card className="w-full max-w-md border-destructive/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                Unexpected Error
              </CardTitle>
              <CardDescription>
                We encountered a problem loading the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground break-words bg-muted p-3 rounded-md font-mono text-left">
                {error.message || "An unexpected error occurred. Please try again."}
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => reset()}>
                Try Again
              </Button>
              <Button variant="ghost" className="w-full text-xs" onClick={() => window.location.href = '/'}>
                Return Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      </body>
    </html>
  );
}
