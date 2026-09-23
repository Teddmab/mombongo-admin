import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  X, Phone, UserCheck, Users2, Loader2, CheckCircle2, XCircle, Circle, Trash2,
  Sprout, MapPin, ClipboardCheck, Info, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { CROP_CATALOG, DRC_PROVINCES, MOBILE_MONEY_OPERATORS, type Methode } from "@/data/cropCatalog";
import { useAdminCreatePerson, type ConsentMethod } from "@/hooks/useAssistedInvoice";
import { useAdminSaveExploitation, useAdminSaveCulture } from "@/hooks/useAdminFarmerOnboarding";

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS: [Step, string][] = [
  [1, "Identité"], [2, "Exploitation"], [3, "Cultures"], [4, "Vérification"],
];
const CONTINUE_LABEL: Record<Step, string> = {
  1: "Continuer vers l'exploitation",
  2: "Continuer vers les cultures",
  3: "Continuer vers la vérification",
  4: "Créer l'agriculteur",
};

const CONSENT_OPTIONS: { key: ConsentMethod; label: string; icon: React.ReactNode }[] = [
  { key: "phone", label: "Appel téléphonique", icon: <Phone size={14} /> },
  { key: "in_person", label: "Présent avec moi", icon: <UserCheck size={14} /> },
  { key: "field_agent", label: "Agent terrain", icon: <Users2 size={14} /> },
];

const EXPLOITATION_TYPES = [
  { value: "familiale", label: "Familiale" },
  { value: "cooperative", label: "Coopérative" },
  { value: "commerciale", label: "Commerciale" },
] as const;

const WATER_ACCESS = [
  { value: "pluie", label: "Eau de pluie" },
  { value: "irrigation", label: "Irrigation" },
  { value: "riviere", label: "Rivière" },
  { value: "mixte", label: "Mixte" },
] as const;

const WORKER_TYPES = [
  { value: "permanent", label: "Permanent" },
  { value: "saisonnier", label: "Saisonnier" },
  { value: "mixte", label: "Mixte" },
] as const;

interface CultureRow {
  key: string;
  commodity: string;
  icon: string;
  surfaceHa: number | "";
  methode: Methode;
  saison: "principale" | "secondaire";
}

function newCultureRow(): CultureRow {
  return { key: crypto.randomUUID(), commodity: "", icon: "", surfaceHa: "", methode: "traditionnel", saison: "principale" };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Une erreur est survenue.";
}

function StepCircles({ step }: { step: Step }) {
  return (
    <div className="flex items-center" style={{ marginBottom: 20 }}>
      {STEP_LABELS.map(([n, label], i) => (
        <div key={n} style={{ display: "flex", alignItems: "center", flex: i < STEP_LABELS.length - 1 ? 1 : undefined }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div className={`step-circle ${n === step ? "current" : n < step ? "done" : ""}`}>
              {n < step ? <CheckCircle2 size={16} /> : n}
            </div>
            <span className={`step-circle-label ${n === step ? "current" : ""}`}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && <div className={`step-circle-line ${n < step ? "done" : ""}`} />}
        </div>
      ))}
    </div>
  );
}

type SubStage = "person" | "exploitation" | "cultures";
type CultureStatus = "pending" | "done" | "error";

/**
 * ADM-UI "Créer un agriculteur" — the functions half of this is
 * adminSaveExploitation/adminSaveCulture (mombongo-functions), which record
 * adminAssisted provenance identically to adminCreateAssistedInvoice. This
 * wizard chains 3 independent Cloud Function calls (adminCreatePerson →
 * adminSaveExploitation → adminSaveCulture ×N); a submission checklist
 * (renderSubmission) tracks each call's status explicitly so a failure
 * partway through is never silently hidden — the admin always sees exactly
 * what was created and what still needs to be retried, and closing the
 * wizard mid-submission is blocked (see canClose) so a half-created farmer
 * is never left invisible.
 */
export function CreateFarmerModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);

  // Step 1 — identity
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [identityProvince, setIdentityProvince] = useState("");
  const [mmNumber, setMmNumber] = useState("");
  const [mmProvider, setMmProvider] = useState<"" | "mpesa" | "airtel" | "orange">("");
  const [consentMethod, setConsentMethod] = useState<ConsentMethod>("phone");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const now = new Date();
  const [consentDate, setConsentDate] = useState(now.toISOString().slice(0, 10));
  const [consentTime, setConsentTime] = useState(now.toTimeString().slice(0, 5));
  const [note, setNote] = useState("");

  // Step 2 — exploitation
  const [exploProvince, setExploProvince] = useState("");
  const [territory, setTerritory] = useState("");
  const [village, setVillage] = useState("");
  const [totalHectares, setTotalHectares] = useState<number | "">("");
  const [exploType, setExploType] = useState<typeof EXPLOITATION_TYPES[number]["value"]>("familiale");
  const [waterAccess, setWaterAccess] = useState<typeof WATER_ACCESS[number]["value"]>("pluie");
  const [workerCount, setWorkerCount] = useState<number | "">("");
  const [workerType, setWorkerType] = useState<typeof WORKER_TYPES[number]["value"]>("permanent");
  const [exploNotes, setExploNotes] = useState("");
  const [exploitationClientRequestId] = useState(() => crypto.randomUUID());

  // Step 3 — cultures
  const [cultureRows, setCultureRows] = useState<CultureRow[]>([]);

  // Submission state (shared across the "submitting"/"done" screen)
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [farmerName, setFarmerName] = useState<string | null>(null);
  const [exploitationId, setExploitationId] = useState<string | null>(null);
  const [cultureStatuses, setCultureStatuses] = useState<Record<string, { status: CultureStatus; error?: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [currentSubStage, setCurrentSubStage] = useState<SubStage | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [awaitingDuplicateChoice, setAwaitingDuplicateChoice] = useState(false);
  const [done, setDone] = useState(false);

  const createPerson = useAdminCreatePerson();
  const saveExploitation = useAdminSaveExploitation();
  const saveCulture = useAdminSaveCulture();

  const step1Valid = fullName.trim().length > 0 && phone.trim().length > 0 && consentConfirmed;
  const step2Valid = exploProvince.trim().length > 0 && typeof totalHectares === "number" && totalHectares > 0;
  const step3Valid = cultureRows.every((r) => r.commodity && typeof r.surfaceHa === "number" && r.surfaceHa > 0);

  const stepDisabled = (step === 1 && !step1Valid) || (step === 2 && !step2Valid) || (step === 3 && !step3Valid);

  const consentAt = new Date(`${consentDate}T${consentTime}:00`).toISOString();

  function updateCultureRow(key: string, patch: Partial<CultureRow>) {
    setCultureRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function selectCrop(key: string, commodity: string) {
    const crop = CROP_CATALOG.find((c) => c.commodity === commodity);
    updateCultureRow(key, { commodity, icon: crop?.icon ?? "" });
  }
  function removeCultureRow(key: string) {
    setCultureRows((rows) => rows.filter((r) => r.key !== key));
    setCultureStatuses((s) => {
      const rest = { ...s };
      delete rest[key];
      return rest;
    });
  }

  async function submitPerson() {
    setCurrentSubStage("person");
    setStageError(null);
    try {
      const result = await createPerson.mutateAsync({
        role: "farmer",
        fullName: fullName.trim(),
        phone: phone.trim(),
        ...(identityProvince.trim() ? { province: identityProvince.trim() } : {}),
        ...(mmNumber.trim() ? { mobileMoneyNumber: mmNumber.trim() } : {}),
        ...(mmProvider ? { mobileMoneyProvider: mmProvider } : {}),
        consentMethod,
        consentAt,
        note: note.trim() || undefined,
      });
      setFarmerId(result.uid);
      setFarmerName(result.fullName);
      if (!result.isNew) {
        setAwaitingDuplicateChoice(true);
        return;
      }
      await runExploitation(result.uid);
    } catch (err) {
      setStageError(errMsg(err));
    }
  }

  async function runExploitation(fid: string) {
    setCurrentSubStage("exploitation");
    setStageError(null);
    try {
      const result = await saveExploitation.mutateAsync({
        farmerId: fid,
        province: exploProvince.trim(),
        territory: territory.trim() || undefined,
        village: village.trim() || undefined,
        totalHectares: totalHectares as number,
        type: exploType,
        waterAccess,
        workerCount: workerCount === "" ? undefined : workerCount,
        workerType,
        notes: exploNotes.trim() || undefined,
        consentMethod,
        consentAt,
        note: note.trim() || undefined,
        clientRequestId: exploitationClientRequestId,
      });
      setExploitationId(result.exploitationId);
      await runCultures(result.exploitationId, fid);
    } catch (err) {
      setStageError(errMsg(err));
    }
  }

  async function runCultures(eid: string, fid: string) {
    setCurrentSubStage("cultures");
    setStageError(null);
    const pending = cultureRows.filter((r) => cultureStatuses[r.key]?.status !== "done");
    for (const row of pending) {
      setCultureStatuses((s) => ({ ...s, [row.key]: { status: "pending" } }));
      const crop = CROP_CATALOG.find((c) => c.commodity === row.commodity);
      const rendementEstimeKgHa = crop ? crop.defaultYield[row.methode] : 0;
      try {
        // Submitted one at a time (not Promise.all) so the checklist can show per-row progress.
        await saveCulture.mutateAsync({
          farmerId: fid,
          exploitationId: eid,
          commodity: row.commodity,
          icon: row.icon || undefined,
          surfaceHa: row.surfaceHa as number,
          methode: row.methode,
          saison: row.saison,
          rendementEstimeKgHa,
          consentMethod,
          consentAt,
          note: note.trim() || undefined,
          clientRequestId: row.key,
        });
        setCultureStatuses((s) => ({ ...s, [row.key]: { status: "done" } }));
      } catch (err) {
        setCultureStatuses((s) => ({ ...s, [row.key]: { status: "error", error: errMsg(err) } }));
      }
    }
    setCurrentSubStage(null);
    setSubmitting(false);
    setDone(true);
    void queryClient.invalidateQueries({ queryKey: ["admin-farmers-v2"] });
  }

  function startSubmission() {
    setSubmitting(true);
    setAwaitingDuplicateChoice(false);
    if (!farmerId) void submitPerson();
    else if (!exploitationId) void runExploitation(farmerId);
    else void runCultures(exploitationId, farmerId);
  }

  function retryCurrentStage() {
    if (currentSubStage === "person" || !farmerId) void submitPerson();
    else if (currentSubStage === "exploitation" || !exploitationId) void runExploitation(farmerId);
    else void runCultures(exploitationId, farmerId);
  }

  function continueWithExistingProfile() {
    setAwaitingDuplicateChoice(false);
    if (farmerId) void runExploitation(farmerId);
  }

  function editPhoneInstead() {
    setAwaitingDuplicateChoice(false);
    setSubmitting(false);
    setFarmerId(null);
    setFarmerName(null);
    setStep(1);
  }

  function resetForAnotherFarmer() {
    setStep(1);
    setFullName(""); setPhone(""); setIdentityProvince(""); setMmNumber(""); setMmProvider("");
    setConsentConfirmed(false); setNote("");
    setExploProvince(""); setTerritory(""); setVillage(""); setTotalHectares("");
    setExploType("familiale"); setWaterAccess("pluie"); setWorkerCount(""); setWorkerType("permanent"); setExploNotes("");
    setCultureRows([]);
    setFarmerId(null); setFarmerName(null); setExploitationId(null);
    setCultureStatuses({}); setSubmitting(false); setCurrentSubStage(null); setStageError(null);
    setAwaitingDuplicateChoice(false); setDone(false);
  }

  // A real, non-`isNew` farmer account may already exist once step 1 has
  // been attempted — closing must never make that silently disappear from
  // the admin's view without them acknowledging it (V2 farmer-onboarding
  // "no invisible half-completed farmer" requirement). Blocking is scoped
  // to that case specifically: if nothing was created yet (farmerId still
  // null, e.g. the very first call failed outright), or a call is actively
  // in flight, closing is either safe or actively harmful respectively —
  // neither should require the explicit "Fermer sans terminer" escape hatch.
  const activelySubmitting = createPerson.isPending || saveExploitation.isPending || saveCulture.isPending;
  const hasPartialProgress = !!farmerId && !done;
  const canClose = !activelySubmitting && (!farmerId || done);

  function handleClose() {
    if (!canClose) return;
    onClose();
  }

  const primary = () => {
    if (step < 4) { setStep((s) => (s + 1) as Step); return; }
    startSubmission();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <section className="page" style={{ background: "hsl(var(--background, 42 25% 95%))", borderRadius: 20, padding: 24, width: "100%", maxWidth: 920, boxShadow: "var(--shadow-elevated)" }}>
        <div className="page-header">
          <div>
            <div className="section-kicker">Agriculteurs</div>
            <h1 className="page-title">Créer un agriculteur</h1>
            <p className="page-copy">Enregistrez un agriculteur, son exploitation et ses cultures au nom d'un agriculteur qui vous a donné son accord.</p>
          </div>
          <button
            onClick={handleClose}
            disabled={!canClose}
            className="button-outline"
            style={{ height: 40, width: 40, padding: 0, justifyContent: "center" }}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="hint-box info" style={{ marginTop: 16, marginBottom: 16 }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1, marginRight: 8, display: "inline" }} />
          Ce compte sera créé immédiatement avec un KYC attesté par vous. Le numéro Mobile Money saisi ici n'est pas vérifié et ne peut pas encore recevoir de paiement.
        </div>

        {!submitting && !done && (
          <>
            <StepCircles step={step} />
            <div className="panel">
              {step === 1 && (
                <>
                  <div className="section-header"><h3>1. Identité de l'agriculteur</h3></div>
                  <label className="form-label" htmlFor="fullName">Nom complet</label>
                  <input id="fullName" className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ marginBottom: 12 }} />
                  <label className="form-label" htmlFor="phone">Téléphone</label>
                  <input id="phone" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+243..." style={{ marginBottom: 12 }} />
                  <label className="form-label" htmlFor="identityProvince">Province (optionnel)</label>
                  <select id="identityProvince" className="form-select" value={identityProvince} onChange={(e) => { setIdentityProvince(e.target.value); if (!exploProvince) setExploProvince(e.target.value); }} style={{ marginBottom: 12 }}>
                    <option value="">— Non renseignée —</option>
                    {DRC_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>

                  <div className="hint-box" style={{ marginBottom: 12, fontSize: 12 }}>
                    <strong>Mobile Money — information non vérifiée.</strong> Ce numéro sera enregistré tel quel, sans preuve de possession. Il ne pourra pas recevoir de paiement tant qu'il n'aura pas été vérifié par l'agriculteur lui-même.
                  </div>
                  <div className="flex gap-2" style={{ marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="mmNumber">Numéro Mobile Money (optionnel)</label>
                      <input id="mmNumber" className="form-input" value={mmNumber} onChange={(e) => setMmNumber(e.target.value)} placeholder="+243..." />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="mmProvider">Opérateur</label>
                      <select id="mmProvider" className="form-select" value={mmProvider} onChange={(e) => setMmProvider(e.target.value as typeof mmProvider)}>
                        <option value="">—</option>
                        {MOBILE_MONEY_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="section-header"><h3>2. Accord de l'agriculteur</h3></div>
                  <p className="form-label" style={{ marginBottom: 8 }}>Méthode d'obtention de l'accord</p>
                  <div className="flex gap-2 flex-wrap" style={{ marginBottom: 16 }}>
                    {CONSENT_OPTIONS.map((c) => (
                      <button key={c.key} type="button" onClick={() => setConsentMethod(c.key)} className={`button-outline ${consentMethod === c.key ? "active" : ""}`}>
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>
                  <p className="form-label" style={{ marginBottom: 8 }}>Date et heure de l'accord</p>
                  <div className="flex gap-2" style={{ marginBottom: 16 }}>
                    <input type="date" value={consentDate} onChange={(e) => setConsentDate(e.target.value)} className="form-input" aria-label="Date de l'accord" max={now.toISOString().slice(0, 10)} />
                    <input type="time" value={consentTime} onChange={(e) => setConsentTime(e.target.value)} className="form-input" aria-label="Heure de l'accord" />
                  </div>
                  <label className="flex items-center gap-2 text-sm" style={{ marginBottom: 12 }}>
                    <input type="checkbox" checked={consentConfirmed} onChange={(e) => setConsentConfirmed(e.target.checked)} />
                    Je confirme avoir reçu l'accord de l'agriculteur <span className="pill status-pending">Requis</span>
                  </label>
                  <label className="form-label" htmlFor="note">Note (optionnelle)</label>
                  <textarea id="note" className="form-textarea" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} maxLength={500} />
                </>
              )}

              {step === 2 && (
                <>
                  <div className="section-header"><h3>3. Exploitation</h3></div>
                  <div className="flex gap-2" style={{ marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="exploProvince">Province</label>
                      <select id="exploProvince" className="form-select" value={exploProvince} onChange={(e) => setExploProvince(e.target.value)}>
                        <option value="">— Sélectionner —</option>
                        {DRC_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="territory">Territoire (optionnel)</label>
                      <input id="territory" className="form-input" value={territory} onChange={(e) => setTerritory(e.target.value)} />
                    </div>
                  </div>
                  <label className="form-label" htmlFor="village">Village (optionnel)</label>
                  <input id="village" className="form-input" value={village} onChange={(e) => setVillage(e.target.value)} style={{ marginBottom: 12 }} />

                  <label className="form-label" htmlFor="totalHectares">Surface totale (hectares)</label>
                  <input
                    id="totalHectares" type="number" min={0.1} step={0.1} className="form-input"
                    value={totalHectares}
                    onChange={(e) => setTotalHectares(e.target.value === "" ? "" : Number(e.target.value))}
                    style={{ marginBottom: 12 }}
                  />

                  <div className="flex gap-2" style={{ marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="exploType">Type d'exploitation</label>
                      <select id="exploType" className="form-select" value={exploType} onChange={(e) => setExploType(e.target.value as typeof exploType)}>
                        {EXPLOITATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="waterAccess">Accès à l'eau</label>
                      <select id="waterAccess" className="form-select" value={waterAccess} onChange={(e) => setWaterAccess(e.target.value as typeof waterAccess)}>
                        {WATER_ACCESS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2" style={{ marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="workerCount">Nombre de travailleurs (optionnel)</label>
                      <input id="workerCount" type="number" min={0} className="form-input" value={workerCount} onChange={(e) => setWorkerCount(e.target.value === "" ? "" : Number(e.target.value))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" htmlFor="workerType">Type de travailleurs</label>
                      <select id="workerType" className="form-select" value={workerType} onChange={(e) => setWorkerType(e.target.value as typeof workerType)}>
                        {WORKER_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <label className="form-label" htmlFor="exploNotes">Notes (optionnelles)</label>
                  <textarea id="exploNotes" className="form-textarea" value={exploNotes} onChange={(e) => setExploNotes(e.target.value)} rows={2} />
                </>
              )}

              {step === 3 && (
                <>
                  <div className="section-header"><h3>4. Cultures (optionnel)</h3></div>
                  <p className="muted text-sm" style={{ marginBottom: 12 }}>
                    Ajoutez les cultures déjà en place, si l'agriculteur les connaît. Vous pourrez toujours en ajouter plus tard depuis son profil.
                  </p>
                  {cultureRows.map((row, i) => {
                    const crop = CROP_CATALOG.find((c) => c.commodity === row.commodity);
                    const rendement = crop ? crop.defaultYield[row.methode] : 0;
                    return (
                      <div key={row.key} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid hsl(var(--gray-100))" }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                          <p className="muted text-sm" style={{ fontWeight: 600 }}>Culture {i + 1}</p>
                          <button type="button" onClick={() => removeCultureRow(row.key)} className="button-outline danger" style={{ height: 28, padding: "0 10px" }}>
                            <Trash2 size={13} /> Retirer
                          </button>
                        </div>
                        <div className="flex gap-2" style={{ marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label className="form-label" htmlFor={`crop-${row.key}`}>Produit</label>
                            <select id={`crop-${row.key}`} className="form-select" value={row.commodity} onChange={(e) => selectCrop(row.key, e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              {CROP_CATALOG.map((c) => <option key={c.commodity} value={c.commodity}>{c.icon} {c.commodity}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="form-label" htmlFor={`surface-${row.key}`}>Surface (ha)</label>
                            <input id={`surface-${row.key}`} type="number" min={0.1} step={0.1} className="form-input" value={row.surfaceHa} onChange={(e) => updateCultureRow(row.key, { surfaceHa: e.target.value === "" ? "" : Number(e.target.value) })} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div style={{ flex: 1 }}>
                            <label className="form-label" htmlFor={`methode-${row.key}`}>Méthode</label>
                            <select id={`methode-${row.key}`} className="form-select" value={row.methode} onChange={(e) => updateCultureRow(row.key, { methode: e.target.value as Methode })}>
                              <option value="traditionnel">Traditionnel</option>
                              <option value="semi-intensif">Semi-intensif</option>
                              <option value="intensif">Intensif</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="form-label" htmlFor={`saison-${row.key}`}>Saison</label>
                            <select id={`saison-${row.key}`} className="form-select" value={row.saison} onChange={(e) => updateCultureRow(row.key, { saison: e.target.value as CultureRow["saison"] })}>
                              <option value="principale">Principale</option>
                              <option value="secondaire">Secondaire</option>
                            </select>
                          </div>
                        </div>
                        {crop && typeof row.surfaceHa === "number" && row.surfaceHa > 0 && (
                          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            Production estimée : {(rendement * row.surfaceHa).toLocaleString("fr-FR")} kg ({rendement.toLocaleString("fr-FR")} kg/ha)
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => setCultureRows((rows) => [...rows, newCultureRow()])} className="button-outline" style={{ height: 36 }}>
                    <Sprout size={14} /> + Ajouter une culture
                  </button>
                </>
              )}

              {step === 4 && (
                <>
                  <div className="section-header"><h3>5. Vérification</h3></div>
                  <p className="muted text-sm" style={{ marginBottom: 16 }}>
                    Relisez les informations avant de créer l'agriculteur.
                  </p>
                  <dl className="space-y-0">
                    <div className="flex justify-between border-b border-gray-50 py-2">
                      <dt className="text-[13px] text-gray-500">Agriculteur</dt>
                      <dd className="text-[13px] font-semibold">{fullName || "—"} · {phone || "—"}</dd>
                    </div>
                    {mmNumber.trim() && (
                      <div className="flex justify-between border-b border-gray-50 py-2">
                        <dt className="text-[13px] text-gray-500">Mobile Money</dt>
                        <dd className="text-[13px] font-semibold">{mmNumber} <span className="pill status-pending" style={{ marginLeft: 6 }}>Non vérifié</span></dd>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-gray-50 py-2">
                      <dt className="text-[13px] text-gray-500">Exploitation</dt>
                      <dd className="text-[13px] font-semibold">{exploProvince || "—"} · {totalHectares || "—"} ha</dd>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 py-2">
                      <dt className="text-[13px] text-gray-500">Cultures</dt>
                      <dd className="text-[13px] font-semibold">
                        {cultureRows.length === 0 ? "Aucune (à ajouter plus tard)" : cultureRows.map((r) => `${r.icon} ${r.commodity}`).join(", ")}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-[13px] text-gray-500">Accord obtenu</dt>
                      <dd className="text-[13px] font-semibold">{CONSENT_OPTIONS.find((c) => c.key === consentMethod)?.label} · {consentDate} {consentTime}</dd>
                    </div>
                  </dl>
                  <div className="hint-box" style={{ marginTop: 16, fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Ce compte, son exploitation et ses cultures seront enregistrés avec les détails de votre intervention et de l'accord obtenu.</span>
                  </div>
                </>
              )}

              <div className="button-row" style={{ marginTop: 20, justifyContent: "space-between" }}>
                {step > 1 ? (
                  <button onClick={() => setStep((s) => (s - 1) as Step)} className="button-outline">Retour</button>
                ) : <span />}
                <button onClick={primary} disabled={stepDisabled} className="btn-primary">
                  {step === 4 ? <ClipboardCheck size={14} /> : null} {CONTINUE_LABEL[step]}
                </button>
              </div>
            </div>
          </>
        )}

        {(submitting || done) && (
          <SubmissionPanel
            farmerId={farmerId}
            farmerName={farmerName}
            exploitationId={exploitationId}
            cultureRows={cultureRows}
            cultureStatuses={cultureStatuses}
            currentSubStage={currentSubStage}
            stageError={stageError}
            awaitingDuplicateChoice={awaitingDuplicateChoice}
            done={done}
            onRetry={retryCurrentStage}
            onContinueWithExisting={continueWithExistingProfile}
            onEditPhone={editPhoneInstead}
            onViewProfile={() => { onClose(); if (farmerId) navigate(`/admin/farmers/${farmerId}`); }}
            onCreateAnother={resetForAnotherFarmer}
            onClose={onClose}
          />
        )}

        {hasPartialProgress && !done && (
          <div style={{ marginTop: 12 }}>
            <button onClick={onClose} className="muted" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0 }}>
              {awaitingDuplicateChoice
                ? `Fermer sans continuer — ${farmerName ?? "ce profil"} existait déjà avant cette création, rien n'a été modifié.`
                : `Fermer sans terminer — ${farmerName ?? "cet agriculteur"} a déjà été créé, vous pourrez reprendre plus tard en recherchant à nouveau ce numéro.`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function SubmissionPanel({
  farmerId, farmerName, exploitationId, cultureRows, cultureStatuses, currentSubStage, stageError,
  awaitingDuplicateChoice, done, onRetry, onContinueWithExisting, onEditPhone, onViewProfile, onCreateAnother, onClose,
}: {
  farmerId: string | null; farmerName: string | null; exploitationId: string | null;
  cultureRows: CultureRow[]; cultureStatuses: Record<string, { status: CultureStatus; error?: string }>;
  currentSubStage: SubStage | null; stageError: string | null; awaitingDuplicateChoice: boolean; done: boolean;
  onRetry: () => void; onContinueWithExisting: () => void; onEditPhone: () => void;
  onViewProfile: () => void; onCreateAnother: () => void; onClose: () => void;
}) {
  const cultureFailures = cultureRows.filter((r) => cultureStatuses[r.key]?.status === "error");

  function rowIcon(state: "pending-item" | "active" | "done" | "error") {
    if (state === "done") return <CheckCircle2 size={16} style={{ color: "hsl(var(--green-700))" }} />;
    if (state === "error") return <XCircle size={16} style={{ color: "hsl(var(--red-700, 0 84% 60%))" }} />;
    if (state === "active") return <Loader2 size={16} className="animate-spin" />;
    return <Circle size={16} className="muted" />;
  }

  const personState = farmerId ? "done" : currentSubStage === "person" ? "active" : "pending-item";
  const exploState = exploitationId ? "done" : currentSubStage === "exploitation" ? "active" : "pending-item";

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="section-header"><h3>{done ? "Confirmation" : "Création en cours"}</h3></div>

      <ul className="space-y-0">
        <li className="flex items-center gap-3 py-2 border-b border-gray-50">
          {rowIcon(personState)}
          <span className="text-[13px]">Compte agriculteur{farmerName ? ` — ${farmerName}` : ""}</span>
        </li>
        <li className="flex items-center gap-3 py-2 border-b border-gray-50">
          {rowIcon(exploState)}
          <span className="text-[13px]">Exploitation</span>
        </li>
        {cultureRows.map((r) => {
          const st = cultureStatuses[r.key]?.status;
          const state = st === "done" ? "done" : st === "error" ? "error" : currentSubStage === "cultures" && st === "pending" ? "active" : "pending-item";
          return (
            <li key={r.key} className="flex items-center gap-3 py-2 border-b border-gray-50">
              {rowIcon(state)}
              <span className="text-[13px]">{r.icon} {r.commodity}</span>
              {state === "error" && cultureStatuses[r.key]?.error && (
                <span className="error-text" style={{ fontSize: 12, marginLeft: 8 }}>{cultureStatuses[r.key].error}</span>
              )}
            </li>
          );
        })}
      </ul>

      {awaitingDuplicateChoice && (
        <div className="hint-box" style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Un compte existe déjà pour ce téléphone : {farmerName}.
            </p>
            <p style={{ fontSize: 12, marginBottom: 10 }}>
              Vous pouvez continuer et ajouter l'exploitation sur ce profil existant, ou modifier le numéro si c'était une erreur.
            </p>
            <div className="flex gap-2">
              <button onClick={onContinueWithExisting} className="btn-primary" style={{ height: 34 }}>Continuer avec ce profil</button>
              <button onClick={onEditPhone} className="button-outline" style={{ height: 34 }}>Modifier le téléphone</button>
            </div>
          </div>
        </div>
      )}

      {stageError && !awaitingDuplicateChoice && (
        <div className="hint-box" style={{ marginTop: 16 }}>
          <p role="alert" className="error-text text-sm" style={{ marginBottom: 10 }}>{stageError}</p>
          <button onClick={onRetry} className="btn-primary" style={{ height: 34 }}>Réessayer</button>
        </div>
      )}

      {done && (
        <div style={{ marginTop: 16 }}>
          <div className="hint-box" style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <MapPin size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13 }}>
              {cultureFailures.length === 0
                ? "L'agriculteur, son exploitation et ses cultures ont été créés."
                : `L'agriculteur et son exploitation ont été créés. ${cultureFailures.length} culture(s) n'ont pas pu être enregistrées — vous pourrez les ajouter depuis son profil.`}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={onViewProfile} className="btn-primary" style={{ height: 40 }}>Voir le profil</button>
            <button onClick={onCreateAnother} className="button-outline" style={{ height: 40 }}>Créer un autre agriculteur</button>
            <button onClick={onClose} className="muted" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
