import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { auth } from "@/lib/firebase";
import type { UserRole } from "@/types";
import { AuthContext, type AuthUser } from "@/store/auth-context";

function resolveRole(email: string | null): UserRole | null {
  if (!email) return null;

  const normalized = email.toLowerCase();
  const adminEmails = new Set([
    "djuna@mombongo.coop",
    "patrick@mombongo.coop",
    "teddmabulay@gmail.com",
  ]);

  return adminEmails.has(normalized) ? "admin" : "investor";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
        });
        setRole(resolveRole(currentUser.email));
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoading(false);
      throw error instanceof Error ? error : new Error("Connexion impossible.");
    }
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function signOut() {
    setUser(null);
    setRole(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
  }

  const value = useMemo(
    () => ({ user, role, loading, signIn, signOut, resetPassword }),
    [loading, role, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
