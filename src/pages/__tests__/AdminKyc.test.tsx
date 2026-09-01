import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const ROW = {
  uid: "u1", fullName: "Teddy Agent Terrain", phone: "+243810000000", role: "agent",
  status: "pending" as const, submittedAt: { seconds: 1723000000 } as never, reviewedAt: null,
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
    mockedReview.mockReturnValue({ mutateAsync, isPending: false } as never);
  });

  it("shows an error state for the queue", () => {
    mockedSubmissions.mockReturnValue({ data: [], isLoading: false, error: new Error("boom") } as never);
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/impossible de charger la file/i);
  });

  it("shows an empty state when nothing is pending", () => {
    mockedSubmissions.mockReturnValue({ data: [], isLoading: false, error: null } as never);
    renderPage();
    expect(screen.getByText(/aucun dossier dans cette file/i)).toBeInTheDocument();
  });

  it("lists a pending submission and shows its detail pane once selected", async () => {
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({
      data: {
        uid: "u1", fullName: "Teddy Agent Terrain", phone: "+243810000000", role: "agent",
        province: "Haut-Katanga", documentType: "cni", status: "pending",
        submittedAt: { seconds: 1723000000 }, reviewedAt: null, reviewedBy: null, rejectionReason: null,
      },
      isLoading: false,
    } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: ["https://signed.example/a.jpg"] }, isLoading: false, error: null } as never);

    renderPage();
    expect(screen.getByText("Teddy Agent Terrain")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: /dossier de teddy agent terrain/i })).toBeInTheDocument());
    expect(screen.getByAltText("Document 1")).toHaveAttribute("src", "https://signed.example/a.jpg");
    expect(screen.getByText("Valider le dossier")).toBeInTheDocument();
  });

  it("requires a reason before confirming a rejection, then calls reviewKycSubmission", async () => {
    mockedSubmissions.mockReturnValue({ data: [ROW], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({
      data: {
        uid: "u1", fullName: "Teddy Agent Terrain", phone: "", role: "agent",
        province: null, documentType: "cni", status: "pending",
        submittedAt: null, reviewedAt: null, reviewedBy: null, rejectionReason: null,
      },
      isLoading: false,
    } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: [] }, isLoading: false, error: null } as never);

    renderPage();
    fireEvent.click(screen.getByText("Rejeter"));
    const confirmBtn = screen.getByText("Confirmer");
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/raison du rejet/i), { target: { value: "Photo illisible" } });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ uid: "u1", decision: "rejected", reason: "Photo illisible" }),
    );
  });

  it("does not show decision actions once a submission is already verified or rejected", () => {
    mockedSubmissions.mockReturnValue({ data: [{ ...ROW, status: "verified" }], isLoading: false, error: null } as never);
    mockedDetail.mockReturnValue({
      data: {
        uid: "u1", fullName: "Teddy Agent Terrain", phone: "", role: "agent",
        province: null, documentType: "cni", status: "verified",
        submittedAt: null, reviewedAt: { seconds: 1723000100 }, reviewedBy: "admin1", rejectionReason: null,
      },
      isLoading: false,
    } as never);
    mockedDocs.mockReturnValue({ data: { documentType: "cni", urls: [] }, isLoading: false, error: null } as never);

    renderPage();
    expect(screen.queryByText("Valider le dossier")).not.toBeInTheDocument();
    expect(screen.queryByText("Rejeter")).not.toBeInTheDocument();
  });
});
