import { createContext } from "react";
import type { UserRole } from "@/types";
import type { AdminAuthSource } from "@/lib/adminAuthz";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * Five explicit authorization states for the admin app:
 * - loading: auth state or ID-token claims still resolving
 * - unauthenticated: no signed-in user
 * - unauthorized: signed in, but neither the role claim nor the temporary
 *   email fallback grants admin access
 * - authorized: signed in and admin (via claim or, temporarily, fallback)
 * - error: the claims check itself failed (network/config issue) — distinct
 *   from "unauthorized" so the UI doesn't tell someone "no admin access"
 *   when the real problem is that access could not be determined at all
 */
export type AuthStatus = "loading" | "unauthenticated" | "unauthorized" | "authorized" | "error";

export interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  status: AuthStatus;
  /** Which mechanism granted admin access, for logging/diagnostics only — never shown to the end user. null when not admin. */
  authSource: Exclude<AdminAuthSource, "none"> | null;
  /** Set only when status === "error"; the raw error is for developers (console), never rendered verbatim to the user. */
  authError: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Forces a fresh ID token so a claim change (promotion/demotion) since login becomes visible without logging out. */
  refreshAuthorization: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
