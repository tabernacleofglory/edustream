'use server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/firebase-admin';

export async function signOut() {
  cookies().delete('session');
}

export async function getFirebaseAuth() {
    return auth;
}
