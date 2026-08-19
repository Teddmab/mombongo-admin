import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/store/AuthContext";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/lib/firebase", () => ({
  auth: {},
  isDevMode: () => true,
}));

function AuthHarness() {
  const { user, role, loading, signIn, signOut } = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="role">{role ?? "none"}</div>
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
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(onAuthStateChanged).mockImplementation((_, callback) => {
      callback(null);
      return vi.fn();
    });
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(
      new Error("Firebase auth unavailable in tests"),
    );
    vi.mocked(firebaseSignOut).mockResolvedValue(undefined);
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

  it("clears state and calls firebaseSignOut on sign-out", async () => {
    vi.mocked(onAuthStateChanged).mockImplementation((_, callback) => {
      callback({ uid: "u1", email: "teddmabulay@gmail.com", displayName: "Teddy" } as never);
      return vi.fn();
    });

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
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });

    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
  });
});