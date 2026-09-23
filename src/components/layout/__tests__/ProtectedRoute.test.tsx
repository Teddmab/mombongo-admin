import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderProtected(initialPath = "/admin") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login route</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<div>Admin route</div>} />
          <Route path="/admin/farmers/:id" element={<div>Farmer detail route</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while authentication is resolving", () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      refreshAuthorization: vi.fn(),
      user: null,
      role: null,
      loading: true,
      status: "loading",
      authSource: null,
      authError: null,
    });

    renderProtected();

    expect(screen.getByText("Connexion au panneau admin…")).toBeInTheDocument();
    expect(screen.queryByText("Admin route")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to /login", async () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      refreshAuthorization: vi.fn(),
      user: null,
      role: null,
      loading: false,
      status: "unauthenticated",
      authSource: null,
      authError: null,
    });

    renderProtected();

    expect(await screen.findByText("Login route")).toBeInTheDocument();
  });

  it("redirects to /login on direct navigation to a nested admin URL while unauthenticated", async () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      refreshAuthorization: vi.fn(),
      user: null,
      role: null,
      loading: false,
      status: "unauthenticated",
      authSource: null,
      authError: null,
    });

    renderProtected("/admin/farmers/abc123");

    expect(await screen.findByText("Login route")).toBeInTheDocument();
    expect(screen.queryByText("Farmer detail route")).not.toBeInTheDocument();
  });

  it("renders the nested route for authorized admin users", () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      refreshAuthorization: vi.fn(),
      user: { uid: "admin-1", email: "admin@test.com", displayName: "Admin" },
      role: "admin",
      loading: false,
      status: "authorized",
      authSource: "claim",
      authError: null,
    });

    renderProtected();

    expect(screen.getByText("Admin route")).toBeInTheDocument();
  });

  it("renders a deep nested admin route directly for an authorized user (no bypass needed, none possible)", () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      refreshAuthorization: vi.fn(),
      user: { uid: "admin-1", email: "admin@test.com", displayName: "Admin" },
      role: "admin",
      loading: false,
      status: "authorized",
      authSource: "claim",
      authError: null,
    });

    renderProtected("/admin/farmers/abc123");

    expect(screen.getByText("Farmer detail route")).toBeInTheDocument();
  });

  it("shows access denied for authenticated non-admin users, on any admin URL", () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      refreshAuthorization: vi.fn(),
      user: { uid: "user-1", email: "user@test.com", displayName: "User" },
      role: "investor",
      loading: false,
      status: "unauthorized",
      authSource: null,
      authError: null,
    });

    renderProtected("/admin/farmers/abc123");

    expect(screen.getByText("Accès administrateur requis")).toBeInTheDocument();
    expect(screen.queryByText("Farmer detail route")).not.toBeInTheDocument();
  });

  it("does not expose the technical auth error to the user in the error state", () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      refreshAuthorization: vi.fn(),
      user: { uid: "user-1", email: "user@test.com", displayName: "User" },
      role: null,
      loading: false,
      status: "error",
      authSource: null,
      authError: new Error("permission-denied: missing or insufficient permissions at users/xyz"),
    });

    renderProtected();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Impossible de vérifier votre session. Réessayez, ou reconnectez-vous si le problème persiste.",
    );
    expect(screen.queryByText(/permission-denied/)).not.toBeInTheDocument();
    expect(screen.getByText("Réessayer")).toBeInTheDocument();
  });
});
