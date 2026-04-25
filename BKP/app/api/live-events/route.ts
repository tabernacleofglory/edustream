
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import type { LiveEvent } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { title, description } = await req.json();

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const newEventData = {
      title,
      description,
      status: 'upcoming' as 'upcoming',
      startTime: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('liveEvents').add(newEventData);

    const createdEvent: LiveEvent = {
        id: docRef.id,
        title: title,
        description: description,
        status: 'upcoming',
        // Optimistically return a placeholder date. 
        // The client will get the real date via its real-time listener.
        startTime: new Date().toISOString(), 
    };

    return NextResponse.json(createdEvent, { status: 201 });

  } catch (error: any) {
    console.error('Error creating live event:', error);
    const userFacingError = 'Failed to create live event. Firebase Admin SDK not initialized. Ensure FIREBASE_SERVICE_ACCOUNT_KEY is set in your environment.';
    return NextResponse.json({ error: userFacingError }, { status: 500 });
  }
}
