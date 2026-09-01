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
  id: "inv1", origin: "partner_api" as const, partnerId: "arom", farmerName: null, merchantName: null,
  amountUsd: 50, method: "mobile_money", status: "paid", createdAt: { seconds: 1723000000 } as never,
};
const HARVEST_ROW = {
  id: "inv2", origin: "harvest_sale" as const, partnerId: null, farmerName: "Jean Kalonji", merchantName: "AROM Industries",
  amountUsd: 100, method: "mobile_money", status: "pending", createdAt: { seconds: 1723000000 } as never,
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

  it("filters by origin", () => {
    mockedList.mockReturnValue({ data: [API_ROW, HARVEST_ROW], isLoading: false, error: null } as never);
    renderList();
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "harvest_sale" } });
    expect(screen.queryByText("arom")).not.toBeInTheDocument();
    expect(screen.getByText("Jean Kalonji")).toBeInTheDocument();
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
      data: { ...HARVEST_ROW, externalInvoiceId: "inv2", reference: null, currency: "USD", testMode: false, providerRef: null, paidAt: null, failedAt: null, adminAssisted: null },
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
