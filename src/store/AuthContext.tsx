import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, isDevMode } from "@/lib/firebase";
import type { UserRole } from "@/types";
import { AuthContext, type AuthUser } from "@/store/auth-context";

const DEMO_ADMIN_EMAIL = "admin@test.com";
const DEMO_ADMIN_PASSWORD = "Mombongo2026!";
const DEMO_SESSION_KEY = "mombongo_admin_demo_session";

function resolveRole(email: string | null): UserRole | null {
  if (!email) return null;

  const normalized = email.toLowerCase();
  const adminEmails = new Set([
    DEMO_ADMIN_EMAIL,
    "djuna@mombongo.coop",
    "patrick@mombongo.coop",
  ]);

  return adminEmails.has(normalized) ? "admin" : "investor";
}

function readDemoSession(): AuthUser | null {
  const raw = localStorage.getItem(DEMO_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return null;
  }
}

function persistDemoSession(email: string) {
  const demoUser: AuthUser = {
    uid: "demo-admin",
    email,
    displayName: "Admin Demo",
  };

  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(demoUser));
  return demoUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readDemoSession());
  const [role, setRole] = useState<UserRole | null>(() =>
    resolveRole(readDemoSession()?.email ?? null),
  );
  const [loading, setLoading] = useState(() => readDemoSession() === null);

  useEffect(() => {
    if (user) return;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
      });
      setRole(resolveRole(currentUser.email));
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  async function signIn(email: string, password: string) {
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (
        isDevMode() &&
        email.toLowerCase() === DEMO_ADMIN_EMAIL &&
        password === DEMO_ADMIN_PASSWORD
      ) {
        const demoUser = persistDemoSession(email);
        setUser(demoUser);
        setRole("admin");
        setLoading(false);
        return;
      }

      setLoading(false);
      throw error instanceof Error ? error : new Error("Connexion impossible.");
    }
  }

  async function signOut() {
    localStorage.removeItem(DEMO_SESSION_KEY);
    setUser(null);
    setRole(null);

    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore sign-out failures for local demo sessions.
    }
  }

  const value = useMemo(
    () => ({ user, role, loading, signIn, signOut }),
    [loading, role, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
