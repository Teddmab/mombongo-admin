import { afterEach, describe, expect, it } from "vitest";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, getIdTokenResult, signInWithEmailAndPassword } from "firebase/auth";
import { collection, connectFirestoreEmulator, getDocs, getFirestore, query, where } from "firebase/firestore";
import { resolveAdminAccess } from "@/lib/adminAuthz";
import { FARMERS, TEST_ACCOUNTS, assertSafeTarget } from "../../scripts/emulator/fixtures.mjs";

// Runs against the fixtures loaded by `bun run emulator --test` (scripts/emulator/start.mjs), which sets these
// variables. Skipped otherwise, including in the CI integration job, which uses a different emulator project.
const PROJECT_ID = process.env.ADMIN_EMULATOR_PROJECT_ID ?? "";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "";
const enabled = PROJECT_ID.startsWith("demo-") && !!AUTH_HOST && !!FIRESTORE_HOST;

const apps: FirebaseApp[] = [];
async function signedIn(email: string, password: string) {
  assertSafeTarget({ projectId: PROJECT_ID, host: AUTH_HOST.split(":")[0] });
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: "demo-api-key" }, `fixture-${apps.length}-${Date.now()}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [host, port] = FIRESTORE_HOST.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return { user: cred.user, db };
}

describe.skipIf(!enabled)("emulator fixtures (demo- project only)", () => {
  afterEach(async () => { await Promise.all(apps.splice(0).map((a) => deleteApp(a))); });

  it("admin fixture: admin via the canonical role claim, and the deployed rules let it read farmer data", async () => {
    const { user, db } = await signedIn(TEST_ACCOUNTS.admin.email, TEST_ACCOUNTS.admin.password);
    const { claims } = await getIdTokenResult(user);
    expect(resolveAdminAccess(claims, user.email)).toEqual({ isAdmin: true, source: "claim" });
    const farmers = await getDocs(query(collection(db, "users"), where("role", "==", "farmer")));
    expect(farmers.docs.map((d) => d.id).sort()).toEqual(FARMERS.map((f) => f.uid).sort());
    const expl = await getDocs(query(collection(db, "exploitations"), where("farmerId", "==", "emu-farmer-0001")));
    expect(expl.size).toBe(1);
  });

  it("non-admin fixture: not an admin (access-denied path), and the rules refuse farmer data", async () => {
    const { user, db } = await signedIn(TEST_ACCOUNTS.nonAdmin.email, TEST_ACCOUNTS.nonAdmin.password);
    const { claims } = await getIdTokenResult(user);
    expect(resolveAdminAccess(claims, user.email)).toEqual({ isAdmin: false, source: "none" });
    await expect(getDocs(query(collection(db, "users"), where("role", "==", "farmer")))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects a wrong password for a fixture account", async () => {
    await expect(signedIn(TEST_ACCOUNTS.admin.email, "not-the-password")).rejects.toMatchObject({ code: expect.stringMatching(/auth\/(wrong-password|invalid-credential)/) });
  });
});
