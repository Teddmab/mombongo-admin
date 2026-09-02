import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminInvestors, AdminInvestorDetail } from "@/pages/AdminInvestors";
import { useInvestors, useInvestorDetail } from "@/hooks/useInvestors";

vi.mock("@/hooks/useInvestors", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useInvestors")>("@/hooks/useInvestors");
  return { ...actual, useInvestors: vi.fn(), useInvestorDetail: vi.fn() };
});

const mockedUseInvestors = vi.mocked(useInvestors);
const mockedUseInvestorDetail = vi.mocked(useInvestorDetail);
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const INVESTOR = {
  id: "inv1", fullName: "Alice Mbuyi", phone: "+243970000000", email: "alice@example.com",
  walletUsd: 250, walletCdf: 10000, totalInvestedUsd: 1000, totalEarnedUsd: 120,
  kycStatus: "verified" as const, isActive: true, createdAt: { seconds: 1723000000 } as never,
};

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/admin/investors"]}>
      <Routes>
        <Route path="/admin/investors" element={<AdminInvestors />} />
        <Route path="/admin/investors/:id" element={<AdminInvestorDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminInvestors list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an error state", () => {
    mockedUseInvestors.mockReturnValue({ data: [], isLoading: false, error: new Error("boom") } as never);
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent(/impossible de charger/i);
  });

  it("shows an empty state", () => {
    mockedUseInvestors.mockReturnValue({ data: [], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText(/aucun investisseur/i)).toBeInTheDocument();
  });

  it("renders a populated row and navigates to the detail page on click", () => {
    mockedUseInvestors.mockReturnValue({ data: [INVESTOR], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText("Alice Mbuyi")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Alice Mbuyi"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/investors/inv1");
  });

  it("filters by search text", () => {
    mockedUseInvestors.mockReturnValue({ data: [INVESTOR], isLoading: false, error: null } as never);
    renderList();
    fireEvent.change(screen.getByPlaceholderText(/rechercher un nom/i), { target: { value: "zzz" } });
    expect(screen.getByText(/aucun investisseur ne correspond/i)).toBeInTheDocument();
  });
});

function renderDetail(id: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/investors/${id}`]}>
        <Routes><Route path="/admin/investors/:id" element={<AdminInvestorDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminInvestorDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows investments and transactions for the investor", () => {
    mockedUseInvestorDetail.mockReturnValue({
      data: {
        ...INVESTOR,
        investments: [{ id: "i1", productTitle: "Bourse maïs", amountUsd: 500, status: "active" }],
        transactions: [{ id: "t1", type: "deposit", amountUsd: 200, status: "completed", createdAt: { seconds: 1723000000 } as never }],
      },
      isLoading: false, error: null,
    } as never);
    renderDetail("inv1");
    expect(screen.getByText("Bourse maïs")).toBeInTheDocument();
    expect(screen.getByText("deposit")).toBeInTheDocument();
  });

  it("shows a not-found state", () => {
    mockedUseInvestorDetail.mockReturnValue({ data: null, isLoading: false, error: null } as never);
    renderDetail("missing");
    expect(screen.getByText(/introuvable/i)).toBeInTheDocument();
  });
});
