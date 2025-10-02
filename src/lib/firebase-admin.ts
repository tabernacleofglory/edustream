
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // When deployed in a Google Cloud environment like App Hosting,
    // initializeApp() automatically uses Application Default Credentials.
    admin.initializeApp({
        projectId: 'edustream-5t6z4',
        storageBucket: "edustream-5t6z4.appspot.com",
        databaseURL: "https://edustream-5t6z4.firebaseio.com"
    });
    console.log("Firebase Admin SDK initialized successfully with Application Default Credentials.");
  } catch (error: any) {
    console.error("Firebase Admin SDK initialization error:", error.message);
  }
}

let auth: admin.auth.Auth;
let db: admin.firestore.Firestore;
let storage: admin.storage.Storage;

// Check if the app was initialized before getting the services
if (admin.apps.length > 0) {
    auth = admin.auth();
    db = admin.firestore();
    storage = admin.storage();
} else {
    // Provide mocks or throw an error if the services are used without initialization
    const errorMessage = "Firebase Admin SDK not initialized. Ensure you are in a valid environment or have credentials set up.";
    const createProxy = () => new Proxy({}, {
        get: () => { throw new Error(errorMessage); }
    });
    auth = createProxy() as admin.auth.Auth;
    db = createProxy() as admin.firestore.Firestore;
    storage = createProxy() as admin.storage.Storage;
}

export { auth, db, storage };
