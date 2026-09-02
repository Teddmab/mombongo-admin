import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SidebarDrawerContext } from "@/components/layout/sidebar-drawer-context";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderSidebar(initialEntry = "/admin") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SidebarDrawerContext.Provider value={{ open: false, toggle: vi.fn(), close: vi.fn() }}>
        <AdminSidebar />
      </SidebarDrawerContext.Provider>
    </MemoryRouter>,
  );
}

describe("AdminSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      user: { uid: "admin-1", email: "admin@mombongo.coop", displayName: "Djuna Admin" },
      role: "admin",
      loading: false,
    });
  });

  it("renders every group from the redesign IA plus the top-level dashboard link", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Vue d'ensemble/ })).toHaveAttribute("href", "/admin");
    for (const label of ["Personnes", "Marché & agriculture", "Finance", "Partenaires", "Administration"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("covers every route family registered in App.tsx — nothing dropped from the old flat nav", () => {
    renderSidebar();
    const expectedHrefs = [
      "/admin", "/admin/investors", "/admin/farmers", "/admin/agents", "/admin/merchants", "/admin/products",
      "/admin/opportunities", "/admin/bourse", "/admin/harvest-offers",
      "/admin/qa/harvest-offers", "/admin/agronomie", "/admin/academia",
      "/admin/offers", "/admin/agro-exchange", "/admin/kyc",
      "/admin/transactions", "/admin/financing", "/admin/investments",
      "/admin/partner-invoices", "/admin/partners", "/admin/reports",
      "/admin/alerts", "/admin/notifications", "/admin/videos",
      "/admin/did-you-know", "/admin/roles", "/admin/settings",
    ];
    const links = screen.getAllByRole("link").map((el) => el.getAttribute("href"));
    for (const href of expectedHrefs) {
      expect(links).toContain(href);
    }
  });

  it("collapses and re-expands a group's items on toggle", async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByRole("link", { name: /Agriculteurs/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Personnes/ }));
    expect(screen.queryByRole("link", { name: /Agriculteurs/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Personnes/ }));
    expect(screen.getByRole("link", { name: /Agriculteurs/ })).toBeInTheDocument();
  });

  it("marks the current route's link active", () => {
    renderSidebar("/admin/farmers");
    expect(screen.getByRole("link", { name: /Agriculteurs/ })).toHaveClass("active");
    expect(screen.getByRole("link", { name: /Investisseurs/ })).not.toHaveClass("active");
  });

  it("signs out when Déconnexion is clicked", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn();
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(), signOut,
      user: { uid: "admin-1", email: "admin@mombongo.coop", displayName: "Djuna Admin" },
      role: "admin", loading: false,
    });
    renderSidebar();
    await user.click(screen.getByRole("button", { name: /Déconnexion/ }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
