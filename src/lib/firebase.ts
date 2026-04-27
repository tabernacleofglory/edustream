

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFirestore, Firestore } from "firebase/firestore";
import { getFunctions, Functions } from "firebase/functions";

// --- Default Firebase bucket (for images, docs, thumbnails, etc.)
const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
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
    