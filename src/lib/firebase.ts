import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, enableIndexedDbPersistence, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { emulatorFirebaseConfig, resolveEmulatorMode } from "@/lib/firebaseEmulator";

// See firebaseEmulator.ts: only a local dev server with an explicit flag and a demo- project ever gets here.
export const emulatorMode = resolveEmulatorMode(
  import.meta.env,
  typeof window === "undefined" ? "" : window.location.hostname,
);

const firebaseConfig = emulatorMode.enabled
  ? emulatorFirebaseConfig(emulatorMode.projectId)
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");

if (emulatorMode.enabled) {
  const { host, ports } = emulatorMode;
  connectAuthEmulator(auth, `http://${host}:${ports.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, ports.firestore);
  connectFunctionsEmulator(functions, host, ports.functions);
}

enableIndexedDbPersistence(db).catch((error: { code?: string }) => {
  if (error.code === "failed-precondition") console.warn("Multiple tabs open");
  if (error.code === "unimplemented")
    console.warn("Browser does not support persistence");
});

export const isDevMode = () => import.meta.env.VITE_DEV_MODE === "true";
