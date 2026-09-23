/**
 * Centralized admin-access resolution for the admin frontend.
 *
 * Canonical authority: the `role` custom claim on the user's Firebase ID
 * token (`role === 'admin'`) — the same claim shape set by
 * mombongo-functions' bootstrapAdmin/setUserRole/claimAdminInvite and read
 * by firestore.rules' isAdmin(). See
 * sprints/sprint-farmer-journey-v2/V2-01-product-architecture-decisions.md,
 * "Admin UI entry gate" section, for the full audit.
 *
 * Temporary fallback: a fixed, exact-match email allowlist, used only when
 * the claim does not grant access. This exists purely so the small set of
 * people who used to be admin-by-email don't get locked out while their
 * accounts are migrated to the canonical claim (via setUserRole) — it is
 * not a general-purpose or domain-based mechanism, and must never become
 * one. Do not add emails here casually; every entry needs the same
 * migration urgency the original three did.
 *
 * Do not remove LEGACY_ADMIN_EMAIL_ALLOWLIST or the email_fallback branch
 * below until a read-only production check confirms every account on this
 * list already carries the role:'admin' claim (see the decisions doc for
 * the exact command).
 */
export const LEGACY_ADMIN_EMAIL_ALLOWLIST: ReadonlySet<string> = new Set([
  "djuna@mombongo.coop",
  "patrick@mombongo.coop",
  "teddmabulay@gmail.com",
]);

export type AdminAuthSource = "claim" | "email_fallback" | "none";

export interface AdminAccessResult {
  isAdmin: boolean;
  source: AdminAuthSource;
}

/**
 * Pure, side-effect-free — the one place admin-access logic lives. Every
 * screen/hook in this app that needs to know "is this user an admin" goes
 * through AuthContext (which calls this), never re-implements the check.
 */
export function resolveAdminAccess(
  claims: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
): AdminAccessResult {
  if (claims?.role === "admin") {
    return { isAdmin: true, source: "claim" };
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && LEGACY_ADMIN_EMAIL_ALLOWLIST.has(normalizedEmail)) {
    return { isAdmin: true, source: "email_fallback" };
  }

  return { isAdmin: false, source: "none" };
}
