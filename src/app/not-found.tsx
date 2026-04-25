
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileWarning } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <FileWarning className="w-16 h-16 text-destructive mb-4" />
      <h1 className="text-4xl font-bold font-headline mb-2">404 - Page Not Found</h1>
      <p className="text-lg text-muted-foreground mb-6">
        Sorry, the page you are looking for does not exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/">Return to Homepage</Link>
      </Button>
    </div>
  );
}
