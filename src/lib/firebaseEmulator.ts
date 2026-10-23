/**
 * Local-only Firebase emulator mode, for browser testing against fictional data.
 *
 * Emulator mode is used only when ALL of these hold:
 *   - a Vite development server (import.meta.env.DEV);
 *   - VITE_USE_FIREBASE_EMULATORS is exactly "true";
 *   - the page is served from localhost or 127.0.0.1;
 *   - VITE_FIREBASE_EMULATOR_PROJECT_ID starts with "demo-" (a project that cannot exist in Google Cloud).
 * If the flag is set but any other condition fails, startup throws instead of falling back to a real project.
 * Without the flag nothing changes: the app uses the VITE_FIREBASE_* project as before.
 */

export interface EmulatorEnv {
  DEV?: boolean;
  VITE_USE_FIREBASE_EMULATORS?: string;
  VITE_FIREBASE_EMULATOR_PROJECT_ID?: string;
  VITE_FIREBASE_EMULATOR_AUTH_PORT?: string;
  VITE_FIREBASE_EMULATOR_FIRESTORE_PORT?: string;
  VITE_FIREBASE_EMULATOR_FUNCTIONS_PORT?: string;
}

export interface EmulatorTarget {
  projectId: string;
  host: string;
  ports: { auth: number; firestore: number; functions: number };
}

export type EmulatorMode = { enabled: false } | ({ enabled: true } & EmulatorTarget);

/** Default ports, chosen away from the Firebase defaults so other projects' emulators can run alongside. */
export const DEFAULT_EMULATOR_PORTS = { auth: 9399, firestore: 8399, functions: 5399 } as const;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function port(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) throw new Error(`Invalid Firebase emulator port: ${value}`);
  return n;
}

export function resolveEmulatorMode(env: EmulatorEnv, hostname: string): EmulatorMode {
  if (env.VITE_USE_FIREBASE_EMULATORS !== "true") return { enabled: false };

  if (!env.DEV)
    throw new Error("Firebase emulator mode was requested in a production/preview build; refusing to start.");
  if (!LOCAL_HOSTNAMES.has(hostname))
    throw new Error(`Firebase emulator mode is only allowed on localhost or 127.0.0.1 (got "${hostname}").`);
  const projectId = env.VITE_FIREBASE_EMULATOR_PROJECT_ID ?? "";
  if (!projectId.startsWith("demo-"))
    throw new Error("Firebase emulator mode requires a demo- project ID (VITE_FIREBASE_EMULATOR_PROJECT_ID); refusing to use a real project.");

  return {
    enabled: true,
    projectId,
    host: "127.0.0.1",
    ports: {
      auth: port(env.VITE_FIREBASE_EMULATOR_AUTH_PORT, DEFAULT_EMULATOR_PORTS.auth),
      firestore: port(env.VITE_FIREBASE_EMULATOR_FIRESTORE_PORT, DEFAULT_EMULATOR_PORTS.firestore),
      functions: port(env.VITE_FIREBASE_EMULATOR_FUNCTIONS_PORT, DEFAULT_EMULATOR_PORTS.functions),
    },
  };
}

/** Firebase web config for a demo- project: no real API key, project, bucket or app ID is ever used. */
export function emulatorFirebaseConfig(projectId: string) {
  return {
    apiKey: "demo-api-key",
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
    appId: "demo-app-id",
  };
}
