

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFirestore, Firestore } from "firebase/firestore";
import { getFunctions, Functions } from "firebase/functions";

// --- Default Firebase bucket (for images, docs, thumbnails, etc.)
const firebaseConfig = {
  projectId: "edustream-5t6z4",
  appId: "1:97402238606:web:9eafd9e0eef544c9a7bbdf",
  storageBucket: "edustream-5t6z4.appspot.com",
  apiKey: "AIzaSyDeGE3SrZAph45xj9mgOyEKPURLgsBbIJM",
  authDomain: "edustream-5t6z4.firebaseapp.com",
  messagingSenderId: "97402238606",
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
    