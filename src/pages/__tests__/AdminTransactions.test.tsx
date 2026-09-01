import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTransactions, AdminTransactionDetail } from "@/pages/AdminTransactions";
import { useTransactions, useTransactionDetail, useResendPartnerNotification } from "@/hooks/useTransactions";

vi.mock("@/hooks/useTransactions", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useTransactions")>("@/hooks/useTransactions");
  return {
    ...actual,
    useTransactions: vi.fn(),
    useTransactionDetail: vi.fn(),
    useResendPartnerNotification: vi.fn(),
  };
});

const mockedList = vi.mocked(useTransactions);
const mockedDetail = vi.mocked(useTransactionDetail);
const mockedResend = vi.mocked(useResendPartnerNotification);

const ROW = {
  id: "tx1", type: "deposit", label: "Dépôt", direction: "in" as const,
  amount: 1250, currency: "USD", status: "completed", method: "mobile_money", operator: "Airtel",
  participantName: "Jean Kalonji", secondaryParticipantName: null, reference: "dep_abc123",
  createdAt: { seconds: Math.floor(Date.now() / 1000) } as never, externalInvoiceDocId: null,
};

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/admin/transactions"]}>
      <Routes>
        <Route path="/admin/transactions" element={<AdminTransactions />} />
        <Route path="/admin/transactions/:id" element={<AdminTransactionDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminTransactions list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResend.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false } as never);
  });

  it("shows an error state", () => {
    mockedList.mockReturnValue({ data: [], isLoading: false, error: new Error("boom") } as never);
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent(/impossible de charger les transactions/i);
  });

  it("shows a loading skeleton", () => {
    mockedList.mockReturnValue({ data: [], isLoading: true, error: null } as never);
    renderList();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an empty state", () => {
    mockedList.mockReturnValue({ data: [], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText(/aucune transaction ne correspond/i)).toBeInTheDocument();
  });

  it("renders a populated row with a signed, directional amount", () => {
    mockedList.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    renderList();
    expect(screen.getByText(/Dépôt — Jean Kalonji/)).toBeInTheDocument();
    expect(screen.getAllByText(/1.250,00 \$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Réussi").length).toBeGreaterThan(0);
  });

  it("filters by segment", () => {
    const out = { ...ROW, id: "tx2", type: "withdrawal", label: "Retrait", direction: "out" as const, participantName: "Marie Femme" };
    mockedList.mockReturnValue({ data: [ROW, out], isLoading: false, error: null } as never);
    renderList();
    fireEvent.click(screen.getByRole("tab", { name: "Sorties" }));
    expect(screen.queryByText(/Jean Kalonji/)).not.toBeInTheDocument();
    expect(screen.getByText(/Marie Femme/)).toBeInTheDocument();
  });

  it("filters by search text", () => {
    mockedList.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    renderList();
    fireEvent.change(screen.getByPlaceholderText(/nom ou référence/i), { target: { value: "zzz" } });
    expect(screen.getByText(/aucune transaction ne correspond/i)).toBeInTheDocument();
  });
});

describe("AdminTransactionDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResend.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false } as never);
  });

  it("shows not-found for a missing transaction", () => {
    mockedDetail.mockReturnValue({ data: null, isLoading: false, error: null } as never);
    render(
      <MemoryRouter initialEntries={["/admin/transactions/ghost"]}>
        <Routes><Route path="/admin/transactions/:id" element={<AdminTransactionDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/introuvable/i)).toBeInTheDocument();
  });

  it("renders real timeline steps and never fabricates a fee or reconciliation result", () => {
    mockedDetail.mockReturnValue({
      data: {
        ...ROW,
        timeline: [{ label: "Demande envoyée à l'opérateur", at: { seconds: 1723000000 } }],
        notificationStatus: "not_applicable",
        notificationFailureReason: null,
      },
      isLoading: false,
      error: null,
    } as never);
    render(
      <MemoryRouter initialEntries={["/admin/transactions/tx1"]}>
        <Routes><Route path="/admin/transactions/:id" element={<AdminTransactionDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Demande envoyée à l'opérateur")).toBeInTheDocument();
    expect(screen.queryByText(/frais/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rapprochement/i)).not.toBeInTheDocument();
    expect(screen.getByText(/ne peuvent pas être marqués comme payés manuellement/i)).toBeInTheDocument();
  });

  it("shows a resend action only for external_invoice_payment rows with a linked invoice", () => {
    mockedDetail.mockReturnValue({
      data: {
        ...ROW, type: "external_invoice_payment", label: "Paiement de facture",
        externalInvoiceDocId: "inv1", timeline: [], notificationStatus: "failed",
        notificationFailureReason: "Timeout",
      },
      isLoading: false,
      error: null,
    } as never);
    render(
      <MemoryRouter initialEntries={["/admin/transactions/tx1"]}>
        <Routes><Route path="/admin/transactions/:id" element={<AdminTransactionDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Échec de notification")).toBeInTheDocument();
    expect(screen.getByText("Timeout")).toBeInTheDocument();
    expect(screen.getByText("Renvoyer la notification")).toBeInTheDocument();
  });
});
