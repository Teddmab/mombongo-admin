import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAgents, AdminAgentDetail } from "@/pages/AdminAgents";
import { useAgents, useAgentDetail } from "@/hooks/useAgents";

vi.mock("@/hooks/useAgents", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useAgents")>("@/hooks/useAgents");
  return { ...actual, useAgents: vi.fn(), useAgentDetail: vi.fn() };
});

const mockedUseAgents = vi.mocked(useAgents);
const mockedUseAgentDetail = vi.mocked(useAgentDetail);
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const AGENT = {
  id: "a1", fullName: "Paul Mukendi", phone: "+243970000001", province: "Kasaï",
  assignedFarmerCount: 3, kycStatus: "verified" as const, isActive: true, createdAt: { seconds: 1723000000 } as never,
};

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/admin/agents"]}>
      <Routes>
        <Route path="/admin/agents" element={<AdminAgents />} />
        <Route path="/admin/agents/:id" element={<AdminAgentDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail(id: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/agents/${id}`]}>
        <Routes><Route path="/admin/agents/:id" element={<AdminAgentDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminAgents list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an error state", () => {
    mockedUseAgents.mockReturnValue({ data: [], isLoading: false, error: new Error("boom") } as never);
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent(/impossible de charger/i);
  });

  it("shows an empty state", () => {
    mockedUseAgents.mockReturnValue({ data: [], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText(/aucun agent/i)).toBeInTheDocument();
  });

  it("renders a populated row and navigates to the detail page on click", () => {
    mockedUseAgents.mockReturnValue({ data: [AGENT], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText("Paul Mukendi")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Paul Mukendi"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/agents/a1");
  });
});

describe("AdminAgentDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows assigned farmers and recent visit reports, and links a farmer to their profile", () => {
    mockedUseAgentDetail.mockReturnValue({
      data: {
        ...AGENT, email: "paul@example.com",
        assignedFarmers: [{ id: "f1", fullName: "Jean Kalonji", province: "Kasaï", kycStatus: "verified" }],
        recentReports: [{ id: "r1", farmerName: "Jean Kalonji", cropType: "Maïs", status: "en attente", disbursedUsd: 0, visitDate: { seconds: 1723000000 } as never, createdAt: { seconds: 1723000000 } as never }],
      },
      isLoading: false, error: null,
    } as never);
    renderDetail("a1");
    fireEvent.click(screen.getByText("Jean Kalonji"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/farmers/f1");
    expect(screen.getByText(/Jean Kalonji · Maïs/)).toBeInTheDocument();
  });

  it("shows a not-found state", () => {
    mockedUseAgentDetail.mockReturnValue({ data: null, isLoading: false, error: null } as never);
    renderDetail("missing");
    expect(screen.getByText(/introuvable/i)).toBeInTheDocument();
  });
});
