import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useAdminKpis } from "@/hooks/useAdminKpis";
import {
  useInvoiceSummary, usePartnerSummary, useOperationalAlertCount, usePaymentActivity,
} from "@/hooks/useCommandCenter";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useAdminKpis", () => ({ useAdminKpis: vi.fn() }));
vi.mock("@/hooks/useCommandCenter", () => ({
  useInvoiceSummary: vi.fn(),
  usePartnerSummary: vi.fn(),
  useOperationalAlertCount: vi.fn(),
  usePaymentActivity: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseAdminKpis = vi.mocked(useAdminKpis);
const mockedUseInvoiceSummary = vi.mocked(useInvoiceSummary);
const mockedUsePartnerSummary = vi.mocked(usePartnerSummary);
const mockedUseOperationalAlertCount = vi.mocked(useOperationalAlertCount);
const mockedUsePaymentActivity = vi.mocked(usePaymentActivity);

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AdminDashboard />
    </MemoryRouter>,
  );
}

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(), signOut: vi.fn(),
      user: { uid: "admin-1", email: "admin@mombongo.coop", displayName: "Djuna Admin" },
      role: "admin", loading: false,
    });
    mockedUseAdminKpis.mockReturnValue({
      activeUsers: 128, pendingKyc: 21, monthlyVolumeUsd: 24500,
      financingOpen: 4, bourseOpen: 2, totalDepositsUsd: 9000,
      platformRevenueUsd: 1225, activeInvestments: 12,
    });
    mockedUseInvoiceSummary.mockReturnValue({
      data: { pendingCount: 6, overdueCount: 2 }, isLoading: false, error: null,
      dataUpdatedAt: Date.now(),
    } as ReturnType<typeof useInvoiceSummary>);
    mockedUsePartnerSummary.mockReturnValue({
      data: { activeCount: 3 }, isLoading: false, error: null,
      dataUpdatedAt: Date.now(),
    } as ReturnType<typeof usePartnerSummary>);
    mockedUseOperationalAlertCount.mockReturnValue({
      data: { count: 5 }, isLoading: false, error: null,
      dataUpdatedAt: Date.now(),
    } as ReturnType<typeof useOperationalAlertCount>);
    mockedUsePaymentActivity.mockReturnValue({
      data: [{ day: "1 sept.", volumeUsd: 100 }], isLoading: false, error: null,
    } as ReturnType<typeof usePaymentActivity>);
  });

  it("routes each priority card to its real filtered queue, with real (non-hardcoded) counts", () => {
    renderDashboard();

    const kycCard = screen.getByRole("link", { name: /Dossiers KYC à vérifier/ });
    expect(kycCard).toHaveAttribute("href", "/admin/kyc");
    expect(kycCard).toHaveTextContent("21");

    const invoiceCard = screen.getByRole("link", { name: /Factures en attente/ });
    expect(invoiceCard).toHaveAttribute("href", "/admin/partner-invoices");
    expect(invoiceCard).toHaveTextContent("6");
    expect(invoiceCard).toHaveTextContent("2 en retard");

    const alertCard = screen.getByRole("link", { name: /Alertes à traiter/ });
    expect(alertCard).toHaveAttribute("href", "/admin/alerts");
    expect(alertCard).toHaveTextContent("5");
  });

  it("renders the four KPI cards from real hook data, not fixture text from the reference image", () => {
    renderDashboard();
    expect(screen.getByText("Utilisateurs actifs").closest("article")).toHaveTextContent("128");
    expect(screen.getByText("Paiements ce mois").closest("article")).toHaveTextContent("$24,500");
    expect(screen.getByText("Factures à payer").closest("article")).toHaveTextContent("6");
    expect(screen.getByText("Partenaires actifs").closest("article")).toHaveTextContent("3");
  });

  it("shows an error indicator instead of a fake zero when a card's query fails", () => {
    mockedUseInvoiceSummary.mockReturnValue({
      data: undefined, isLoading: false, error: new Error("permission-denied"),
    } as ReturnType<typeof useInvoiceSummary>);
    renderDashboard();
    const invoiceCard = screen.getByRole("link", { name: /Facture.? en attente/ });
    expect(invoiceCard).toHaveTextContent("—");
    expect(invoiceCard).toHaveTextContent("Données indisponibles");
  });

  it("only links quick actions to destinations that exist today (no dead 'Créer une facture' link)", () => {
    renderDashboard();
    expect(screen.getByRole("link", { name: /Ajouter un partenaire/ })).toHaveAttribute("href", "/admin/partners");
    expect(screen.getByRole("link", { name: /Examiner les KYC/ })).toHaveAttribute("href", "/admin/kyc");
    expect(screen.getByRole("link", { name: /Voir les factures partenaires/ })).toHaveAttribute("href", "/admin/partner-invoices");
    expect(screen.queryByText(/Créer une facture/)).not.toBeInTheDocument();
  });

  it("shows a last-updated timestamp for the auto-refreshing data", () => {
    renderDashboard();
    expect(screen.getByText(/Priorités et KPI actualisés à/)).toBeInTheDocument();
  });

  it("shows a stale-data warning instead of silently displaying old numbers", () => {
    const staleQuery = {
      data: { pendingCount: 6, overdueCount: 2 }, isLoading: false, error: null,
      dataUpdatedAt: Date.now() - 10 * 60_000,
    } as ReturnType<typeof useInvoiceSummary>;
    mockedUseInvoiceSummary.mockReturnValue(staleQuery);
    renderDashboard();
    expect(screen.getByText(/n'ont pas pu se rafraîchir/)).toBeInTheDocument();
  });
});
