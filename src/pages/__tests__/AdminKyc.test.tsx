import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminKyc } from "@/pages/AdminKyc";
import {
  useAdminKycQueue, useAdminKycSummary, useAdminKycDocumentUrls, useAdminReviewKyc,
} from "@/hooks/useAdminKyc";

vi.mock("@/hooks/useAdminKyc", () => ({
  useAdminKycQueue: vi.fn(),
  useAdminKycSummary: vi.fn(),
  useAdminKycDocumentUrls: vi.fn(),
  useAdminReviewKyc: vi.fn(),
}));

const mockedQueue = vi.mocked(useAdminKycQueue);
const mockedSummary = vi.mocked(useAdminKycSummary);
const mockedDocs = vi.mocked(useAdminKycDocumentUrls);
const mockedReview = vi.mocked(useAdminReviewKyc);

const PENDING_ROW = {
  uid: "farmer1", name: "Jean Kalonji", phone: "+243970000000", province: "Nord-Kivu",
  role: "farmer", status: "pending", submittedAt: Date.now(), completePct: 75,
};

function renderPage() {
  return render(<MemoryRouter><AdminKyc /></MemoryRouter>);
}

describe("AdminKyc", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedSummary.mockReturnValue({
      data: { pending: 21, correctionRequested: 6, approvedThisMonth: 34, rejectedThisMonth: 3 },
    } as ReturnType<typeof useAdminKycSummary>);
    mockedQueue.mockReturnValue({ data: [PENDING_ROW], isLoading: false, error: null } as ReturnType<typeof useAdminKycQueue>);
    mockedDocs.mockReturnValue({
      data: {
        documentType: "cni", status: "pending", submittedAt: null, reviewedAt: null, reviewedBy: null,
        rejectionReason: null, photoUrls: ["https://signed.example.com/recto.jpg", "https://signed.example.com/verso.jpg"],
      },
      isLoading: false, error: null,
    } as ReturnType<typeof useAdminKycDocumentUrls>);
    mockedReview.mockReturnValue({
      mutateAsync, isPending: false, isError: false, error: null,
    } as unknown as ReturnType<typeof useAdminReviewKyc>);
  });

  it("shows real summary counts, not the reference image's fixture numbers", () => {
    renderPage();
    const badge = (text: string) => screen.getAllByText(text).find((el) => el.className.includes("badge"));
    expect(badge("À vérifier")?.closest("article")).toHaveTextContent("21");
    expect(badge("Informations manquantes")?.closest("article")).toHaveTextContent("6");
    expect(badge("Validés ce mois")?.closest("article")).toHaveTextContent("34");
    expect(badge("Rejetés ce mois")?.closest("article")).toHaveTextContent("3");
  });

  it("never renders a raw kycStatus/role enum value", () => {
    renderPage();
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
    expect(screen.queryByText("farmer")).not.toBeInTheDocument();
    expect(screen.getByText(/Agriculteur/)).toBeInTheDocument(); // mapped label instead
  });

  it("selecting a row shows the detail pane with real document images, no selfie panel", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Jean Kalonji"));

    expect(screen.getByText("Dossier de Jean Kalonji")).toBeInTheDocument();
    expect(screen.getByAltText("Recto")).toBeInTheDocument();
    expect(screen.getByAltText("Verso")).toBeInTheDocument();
    expect(screen.queryByAltText(/[Ss]elfie/)).not.toBeInTheDocument();
    expect(screen.queryByText(/[Rr]isque/)).not.toBeInTheDocument();
  });

  it("disables the reject confirmation until a reason is entered", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Jean Kalonji"));
    await user.click(screen.getByRole("button", { name: /Rejeter/ }));

    const confirmBtn = screen.getByRole("button", { name: /Confirmer le rejet/ });
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/Raison du rejet/), "Photo illisible");
    expect(confirmBtn).toBeEnabled();

    await user.click(confirmBtn);
    expect(mutateAsync).toHaveBeenCalledWith({ uid: "farmer1", decision: "reject", reason: "Photo illisible" });
  });

  it("requires a reason before sending a correction request", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Jean Kalonji"));
    await user.click(screen.getByRole("button", { name: /Demander une correction/ }));

    expect(screen.getByRole("button", { name: /Envoyer la demande/ })).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/ce qui manque/), "Verso manquant");
    await user.click(screen.getByRole("button", { name: /Envoyer la demande/ }));

    expect(mutateAsync).toHaveBeenCalledWith({ uid: "farmer1", decision: "request_correction", reason: "Verso manquant" });
  });

  it("approves without requiring a reason", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Jean Kalonji"));
    await user.click(screen.getByRole("button", { name: /Valider le dossier/ }));

    expect(mutateAsync).toHaveBeenCalledWith({ uid: "farmer1", decision: "approve", reason: undefined });
  });

  it("surfaces a double-submit/already-reviewed error from the server instead of failing silently", async () => {
    mockedReview.mockReturnValue({
      mutateAsync, isPending: false, isError: true,
      error: new Error("Ce dossier a déjà été traité (statut actuel : approved)."),
    } as unknown as ReturnType<typeof useAdminReviewKyc>);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Jean Kalonji"));

    expect(screen.getByText(/déjà été traité/)).toBeInTheDocument();
  });

  it("does not show decision actions for an already-resolved (Terminés) dossier", async () => {
    mockedQueue.mockReturnValue({
      data: [{ ...PENDING_ROW, status: "approved" }], isLoading: false, error: null,
    } as ReturnType<typeof useAdminKycQueue>);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Jean Kalonji"));

    expect(screen.queryByRole("button", { name: /Valider le dossier/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rejeter/ })).not.toBeInTheDocument();
  });

  it("shows an empty state when the queue has no entries", () => {
    mockedQueue.mockReturnValue({ data: [], isLoading: false, error: null } as ReturnType<typeof useAdminKycQueue>);
    renderPage();
    expect(screen.getByText(/Aucun dossier/)).toBeInTheDocument();
  });

  it("shows an error state instead of an empty table when the queue query fails", () => {
    mockedQueue.mockReturnValue({
      data: undefined, isLoading: false, error: new Error("permission-denied"),
    } as unknown as ReturnType<typeof useAdminKycQueue>);
    renderPage();
    expect(screen.getByText(/Impossible de charger la file KYC/)).toBeInTheDocument();
  });

  it("switches tabs and clears the selected dossier", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Jean Kalonji"));
    expect(screen.getByText("Dossier de Jean Kalonji")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Terminés" }));
    expect(screen.getByRole("button", { name: "Terminés" })).toHaveClass("active");
    expect(screen.queryByText("Dossier de Jean Kalonji")).not.toBeInTheDocument();
  });
});
