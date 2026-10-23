# Local browser testing with Firebase emulators

For testing the admin app in a real browser **without any real Firebase project, account or data**.

```sh
bun run emulator                    # emulators + fictional fixtures + admin dev server → http://127.0.0.1:5180/login
bun run emulator --test             # same emulators + fixtures, runs src/__tests__/emulatorFixtures.integration.test.ts, exits
bun run emulator --with-functions   # also runs ../mombongo-functions in the Functions emulator (build it first: npm ci && npm run build)
```

`Ctrl+C` stops the emulators and the dev server together. Requirements: bun, Java (for the Firestore emulator). firebase-tools 15.20.0 is fetched by `bunx`.

## What it does
- Starts the Auth and Firestore emulators (and optionally Functions) for the project **`demo-mombongo-admin`**. A `demo-` project cannot exist in Google Cloud, so nothing can leave the machine.
- Uses ports **9399** (auth), **8399** (firestore), **5399** (functions), **4399/4599** (hub/logging), **5180** (admin). These differ from the Firebase defaults on purpose, so this can run next to other projects' emulators.
- Loads the **deployed** Firestore rules from `../mombongo-functions/firestore.rules` when that repo sits next to this one, otherwise this repo's local copy. The runner prints which one it used. Rules are never relaxed.
- Loads the fixtures below (`scripts/emulator/fixtures.mjs`), replacing whatever the emulators held, so every run starts from the same state.
- Starts `vite` with `VITE_USE_FIREBASE_EMULATORS=true`. The app then connects Auth, Firestore and Functions to the emulators and shows a small "Émulateur local" badge.

## Fixtures (fictional — emulator-only test data)

| Account | Email | Password | Role claim + `users/{uid}.role` |
|---|---|---|---|
| Administrator | `admin.test@mombongo.test` | `emulateur-admin-0001` | `admin` |
| Non-admin | `agent.test@mombongo.test` | `emulateur-agent-0001` | `agent` (gets the access-denied screen) |

These accounts exist only inside the `demo-mombongo-admin` emulator. They are not real credentials and do not exist in any Firebase project. Both authorization sources are seeded: the `role` custom claim (checked by `firestore.rules` and the admin UI) and the `users/{uid}.role` field (checked by admin Cloud Functions).

Farmers: **Marie Kabeya** (KYC approved; Ferme Kabeya, Kambove, Haut-Katanga, 500 ha, maize 50 ha + beans 30 ha), **Joseph Mwamba** (KYC pending; 4 ha manioc), **Esther Ilunga** (no KYC, no exploitation).

## Safety guards
Emulator mode switches on only if **all** of these hold, otherwise the app either runs normally or refuses to start (`src/lib/firebaseEmulator.ts`):
1. Vite dev server (`import.meta.env.DEV`). A production or preview build with the flag set throws at startup, and `vite build` itself refuses when the flag is set (`vite.config.ts`).
2. `VITE_USE_FIREBASE_EMULATORS` is exactly `true`.
3. The page is served from `localhost` or `127.0.0.1`.
4. `VITE_FIREBASE_EMULATOR_PROJECT_ID` starts with `demo-`. A real project ID throws instead of connecting.

Without the flag, Firebase initialization is unchanged. The seeding script refuses any non-`demo-` project or non-local host.

## Known limitation (Functions emulator)
firebase-tools 15.20.0's Functions emulator wraps `firebase-admin` in a proxy that binds `admin.firestore`, dropping static members. Code using `admin.firestore.FieldValue` or `admin.firestore.Timestamp` therefore fails **inside the emulator only** (it works when deployed). This affects many functions, including `adminCreatePerson`, `adminSaveExploitation`, `adminCreateAssistedInvoice` and `getDashboardKpis`. Admin screens that call them will show their error state when run with `--with-functions`.
