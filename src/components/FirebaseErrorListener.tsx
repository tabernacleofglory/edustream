'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

/**
 * A invisible component that listens for global Firebase errors
 * and logs them to the console. In development, this helps surface
 * Security Rule issues clearly.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const unsubscribe = errorEmitter.on('permission-error', (error) => {
      // Log to console for developer visibility. 
      // Next.js development overlay will often catch uncaught errors,
      // but logging here ensures they aren't swallowed by background promises.
      console.error('Firebase Contextual Error:', error);
    });
    
    return () => unsubscribe();
  }, []);

  return null;
}
