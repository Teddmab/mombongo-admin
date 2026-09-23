import { describe, it, expect } from "vitest";
import { resolveAdminAccess, LEGACY_ADMIN_EMAIL_ALLOWLIST } from "@/lib/adminAuthz";

describe("resolveAdminAccess", () => {
  it("grants access via the canonical role claim", () => {
    expect(resolveAdminAccess({ role: "admin" }, "anyone@example.com")).toEqual({
      isAdmin: true,
      source: "claim",
    });
  });

  it("grants access via the temporary email fallback when the claim is absent", () => {
    const email = [...LEGACY_ADMIN_EMAIL_ALLOWLIST][0];
    expect(resolveAdminAccess(null, email)).toEqual({
      isAdmin: true,
      source: "email_fallback",
    });
  });

  it("prefers the canonical claim over the fallback when both would grant access", () => {
    const email = [...LEGACY_ADMIN_EMAIL_ALLOWLIST][0];
    expect(resolveAdminAccess({ role: "admin" }, email)).toEqual({
      isAdmin: true,
      source: "claim",
    });
  });

  it("denies a non-admin claim for a non-allowlisted email", () => {
    expect(resolveAdminAccess({ role: "investor" }, "someone@example.com")).toEqual({
      isAdmin: false,
      source: "none",
    });
  });

  it("denies access when claims are absent and the email is not allowlisted", () => {
    expect(resolveAdminAccess(null, "someone@example.com")).toEqual({
      isAdmin: false,
      source: "none",
    });
  });

  it("denies access for an unauthenticated caller (no claims, no email)", () => {
    expect(resolveAdminAccess(undefined, null)).toEqual({ isAdmin: false, source: "none" });
    expect(resolveAdminAccess(undefined, undefined)).toEqual({ isAdmin: false, source: "none" });
  });

  it("is case-insensitive and whitespace-tolerant for the email fallback", () => {
    const email = [...LEGACY_ADMIN_EMAIL_ALLOWLIST][0];
    expect(resolveAdminAccess(null, `  ${email.toUpperCase()}  `)).toEqual({
      isAdmin: true,
      source: "email_fallback",
    });
  });

  it("does not match an email by domain — only the exact allowlisted address", () => {
    const [firstAllowed] = [...LEGACY_ADMIN_EMAIL_ALLOWLIST];
    const domain = firstAllowed.split("@")[1];
    expect(resolveAdminAccess(null, `someone-else@${domain}`)).toEqual({
      isAdmin: false,
      source: "none",
    });
  });

  it("rejects malformed claim values rather than coercing them", () => {
    expect(resolveAdminAccess({ role: 1 }, "someone@example.com")).toEqual({
      isAdmin: false,
      source: "none",
    });
    expect(resolveAdminAccess({ role: "Admin" }, "someone@example.com")).toEqual({
      isAdmin: false,
      source: "none",
    });
    expect(resolveAdminAccess({ role: ["admin"] }, "someone@example.com")).toEqual({
      isAdmin: false,
      source: "none",
    });
  });

  it("falls back to email check when claims is an unexpected shape", () => {
    const email = [...LEGACY_ADMIN_EMAIL_ALLOWLIST][0];
    // @ts-expect-error — deliberately passing a malformed claims value to prove it doesn't throw
    expect(resolveAdminAccess("not-an-object", email)).toEqual({
      isAdmin: true,
      source: "email_fallback",
    });
  });
});
