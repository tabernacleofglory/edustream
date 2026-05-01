

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFirestore, Firestore } from "firebase/firestore";
import { getFunctions, Functions } from "firebase/functions";

// --- Default Firebase bucket (for images, docs, thumbnails, etc.)
// Firebase Web API keys are strictly public identifiers and are safe to embed.
// Using fallbacks ensures the Next.js build succeeds on Firebase App Hosting.
const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "edustream-5t6z4",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:97402238606:web:9eafd9e0eef544c9a7bbdf",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "edustream-5t6z4.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDeGE3SrZAph45xj9mgOyEKPURLgsBbIJM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "edustream-5t6z4.firebaseapp.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "97402238606",
};

// Initialize Firebase app (only once)
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// --- Core Firebase services
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
const db: Firestore = getFirestore(app);
const functions: Functions = getFunctions(app, 'us-central1');

// --- Exports
export { app, auth, storage, db, functions };

// --- Getter functions for backwards compatibility
export function getFirebaseApp(): FirebaseApp {
  return app;
}

export function getFirebaseAuth(): Auth {
  return auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  return storage;
}

export function getFirebaseFirestore(): Firestore {
  return db;
}

export function getFirebaseFunctions(): Functions {
  return functions;
}
    