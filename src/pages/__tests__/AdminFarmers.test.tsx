import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminFarmers } from "@/pages/AdminFarmers";
import { useAdminFarmers, useAdminFarmerExploitation } from "@/hooks/useAdminFarmers";

vi.mock("@/hooks/useAdminFarmers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useAdminFarmers")>();
  return { ...actual, useAdminFarmers: vi.fn(), useAdminFarmerExploitation: vi.fn() };
});

const mockedFarmers = vi.mocked(useAdminFarmers);
const mockedExploitation = vi.mocked(useAdminFarmerExploitation);

const ROWS = [
  {
    id: "f1", name: "Jean Kalonji", phone: "+243970000000", email: "jean@x.cd",
    province: "Nord-Kivu", primaryCrop: "Cacao", exploitationHectares: 3.5, hasExploitation: true,
    profileCompletePct: 100, kycStatus: "approved", isActive: true, lastActivityAt: Date.now(), createdAt: Date.now(),
  },
  {
    id: "f2", name: "Marie Femme", phone: "", email: "",
    province: "", primaryCrop: null, exploitationHectares: null, hasExploitation: false,
    profileCompletePct: 25, kycStatus: "none", isActive: false, lastActivityAt: null, createdAt: Date.now(),
  },
];

function renderPage(initialEntry = "/admin/farmers") {
  return render(<MemoryRouter initialEntries={[initialEntry]}><AdminFarmers /></MemoryRouter>);
}

describe("AdminFarmers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFarmers.mockReturnValue({ data: ROWS, isLoading: false, error: null } as ReturnType<typeof useAdminFarmers>);
    mockedExploitation.mockReturnValue({ data: null } as ReturnType<typeof useAdminFarmerExploitation>);
  });

  it("computes summary counts from real rows, not hardcoded reference-image numbers", () => {
    renderPage();
    const badge = (text: string) => screen.getAllByText(text).find((el) => el.className.includes("badge"));
    expect(badge("Agriculteurs")?.closest("article")).toHaveTextContent("2");
    expect(badge("Profils à compléter")?.closest("article")).toHaveTextContent("1");
    expect(badge("KYC à vérifier")?.closest("article")).toHaveTextContent("0");
  });

  it("never renders a Mombongo Score field — no admin-callable score endpoint exists", () => {
    renderPage();
    expect(screen.queryByText(/[Ss]core/)).not.toBeInTheDocument();
  });

  it("filters by search text across name/phone/province", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText("Marie Femme")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Rechercher un nom/), "Kalonji");
    expect(screen.getByText("Jean Kalonji")).toBeInTheDocument();
    expect(screen.queryByText("Marie Femme")).not.toBeInTheDocument();
  });

  it("filters by segment (URL-persisted)", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Suspendus" }));
    expect(screen.getByText("Marie Femme")).toBeInTheDocument();
    expect(screen.queryByText("Jean Kalonji")).not.toBeInTheDocument();
  });

  it("shows an empty state distinct from the loading state", () => {
    mockedFarmers.mockReturnValue({ data: [], isLoading: false, error: null } as ReturnType<typeof useAdminFarmers>);
    renderPage();
    expect(screen.getByText("Aucun agriculteur trouvé")).toBeInTheDocument();
  });

  it("shows an error state when the farmers query fails", () => {
    mockedFarmers.mockReturnValue({
      data: undefined, isLoading: false, error: new Error("permission-denied"),
    } as unknown as ReturnType<typeof useAdminFarmers>);
    renderPage();
    expect(screen.getByText(/Impossible de charger les agriculteurs/)).toBeInTheDocument();
  });

  it("selecting a row opens a preview with a 'Créer une facture' handoff link, not an invoice form", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Jean Kalonji"));

    const handoff = screen.getByRole("link", { name: /Créer une facture/ });
    expect(handoff).toHaveAttribute("href", "/admin/partner-invoices?farmerId=f1");

    const profileLink = screen.getByRole("link", { name: /Voir le profil/ });
    expect(profileLink).toHaveAttribute("href", "/admin/farmers/f1");
  });

  it("preview panel shows a real empty-exploitation message rather than a fake hectare value", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Marie Femme"));
    expect(screen.getByText("Aucune exploitation enregistrée")).toBeInTheDocument();
  });
});
