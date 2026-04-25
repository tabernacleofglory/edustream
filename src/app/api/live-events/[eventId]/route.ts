
import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-admin';
import type { LiveEvent } from '@/lib/types';

interface RouteParams {
  params: {
    eventId: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = params;
    const eventData = await req.json() as Partial<LiveEvent>;
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const eventRef = doc(db, 'liveEvents', eventId);
    await updateDoc(eventRef, eventData);

    const updatedDoc = await getDoc(eventRef);
    
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error) {
    console.error(`Error updating event ${params.eventId}:`, error);
    return NextResponse.json({ error: 'Failed to update live event' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = params;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const eventRef = doc(db, 'liveEvents', eventId);
    await deleteDoc(eventRef);

    return NextResponse.json({ message: 'Event deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error(`Error deleting event ${params.eventId}:`, error);
    return NextResponse.json({ error: 'Failed to delete live event' }, { status: 500 });
  }
}
