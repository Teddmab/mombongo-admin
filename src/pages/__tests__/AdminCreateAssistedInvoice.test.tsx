import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateAssistedInvoiceModal } from "@/pages/AdminCreateAssistedInvoice";
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

const FARMER = { uid: "farmer1", fullName: "Jean Kalonji", phone: "+243810000000", province: "Nord-Kivu", avatarUrl: null, isActive: true, kycApproved: true };
const FARMER2 = { uid: "farmer2", fullName: "Marie Tshisekedi", phone: "+243830000000", province: "Kasaï", avatarUrl: null, isActive: true, kycApproved: true };
const MERCHANT = { uid: "merchant1", fullName: "AROM Industries", phone: "+243820000000", province: "Kinshasa", avatarUrl: null, isActive: true, kycApproved: true };
const LISTING = { id: "listing1", commodity: "Ananas", quantityKg: 500, pricePerKgCdf: 800, province: "Nord-Kivu" };

const mockOnClose = vi.fn();

function renderWizard() {
  return render(<MemoryRouter><CreateAssistedInvoiceModal onClose={mockOnClose} /></MemoryRouter>);
}

/** Farmer/merchant pickers are an always-visible radio card list — select by clicking the radio whose wrapping <label> contains the person's name. With a cooperative's several farmer rows, the same candidate can appear in more than one row's list until selected somewhere, so pick by occurrence (default: the only/first one). */
function selectPerson(name: string, occurrence = 0) {
  fireEvent.click(screen.getAllByRole("radio", { name: new RegExp(name, "i") })[occurrence]);
}

/** The listing picker (step 3, listing mode) is still a real combobox: closed until focused, selection fires on mousedown. */
function selectFromListingCombobox(optionText: string) {
  fireEvent.focus(screen.getByRole("combobox"));
  fireEvent.mouseDown(screen.getByText(optionText));
}

/** Consent now lives in step 1 (matching the reference's "1. Sélectionner l'agriculteur" + "2. Accord de l'agriculteur" layout), so every walkthrough needs to confirm it before step 1's continue button unlocks. */
function confirmConsent() {
  fireEvent.click(screen.getByText(/confirme avoir reçu l'accord/i));
}

describe("AdminCreateAssistedInvoice wizard", () => {
  const mutateAsync = vi.fn();
  const createPersonMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    try { localStorage.clear(); } catch { /* jsdom always has it */ }
    mutateAsync.mockResolvedValue({ invoiceId: "inv1", amountUsd: 100 });
    mockedFarmers.mockReturnValue({ data: { eligible: [FARMER, FARMER2], totalCount: 2 }, isLoading: false } as never);
    mockedMerchants.mockReturnValue({ data: { eligible: [MERCHANT], totalCount: 3 }, isLoading: false } as never);
    mockedListings.mockReturnValue({ data: [LISTING], isLoading: false } as never);
    mockedRate.mockReturnValue({ data: 2800 } as never);
    mockedCreate.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null } as never);
    mockedCreatePerson.mockReturnValue({ mutateAsync: createPersonMutateAsync, isPending: false, isError: false, error: null } as never);
  });

  it("cannot advance past step 1 without selecting a farmer and confirming consent", () => {
    renderWizard();
    expect(screen.getByText("Continuer vers le commerçant")).toBeDisabled();
    selectPerson("Jean Kalonji");
    expect(screen.getByText("Continuer vers le commerçant")).toBeDisabled();
    confirmConsent();
    expect(screen.getByText("Continuer vers le commerçant")).not.toBeDisabled();
  });

  it("shows every eligible farmer as an always-visible card, no click-to-open needed", () => {
    renderWizard();
    expect(screen.getByText("Jean Kalonji")).toBeInTheDocument();
    expect(screen.getByText("Marie Tshisekedi")).toBeInTheDocument();
  });

  it("filters cards by search text", () => {
    renderWizard();
    fireEvent.change(screen.getByPlaceholderText(/rechercher par nom ou téléphone/i), { target: { value: "marie" } });
    expect(screen.queryByText("Jean Kalonji")).not.toBeInTheDocument();
    expect(screen.getByText("Marie Tshisekedi")).toBeInTheDocument();
  });

  it("explains an empty picker instead of looking broken when nobody has approved KYC yet", () => {
    mockedMerchants.mockReturnValue({ data: { eligible: [], totalCount: 3 }, isLoading: false } as never);
    renderWizard();
    selectPerson("Jean Kalonji");
    confirmConsent();
    fireEvent.click(screen.getByText("Continuer vers le commerçant"));
    expect(screen.getByText(/3 commerçants enregistrés, mais aucun avec une identité vérifiée/i)).toBeInTheDocument();
  });

  it("shows the assistance rules only when expanded, with no dead external link", () => {
    renderWizard();
    expect(screen.queryByText(/reste l'émetteur légal/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/voir les règles d'assistance/i));
    expect(screen.getByText(/reste l'émetteur légal/i)).toBeInTheDocument();
  });

  it("walks through all 5 steps and submits with consent required", async () => {
    renderWizard();

    selectPerson("Jean Kalonji");
    confirmConsent();
    fireEvent.click(screen.getByText("Continuer vers le commerçant"));

    selectPerson("AROM Industries");
    fireEvent.click(screen.getByText("Continuer vers la livraison"));

    selectFromListingCombobox("Ananas — 500 kg disponibles");
    fireEvent.change(screen.getByLabelText(/quantité/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText("Continuer vers les montants"));

    fireEvent.click(screen.getByText("Continuer vers la vérification")); // step 4 -> 5, no input required

    const submitBtn = screen.getByText("Créer la facture");
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

    selectPerson("Jean Kalonji");
    fireEvent.click(screen.getByText("+ Ajouter un agriculteur (coopérative)"));
    // Jean is now excluded from row 2's own list (already taken by row 1), so Marie is
    // the second occurrence overall: row 1 still offers her too, row 2 only offers her.
    selectPerson("Marie Tshisekedi", 1);
    confirmConsent();
    fireEvent.click(screen.getByText("Continuer vers le commerçant"));

    selectPerson("AROM Industries");
    fireEvent.click(screen.getByText("Continuer vers la livraison"));

    // Cooperative mode is forced ad-hoc — no listing toggle, one shared price + a quantity field per farmer
    expect(screen.queryByText("Depuis une annonce publiée")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/produit/i), { target: { value: "Maïs" } });
    fireEvent.change(screen.getByLabelText(/prix convenu/i), { target: { value: "2800" } });
    fireEvent.change(screen.getByLabelText(/jean kalonji/i), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText(/marie tshisekedi/i), { target: { value: "40" } });
    fireEvent.click(screen.getByText("Continuer vers les montants"));
    fireEvent.click(screen.getByText("Continuer vers la vérification"));

    fireEvent.click(screen.getByText("Créer la facture"));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const call = mutateAsync.mock.calls[0][0];
    expect(call).toMatchObject({
      farmers: [{ farmerId: "farmer1", contributedKg: 60 }, { farmerId: "farmer2", contributedKg: 40 }],
      merchantId: "merchant1", commodity: "Maïs", pricePerKgCdf: 2800,
    });
    expect(call.listingId).toBeUndefined();
  });

  it("creates a farmer inline when they aren't listed yet", async () => {
    createPersonMutateAsync.mockResolvedValue({ uid: "new-farmer-1", isNew: true, fullName: "Nouveau Agriculteur" });
    renderWizard();

    fireEvent.click(screen.getByText("+ Créer un nouvel agriculteur"));

    fireEvent.change(screen.getByLabelText(/nom complet/i), { target: { value: "Nouveau Agriculteur" } });
    fireEvent.change(screen.getByLabelText(/téléphone/i), { target: { value: "+243800000001" } });
    fireEvent.click(screen.getByText("Créer"));

    await waitFor(() => expect(createPersonMutateAsync).toHaveBeenCalled());
    expect(createPersonMutateAsync.mock.calls[0][0]).toMatchObject({ role: "farmer", fullName: "Nouveau Agriculteur", phone: "+243800000001" });
    await waitFor(() => expect(screen.getByRole("radio", { name: /Nouveau Agriculteur/i })).toBeChecked());
    confirmConsent();
    expect(screen.getByText("Continuer vers le commerçant")).not.toBeDisabled();
  });

  it("blocks advancing past the listing step when quantity exceeds what's available", () => {
    renderWizard();
    selectPerson("Jean Kalonji");
    confirmConsent();
    fireEvent.click(screen.getByText("Continuer vers le commerçant"));
    selectPerson("AROM Industries");
    fireEvent.click(screen.getByText("Continuer vers la livraison"));
    selectFromListingCombobox("Ananas — 500 kg disponibles");
    fireEvent.change(screen.getByLabelText(/quantité/i), { target: { value: "10000" } });
    expect(screen.getByText("Continuer vers les montants")).toBeDisabled();
  });

  it("shows a server error message from the CF without pretending it succeeded", async () => {
    mockedCreate.mockReturnValue({ mutateAsync, isPending: false, isError: true, error: new Error("L'agriculteur doit avoir un KYC approuvé") } as never);
    renderWizard();
    selectPerson("Jean Kalonji");
    confirmConsent();
    fireEvent.click(screen.getByText("Continuer vers le commerçant"));
    selectPerson("AROM Industries");
    fireEvent.click(screen.getByText("Continuer vers la livraison"));
    selectFromListingCombobox("Ananas — 500 kg disponibles");
    fireEvent.change(screen.getByLabelText(/quantité/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText("Continuer vers les montants"));
    fireEvent.click(screen.getByText("Continuer vers la vérification"));
    expect(screen.getByRole("alert")).toHaveTextContent(/KYC approuvé/);
  });

  it("saves a draft locally (no server-side draft endpoint exists) — writes to localStorage, not a Cloud Function", () => {
    renderWizard();
    selectPerson("Jean Kalonji");
    fireEvent.click(screen.getByText(/enregistrer comme brouillon/i));
    expect(screen.getByText("Brouillon enregistré.")).toBeInTheDocument();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "admin-assisted-invoice-draft",
      expect.stringContaining('"farmerIds":["farmer1"]'),
    );
  });

  it("offers to resume a draft saved in an earlier session", () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(JSON.stringify({
      savedAt: new Date().toISOString(), farmerIds: ["farmer1"], merchantId: null,
      saleMode: "listing", listingId: null, adHocCommodity: "", adHocPriceCdf: "",
      consentMethod: "phone", note: "",
    }));
    renderWizard();
    expect(screen.getByText(/brouillon enregistré le/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reprendre"));
    expect(screen.getByRole("radio", { name: /Jean Kalonji/i })).toBeChecked();
  });

  it("closes via the X button", () => {
    renderWizard();
    fireEvent.click(screen.getByLabelText("Fermer"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("closes via 'Annuler et revenir' without submitting anything", () => {
    renderWizard();
    fireEvent.click(screen.getByText("Annuler et revenir"));
    expect(mockOnClose).toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
