'use client';

import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { LiveEvent } from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * Creates a new live event in Firestore.
 * uses non-blocking writes for better performance.
 */
export const createLiveEvent = (
  eventData: Omit<LiveEvent, 'id' | 'status'>
) => {
  const startTimeAsDate = new Date(eventData.startTime);

  const dataToSave: any = {
    ...eventData,
    status: 'upcoming',
    startTime: startTimeAsDate,
    platform: eventData.platform || 'gloryLive',
    createdAt: serverTimestamp(),
  };
  
  // CRITICAL: Ensure no 'undefined' values reach Firestore
  Object.keys(dataToSave).forEach(key => {
    if (dataToSave[key] === undefined) {
      delete dataToSave[key];
    }
  });
  
  addDoc(collection(db, 'liveEvents'), dataToSave)
    .catch(async (error) => {
      const permissionError = new FirestorePermissionError({
        path: 'liveEvents',
        operation: 'create',
        requestResourceData: dataToSave,
      } satisfies SecurityRuleContext);

      errorEmitter.emit('permission-error', permissionError);
    });
};

const generatePassword = () => {
  return Math.random().toString(36).slice(-8);
};

/**
 * Starts a live stream, creating a Glory Live room if necessary.
 */
export const goLiveWithGloryLive = async (eventId: string, vdoNinjaRoomId?: string): Promise<{ success: boolean; message: string; roomId?: string, password?: string }> => {
    try {
        const eventRef = doc(db, 'liveEvents', eventId);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
            throw new Error('Event not found.');
        }

        const eventData = eventSnap.data() as LiveEvent;

        if (eventData.platform === 'external') {
            updateDoc(eventRef, { status: 'live' }).catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: eventRef.path,
                    operation: 'update',
                    requestResourceData: { status: 'live' },
                }));
            });
            return { success: true, message: "Event status set to live." };
        }

        const roomId = vdoNinjaRoomId || eventData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const password = generatePassword();

        const updateData = {
            gloryLiveRoomId: roomId,
            gloryLiveRoomPassword: password,
            status: 'live'
        };

        updateDoc(eventRef, updateData).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: eventRef.path,
                operation: 'update',
                requestResourceData: updateData,
            }));
        });

        return { success: true, message: "Room created successfully.", roomId, password };
    } catch (error: any) {
        console.error("Error creating Glory Live room:", error);
        return { success: false, message: error.message || 'Failed to create Glory Live room.' };
    }
};

/**
 * Updates an existing live event.
 */
export const updateLiveEvent = (
  eventId: string,
  eventData: Partial<Omit<LiveEvent, 'id'>>
) => {
  const dataToUpdate: Record<string, any> = { ...eventData };
  if (eventData.startTime) {
    dataToUpdate.startTime = new Date(eventData.startTime);
  }
  
  // CRITICAL: Ensure no 'undefined' values reach Firestore
  Object.keys(dataToUpdate).forEach(key => {
    if (dataToUpdate[key] === undefined) {
      delete dataToUpdate[key];
    }
  });
  
  const eventRef = doc(db, 'liveEvents', eventId);
  updateDoc(eventRef, dataToUpdate).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: eventRef.path,
          operation: 'update',
          requestResourceData: dataToUpdate,
      }));
  });
};

/**
 * Deletes a live event.
 */
export const deleteLiveEvent = (eventId: string) => {
  const eventRef = doc(db, 'liveEvents', eventId);
  deleteDoc(eventRef).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: eventRef.path,
          operation: 'delete',
      }));
  });
};
