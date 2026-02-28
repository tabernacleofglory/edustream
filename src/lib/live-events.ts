
'use server';

import { db } from './firebase-admin'; 
import type { LiveEvent } from './types';
import { v4 as uuidv4 } from 'uuid';

export const createLiveEvent = async (
  eventData: Omit<LiveEvent, 'id' | 'status'>
): Promise<LiveEvent> => {
  try {
    const startTimeAsDate = new Date(eventData.startTime);

    const dataToSave = {
      ...eventData,
      status: 'upcoming' as 'upcoming',
      startTime: startTimeAsDate, // Store as a Timestamp
      platform: eventData.platform || 'gloryLive',
    };
    
    const docRef = await db.collection('liveEvents').add(dataToSave);

    // Reconstruct the event object to match the client-side type, converting Timestamp back to ISO string
    return {
      ...(eventData as any), // Cast to any to handle type mismatch during creation
      id: docRef.id,
      status: 'upcoming',
      startTime: startTimeAsDate.toISOString(),
    };
  } catch (error) {
    console.error("Error creating live event document: ", error);
    throw new Error('Failed to create live event document.');
  }
};

const generatePassword = () => {
  return Math.random().toString(36).slice(-8);
}

export const goLiveWithGloryLive = async (eventId: string, vdoNinjaRoomId?: string): Promise<{ success: boolean; message: string; roomId?: string, password?: string }> => {
    try {
        const eventRef = db.collection('liveEvents').doc(eventId);
        const eventDoc = await eventRef.get();

        if (!eventDoc.exists) {
            throw new Error('Event not found.');
        }

        const eventData = eventDoc.data() as LiveEvent;

        if (eventData.platform === 'external') {
            await eventRef.update({ status: 'live' });
            return { success: true, message: "Event status set to live." };
        }

        const roomId = vdoNinjaRoomId || eventData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const password = generatePassword();

        await eventRef.update({
            gloryLiveRoomId: roomId,
            gloryLiveRoomPassword: password,
            status: 'live'
        });

        return { success: true, message: "Room created successfully.", roomId, password };
    } catch (error: any) {
        console.error("Error creating Glory Live room:", error);
        return { success: false, message: error.message || 'Failed to create Glory Live room.' };
    }
};

export const updateLiveEvent = async (
  eventId: string,
  eventData: Partial<Omit<LiveEvent, 'id'>>
): Promise<LiveEvent> => {
  try {
    const dataToUpdate: Record<string, any> = { ...eventData };
    if (eventData.startTime) {
      dataToUpdate.startTime = new Date(eventData.startTime);
    }
    const eventRef = db.collection('liveEvents').doc(eventId);
    await eventRef.update(dataToUpdate);
    
    const updatedDoc = await eventRef.get();
    const data = updatedDoc.data()!;

    return {
      id: eventId,
      ...data,
      startTime: (data.startTime as any).toDate().toISOString(),
    } as LiveEvent;


  } catch (error) {
    console.error("Error updating live event: ", error);
    throw new Error('Failed to update live event.');
  }
};

export const deleteLiveEvent = async (eventId: string): Promise<void> => {
  try {
    const eventRef = db.collection('liveEvents').doc(eventId);
    await eventRef.delete();
  } catch (error) {
    console.error("Error deleting live event: ", error);
    throw new Error('Failed to delete live event.');
  }
};
