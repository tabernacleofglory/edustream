
'use server';
import { cookies } from 'next/headers';

export async function signOut() {
  cookies().delete('session');
}
