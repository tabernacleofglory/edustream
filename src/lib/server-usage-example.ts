// src/lib/server-usage-example.ts
'use server';

// This file is an example of how to use the Firebase Admin SDK in a server context.
// It should not be imported into any client-side components.

import { getAdminDb } from './firebase-admin';
import { collection, getDocs, limit, query } from 'firebase/firestore';

// This tells Next.js to not run this code on the Edge runtime.
export const runtime = 'nodejs'; 

interface ExampleUserData {
    id: string;
    displayName: string;
    email: string;
}

/**
 * An example server function to fetch a few users from Firestore using the Admin SDK.
 * @returns {Promise<ExampleUserData[]>} A promise that resolves to an array of users.
 */
export async function getSomeUsers(): Promise<ExampleUserData[]> {
  try {
    const db = await getAdminDb();
    const usersRef = collection(db, 'users');
    const q = query(usersRef, limit(5));
    const querySnapshot = await getDocs(q);

    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      displayName: doc.data().displayName,
      email: doc.data().email,
    }));

    console.log('Successfully fetched users from Firestore:', users);
    return users;

  } catch (error) {
    console.error('Error fetching users with Admin SDK:', error);
    // In a real app, you might want to handle this more gracefully.
    return [];
  }
}
