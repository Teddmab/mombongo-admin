import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCreateAssistedInvoice } from "@/pages/AdminCreateAssistedInvoice";
import {
  useEligibleFarmers, useEligibleMerchants, useFarmerListings, useExchangeRatePreview,
  useCreateAssistedInvoice, useAdminCreatePerson,
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
    useAdminCreatePerson: vi.fn(),
  };
});

const mockedFarmers = vi.mocked(useEligibleFarmers);
const mockedMerchants = vi.mocked(useEligibleMerchants);
const mockedListings = vi.mocked(useFarmerListings);
const mockedRate = vi.mocked(useExchangeRatePreview);
const mockedCreate = vi.mocked(useCreateAssistedInvoice);
const mockedCreatePerson = vi.mocked(useAdminCreatePerson);
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

/** The combobox only renders its option list once opened (focused) — mirrors real user interaction, not the old always-visible list. Selection fires on mousedown (not click), matching the component's real event handler. */
function selectFromCombobox(optionText: string) {
  fireEvent.focus(screen.getByRole("combobox"));
  fireEvent.mouseDown(screen.getByText(optionText));
}

const FARMER2 = { uid: "farmer2", fullName: "Marie Tshisekedi", phone: "+243830000000", province: "Kasaï", kycApproved: true };

describe("AdminCreateAssistedInvoice wizard", () => {
  const mutateAsync = vi.fn();
  const createPersonMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({ invoiceId: "inv1", amountUsd: 100 });
    mockedFarmers.mockReturnValue({ data: [FARMER, FARMER2], isLoading: false } as never);
    mockedMerchants.mockReturnValue({ data: [MERCHANT], isLoading: false } as never);
    mockedListings.mockReturnValue({ data: [LISTING], isLoading: false } as never);
    mockedRate.mockReturnValue({ data: 2800 } as never);
    mockedCreate.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null } as never);
    mockedCreatePerson.mockReturnValue({ mutateAsync: createPersonMutateAsync, isPending: false, isError: false, error: null } as never);
  });

  it("cannot advance past step 1 without selecting a farmer", () => {
    renderWizard();
    expect(screen.getByText("Continuer")).toBeDisabled();
  });

  it("is a real combobox — no options are visible until the input is opened", () => {
    renderWizard();
    expect(screen.queryByText("Jean Kalonji")).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByText("Jean Kalonji")).toBeInTheDocument();
  });

  it("filters options as you type and collapses back to the selected label after choosing one", () => {
    renderWizard();
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz-no-match" } });
    expect(screen.queryByText("Jean Kalonji")).not.toBeInTheDocument();
    expect(screen.getByText(/aucun compte vérifié/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "jean" } });
    fireEvent.mouseDown(screen.getByText("Jean Kalonji"));

    expect(input.value).toBe("Jean Kalonji");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("walks through all 5 steps and submits with consent required", async () => {
    renderWizard();

    selectFromCombobox("Jean Kalonji");
    fireEvent.click(screen.getByText("Continuer"));

    selectFromCombobox("AROM Industries");
    fireEvent.click(screen.getByText("Continuer"));

    selectFromCombobox("Ananas — 500 kg disponibles");
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
    expect(call).toMatchObject({
      farmers: [{ farmerId: "farmer1", contributedKg: 100 }],
      merchantId: "merchant1", listingId: "listing1", consentMethod: "phone",
    });
    expect(call.clientRequestId).toBeTruthy();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/admin/partner-invoices/inv1"));
  });

  it("supports a cooperative of several farmers pooling a harvest at an ad-hoc price", async () => {
    renderWizard();

    selectFromCombobox("Jean Kalonji");
    fireEvent.click(screen.getByText("+ Ajouter un agriculteur (coopérative)"));
    const comboboxes = screen.getAllByRole("combobox");
    fireEvent.focus(comboboxes[1]);
    fireEvent.mouseDown(screen.getByText("Marie Tshisekedi"));
    fireEvent.click(screen.getByText("Continuer"));

    selectFromCombobox("AROM Industries");
    fireEvent.click(screen.getByText("Continuer"));

    // Cooperative mode is forced ad-hoc — no listing toggle, one shared price + a quantity field per farmer
    expect(screen.queryByText("Depuis une annonce publiée")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/produit/i), { target: { value: "Maïs" } });
    fireEvent.change(screen.getByLabelText(/prix convenu/i), { target: { value: "2800" } });
    fireEvent.change(screen.getByLabelText(/jean kalonji/i), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText(/marie tshisekedi/i), { target: { value: "40" } });
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("Continuer")); // step 4 -> 5

    fireEvent.click(screen.getByText(/confirme avoir reçu l'accord/i));
    fireEvent.click(screen.getByText(/créer la facture/i));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const call = mutateAsync.mock.calls[0][0];
    expect(call).toMatchObject({
      farmers: [{ farmerId: "farmer1", contributedKg: 60 }, { farmerId: "farmer2", contributedKg: 40 }],
      merchantId: "merchant1", commodity: "Maïs", pricePerKgCdf: 2800,
    });
    expect(call.listingId).toBeUndefined();
  });

  it("creates a farmer inline from the combobox when they aren't listed yet", async () => {
    createPersonMutateAsync.mockResolvedValue({ uid: "new-farmer-1", isNew: true, fullName: "Nouveau Agriculteur" });
    renderWizard();

    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.mouseDown(screen.getByText("+ Créer un nouvel agriculteur"));

    fireEvent.change(screen.getByLabelText(/nom complet/i), { target: { value: "Nouveau Agriculteur" } });
    fireEvent.change(screen.getByLabelText(/téléphone/i), { target: { value: "+243800000001" } });
    fireEvent.click(screen.getByText("Créer"));

    await waitFor(() => expect(createPersonMutateAsync).toHaveBeenCalled());
    expect(createPersonMutateAsync.mock.calls[0][0]).toMatchObject({ role: "farmer", fullName: "Nouveau Agriculteur", phone: "+243800000001" });
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("Nouveau Agriculteur"));
    expect(screen.getByText("Continuer")).not.toBeDisabled();
  });

  it("blocks advancing past the listing step when quantity exceeds what's available", () => {
    renderWizard();
    selectFromCombobox("Jean Kalonji");
    fireEvent.click(screen.getByText("Continuer"));
    selectFromCombobox("AROM Industries");
    fireEvent.click(screen.getByText("Continuer"));
    selectFromCombobox("Ananas — 500 kg disponibles");
    fireEvent.change(screen.getByLabelText(/quantité/i), { target: { value: "10000" } });
    expect(screen.getByText("Continuer")).toBeDisabled();
  });

  it("shows a server error message from the CF without pretending it succeeded", async () => {
    mockedCreate.mockReturnValue({ mutateAsync, isPending: false, isError: true, error: new Error("L'agriculteur doit avoir un KYC approuvé") } as never);
    renderWizard();
    selectFromCombobox("Jean Kalonji");
    fireEvent.click(screen.getByText("Continuer"));
    selectFromCombobox("AROM Industries");
    fireEvent.click(screen.getByText("Continuer"));
    selectFromCombobox("Ananas — 500 kg disponibles");
    fireEvent.change(screen.getByLabelText(/quantité/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText("Continuer"));
    fireEvent.click(screen.getByText("Continuer"));
    expect(screen.getByRole("alert")).toHaveTextContent(/KYC approuvé/);
  });
});
