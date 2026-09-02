import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminMerchants, AdminMerchantDetail } from "@/pages/AdminMerchants";
import { useMerchants, useMerchantDetail } from "@/hooks/useMerchants";

vi.mock("@/hooks/useMerchants", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useMerchants")>("@/hooks/useMerchants");
  return { ...actual, useMerchants: vi.fn(), useMerchantDetail: vi.fn() };
});

const mockedUseMerchants = vi.mocked(useMerchants);
const mockedUseMerchantDetail = vi.mocked(useMerchantDetail);
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const MERCHANT = {
  id: "m1", fullName: "AROM Industries", phone: "+243970000002", email: "arom@example.com",
  businessType: "grossiste", walletUsd: 500, offersCount: 4,
  kycStatus: "verified" as const, isActive: true, createdAt: { seconds: 1723000000 } as never,
};

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/admin/merchants"]}>
      <Routes>
        <Route path="/admin/merchants" element={<AdminMerchants />} />
        <Route path="/admin/merchants/:id" element={<AdminMerchantDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail(id: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/merchants/${id}`]}>
        <Routes><Route path="/admin/merchants/:id" element={<AdminMerchantDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminMerchants list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an error state", () => {
    mockedUseMerchants.mockReturnValue({ data: [], isLoading: false, error: new Error("boom") } as never);
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent(/impossible de charger/i);
  });

  it("shows an empty state", () => {
    mockedUseMerchants.mockReturnValue({ data: [], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText(/aucun commerçant/i)).toBeInTheDocument();
  });

  it("renders a populated row and navigates to the detail page on click", () => {
    mockedUseMerchants.mockReturnValue({ data: [MERCHANT], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText("AROM Industries")).toBeInTheDocument();
    fireEvent.click(screen.getByText("AROM Industries"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/merchants/m1");
  });
});

describe("AdminMerchantDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows recent offers and links an invoice to its detail page", () => {
    mockedUseMerchantDetail.mockReturnValue({
      data: {
        ...MERCHANT,
        recentOffers: [{ id: "o1", farmerName: "Jean Kalonji", offerQuantityKg: 100, offerPricePerKgCdf: 800, status: "pending", createdAt: { seconds: 1723000000 } as never }],
        recentInvoices: [{ id: "inv1", amountUsd: 100, status: "paid", origin: "harvest_sale", createdAt: { seconds: 1723000000 } as never }],
      },
      isLoading: false, error: null,
    } as never);
    renderDetail("m1");
    expect(screen.getByText(/Jean Kalonji · 100 kg/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Créée par l'agriculteur"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/partner-invoices/inv1");
  });

  it("shows a not-found state", () => {
    mockedUseMerchantDetail.mockReturnValue({ data: null, isLoading: false, error: null } as never);
    renderDetail("missing");
    expect(screen.getByText(/introuvable/i)).toBeInTheDocument();
  });
});
