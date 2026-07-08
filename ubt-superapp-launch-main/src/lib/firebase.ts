import { initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

// NOTE: Replace these placeholders with real values via env in production.
// Using safe placeholders here so the app boots in preview without crashing.
const firebaseConfig = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  databaseURL: "https://placeholder-default-rtdb.firebaseio.com",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID",
};

let app: FirebaseApp | null = null;
let _db: Database | null = null;

export const getFirebaseApp = (): FirebaseApp | null => {
  try {
    if (!app) app = initializeApp(firebaseConfig);
    return app;
  } catch {
    return null;
  }
};

export const db: Database | null = (() => {
  try {
    const a = getFirebaseApp();
    if (!a) return null;
    if (firebaseConfig.databaseURL.includes("placeholder")) {
      return null;
    }
    _db = getDatabase(a);
    return _db;
  } catch {
    return null;
  }
})();
