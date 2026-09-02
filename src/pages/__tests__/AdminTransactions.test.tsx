import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTransactions, AdminTransactionDetail } from "@/pages/AdminTransactions";
import {
  useTransactions, useTransactionDetail, useResendPartnerNotification,
  useResolveReconciliationException, useCreateSupportTicket, useSupportTickets, useRunReconciliationCheck,
  type TransactionRow, type TransactionsPage,
} from "@/hooks/useTransactions";

vi.mock("@/hooks/useTransactions", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useTransactions")>("@/hooks/useTransactions");
  return {
    ...actual,
    useTransactions: vi.fn(),
    useTransactionDetail: vi.fn(),
    useResendPartnerNotification: vi.fn(),
    useResolveReconciliationException: vi.fn(),
    useCreateSupportTicket: vi.fn(),
    useSupportTickets: vi.fn(),
    useRunReconciliationCheck: vi.fn(),
    downloadReceipt: vi.fn(),
  };
});

const mockedList = vi.mocked(useTransactions);
const mockedDetail = vi.mocked(useTransactionDetail);
const mockedResend = vi.mocked(useResendPartnerNotification);
const mockedResolve = vi.mocked(useResolveReconciliationException);
const mockedCreateTicket = vi.mocked(useCreateSupportTicket);
const mockedTickets = vi.mocked(useSupportTickets);
const mockedRunReconciliation = vi.mocked(useRunReconciliationCheck);

const ROW: TransactionRow = {
  id: "tx1", source: "ledger", type: "deposit", label: "Dépôt", direction: "in",
  amount: 1250, currency: "USD", status: "completed", method: "mobile_money", operator: "Airtel",
  participantName: "Jean Kalonji", secondaryParticipantName: null, phone: null, reference: "dep_abc123",
  createdAt: { seconds: Math.floor(Date.now() / 1000) } as never, externalInvoiceDocId: null,
  reconciliationStatus: "unchecked", feeUsd: null,
};

function mockList(rows: TransactionRow[] | undefined, overrides: Partial<{
  isLoading: boolean; error: Error | null; isFetching: boolean; hasMore: boolean; dataUpdatedAt: number; refetch: () => void;
}> = {}) {
  mockedList.mockReturnValue({
    data: rows === undefined ? undefined : ({ rows, hasMore: overrides.hasMore ?? false } satisfies TransactionsPage),
    isLoading: overrides.isLoading ?? false,
    isFetching: overrides.isFetching ?? false,
    error: overrides.error ?? null,
    refetch: overrides.refetch ?? vi.fn(),
    dataUpdatedAt: overrides.dataUpdatedAt ?? Date.now(),
  } as never);
}

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
    mockedResolve.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as never);
    mockedCreateTicket.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as never);
    mockedTickets.mockReturnValue({ data: [] } as never);
    mockedRunReconciliation.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  });

  it("shows an error state with a retry action, never a raw error string", () => {
    const refetch = vi.fn();
    mockList([], { error: new Error("boom"), refetch });
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent(/impossible de charger les transactions/i);
    expect(screen.queryByText(/boom/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Réessayer"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows a loading skeleton", () => {
    mockList(undefined, { isLoading: true });
    renderList();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows the true-empty state when there is no data at all", () => {
    mockList([]);
    renderList();
    expect(screen.getByText("Aucune transaction")).toBeInTheDocument();
    expect(screen.getByText(/apparaîtront ici lorsqu'ils seront enregistrés/i)).toBeInTheDocument();
  });

  it("renders a populated row with a signed, directional amount", () => {
    mockList([ROW]);
    renderList();
    expect(screen.getByText(/Dépôt — Jean Kalonji/)).toBeInTheDocument();
    expect(screen.getAllByText(/1.250,00 \$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Réussi").length).toBeGreaterThan(0);
  });

  it("masks a row's phone number rather than showing it raw", () => {
    mockList([{ ...ROW, phone: "+243812345678" }]);
    renderList();
    expect(screen.getByText(/\+243 81 \*\*\* \*\* 78/)).toBeInTheDocument();
    expect(screen.queryByText("+243812345678")).not.toBeInTheDocument();
  });

  it("filters by segment", () => {
    const out: TransactionRow = { ...ROW, id: "tx2", type: "withdrawal", label: "Retrait", direction: "out", participantName: "Marie Femme" };
    mockList([ROW, out]);
    renderList();
    fireEvent.click(screen.getByRole("tab", { name: "Sorties" }));
    expect(screen.queryByText(/Jean Kalonji/)).not.toBeInTheDocument();
    expect(screen.getByText(/Marie Femme/)).toBeInTheDocument();
  });

  it("filters by search text and offers to clear filters when nothing matches", () => {
    mockList([ROW]);
    renderList();
    fireEvent.change(screen.getByPlaceholderText(/nom, référence ou téléphone/i), { target: { value: "zzz" } });
    expect(screen.getByText(/aucune transaction ne correspond à vos filtres/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Effacer les filtres"));
    expect(screen.getByText(/Jean Kalonji/)).toBeInTheDocument();
  });

  it("a pending attempt row (no ledger entry yet) still shows up, with an 'En cours' status", () => {
    const attempt: TransactionRow = {
      ...ROW, id: "attempt:deposit:dep1", source: "deposit_attempt", status: "pending", reconciliationStatus: "not_applicable",
    };
    mockList([attempt]);
    renderList();
    expect(screen.getAllByText("En cours").length).toBeGreaterThan(0);
  });

  it("clicking the 'Réussies' KPI card filters the list to completed transactions", () => {
    const pending: TransactionRow = {
      ...ROW, id: "tx2", source: "deposit_attempt", status: "pending", reconciliationStatus: "not_applicable", participantName: "Marie Femme",
    };
    mockList([ROW, pending]);
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /réussies/i }));
    expect(screen.getByText(/Jean Kalonji/)).toBeInTheDocument();
    expect(screen.queryByText(/Marie Femme/)).not.toBeInTheDocument();
  });

  it("clicking the 'À rapprocher' KPI card filters to reconciliation exceptions", () => {
    const exception: TransactionRow = { ...ROW, id: "tx2", participantName: "Entreprise Canaan", reconciliationStatus: "exception" };
    mockList([ROW, exception]);
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /à rapprocher/i }));
    expect(screen.queryByText(/Jean Kalonji/)).not.toBeInTheDocument();
    expect(screen.getByText(/Entreprise Canaan/)).toBeInTheDocument();
    expect(screen.getAllByText("À vérifier").length).toBeGreaterThan(0);
  });

  it("Actualiser refetches without losing the active filters", () => {
    const refetch = vi.fn();
    const out: TransactionRow = { ...ROW, id: "tx2", direction: "out", participantName: "Marie Femme" };
    mockList([ROW, out], { refetch });
    renderList();
    fireEvent.click(screen.getByRole("tab", { name: "Sorties" }));
    fireEvent.click(screen.getByText("Actualiser"));
    expect(refetch).toHaveBeenCalled();
    expect(screen.queryByText(/Jean Kalonji/)).not.toBeInTheDocument();
  });

  it("shows 'Charger plus' when the ledger page is full, and 'Chargement terminé' when it isn't", () => {
    mockList([ROW], { hasMore: true });
    const { unmount } = renderList();
    expect(screen.getByText(/charger plus de transactions/i)).toBeInTheDocument();
    unmount();

    mockList([ROW], { hasMore: false });
    renderList();
    expect(screen.getByText("Chargement terminé")).toBeInTheDocument();
  });

  it("opens the export dialog instead of exporting immediately", () => {
    mockList([ROW]);
    renderList();
    fireEvent.click(screen.getByText("Exporter"));
    expect(screen.getByText("Exporter les transactions")).toBeInTheDocument();
    expect(screen.getByText(/masquer les numéros de téléphone/i)).toBeInTheDocument();
  });

  it("reconciliation exception rows get an attention row style and an Examiner action", () => {
    mockList([{ ...ROW, reconciliationStatus: "exception" }]);
    renderList();
    const row = screen.getByText(/Dépôt — Jean Kalonji/).closest("tr")!;
    expect(row.className).toContain("attention-row");
    expect(screen.getByText("Examiner")).toBeInTheDocument();
  });
});

describe("AdminTransactionDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResend.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false } as never);
    mockedResolve.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as never);
    mockedCreateTicket.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as never);
    mockedTickets.mockReturnValue({ data: [] } as never);
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

  function renderDetail(overrides: Record<string, unknown>) {
    mockedDetail.mockReturnValue({
      data: {
        ...ROW,
        timeline: [{ label: "Demande envoyée à l'opérateur", at: { seconds: 1723000000 } }],
        notificationStatus: "not_applicable",
        notificationFailureReason: null,
        feeUsd: null,
        reconciliationNote: null,
        reconciliationResolvedByName: null,
        reconciliationResolutionNote: null,
        ...overrides,
      },
      isLoading: false,
      error: null,
    } as never);
    return render(
      <MemoryRouter initialEntries={["/admin/transactions/tx1"]}>
        <Routes><Route path="/admin/transactions/:id" element={<AdminTransactionDetail />} /></Routes>
      </MemoryRouter>,
    );
  }

  it("renders real timeline steps and shows an honest 'not communicated' fee rather than fabricating a number", () => {
    renderDetail({});
    expect(screen.getByText("Demande envoyée à l'opérateur")).toBeInTheDocument();
    expect(screen.getByText("non communiqué")).toBeInTheDocument();
    expect(screen.getByText(/ne peuvent pas être marqués comme payés manuellement/i)).toBeInTheDocument();
  });

  it("shows the real fee when the webhook actually captured one", () => {
    renderDetail({ feeUsd: 2.5 });
    expect(screen.queryByText("non communiqué")).not.toBeInTheDocument();
    expect(screen.getAllByText(/2,50 \$/).length).toBeGreaterThan(0);
  });

  it("shows a masked phone number in the payment details when one is on record", () => {
    renderDetail({ phone: "+243812345678" });
    expect(screen.getByText(/\+243 81 \*\*\* \*\* 78/)).toBeInTheDocument();
  });

  it("shows a slow-provider warning for a still-pending payment, with no fake 'verify' action", () => {
    renderDetail({ source: "deposit_attempt", status: "pending", reconciliationStatus: "not_applicable" });
    expect(screen.getByText(/la confirmation du paiement prend plus de temps/i)).toBeInTheDocument();
    expect(screen.getByText(/ne lancez pas un deuxième paiement/i)).toBeInTheDocument();
    // No receipt exists yet for an unsettled attempt — don't offer to download one.
    expect(screen.queryByText(/télécharger le reçu/i)).not.toBeInTheDocument();
  });

  it("reconciliation: shows 'not yet checked' honestly rather than claiming a match", () => {
    renderDetail({ reconciliationStatus: "unchecked" });
    expect(screen.getByText(/pas encore vérifié/i)).toBeInTheDocument();
  });

  it("reconciliation: shows 'sans objet' for transaction types with no secondary record", () => {
    renderDetail({ reconciliationStatus: "not_applicable" });
    expect(screen.getByText(/sans objet/i)).toBeInTheDocument();
  });

  it("reconciliation: exception requires a note before 'Confirmer' resolves it", async () => {
    const mutate = vi.fn();
    mockedResolve.mockReturnValue({ mutate, isPending: false, isError: false } as never);
    renderDetail({ reconciliationStatus: "exception", reconciliationNote: "Montant différent" });
    expect(screen.getByText("Montant différent")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Examiner"));
    const confirmBtn = screen.getByText("Confirmer");
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/note de résolution/i), { target: { value: "Vérifié avec PawaPay" } });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(
      { transactionId: "tx1", note: "Vérifié avec PawaPay" },
      expect.anything(),
    ));
  });

  it("reconciliation: shows who resolved it and why once resolved", () => {
    renderDetail({ reconciliationStatus: "resolved_manually", reconciliationResolvedByName: "Admin Mombongo", reconciliationResolutionNote: "Confirmé avec le partenaire" });
    expect(screen.getByText(/Admin Mombongo/)).toBeInTheDocument();
    expect(screen.getByText(/Confirmé avec le partenaire/)).toBeInTheDocument();
  });

  it("support: opens a ticket with a description", async () => {
    const mutate = vi.fn();
    mockedCreateTicket.mockReturnValue({ mutate, isPending: false, isError: false } as never);
    renderDetail({});
    fireEvent.click(screen.getByText("Ouvrir un dossier de support"));
    fireEvent.change(screen.getByLabelText(/décrire le problème/i), { target: { value: "Le client ne voit pas son crédit" } });
    fireEvent.click(screen.getByText("Ouvrir le dossier"));
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(
      { transactionId: "tx1", description: "Le client ne voit pas son crédit" },
      expect.anything(),
    ));
  });

  it("support: lists existing tickets for this transaction", () => {
    mockedTickets.mockReturnValue({
      data: [{ id: "t1", description: "Problème signalé", createdByName: "Admin Mombongo", createdAt: { seconds: 1723000000 } }],
    } as never);
    renderDetail({});
    expect(screen.getByText("Problème signalé")).toBeInTheDocument();
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
