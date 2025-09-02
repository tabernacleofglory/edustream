
'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Check for the specific Next.js chunk load error
    if (error.message.includes('ChunkLoadError')) {
      // Force a hard reload of the page to get the latest assets
      window.location.reload(true);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'sans-serif',
          textAlign: 'center',
          padding: '1rem',
        }}>
          <h2>Something went wrong!</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            We're attempting to refresh the application to fix the issue.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ccc',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
