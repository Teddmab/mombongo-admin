#!/usr/bin/env node
// One command for local browser testing against Firebase emulators (docs/EMULATOR.md):
//   bun run emulator           → emulators + fixtures + admin dev server in emulator mode
//   bun run emulator --test    → emulators + fixtures + emulator integration tests, then exit
//   add --with-functions       → also run ../mombongo-functions (needs `npm run build` there first)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedFixtures, assertSafeTarget } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECT_ID = process.env.ADMIN_EMULATOR_PROJECT_ID ?? "demo-mombongo-admin";
const HOST = "127.0.0.1";
const PORTS = { auth: 9399, firestore: 8399, functions: 5399, hub: 4399, logging: 4599, admin: 5180 };
const args = new Set(process.argv.slice(2));
const TEST_MODE = args.has("--test");
const WITH_FUNCTIONS = args.has("--with-functions");

assertSafeTarget({ projectId: PROJECT_ID, host: HOST });

// Prefer the deployed (canonical) rules from mombongo-functions; fall back to this repo's local copy.
const canonicalRules = path.resolve(ROOT, "../mombongo-functions/firestore.rules");
const rules = existsSync(canonicalRules) ? canonicalRules : path.join(ROOT, "firestore.rules");
const functionsDir = path.resolve(ROOT, "../mombongo-functions");
if (WITH_FUNCTIONS && !existsSync(path.join(functionsDir, "lib/index.js")))
  throw new Error(`--with-functions needs a built ${functionsDir} (run \`npm ci && npm run build\` there first).`);

const workDir = path.join(ROOT, ".emulator-local");
mkdirSync(workDir, { recursive: true });
const config = {
  firestore: { rules },
  ...(WITH_FUNCTIONS ? { functions: { source: functionsDir, runtime: "nodejs20", ignore: ["node_modules", "src", ".git"] } } : {}),
  emulators: {
    auth: { host: HOST, port: PORTS.auth },
    firestore: { host: HOST, port: PORTS.firestore },
    ...(WITH_FUNCTIONS ? { functions: { host: HOST, port: PORTS.functions } } : {}),
    hub: { host: HOST, port: PORTS.hub },
    logging: { host: HOST, port: PORTS.logging },
    ui: { enabled: false },
    singleProjectMode: true,
  },
};
writeFileSync(path.join(workDir, "firebase.json"), JSON.stringify(config, null, 2));

const children = [];
const stopAll = () => children.forEach((c) => !c.killed && c.kill("SIGINT"));
process.on("SIGINT", () => { stopAll(); process.exit(130); });

const only = ["auth", "firestore", ...(WITH_FUNCTIONS ? ["functions"] : [])].join(",");
const emulators = spawn("bunx", ["--package", "firebase-tools@15.20.0", "firebase", "emulators:start", "--config", path.join(workDir, "firebase.json"), "--project", PROJECT_ID, "--only", only], { cwd: workDir, stdio: ["ignore", "pipe", "pipe"] });
children.push(emulators);
let emulatorLog = "";
emulators.stdout.on("data", (d) => (emulatorLog += d));
emulators.stderr.on("data", (d) => (emulatorLog += d));
emulators.on("exit", (code) => { if (code) { console.error(emulatorLog.slice(-2000)); process.exit(code); } });

async function waitFor(url, label) {
  for (let i = 0; i < 240; i++) {
    try { if ((await fetch(url)).status < 500) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not start (see emulator output above)`);
}
await waitFor(`http://${HOST}:${PORTS.auth}/`, "Auth emulator");
await waitFor(`http://${HOST}:${PORTS.firestore}/`, "Firestore emulator");
if (WITH_FUNCTIONS) await waitFor(`http://${HOST}:${PORTS.functions}/`, "Functions emulator");

const seeded = await seedFixtures({ projectId: PROJECT_ID, host: HOST, authPort: PORTS.auth, firestorePort: PORTS.firestore });

const env = {
  ...process.env,
  VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_FIREBASE_EMULATOR_PROJECT_ID: PROJECT_ID,
  VITE_FIREBASE_EMULATOR_AUTH_PORT: String(PORTS.auth),
  VITE_FIREBASE_EMULATOR_FIRESTORE_PORT: String(PORTS.firestore),
  VITE_FIREBASE_EMULATOR_FUNCTIONS_PORT: String(PORTS.functions),
  ADMIN_EMULATOR_PROJECT_ID: PROJECT_ID,
  FIREBASE_AUTH_EMULATOR_HOST: `${HOST}:${PORTS.auth}`,
  FIRESTORE_EMULATOR_HOST: `${HOST}:${PORTS.firestore}`,
};

console.log(`\nFirebase emulators (project ${PROJECT_ID}, rules: ${path.relative(ROOT, rules)}) — fictional fixtures loaded:`);
for (const [k, a] of Object.entries(seeded.accounts)) console.log(`  ${k.padEnd(9)} ${a.email}  (role ${a.role}; emulator-only password: see docs/EMULATOR.md)`);
for (const f of seeded.farmers) console.log(`  farmer    ${f.fullName}  (KYC ${f.kycStatus})`);

if (TEST_MODE) {
  const tests = spawn("bunx", ["vitest", "run", "--config", "vitest.integration.config.ts", "src/__tests__/emulatorFixtures.integration.test.ts"], { cwd: ROOT, env, stdio: "inherit" });
  children.push(tests);
  tests.on("exit", (code) => { stopAll(); process.exit(code ?? 1); });
} else {
  const vite = spawn("bunx", ["vite", "--host", HOST, "--port", String(PORTS.admin), "--strictPort"], { cwd: ROOT, env, stdio: ["ignore", "inherit", "inherit"] });
  children.push(vite);
  await waitFor(`http://${HOST}:${PORTS.admin}/`, "Admin dev server");
  console.log(`\nAdmin (emulator mode): http://${HOST}:${PORTS.admin}/login   — Ctrl+C stops everything.\n`);
  vite.on("exit", () => { stopAll(); process.exit(0); });
}
