import {
  getIdTokenResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { auth } from "@/lib/firebase";
import type { UserRole } from "@/types";
import { resolveAdminAccess, type AdminAuthSource } from "@/lib/adminAuthz";
import { AuthContext, type AuthStatus, type AuthUser } from "@/store/auth-context";

function warnIfLegacyFallback(email: string | null, source: AdminAuthSource) {
  if (source !== "email_fallback") return;
  // Deliberately visible in the browser console, not the UI — this is a
  // migration signal for developers/ops, not something to show the user.
  console.warn(
    `[mombongo-admin] Admin access granted via the temporary email allowlist fallback for ` +
    `${email ?? "(unknown email)"}. This account should be migrated to the role:'admin' custom ` +
    `claim via setUserRole — see V2-01-product-architecture-decisions.md, "Admin UI entry gate". ` +
    `Do not remove this fallback until a production check confirms no account still needs it.`,
  );
}

async function evaluateAdminAccess(currentUser: User, forceRefresh = false) {
  const tokenResult = await getIdTokenResult(currentUser, forceRefresh);
  const result = resolveAdminAccess(tokenResult.claims, currentUser.email);
  warnIfLegacyFallback(currentUser.email, result.source);
  return result;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [authSource, setAuthSource] = useState<Exclude<AdminAuthSource, "none"> | null>(null);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setAuthSource(null);
        setAuthError(null);
        setStatus("unauthenticated");
        setLoading(false);
        return;
      }

      setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
      });

      void (async () => {
        try {
          const { isAdmin, source } = await evaluateAdminAccess(currentUser);
          setRole(isAdmin ? "admin" : "investor");
          setAuthSource(source === "none" ? null : source);
          setAuthError(null);
          setStatus(isAdmin ? "authorized" : "unauthorized");
        } catch (error) {
          setRole(null);
          setAuthSource(null);
          setAuthError(
            error instanceof Error ? error : new Error("Impossible de vérifier vos autorisations."),
          );
          setStatus("error");
        } finally {
          setLoading(false);
        }
      })();
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
    setAuthSource(null);
    setAuthError(null);
    setStatus("unauthenticated");
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
  }

  /**
   * Forces a fresh ID token from Firebase Auth (not just the cached one in
   * IndexedDB/localStorage), so a claim change made server-side after this
   * session started — a promotion via setUserRole, or a demotion — becomes
   * visible without the user having to log out and back in. Manually
   * triggered only (the "Actualiser mes autorisations" button); never
   * auto-polled, to avoid an unbounded refresh loop.
   */
  async function refreshAuthorization() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setStatus("unauthenticated");
      return;
    }
    try {
      const { isAdmin, source } = await evaluateAdminAccess(currentUser, true);
      setRole(isAdmin ? "admin" : "investor");
      setAuthSource(source === "none" ? null : source);
      setAuthError(null);
      setStatus(isAdmin ? "authorized" : "unauthorized");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error : new Error("Impossible d'actualiser vos autorisations."),
      );
      setStatus("error");
    }
  }

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      status,
      authSource,
      authError,
      signIn,
      signOut,
      resetPassword,
      refreshAuthorization,
    }),
    [loading, role, user, status, authSource, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
