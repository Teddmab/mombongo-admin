import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AdminShell } from "@/components/layout/AdminShell";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function renderShell(initialEntry: string, childPath: string) {
  vi.mocked(useAuth).mockReturnValue({
    signIn: vi.fn(), signOut: vi.fn(),
    user: { uid: "admin-1", email: "admin@mombongo.coop", displayName: "Admin Mombongo" },
    role: "admin", loading: false,
  } as never);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin" element={<AdminShell />}>
          <Route path={childPath} element={<div>Contenu de la page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminShell", () => {
  it("renders the generic AdminHeader for a page that has no header of its own yet", () => {
    renderShell("/admin", "");
    expect(screen.getByRole("heading", { name: "Vue d'ensemble" })).toBeInTheDocument();
    expect(screen.getByText("Suivi des priorités, KPI et activité.")).toBeInTheDocument();
  });

  it("suppresses AdminHeader for a page that renders its own .page-header (no duplicate title bar)", () => {
    renderShell("/admin/transactions", "transactions");
    expect(screen.queryByText("Suivi des priorités, KPI et activité.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Déconnexion")).not.toBeInTheDocument();
  });

  it("still exposes a mobile menu button when AdminHeader is suppressed — the drawer needs a way to open below 1024px", () => {
    renderShell("/admin/transactions", "transactions");
    expect(screen.getByLabelText("Ouvrir le menu")).toBeInTheDocument();
  });

  it("also suppresses AdminHeader on dynamic sub-routes of an own-header page (e.g. a transaction detail id)", () => {
    renderShell("/admin/transactions/tx1", "transactions/:id");
    expect(screen.queryByText("Suivi des priorités, KPI et activité.")).not.toBeInTheDocument();
  });
});
