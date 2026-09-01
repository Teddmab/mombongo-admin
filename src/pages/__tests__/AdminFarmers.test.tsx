import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminFarmers, AdminFarmerDetail } from "@/pages/AdminFarmers";
import { useFarmers, useFarmerDetail } from "@/hooks/useFarmers";

vi.mock("@/hooks/useFarmers", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useFarmers")>("@/hooks/useFarmers");
  return { ...actual, useFarmers: vi.fn(), useFarmerDetail: vi.fn() };
});

const mockedUseFarmers = vi.mocked(useFarmers);
const mockedUseFarmerDetail = vi.mocked(useFarmerDetail);

const FARMER = {
  id: "f1",
  fullName: "Jean Kalonji",
  phone: "+243970000000",
  avatarUrl: null,
  province: "Nord-Kivu",
  primaryCommodity: "Cacao",
  totalHectares: 4.5,
  completionPercent: 80,
  momBongoScore: 58,
  kycStatus: "pending" as const,
  isActive: true,
  updatedAt: { seconds: 1723000000 } as never,
  createdAt: { seconds: 1723000000 } as never,
};

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/admin/farmers"]}>
      <Routes>
        <Route path="/admin/farmers" element={<AdminFarmers />} />
        <Route path="/admin/farmers/:id" element={<AdminFarmerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminFarmers list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton", () => {
    mockedUseFarmers.mockReturnValue({ data: [], isLoading: true, error: null } as never);
    renderList();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an error state", () => {
    mockedUseFarmers.mockReturnValue({ data: [], isLoading: false, error: new Error("boom") } as never);
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent(/impossible de charger/i);
  });

  it("shows an empty state when no farmer matches", () => {
    mockedUseFarmers.mockReturnValue({ data: [], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText(/aucun agriculteur/i)).toBeInTheDocument();
  });

  it("renders a populated farmer row and opens the preview panel on click", () => {
    mockedUseFarmers.mockReturnValue({ data: [FARMER], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText("Jean Kalonji")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Jean Kalonji"));
    expect(screen.getByRole("heading", { name: "Jean Kalonji" })).toBeInTheDocument();
    expect(screen.getByText("Voir le profil")).toBeInTheDocument();
  });

  it("filters by search text", () => {
    mockedUseFarmers.mockReturnValue({ data: [FARMER], isLoading: false, error: null } as never);
    renderList();
    fireEvent.change(screen.getByPlaceholderText(/rechercher un nom/i), { target: { value: "zzz" } });
    expect(screen.getByText(/aucun agriculteur ne correspond/i)).toBeInTheDocument();
  });
});

describe("AdminFarmerDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows not-found for a missing farmer", () => {
    mockedUseFarmerDetail.mockReturnValue({ data: null, isLoading: false, error: null } as never);
    render(
      <MemoryRouter initialEntries={["/admin/farmers/ghost"]}>
        <Routes><Route path="/admin/farmers/:id" element={<AdminFarmerDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/introuvable/i)).toBeInTheDocument();
  });

  it("shows an error state", () => {
    mockedUseFarmerDetail.mockReturnValue({ data: null, isLoading: false, error: new Error("boom") } as never);
    render(
      <MemoryRouter initialEntries={["/admin/farmers/f1"]}>
        <Routes><Route path="/admin/farmers/:id" element={<AdminFarmerDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders farmer detail fields", () => {
    mockedUseFarmerDetail.mockReturnValue({
      data: { ...FARMER, email: "jean@example.com", exploitationName: "Ferme Kalonji", territory: "Beni", cultures: [{ commodity: "Cacao", surfaceHa: 3, status: "active" }] },
      isLoading: false,
      error: null,
    } as never);
    render(
      <MemoryRouter initialEntries={["/admin/farmers/f1"]}>
        <Routes><Route path="/admin/farmers/:id" element={<AdminFarmerDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Jean Kalonji" })).toBeInTheDocument();
    expect(screen.getByText("jean@example.com")).toBeInTheDocument();
    expect(screen.getByText("Cacao")).toBeInTheDocument();
  });
});
