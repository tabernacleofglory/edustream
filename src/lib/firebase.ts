import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFirestore, FirebaseFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "edustream-5t6z4",
  appId: "1:97402238606:web:9eafd9e0eef544c9a7bbdf",
  storageBucket: "edustream-5t6z4.firebasestorage.app",
  apiKey: "AIzaSyDeGE3SrZAph45xj9mgOyEKPURLgsBbIJM",
  authDomain: "edustream-5t6z4.firebaseapp.com",
  messagingSenderId: "97402238606"
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
const db: FirebaseFirestore = getFirestore(app);

// Export instances for direct use
export { app, auth, storage, db };

// Backwards compatibility for any code that uses the getter functions
export function getFirebaseApp(): FirebaseApp {
  return app;
}

export function getFirebaseAuth(): Auth {
  return auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  return storage;
}

export function getFirebaseFirestore(): FirebaseFirestore {
  return db;
}
