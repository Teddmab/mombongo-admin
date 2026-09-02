import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPartnerInvoices, AdminPartnerInvoiceDetail } from "@/pages/AdminPartnerInvoices";
import {
  usePartnerInvoices, usePartnerInvoiceDetail, useFailedNotifications, useRetryPartnerNotification,
} from "@/hooks/usePartnerInvoices";

vi.mock("@/hooks/usePartnerInvoices", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePartnerInvoices")>("@/hooks/usePartnerInvoices");
  return {
    ...actual,
    usePartnerInvoices: vi.fn(),
    usePartnerInvoiceDetail: vi.fn(),
    useFailedNotifications: vi.fn(),
    useRetryPartnerNotification: vi.fn(),
  };
});

const mockedList = vi.mocked(usePartnerInvoices);
const mockedDetail = vi.mocked(usePartnerInvoiceDetail);
const mockedFailures = vi.mocked(useFailedNotifications);
const mockedRetry = vi.mocked(useRetryPartnerNotification);

const API_ROW = {
  id: "inv1", origin: "partner_api" as const, partnerId: "arom", farmerName: null, farmerAvatarUrl: null, merchantAvatarUrl: null,
  farmerNames: [], isCooperative: false, merchantName: null,
  amountUsd: 50, method: "mobile_money", status: "paid", createdAt: { seconds: 1723000000 } as never,
  paidAt: { seconds: Math.floor(Date.now() / 1000) } as never, // "this month" relative to whenever the test actually runs
};
const HARVEST_ROW = {
  id: "inv2", origin: "harvest_sale" as const, partnerId: null, farmerName: "Jean Kalonji", farmerAvatarUrl: null, merchantAvatarUrl: null,
  farmerNames: ["Jean Kalonji"], isCooperative: false, merchantName: "AROM Industries",
  amountUsd: 100, method: "mobile_money", status: "pending", createdAt: { seconds: 1723000000 } as never, paidAt: null,
};
const COOP_ROW = {
  id: "inv3", origin: "admin_assisted" as const, partnerId: null, farmerName: "Jean Kalonji", farmerAvatarUrl: null, merchantAvatarUrl: null,
  farmerNames: ["Jean Kalonji (60 kg)", "Marie Tshisekedi (40 kg)"], isCooperative: true, merchantName: "AROM Industries",
  amountUsd: 100, method: null, status: "failed", createdAt: { seconds: 1723000000 } as never, paidAt: null,
};

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/admin/partner-invoices"]}>
      <Routes>
        <Route path="/admin/partner-invoices" element={<AdminPartnerInvoices />} />
        <Route path="/admin/partner-invoices/:id" element={<AdminPartnerInvoiceDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminPartnerInvoices list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFailures.mockReturnValue({ data: [], isLoading: false, error: null } as never);
    mockedRetry.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  });

  it("shows an error state", () => {
    mockedList.mockReturnValue({ data: [], isLoading: false, error: new Error("boom") } as never);
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent(/impossible de charger les factures/i);
  });

  it("distinguishes partner-API and farmer-created (harvest_sale) invoices, showing real names for the latter", () => {
    mockedList.mockReturnValue({ data: [API_ROW, HARVEST_ROW], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getAllByText("API partenaire").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Créée par l'agriculteur").length).toBeGreaterThan(0);
    expect(screen.getByText("Jean Kalonji")).toBeInTheDocument();
    expect(screen.getByText("AROM Industries")).toBeInTheDocument();
    expect(screen.getByText("arom")).toBeInTheDocument(); // partner_api row falls back to partnerId, not a fake name
  });

  it("links to the assisted-invoice creation wizard", () => {
    mockedList.mockReturnValue({ data: [], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText(/créer une facture/i).closest("button")).toBeInTheDocument();
  });

  it("computes KPI cards from real invoice data (pending count/amount, paid this month, failed)", () => {
    mockedList.mockReturnValue({ data: [API_ROW, HARVEST_ROW, COOP_ROW], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText("En attente de paiement").closest(".metric-card")).toHaveTextContent("1");
    expect(screen.getByText("Payées ce mois").closest(".metric-card")).toHaveTextContent("1");
    // "Échouées" also labels the status tab — the KPI card is the first occurrence (stats grid renders above the tabs)
    expect(screen.getAllByText("Échouées")[0].closest(".metric-card")).toHaveTextContent("1");
  });

  it("filters by tab (En attente/Payées/Échouées)", () => {
    mockedList.mockReturnValue({ data: [API_ROW, HARVEST_ROW, COOP_ROW], isLoading: false, error: null } as never);
    renderList();
    fireEvent.click(screen.getByRole("tab", { name: "Payées" }));
    expect(screen.getByText("arom")).toBeInTheDocument();
    expect(screen.queryByText("Jean Kalonji")).not.toBeInTheDocument();
  });

  it("filters by search text across farmer, merchant and invoice id", () => {
    mockedList.mockReturnValue({ data: [API_ROW, HARVEST_ROW], isLoading: false, error: null } as never);
    renderList();
    fireEvent.change(screen.getByPlaceholderText(/agriculteur, commerçant ou numéro/i), { target: { value: "AROM" } });
    expect(screen.getByText("Jean Kalonji")).toBeInTheDocument();
    expect(screen.queryByText("arom")).not.toBeInTheDocument();
  });

  it("filters by origin", () => {
    mockedList.mockReturnValue({ data: [API_ROW, HARVEST_ROW], isLoading: false, error: null } as never);
    renderList();
    fireEvent.change(screen.getByRole("combobox", { name: /^origine$/i }), { target: { value: "harvest_sale" } });
    expect(screen.queryByText("arom")).not.toBeInTheDocument();
    expect(screen.getByText("Jean Kalonji")).toBeInTheDocument();
  });

  it("shows every farmer in a cooperative invoice with a Coopérative badge", () => {
    mockedList.mockReturnValue({ data: [COOP_ROW], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText(/Jean Kalonji \(60 kg\), Marie Tshisekedi \(40 kg\)/)).toBeInTheDocument();
    expect(screen.getByText("Coopérative")).toBeInTheDocument();
  });

  it("opens a side detail panel on row click instead of navigating away", () => {
    mockedList.mockReturnValue({ data: [HARVEST_ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({
      data: { ...HARVEST_ROW, externalInvoiceId: "inv2", reference: null, currency: "USD", testMode: false, providerRef: null, failedAt: null, adminAssisted: null },
      isLoading: false, error: null,
    } as never);
    renderList();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Jean Kalonji"));
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    // still on the list route, not navigated to a separate page
    expect(screen.getByText(/créer une facture/i)).toBeInTheDocument();
  });
});

describe("AdminPartnerInvoiceDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the admin-assistance trace only when the invoice actually has one", () => {
    mockedDetail.mockReturnValue({
      data: {
        ...HARVEST_ROW, origin: "admin_assisted", externalInvoiceId: "inv2", reference: null, currency: "USD",
        testMode: false, providerRef: null, paidAt: null, failedAt: null,
        adminAssisted: { actorName: "Admin Mombongo", consentMethod: "phone", consentAt: { seconds: 1723000000 }, note: "Vente confirmée par téléphone" },
      },
      isLoading: false, error: null,
    } as never);
    render(
      <MemoryRouter initialEntries={["/admin/partner-invoices/inv2"]}>
        <Routes><Route path="/admin/partner-invoices/:id" element={<AdminPartnerInvoiceDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Trace d'assistance admin")).toBeInTheDocument();
    expect(screen.getByText("Admin Mombongo")).toBeInTheDocument();
    expect(screen.getByText("Appel téléphonique")).toBeInTheDocument();
  });

  it("never shows the assistance trace for a real farmer self-service invoice", () => {
    mockedDetail.mockReturnValue({
      data: { ...HARVEST_ROW, externalInvoiceId: "inv2", reference: null, currency: "USD", testMode: false, providerRef: null, failedAt: null, adminAssisted: null },
      isLoading: false, error: null,
    } as never);
    render(
      <MemoryRouter initialEntries={["/admin/partner-invoices/inv2"]}>
        <Routes><Route path="/admin/partner-invoices/:id" element={<AdminPartnerInvoiceDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText("Trace d'assistance admin")).not.toBeInTheDocument();
  });
});
