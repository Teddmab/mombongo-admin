import "@testing-library/jest-dom";
import { vi } from "vitest";

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const firebaseMocks = {
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
  getAuth: vi.fn(() => ({})),
  getFirestore: vi.fn(() => ({})),
  enableIndexedDbPersistence: vi.fn().mockResolvedValue(undefined),
  getFunctions: vi.fn(() => ({})),
};

Object.defineProperty(globalThis, "__firebaseMocks", {
  value: firebaseMocks,
  writable: true,
});

vi.mock("firebase/app", () => ({
  initializeApp: firebaseMocks.initializeApp,
  getApps: firebaseMocks.getApps,
  getApp: firebaseMocks.getApp,
}));

vi.mock("firebase/auth", () => ({
  getAuth: firebaseMocks.getAuth,
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({})),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: firebaseMocks.getFirestore,
  enableIndexedDbPersistence: firebaseMocks.enableIndexedDbPersistence,
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  Timestamp: { fromMillis: vi.fn(), now: vi.fn() },
  increment: vi.fn((value) => value),
  arrayUnion: vi.fn(),
}));

vi.mock("firebase/functions", () => ({
  getFunctions: firebaseMocks.getFunctions,
  httpsCallable: vi.fn(() => vi.fn()),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));