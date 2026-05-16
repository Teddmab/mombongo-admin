export const clearFirestoreEmulator = async () => {
  const response = await fetch(
    "http://localhost:8080/emulator/v1/projects/mombongo-dev/databases/(default)/documents",
    { method: "DELETE" }
  );

  if (!response.ok) console.warn("Could not clear Firestore emulator:", response.status);
};

export const createTestApp = async (name: string) => {
  const { deleteApp, initializeApp } = await import("firebase/app");
  const { connectAuthEmulator, getAuth } = await import("firebase/auth");
  const { connectFirestoreEmulator, getFirestore } = await import("firebase/firestore");

  const app = initializeApp({ projectId: "mombongo-dev", apiKey: "test-key" }, `${name}-${Date.now()}`);
  const db = getFirestore(app);
  const auth = getAuth(app);

  connectFirestoreEmulator(db, "localhost", 8080);
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });

  return { app, db, auth, cleanup: () => deleteApp(app) };
};