// Fictional, deterministic fixtures for the local Firebase emulators (see docs/EMULATOR.md).
// Written through the emulators' own admin REST endpoints ("Bearer owner"), which exist only on an emulator,
// so nothing here can reach a real Firebase project. Every write is refused unless the target is a local
// emulator host and the project ID starts with "demo-".

/** Emulator-only test accounts. These credentials exist only inside a demo- emulator and are documented test data. */
export const TEST_ACCOUNTS = {
  admin: { uid: "emu-admin-0001", email: "admin.test@mombongo.test", password: "emulateur-admin-0001", role: "admin", fullName: "Admin Test (émulateur)" },
  nonAdmin: { uid: "emu-agent-0001", email: "agent.test@mombongo.test", password: "emulateur-agent-0001", role: "agent", fullName: "Agent Test (émulateur)" },
};

const day = (iso) => ({ __timestamp: `${iso}T08:00:00Z` });

/** Farmer profiles (users docs only — farmers created by an admin need no login of their own). */
export const FARMERS = [
  {
    uid: "emu-farmer-0001", fullName: "Marie Kabeya", phone: "+243990000001", kycStatus: "approved", province: "Haut-Katanga",
    createdAt: day("2026-09-14"),
    exploitation: { id: "emu-expl-0001", name: "Ferme Kabeya", province: "Haut-Katanga", territory: "Kambove", village: "Kambove", totalHectares: 500,
      cultures: [ { id: "emu-cult-0001", commodity: "Maïs", icon: "🌽", surfaceHa: 50, methode: "traditionnel", saison: "principale", status: "active" },
                  { id: "emu-cult-0002", commodity: "Haricot", icon: "🫘", surfaceHa: 30, methode: "traditionnel", saison: "principale", status: "active" } ] },
  },
  {
    uid: "emu-farmer-0002", fullName: "Joseph Mwamba", phone: "+243990000002", kycStatus: "pending", province: "Lualaba",
    createdAt: day("2026-10-02"),
    exploitation: { id: "emu-expl-0002", name: "Champ Mwamba", province: "Lualaba", territory: "Mutshatsha", village: "Kasaji", totalHectares: 4,
      cultures: [ { id: "emu-cult-0003", commodity: "Manioc", icon: "🌿", surfaceHa: 3, methode: "traditionnel", saison: "pluriannuelle", status: "active" } ] },
  },
  { uid: "emu-farmer-0003", fullName: "Esther Ilunga", phone: "+243990000003", kycStatus: "none", province: "Haut-Katanga", createdAt: day("2026-10-20"), exploitation: null },
];

export function assertSafeTarget({ projectId, host }) {
  if (!String(projectId).startsWith("demo-")) throw new Error(`Refusing to seed: project "${projectId}" is not a demo- project.`);
  if (!["127.0.0.1", "localhost"].includes(host)) throw new Error(`Refusing to seed: host "${host}" is not a local emulator.`);
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "object" && v.__timestamp) return { timestampValue: v.__timestamp };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
  return { stringValue: String(v) };
}

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", authorization: "Bearer owner", ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${new URL(url).pathname} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

export async function seedFixtures({ projectId, host = "127.0.0.1", authPort, firestorePort }) {
  assertSafeTarget({ projectId, host });
  const authBase = `http://${host}:${authPort}`;
  const fsBase = `http://${host}:${firestorePort}`;
  const docs = `${fsBase}/v1/projects/${projectId}/databases/(default)/documents`;
  const put = (path, data) => call(`${docs}/${path}`, { method: "PATCH", body: JSON.stringify({ fields: toValue(data).mapValue.fields }) });

  // Start from empty so the fixture set is exact and repeatable.
  await call(`${authBase}/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" });
  await call(`${fsBase}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });

  for (const a of Object.values(TEST_ACCOUNTS)) {
    // The custom claim is what firestore.rules' isAdmin() and the admin UI check; the users/{uid}.role field is
    // what the admin Cloud Functions check. Both are set so emulator tests exercise both authorization paths.
    await call(`${authBase}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`, {
      method: "POST",
      body: JSON.stringify({ localId: a.uid, email: a.email, password: a.password, displayName: a.fullName, emailVerified: true }),
    });
    // Account creation ignores customAttributes on the emulator; set the claim the way setCustomUserClaims does.
    await call(`${authBase}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
      method: "POST",
      body: JSON.stringify({ localId: a.uid, customAttributes: JSON.stringify({ role: a.role }) }),
    });
    await put(`users/${a.uid}`, { role: a.role, fullName: a.fullName, email: a.email, isActive: true, createdAt: day("2026-09-01") });
  }

  for (const f of FARMERS) {
    const { exploitation, uid, ...profile } = f;
    await put(`users/${uid}`, { ...profile, role: "farmer", isActive: true, updatedAt: profile.createdAt, consent: { method: "phone", recordedBy: TEST_ACCOUNTS.admin.uid } });
    if (!exploitation) continue;
    const { cultures, id, ...expl } = exploitation;
    await put(`exploitations/${id}`, { ...expl, farmerId: uid, createdAt: profile.createdAt });
    for (const c of cultures) {
      const { id: cid, ...culture } = c;
      await put(`exploitations/${id}/cultures/${cid}`, { ...culture, farmerId: uid, exploitationId: id, createdAt: profile.createdAt });
    }
  }

  return {
    accounts: Object.fromEntries(Object.entries(TEST_ACCOUNTS).map(([k, a]) => [k, { uid: a.uid, email: a.email, role: a.role }])),
    farmers: FARMERS.map((f) => ({ uid: f.uid, fullName: f.fullName, kycStatus: f.kycStatus })),
  };
}
