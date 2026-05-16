import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to /login", async () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      user: null,
      role: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/login" element={<div>Login route</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<div>Admin route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Login route")).toBeInTheDocument();
  });

  it("renders the nested route for admin users", () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      user: { uid: "admin-1", email: "admin@test.com", displayName: "Admin" },
      role: "admin",
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<div>Admin route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Admin route")).toBeInTheDocument();
  });

  it("shows access denied for authenticated non-admin users", () => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      user: { uid: "user-1", email: "user@test.com", displayName: "User" },
      role: "investor",
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<div>Admin route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Ce panneau est réservé aux administrateurs."),
    ).toBeInTheDocument();
  });
});