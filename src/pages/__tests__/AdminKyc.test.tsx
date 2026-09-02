import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { AdminKyc } from "@/pages/AdminKyc";
import {
  useKycSubmissions, useKycSubmissionDetail, useKycDocumentUrls, useReviewKyc,
} from "@/hooks/useKyc";

vi.mock("@/hooks/useKyc", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useKyc")>("@/hooks/useKyc");
  return {
    ...actual,
    useKycSubmissions: vi.fn(),
    useKycSubmissionDetail: vi.fn(),
    useKycDocumentUrls: vi.fn(),
    useReviewKyc: vi.fn(),
  };
});

const mockedSubmissions = vi.mocked(useKycSubmissions);
const mockedDetail = vi.mocked(useKycSubmissionDetail);
const mockedDocs = vi.mocked(useKycDocumentUrls);
const mockedReview = vi.mocked(useReviewKyc);

function fakeTimestamp(date: Date) {
  return { seconds: Math.floor(date.getTime() / 1000), toDate: () => date };
}

const ROW = {
  uid: "u1", fullName: "Teddy Agent Terrain", phone: "+243810000000", role: "agent", province: "Haut-Katanga",
  status: "pending" as const, submittedAt: { seconds: 1723000000 } as never, reviewedAt: null,
};

const DETAIL = {
  uid: "u1", fullName: "Teddy Agent Terrain", phone: "+243810000000", role: "agent",
  province: "Haut-Katanga", documentType: "cni", documentPhotoCount: 2, status: "pending" as const,
  submittedAt: { seconds: 1723000000 } as never, reviewedAt: null, reviewedBy: null, reviewerName: null, rejectionReason: null,
};

function renderPage() {
  return render(<MemoryRouter><AdminKyc /></MemoryRouter>);
}

describe("AdminKyc", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedDetail.mockReturnValue({ data: null, isLoading: true } as never);
    mockedDocs.mockReturnValue({ data: undefined, isLoading: true, error: null } as never);
    mockedReview.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null } as never);
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
  });

  it("shows an error state for the queue", () => {
    mockedSubmissions.mockReturnValue({ data: [], isLoading: false, error: new Error("boom") } as never);
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/impossible de charger la file/i);
  });

  it("shows an empty state when there are no submissions at all", () => {
    mockedSubmissions.mockReturnValue({ data: [], isLoading: false, error: null } as never);
    renderPage();
    expect(screen.getByText("Aucun dossier à vérifier")).toBeInTheDocument();
    expect(screen.getByText(/nouveaux dossiers apparaîtront ici/i)).toBeInTheDocument();
  });

  it("shows a distinct empty state when a search matches nothing, with a way to clear it", () => {
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/rechercher une personne/i), { target: { value: "zzz-no-match" } });
    expect(screen.getByText(/aucun dossier ne correspond à votre recherche/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Effacer les filtres"));
    expect(screen.getAllByText("Teddy Agent Terrain").length).toBeGreaterThan(0);
  });

  it("lists a pending submission with its real province, and shows its detail once selected", async () => {
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: ["https://signed.example/a.jpg", "https://signed.example/b.jpg"] }, isLoading: false, error: null } as never);

    renderPage();
    expect(screen.getAllByText("Teddy Agent Terrain").length).toBeGreaterThan(0);
    expect(screen.getByText(/agent · Haut-Katanga/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: /dossier de teddy agent terrain/i })).toBeInTheDocument());
    // Two photos -> labeled Recto/Verso, not a generic "Document 1/2"
    expect(screen.getByAltText(/Recto — pièce d'identité/)).toHaveAttribute("src", "https://signed.example/a.jpg");
    expect(screen.getByAltText(/Verso — pièce d'identité/)).toHaveAttribute("src", "https://signed.example/b.jpg");
    expect(screen.getByText("Valider le dossier")).toBeInTheDocument();
  });

  it("filters by tab, including a search across name, role and province", () => {
    const row2 = { ...ROW, uid: "u2", fullName: "Aline Mumbere", role: "merchant", province: "Sud-Kivu", status: "correction_requested" as const };
    mockedSubmissions.mockReturnValue({ data: [ROW, row2], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    renderPage();
    expect(screen.getAllByText("Teddy Agent Terrain").length).toBeGreaterThan(0);
    expect(screen.queryByText("Aline Mumbere")).not.toBeInTheDocument(); // different tab by default

    fireEvent.click(screen.getByRole("tab", { name: "En attente d'informations" }));
    expect(screen.getByText("Aline Mumbere")).toBeInTheDocument();
    // Teddy's queue row is gone (the mocked detail panel still shows his name
    // regardless of selection — that's a test-double limitation, not app behavior)
    expect(screen.queryByText(/agent · Haut-Katanga/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/rechercher une personne/i), { target: { value: "sud-kivu" } });
    expect(screen.getByText("Aline Mumbere")).toBeInTheDocument();
  });

  it("clicking a KPI card switches the queue to the matching filter", () => {
    const verifiedThisMonth = { ...ROW, uid: "u3", status: "verified" as const, reviewedAt: fakeTimestamp(new Date()) as never };
    mockedSubmissions.mockReturnValue({ data: [ROW, verifiedThisMonth], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    renderPage();
    fireEvent.click(screen.getByText("Validés ce mois"));
    expect(screen.getByRole("tab", { name: "Terminés" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("Teddy Agent Terrain").length).toBeGreaterThan(0); // the verified row, same fullName fixture reused
  });

  it("paginates when there are more than 10 results", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ ...ROW, uid: `u${i}`, fullName: `Personne ${i}` }));
    mockedSubmissions.mockReturnValue({ data: rows, isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    renderPage();
    expect(screen.getByText("12 résultats")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByText("Personne 11")).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog before approving, and calls reviewKycSubmission on confirm", async () => {
    mutateAsync.mockResolvedValue({ success: true });
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: [] }, isLoading: false, error: null } as never);

    renderPage();
    fireEvent.click(screen.getByText("Valider le dossier"));
    expect(screen.getByRole("dialog", { name: "Valider le dossier" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Confirmer la validation"));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ uid: "u1", decision: "verified", reason: undefined }));
  });

  it("requires a reason before confirming a rejection, supports quick-reason chips, then calls reviewKycSubmission", async () => {
    mutateAsync.mockResolvedValue({ success: true });
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: [] }, isLoading: false, error: null } as never);

    renderPage();
    fireEvent.click(screen.getByText("Rejeter"));
    const confirmBtn = screen.getByText("Confirmer le rejet");
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(screen.getByText("Photo illisible")); // quick-reason chip
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ uid: "u1", decision: "rejected", reason: "Photo illisible" }),
    );
  });

  it("requires an instruction before sending a correction request", async () => {
    mutateAsync.mockResolvedValue({ success: true });
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: [] }, isLoading: false, error: null } as never);

    renderPage();
    fireEvent.click(screen.getByText("Demander une correction"));
    const confirmBtn = screen.getByText("Envoyer la demande");
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/ce que la personne doit corriger/i), { target: { value: "Recto illisible, merci de la reprendre" } });
    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ uid: "u1", decision: "correction_requested", reason: "Recto illisible, merci de la reprendre" }),
    );
  });

  it("closes a decision dialog on Escape without submitting", () => {
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: [] }, isLoading: false, error: null } as never);
    renderPage();
    fireEvent.click(screen.getByText("Rejeter"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("surfaces a server error (e.g. already decided by another admin) without pretending it succeeded", async () => {
    mutateAsync.mockRejectedValue(new Error("Ce dossier a déjà été traité par un autre administrateur."));
    mockedReview.mockReturnValue({ mutateAsync, isPending: false, isError: true, error: new Error("Ce dossier a déjà été traité par un autre administrateur.") } as never);
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: [] }, isLoading: false, error: null } as never);

    renderPage();
    fireEvent.click(screen.getByText("Valider le dossier"));
    fireEvent.click(screen.getByText("Confirmer la validation"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/déjà été traité/));
  });

  it("does not show decision actions once a submission is already verified or rejected", () => {
    mockedSubmissions.mockReturnValue({ data: [{ ...ROW, status: "verified" }], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({
      data: { ...DETAIL, status: "verified", reviewedAt: { seconds: 1723000100 } as never, reviewedBy: "admin1", reviewerName: "Admin Mombongo" },
      isLoading: false,
    } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: [] }, isLoading: false, error: null } as never);

    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Terminés" }));
    expect(screen.queryByText("Valider le dossier")).not.toBeInTheDocument();
    expect(screen.queryByText("Rejeter")).not.toBeInTheDocument();
    expect(screen.getByText("Ce dossier a déjà été traité.")).toBeInTheDocument();
  });

  it("disables decision buttons while offline", () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({ data: DETAIL, isLoading: false } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: [] }, isLoading: false, error: null } as never);
    renderPage();
    expect(screen.getByText(/connexion perdue/i)).toBeInTheDocument();
    expect(screen.getByText("Valider le dossier").closest("button")).toBeDisabled();
    expect(screen.getByText("Rejeter").closest("button")).toBeDisabled();
    expect(screen.getByText("Demander une correction").closest("button")).toBeDisabled();
  });
});
