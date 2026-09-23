import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateFarmerModal } from "@/pages/AdminCreateFarmer";
import { useAdminCreatePerson } from "@/hooks/useAssistedInvoice";
import { useAdminSaveExploitation, useAdminSaveCulture } from "@/hooks/useAdminFarmerOnboarding";

vi.mock("@/hooks/useAssistedInvoice", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useAssistedInvoice")>("@/hooks/useAssistedInvoice");
  return { ...actual, useAdminCreatePerson: vi.fn() };
});

vi.mock("@/hooks/useAdminFarmerOnboarding", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useAdminFarmerOnboarding")>("@/hooks/useAdminFarmerOnboarding");
  return { ...actual, useAdminSaveExploitation: vi.fn(), useAdminSaveCulture: vi.fn() };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockedCreatePerson = vi.mocked(useAdminCreatePerson);
const mockedSaveExploitation = vi.mocked(useAdminSaveExploitation);
const mockedSaveCulture = vi.mocked(useAdminSaveCulture);

const mockOnClose = vi.fn();

function renderWizard() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><CreateFarmerModal onClose={mockOnClose} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillStep1({ isPending = false } = {}) {
  fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Jean Kabila" } });
  fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "+243811234567" } });
  fireEvent.click(screen.getByText(/confirme avoir reçu l'accord/i));
  const btn = screen.getByText("Continuer vers l'exploitation");
  if (!isPending) expect(btn).not.toBeDisabled();
  fireEvent.click(btn);
}

function fillStep2() {
  fireEvent.change(screen.getByLabelText("Province"), { target: { value: "Kasaï" } });
  fireEvent.change(screen.getByLabelText("Surface totale (hectares)"), { target: { value: "2" } });
  fireEvent.click(screen.getByText("Continuer vers les cultures"));
}

function skipStep3() {
  fireEvent.click(screen.getByText("Continuer vers la vérification"));
}

describe("CreateFarmerModal wizard", () => {
  const createPersonMutateAsync = vi.fn();
  const saveExploitationMutateAsync = vi.fn();
  const saveCultureMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    createPersonMutateAsync.mockResolvedValue({ uid: "farmer1", isNew: true, fullName: "Jean Kabila" });
    saveExploitationMutateAsync.mockResolvedValue({ exploitationId: "exp1" });
    saveCultureMutateAsync.mockResolvedValue({ cultureId: "cult1" });
    mockedCreatePerson.mockReturnValue({ mutateAsync: createPersonMutateAsync, isPending: false } as never);
    mockedSaveExploitation.mockReturnValue({ mutateAsync: saveExploitationMutateAsync, isPending: false } as never);
    mockedSaveCulture.mockReturnValue({ mutateAsync: saveCultureMutateAsync, isPending: false } as never);
  });

  it("cannot advance past step 1 without a name, phone and confirmed consent", () => {
    renderWizard();
    expect(screen.getByText("Continuer vers l'exploitation")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Jean Kabila" } });
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "+243811234567" } });
    expect(screen.getByText("Continuer vers l'exploitation")).toBeDisabled();
    fireEvent.click(screen.getByText(/confirme avoir reçu l'accord/i));
    expect(screen.getByText("Continuer vers l'exploitation")).not.toBeDisabled();
  });

  it("cannot advance past step 2 without a province and a positive surface", () => {
    renderWizard();
    fillStep1();
    expect(screen.getByText("Continuer vers les cultures")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Province"), { target: { value: "Kasaï" } });
    expect(screen.getByText("Continuer vers les cultures")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Surface totale (hectares)"), { target: { value: "2" } });
    expect(screen.getByText("Continuer vers les cultures")).not.toBeDisabled();
  });

  it("allows skipping the cultures step entirely", () => {
    renderWizard();
    fillStep1();
    fillStep2();
    expect(screen.getByText("Continuer vers la vérification")).not.toBeDisabled();
    skipStep3();
    expect(screen.getByText("5. Vérification")).toBeInTheDocument();
    expect(screen.getByText(/aucune \(à ajouter plus tard\)/i)).toBeInTheDocument();
  });

  it("creates the farmer, exploitation, then submits cultures in sequence and shows the confirmation screen", async () => {
    renderWizard();
    fillStep1();
    fillStep2();
    fireEvent.click(screen.getByText("+ Ajouter une culture"));
    fireEvent.change(screen.getByLabelText("Produit"), { target: { value: "Maïs" } });
    fireEvent.change(screen.getByLabelText("Surface (ha)"), { target: { value: "1" } });
    fireEvent.click(screen.getByText("Continuer vers la vérification"));

    fireEvent.click(screen.getByText("Créer l'agriculteur"));

    await waitFor(() => expect(createPersonMutateAsync).toHaveBeenCalledTimes(1));
    expect(createPersonMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ role: "farmer", fullName: "Jean Kabila", phone: "+243811234567" }));

    await waitFor(() => expect(saveExploitationMutateAsync).toHaveBeenCalledTimes(1));
    expect(saveExploitationMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ farmerId: "farmer1", province: "Kasaï", totalHectares: 2 }));

    await waitFor(() => expect(saveCultureMutateAsync).toHaveBeenCalledTimes(1));
    expect(saveCultureMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ farmerId: "farmer1", exploitationId: "exp1", commodity: "Maïs", surfaceHa: 1, rendementEstimeKgHa: 800 }));

    await waitFor(() => expect(screen.getByText("Confirmation")).toBeInTheDocument());
    expect(screen.getByText(/ont été créés/i)).toBeInTheDocument();
    expect(screen.getByText("Voir le profil")).toBeInTheDocument();
  });

  it("navigates to the farmer profile when 'Voir le profil' is clicked after success", async () => {
    renderWizard();
    fillStep1();
    fillStep2();
    skipStep3();
    fireEvent.click(screen.getByText("Créer l'agriculteur"));
    await waitFor(() => expect(screen.getByText("Confirmation")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Voir le profil"));
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/admin/farmers/farmer1");
  });

  it("pauses on a duplicate phone match instead of silently reusing the existing profile", async () => {
    createPersonMutateAsync.mockResolvedValueOnce({ uid: "existing1", isNew: false, fullName: "Marie Existante" });
    renderWizard();
    fillStep1();
    fillStep2();
    skipStep3();
    fireEvent.click(screen.getByText("Créer l'agriculteur"));

    await waitFor(() => expect(screen.getByText(/un compte existe déjà pour ce téléphone/i)).toBeInTheDocument());
    expect(screen.getAllByText(/Marie Existante/).length).toBeGreaterThan(0);
    expect(saveExploitationMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Continuer avec ce profil"));
    await waitFor(() => expect(saveExploitationMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ farmerId: "existing1" })));
  });

  it("lets the admin back out of a duplicate match to fix the phone number", async () => {
    createPersonMutateAsync.mockResolvedValueOnce({ uid: "existing1", isNew: false, fullName: "Marie Existante" });
    renderWizard();
    fillStep1();
    fillStep2();
    skipStep3();
    fireEvent.click(screen.getByText("Créer l'agriculteur"));
    await waitFor(() => expect(screen.getByText("Modifier le téléphone")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Modifier le téléphone"));
    expect(screen.getByLabelText("Téléphone")).toHaveValue("+243811234567");
    expect(saveExploitationMutateAsync).not.toHaveBeenCalled();
  });

  it("shows a scoped error and retry when exploitation creation fails after the farmer was created, without hiding the created account", async () => {
    saveExploitationMutateAsync.mockRejectedValueOnce(new Error("Erreur réseau"));
    renderWizard();
    fillStep1();
    fillStep2();
    skipStep3();
    fireEvent.click(screen.getByText("Créer l'agriculteur"));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Erreur réseau"));
    expect(screen.getAllByText(/Jean Kabila/).length).toBeGreaterThan(0);
    expect(screen.getByText(/fermer sans terminer/i)).toBeInTheDocument();

    saveExploitationMutateAsync.mockResolvedValueOnce({ exploitationId: "exp1" });
    fireEvent.click(screen.getByText("Réessayer"));
    await waitFor(() => expect(screen.getByText("Confirmation")).toBeInTheDocument());
    expect(saveExploitationMutateAsync).toHaveBeenCalledTimes(2);
    expect(createPersonMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("reports a partial culture failure without blocking the rest of the onboarding", async () => {
    saveCultureMutateAsync
      .mockResolvedValueOnce({ cultureId: "cult1" })
      .mockRejectedValueOnce(new Error("Culture invalide"));
    renderWizard();
    fillStep1();
    fillStep2();
    fireEvent.click(screen.getByText("+ Ajouter une culture"));
    fireEvent.change(screen.getAllByLabelText("Produit")[0], { target: { value: "Maïs" } });
    fireEvent.change(screen.getAllByLabelText("Surface (ha)")[0], { target: { value: "1" } });
    fireEvent.click(screen.getByText("+ Ajouter une culture"));
    fireEvent.change(screen.getAllByLabelText("Produit")[1], { target: { value: "Riz" } });
    fireEvent.change(screen.getAllByLabelText("Surface (ha)")[1], { target: { value: "1" } });
    fireEvent.click(screen.getByText("Continuer vers la vérification"));
    fireEvent.click(screen.getByText("Créer l'agriculteur"));

    await waitFor(() => expect(screen.getByText("Confirmation")).toBeInTheDocument());
    expect(saveCultureMutateAsync).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/1 culture\(s\) n'ont pas pu être enregistrées/i)).toBeInTheDocument();
  });

  it("blocks the close button once a farmer has been created but onboarding is not finished", async () => {
    saveExploitationMutateAsync.mockRejectedValueOnce(new Error("Erreur réseau"));
    renderWizard();
    fillStep1();
    fillStep2();
    skipStep3();
    fireEvent.click(screen.getByText("Créer l'agriculteur"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    expect(screen.getByLabelText("Fermer")).toBeDisabled();
    fireEvent.click(screen.getByText(/fermer sans terminer/i));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("allows closing immediately if the very first call fails outright (nothing was created)", async () => {
    createPersonMutateAsync.mockRejectedValueOnce(new Error("Erreur réseau"));
    renderWizard();
    fillStep1();
    fillStep2();
    skipStep3();
    fireEvent.click(screen.getByText("Créer l'agriculteur"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    expect(screen.getByLabelText("Fermer")).not.toBeDisabled();
    expect(screen.queryByText(/fermer sans terminer/i)).not.toBeInTheDocument();
  });

  it("sends the mobile money number and provider as plain unverified fields", async () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Jean Kabila" } });
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "+243811234567" } });
    fireEvent.change(screen.getByLabelText("Numéro Mobile Money (optionnel)"), { target: { value: "+243899999999" } });
    fireEvent.change(screen.getByLabelText("Opérateur"), { target: { value: "mpesa" } });
    fireEvent.click(screen.getByText(/confirme avoir reçu l'accord/i));
    fireEvent.click(screen.getByText("Continuer vers l'exploitation"));
    fillStep2();
    skipStep3();
    fireEvent.click(screen.getByText("Créer l'agriculteur"));

    await waitFor(() => expect(createPersonMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mobileMoneyNumber: "+243899999999", mobileMoneyProvider: "mpesa" }),
    ));
  });
});
