
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
    // This is a specific Next.js error that can happen when a new version of the
    // site is deployed and the user's browser has cached an old HTML file
    // that tries to load JS chunks that no longer exist.
    // A hard reload is the best way to solve this.
    if (error.name === 'ChunkLoadError') {
      window.location.reload();
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
            An unexpected error occurred. We are attempting to fix it.
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
