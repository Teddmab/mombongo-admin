import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCreateAssistedInvoice } from "@/pages/AdminCreateAssistedInvoice";
import {
  useEligibleFarmers, useEligibleMerchants, useFarmerListings, useExchangeRatePreview, useCreateAssistedInvoice,
} from "@/hooks/useAssistedInvoice";

vi.mock("@/hooks/useAssistedInvoice", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useAssistedInvoice")>("@/hooks/useAssistedInvoice");
  return {
    ...actual,
    useEligibleFarmers: vi.fn(),
    useEligibleMerchants: vi.fn(),
    useFarmerListings: vi.fn(),
    useExchangeRatePreview: vi.fn(),
    useCreateAssistedInvoice: vi.fn(),
  };
});

const mockedFarmers = vi.mocked(useEligibleFarmers);
const mockedMerchants = vi.mocked(useEligibleMerchants);
const mockedListings = vi.mocked(useFarmerListings);
const mockedRate = vi.mocked(useExchangeRatePreview);
const mockedCreate = vi.mocked(useCreateAssistedInvoice);
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const FARMER = { uid: "farmer1", fullName: "Jean Kalonji", phone: "+243810000000", province: "Nord-Kivu", kycApproved: true };
const MERCHANT = { uid: "merchant1", fullName: "AROM Industries", phone: "+243820000000", province: "Kinshasa", kycApproved: true };
const LISTING = { id: "listing1", commodity: "Ananas", quantityKg: 500, pricePerKgCdf: 800, province: "Nord-Kivu" };

function renderWizard() {
  return render(<MemoryRouter><AdminCreateAssistedInvoice /></MemoryRouter>);
}

describe("AdminCreateAssistedInvoice wizard", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({ invoiceId: "inv1", amountUsd: 100 });
    mockedFarmers.mockReturnValue({ data: [FARMER], isLoading: false } as never);
    mockedMerchants.mockReturnValue({ data: [MERCHANT], isLoading: false } as never);
    mockedListings.mockReturnValue({ data: [LISTING], isLoading: false } as never);
    mockedRate.mockReturnValue({ data: 2800 } as never);
    mockedCreate.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null } as never);
  });

  it("cannot advance past step 1 without selecting a farmer", () => {
    renderWizard();
    expect(screen.getByText("Continuer")).toBeDisabled();
  });

  it("walks through all 5 steps and submits with consent required", async () => {
    renderWizard();

    fireEvent.click(screen.getByText("Jean Kalonji"));
    fireEvent.click(screen.getByText("Continuer"));

    fireEvent.click(screen.getByText("AROM Industries"));
    fireEvent.click(screen.getByText("Continuer"));

    fireEvent.click(screen.getByText(/Ananas — 500 kg disponibles/));
    fireEvent.change(screen.getByLabelText(/quantité/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText("Continuer"));

    fireEvent.click(screen.getByText("Continuer")); // step 4 -> 5, no input required

    // Step 5: submit is disabled until consent is confirmed
    const submitBtn = screen.getByText(/créer la facture/i);
    expect(submitBtn).toBeDisabled();
    fireEvent.click(screen.getByText(/confirme avoir reçu l'accord/i));
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const call = mutateAsync.mock.calls[0][0];
    expect(call).toMatchObject({ farmerId: "farmer1", merchantId: "merchant1", listingId: "listing1", quantityKg: 100, consentMethod: "phone" });
    expect(call.clientRequestId).toBeTruthy();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/admin/partner-invoices/inv1"));
  });

  it("blocks advancing past the listing step when quantity exceeds what's available", () => {
    renderWizard();
    fireEvent.click(screen.getByText("Jean Kalonji"));
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("AROM Industries"));
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText(/Ananas — 500 kg disponibles/));
    fireEvent.change(screen.getByLabelText(/quantité/i), { target: { value: "10000" } });
    expect(screen.getByText("Continuer")).toBeDisabled();
  });

  it("shows a server error message from the CF without pretending it succeeded", async () => {
    mockedCreate.mockReturnValue({ mutateAsync, isPending: false, isError: true, error: new Error("L'agriculteur doit avoir un KYC approuvé") } as never);
    renderWizard();
    fireEvent.click(screen.getByText("Jean Kalonji"));
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("AROM Industries"));
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText(/Ananas — 500 kg disponibles/));
    fireEvent.change(screen.getByLabelText(/quantité/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("Continuer"));
    expect(screen.getByRole("alert")).toHaveTextContent(/KYC approuvé/);
  });
});
