
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFirestore, Firestore } from "firebase/firestore";

// --- Default Firebase bucket (for images, docs, thumbnails, etc.)
const firebaseConfig = {
  projectId: "edustream-5t6z4",
  appId: "1:97402238606:web:9eafd9e0eef544c9a7bbdf",
  storageBucket: "edustream-5t6z4.appspot.com", // ✅ Default bucket
  apiKey: "AIzaSyDeGE3SrZAph45xj9mgOyEKPURLgsBbIJM",
  authDomain: "edustream-5t6z4.firebaseapp.com",
  messagingSenderId: "97402238606",
};

// Initialize Firebase app (only once)
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// --- Core Firebase services
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app); // ✅ Default bucket
const db: Firestore = getFirestore(app);

// --- Additional storage for videos
// This points specifically to your dedicated transcoding bucket
const videoStorage: FirebaseStorage = getStorage(app, "gs://edustream-videos-uscentral1");

// --- Exports
export { app, auth, storage, db, videoStorage };

// --- Getter functions for backwards compatibility
export function getFirebaseApp(): FirebaseApp {
  return app;
}

export function getFirebaseAuth(): Auth {
  return auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  return storage; // default bucket
}

export function getFirebaseVideoStorage(): FirebaseStorage {
  return videoStorage; // dedicated video bucket
}

export function getFirebaseFirestore(): Firestore {
  return db;
}
