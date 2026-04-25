'use server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/firebase-admin';

export async function signOut() {
  (await cookies()).delete('session');
}

export async function getFirebaseAuth() {
    return auth;
}
