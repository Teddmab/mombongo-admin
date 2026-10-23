import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EMULATOR_PORTS, emulatorFirebaseConfig, resolveEmulatorMode } from "@/lib/firebaseEmulator";

const LOCAL_DEV = { DEV: true, VITE_USE_FIREBASE_EMULATORS: "true", VITE_FIREBASE_EMULATOR_PROJECT_ID: "demo-mombongo-admin" };

describe("resolveEmulatorMode", () => {
  it("is disabled when the flag is absent (normal production and dev behaviour)", () => {
    expect(resolveEmulatorMode({ DEV: true }, "localhost")).toEqual({ enabled: false });
    expect(resolveEmulatorMode({ DEV: false }, "mombongo-admin.pages.dev")).toEqual({ enabled: false });
  });

  it("is disabled unless the flag is exactly 'true'", () => {
    for (const flag of ["TRUE", "1", "yes", " true", ""])
      expect(resolveEmulatorMode({ ...LOCAL_DEV, VITE_USE_FIREBASE_EMULATORS: flag }, "localhost")).toEqual({ enabled: false });
  });

  it("connects only for a local dev server with a demo- project", () => {
    for (const host of ["localhost", "127.0.0.1"])
      expect(resolveEmulatorMode(LOCAL_DEV, host)).toEqual({
        enabled: true, projectId: "demo-mombongo-admin", host: "127.0.0.1", ports: { ...DEFAULT_EMULATOR_PORTS },
      });
  });

  it("refuses a production or preview build even if the flag is set", () => {
    expect(() => resolveEmulatorMode({ ...LOCAL_DEV, DEV: false }, "localhost")).toThrow(/production\/preview build/);
  });

  it("refuses any non-local hostname", () => {
    for (const host of ["mombongo-admin.pages.dev", "abc.mombongo-admin.pages.dev", "192.168.1.10", "0.0.0.0", ""])
      expect(() => resolveEmulatorMode(LOCAL_DEV, host)).toThrow(/only allowed on localhost/);
  });

  it("refuses real (non demo-) projects and a missing project ID", () => {
    for (const projectId of ["mombongo-dev", "mombongo-prod", "my-demo-project", undefined])
      expect(() => resolveEmulatorMode({ ...LOCAL_DEV, VITE_FIREBASE_EMULATOR_PROJECT_ID: projectId }, "localhost")).toThrow(/demo- project/);
  });

  it("accepts explicit ports and rejects invalid ones", () => {
    const mode = resolveEmulatorMode({ ...LOCAL_DEV, VITE_FIREBASE_EMULATOR_AUTH_PORT: "9500", VITE_FIREBASE_EMULATOR_FIRESTORE_PORT: "8500", VITE_FIREBASE_EMULATOR_FUNCTIONS_PORT: "5500" }, "localhost");
    expect(mode).toMatchObject({ ports: { auth: 9500, firestore: 8500, functions: 5500 } });
    expect(() => resolveEmulatorMode({ ...LOCAL_DEV, VITE_FIREBASE_EMULATOR_AUTH_PORT: "abc" }, "localhost")).toThrow(/Invalid Firebase emulator port/);
  });

  it("builds a config that carries no real project, key or bucket", () => {
    const cfg = emulatorFirebaseConfig("demo-mombongo-admin");
    expect(cfg.projectId).toBe("demo-mombongo-admin");
    expect(JSON.stringify(cfg)).not.toMatch(/mombongo-dev|AIza/);
  });
});

type Mocks = Record<string, ReturnType<typeof vi.fn>>;
const mocks = () => (globalThis as unknown as { __firebaseMocks: Mocks }).__firebaseMocks;

describe("Firebase initialization (src/lib/firebase.ts)", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks()).forEach((m) => m.mockClear());
  });
  afterEach(() => vi.unstubAllEnvs());

  it("without the flag: unchanged — real VITE_FIREBASE_* config, no emulator connection", async () => {
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "mombongo-dev");
    vi.stubEnv("VITE_FIREBASE_API_KEY", "configured-key");
    const { emulatorMode } = await import("@/lib/firebase");
    expect(emulatorMode).toEqual({ enabled: false });
    expect(mocks().initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: "mombongo-dev", apiKey: "configured-key" }));
    expect(mocks().connectAuthEmulator).not.toHaveBeenCalled();
    expect(mocks().connectFirestoreEmulator).not.toHaveBeenCalled();
    expect(mocks().connectFunctionsEmulator).not.toHaveBeenCalled();
  });

  it("with the flag on localhost: demo- project only, and auth/firestore/functions all point at the emulators", async () => {
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "mombongo-dev");
    vi.stubEnv("VITE_USE_FIREBASE_EMULATORS", "true");
    vi.stubEnv("VITE_FIREBASE_EMULATOR_PROJECT_ID", "demo-mombongo-admin");
    await import("@/lib/firebase");
    expect(mocks().initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: "demo-mombongo-admin" }));
    expect(JSON.stringify(mocks().initializeApp.mock.calls)).not.toContain("mombongo-dev\"");
    expect(mocks().connectAuthEmulator).toHaveBeenCalledWith(expect.anything(), "http://127.0.0.1:9399", { disableWarnings: true });
    expect(mocks().connectFirestoreEmulator).toHaveBeenCalledWith(expect.anything(), "127.0.0.1", 8399);
    expect(mocks().connectFunctionsEmulator).toHaveBeenCalledWith(expect.anything(), "127.0.0.1", 5399);
  });

  it("with the flag in a production build: fails closed before any Firebase app is created", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_USE_FIREBASE_EMULATORS", "true");
    vi.stubEnv("VITE_FIREBASE_EMULATOR_PROJECT_ID", "demo-mombongo-admin");
    await expect(import("@/lib/firebase")).rejects.toThrow(/production\/preview build/);
    expect(mocks().initializeApp).not.toHaveBeenCalled();
  });

  it("with the flag and a real project ID: fails closed", async () => {
    vi.stubEnv("VITE_USE_FIREBASE_EMULATORS", "true");
    vi.stubEnv("VITE_FIREBASE_EMULATOR_PROJECT_ID", "mombongo-dev");
    await expect(import("@/lib/firebase")).rejects.toThrow(/demo- project/);
    expect(mocks().initializeApp).not.toHaveBeenCalled();
  });
});
