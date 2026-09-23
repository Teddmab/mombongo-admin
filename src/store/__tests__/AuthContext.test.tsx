import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/store/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import { LEGACY_ADMIN_EMAIL_ALLOWLIST } from "@/lib/adminAuthz";

vi.mock("@/lib/firebase", () => ({
  auth: {},
  isDevMode: () => true,
}));

const ALLOWLISTED_EMAIL = [...LEGACY_ADMIN_EMAIL_ALLOWLIST][0];

function AuthHarness() {
  const { user, role, loading, status, authSource, authError, signIn, signOut, refreshAuthorization } =
    useAuth();

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="status">{status}</div>
      <div data-testid="role">{role ?? "none"}</div>
      <div data-testid="authSource">{authSource ?? "none"}</div>
      <div data-testid="authError">{authError?.message ?? "none"}</div>
      <div data-testid="email">{user?.email ?? "none"}</div>
      <button
        type="button"
        onClick={() => signIn("admin@test.com", "Mombongo2026!").catch(() => undefined)}
      >
        demo-sign-in
      </button>
      <button type="button" onClick={() => signOut()}>
        sign-out
      </button>
      <button type="button" onClick={() => void refreshAuthorization()}>
        refresh
      </button>
    </div>
  );
}

function fireAuthStateChanged(currentUser: { uid: string; email: string | null; displayName: string | null } | null) {
  vi.mocked(onAuthStateChanged).mockImplementation((_, callback) => {
    callback(currentUser as never);
    return vi.fn();
  });
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as { currentUser?: unknown }).currentUser = undefined;

    fireAuthStateChanged(null);
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(
      new Error("Firebase auth unavailable in tests"),
    );
    vi.mocked(firebaseSignOut).mockResolvedValue(undefined);
    vi.mocked(getIdTokenResult).mockResolvedValue({ claims: {} } as never);
  });

  it("throws when firebase sign-in fails (no demo fallback)", async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    await user.click(screen.getByRole("button", { name: "demo-sign-in" }));

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("none");
      expect(screen.getByTestId("email")).toHaveTextContent("none");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
  });

  it("grants access via the canonical role claim", async () => {
    fireAuthStateChanged({ uid: "u1", email: "someone@example.com", displayName: "Someone" });
    vi.mocked(getIdTokenResult).mockResolvedValue({ claims: { role: "admin" } } as never);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authorized");
    });
    expect(screen.getByTestId("role")).toHaveTextContent("admin");
    expect(screen.getByTestId("authSource")).toHaveTextContent("claim");
  });

  it("denies a non-admin authenticated user (no claim, not allowlisted)", async () => {
    fireAuthStateChanged({ uid: "u2", email: "investor@example.com", displayName: "Investor" });
    vi.mocked(getIdTokenResult).mockResolvedValue({ claims: { role: "investor" } } as never);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthorized");
    });
    expect(screen.getByTestId("authSource")).toHaveTextContent("none");
  });

  it("treats an unauthenticated caller as unauthenticated, not unauthorized", async () => {
    fireAuthStateChanged(null);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    });
    expect(screen.getByTestId("role")).toHaveTextContent("none");
  });

  it("denies access for malformed/wrong-typed claims without throwing", async () => {
    fireAuthStateChanged({ uid: "u3", email: "weird@example.com", displayName: "Weird" });
    vi.mocked(getIdTokenResult).mockResolvedValue({ claims: { role: 123 } } as never);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthorized");
    });
    expect(screen.getByTestId("authError")).toHaveTextContent("none");
  });

  it("grants access via the temporary email fallback when unclaimed, and warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fireAuthStateChanged({ uid: "u4", email: ALLOWLISTED_EMAIL, displayName: "Legacy Admin" });
    vi.mocked(getIdTokenResult).mockResolvedValue({ claims: {} } as never);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authorized");
    });
    expect(screen.getByTestId("authSource")).toHaveTextContent("email_fallback");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("temporary email allowlist fallback"));
    warnSpy.mockRestore();
  });

  it("denies a non-allowlisted user with no claim", async () => {
    fireAuthStateChanged({ uid: "u5", email: "nobody@example.com", displayName: "Nobody" });
    vi.mocked(getIdTokenResult).mockResolvedValue({ claims: {} } as never);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthorized");
    });
  });

  it("reflects a claim promotion after calling refreshAuthorization (no logout required)", async () => {
    const user = userEvent.setup();
    const fakeUser = { uid: "u6", email: "promoted@example.com", displayName: "Promoted" };
    fireAuthStateChanged(fakeUser);
    vi.mocked(getIdTokenResult).mockResolvedValueOnce({ claims: {} } as never);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthorized");
    });

    // Simulate the claim being set (e.g. via setUserRole) since login, and
    // the caller's currentUser now being available for a forced refresh.
    (auth as { currentUser?: unknown }).currentUser = fakeUser;
    vi.mocked(getIdTokenResult).mockResolvedValueOnce({ claims: { role: "admin" } } as never);

    await user.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authorized");
    });
    expect(vi.mocked(getIdTokenResult)).toHaveBeenLastCalledWith(fakeUser, true);
  });

  it("removes access after a demotion becomes visible on token refresh", async () => {
    const user = userEvent.setup();
    const fakeUser = { uid: "u7", email: "demoted@example.com", displayName: "Demoted" };
    fireAuthStateChanged(fakeUser);
    vi.mocked(getIdTokenResult).mockResolvedValueOnce({ claims: { role: "admin" } } as never);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authorized");
    });

    (auth as { currentUser?: unknown }).currentUser = fakeUser;
    vi.mocked(getIdTokenResult).mockResolvedValueOnce({ claims: {} } as never);

    await user.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthorized");
    });
  });

  it("documents the known migration limitation: a demoted-but-still-allowlisted account keeps access via fallback until the allowlist is cleaned up", async () => {
    const user = userEvent.setup();
    const fakeUser = { uid: "u8", email: ALLOWLISTED_EMAIL, displayName: "Legacy" };
    fireAuthStateChanged(fakeUser);
    vi.mocked(getIdTokenResult).mockResolvedValueOnce({ claims: { role: "admin" } } as never);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authSource")).toHaveTextContent("claim");
    });

    (auth as { currentUser?: unknown }).currentUser = fakeUser;
    vi.mocked(getIdTokenResult).mockResolvedValueOnce({ claims: {} } as never); // claim removed

    await user.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("authSource")).toHaveTextContent("email_fallback");
    });
    // Still authorized — expected and documented, not a bug: this is exactly
    // why the fallback must be removed once production accounts are verified.
    expect(screen.getByTestId("status")).toHaveTextContent("authorized");
  });

  it("surfaces a distinct error state when the claims check itself fails", async () => {
    fireAuthStateChanged({ uid: "u9", email: "broken@example.com", displayName: "Broken" });
    vi.mocked(getIdTokenResult).mockRejectedValue(new Error("network unavailable"));

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("error");
    });
    expect(screen.getByTestId("role")).toHaveTextContent("none");
  });

  it("recovers from an error state to authorized after a successful refresh", async () => {
    const user = userEvent.setup();
    const fakeUser = { uid: "u10", email: "recovering@example.com", displayName: "Recovering" };
    fireAuthStateChanged(fakeUser);
    vi.mocked(getIdTokenResult).mockRejectedValueOnce(new Error("network unavailable"));

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("error");
    });

    (auth as { currentUser?: unknown }).currentUser = fakeUser;
    vi.mocked(getIdTokenResult).mockResolvedValueOnce({ claims: { role: "admin" } } as never);

    await user.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authorized");
    });
    expect(screen.getByTestId("authError")).toHaveTextContent("none");
  });

  it("clears state and calls firebaseSignOut on sign-out", async () => {
    fireAuthStateChanged({ uid: "u1", email: ALLOWLISTED_EMAIL, displayName: "Teddy" });
    vi.mocked(getIdTokenResult).mockResolvedValue({ claims: { role: "admin" } } as never);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("admin");
    });

    await user.click(screen.getByRole("button", { name: "sign-out" }));

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("none");
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });

    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
  });
});
