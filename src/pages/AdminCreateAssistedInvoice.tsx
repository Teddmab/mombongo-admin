import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone, UserCheck, Users2, Loader2, CheckCircle2, Trash2, Search, User, Store, Truck, DollarSign,
  ShieldCheck, Info, HelpCircle, Bookmark, ChevronDown, ChevronUp, ClipboardCheck, X,
} from "lucide-react";
import { Combobox } from "@/components/Combobox";
import { CreatePersonModal } from "@/components/CreatePersonModal";
import { Avatar } from "@/components/Avatar";
import {
  useEligibleFarmers, useEligibleMerchants, useFarmerListings, useExchangeRatePreview,
  useCreateAssistedInvoice, type EligiblePerson, type ConsentMethod,
} from "@/hooks/useAssistedInvoice";
import type { FarmerListing } from "@/hooks/useAssistedInvoice";

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS: [Step, string][] = [[1, "Agriculteur"], [2, "Commerçant"], [3, "Livraison"], [4, "Montants"], [5, "Vérification"]];
const CONTINUE_LABEL: Record<Step, string> = {
  1: "Continuer vers le commerçant",
  2: "Continuer vers la livraison",
  3: "Continuer vers les montants",
  4: "Continuer vers la vérification",
  5: "Créer la facture",
};

const CONSENT_OPTIONS: { key: ConsentMethod; label: string; icon: React.ReactNode }[] = [
  { key: "phone", label: "Appel téléphonique", icon: <Phone size={14} /> },
  { key: "in_person", label: "Présent avec moi", icon: <UserCheck size={14} /> },
  { key: "field_agent", label: "Agent terrain", icon: <Users2 size={14} /> },
];

interface FarmerRow {
  key: string;
  farmerId: string | null;
  contributedKg: number | "";
}

interface DraftState {
  savedAt: string;
  farmerIds: string[];
  merchantId: string | null;
  saleMode: "listing" | "adhoc";
  listingId: string | null;
  adHocCommodity: string;
  adHocPriceCdf: number | "";
  consentMethod: ConsentMethod;
  note: string;
}

const DRAFT_KEY = "admin-assisted-invoice-draft";

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

function fmtDraftDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const PAGE_SIZE = 3;

/** Always-visible, radio-selectable card list — matches the ADM-UI-05 reference design (08-create-assisted-invoice.png) more closely than a search-to-reveal combobox, while still working with a short, KYC-filtered candidate list. */
function PersonCardList({
  people, totalCount, isLoading, selected, onSelect, searchPlaceholder, onCreateNew, createLabel, emptyRoleLabel,
}: {
  people: EligiblePerson[]; totalCount: number; isLoading: boolean; selected: string | null; onSelect: (uid: string) => void;
  searchPlaceholder: string; onCreateNew?: () => void; createLabel?: string; emptyRoleLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const q = query.trim().toLowerCase();
  const filtered = !q ? people : people.filter((p) => p.fullName.toLowerCase().includes(q) || p.phone.includes(q));
  const shown = filtered.slice(0, visibleCount);

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--gray-400))" }} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
          placeholder={searchPlaceholder}
          className="form-input"
          style={{ paddingLeft: 34, width: "100%" }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} style={{ height: 64 }} className="bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <div className="hint-box" style={{ fontSize: 13 }}>
          {totalCount === 0
            ? `Aucun ${emptyRoleLabel} enregistré ne correspond.`
            : `${totalCount} ${emptyRoleLabel}${totalCount > 1 ? "s" : ""} enregistré${totalCount > 1 ? "s" : ""}, mais aucun avec une identité vérifiée (KYC approuvé).`}
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((p) => (
            <label key={p.uid} className={`select-row ${selected === p.uid ? "selected" : ""}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <input type="radio" checked={selected === p.uid} onChange={() => onSelect(p.uid)} style={{ flexShrink: 0 }} />
                <Avatar name={p.fullName} url={p.avatarUrl} />
                <div style={{ minWidth: 0 }}>
                  <div className="font-semibold text-sm">{p.fullName}</div>
                  <div style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>
                    {p.phone || "—"}{p.province ? ` · ${p.province}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                <span className="pill status-active">Identité vérifiée</span>
                <span className={`pill ${p.isActive ? "status-active" : "status-blocked"}`}>{p.isActive ? "Actif" : "Désactivé"}</span>
              </div>
            </label>
          ))}
        </div>
      )}

      {filtered.length > visibleCount && (
        <button type="button" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} className="button-outline" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}>
          Voir plus de résultats
        </button>
      )}
      {onCreateNew && (
        <button type="button" onClick={onCreateNew} className="button-outline" style={{ marginTop: 8, width: "100%", justifyContent: "center", color: "hsl(var(--green-700))", fontWeight: 600 }}>
          {createLabel}
        </button>
      )}
    </div>
  );
}

function ListingPicker({
  listings, isLoading, selected, onSelect,
}: { listings: FarmerListing[]; isLoading: boolean; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <Combobox
      options={listings.map((l) => ({
        id: l.id,
        label: `${l.commodity} — ${l.quantityKg} kg disponibles`,
        sublabel: `${l.pricePerKgCdf.toLocaleString("fr-FR")} CDF/kg · ${l.province ?? "—"}`,
      }))}
      isLoading={isLoading}
      selectedId={selected}
      onSelect={onSelect}
      placeholder="Rechercher une annonce par produit"
      emptyLabel="Cet agriculteur n'a aucune annonce active."
    />
  );
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

function SummaryRow({ icon, iconColor, iconBg, label, value, badge, last }: {
  icon: React.ReactNode; iconColor: string; iconBg: string; label: string; value: string; badge?: string; last?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-3"
      style={{ padding: "12px 0", borderBottom: last ? undefined : "1px solid hsl(var(--gray-50))" }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: iconBg, color: iconColor,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="text-[12px] text-gray-500">{label}</p>
        <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
          <p className="text-[13px] font-semibold truncate">{value}</p>
          {badge && <span className="pill status-active" style={{ flexShrink: 0 }}>{badge}</span>}
        </div>
      </div>
    </div>
  );
}

/** Rendered as a modal from AdminPartnerInvoices, not a dedicated route — closing (X, backdrop, "Annuler et revenir")
 * just dismisses it. Draft-save (see saveDraft()) is the explicit way to keep in-progress work; closing without
 * saving one discards it, same as any other unsaved form. */
export function CreateAssistedInvoiceModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  const [farmerRows, setFarmerRows] = useState<FarmerRow[]>([{ key: crypto.randomUUID(), farmerId: null, contributedKg: "" }]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [saleMode, setSaleMode] = useState<"listing" | "adhoc">("listing");
  const [listingId, setListingId] = useState<string | null>(null);
  const [adHocCommodity, setAdHocCommodity] = useState("");
  const [adHocPriceCdf, setAdHocPriceCdf] = useState<number | "">("");
  const [consentMethod, setConsentMethod] = useState<ConsentMethod>("phone");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const now = new Date();
  const [consentDate, setConsentDate] = useState(now.toISOString().slice(0, 10));
  const [consentTime, setConsentTime] = useState(now.toTimeString().slice(0, 5));
  const [note, setNote] = useState("");
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [showAssistanceRules, setShowAssistanceRules] = useState(false);

  const [createModal, setCreateModal] = useState<null | { role: "farmer" | "merchant"; forRowKey?: string }>(null);
  const [createdFarmers, setCreatedFarmers] = useState<EligiblePerson[]>([]);
  const [createdMerchants, setCreatedMerchants] = useState<EligiblePerson[]>([]);

  const [draft, setDraft] = useState<DraftState | null>(() => loadDraft());
  const [draftSaved, setDraftSaved] = useState(false);

  const { data: farmersResult, isLoading: farmersLoading } = useEligibleFarmers();
  const { data: merchantsResult, isLoading: merchantsLoading } = useEligibleMerchants();
  const fetchedFarmers = farmersResult?.eligible ?? [];
  const fetchedMerchants = merchantsResult?.eligible ?? [];
  const farmers = [...fetchedFarmers, ...createdFarmers.filter((c) => !fetchedFarmers.some((f) => f.uid === c.uid))];
  const merchants = [...fetchedMerchants, ...createdMerchants.filter((c) => !fetchedMerchants.some((m) => m.uid === c.uid))];
  const farmersTotalCount = (farmersResult?.totalCount ?? 0) + createdFarmers.length;
  const merchantsTotalCount = (merchantsResult?.totalCount ?? 0) + createdMerchants.length;

  const filledFarmerRows = farmerRows.filter((r): r is FarmerRow & { farmerId: string } => !!r.farmerId);
  const isCooperative = filledFarmerRows.length > 1;
  const effectiveSaleMode = isCooperative ? "adhoc" : saleMode;

  const singleFarmerId = !isCooperative ? filledFarmerRows[0]?.farmerId ?? undefined : undefined;
  const { data: listings = [], isLoading: listingsLoading } = useFarmerListings(singleFarmerId);
  const { data: usdToCdf } = useExchangeRatePreview();
  const create = useCreateAssistedInvoice();

  const merchant = merchants.find((m) => m.uid === merchantId) ?? null;
  const listing = listings.find((l) => l.id === listingId) ?? null;

  const totalKg = filledFarmerRows.reduce((sum, r) => sum + (typeof r.contributedKg === "number" ? r.contributedKg : 0), 0);
  const pricePerKgCdf = effectiveSaleMode === "listing" ? listing?.pricePerKgCdf ?? null : (typeof adHocPriceCdf === "number" ? adHocPriceCdf : null);
  const commodityLabel = effectiveSaleMode === "listing" ? listing?.commodity ?? null : (adHocCommodity.trim() || null);

  const previewTotalUsd = pricePerKgCdf != null && totalKg > 0 && usdToCdf
    ? Math.round(((pricePerKgCdf * totalKg) / usdToCdf) * 100) / 100
    : null;

  const step1Valid = filledFarmerRows.length > 0 && farmerRows.every((r) => r.farmerId) && consentConfirmed;
  const step3Valid = effectiveSaleMode === "listing"
    ? !!listing && typeof filledFarmerRows[0]?.contributedKg === "number" && filledFarmerRows[0].contributedKg > 0 && filledFarmerRows[0].contributedKg <= listing.quantityKg
    : adHocCommodity.trim().length > 0 && typeof adHocPriceCdf === "number" && adHocPriceCdf > 0
      && filledFarmerRows.length > 0 && filledFarmerRows.every((r) => typeof r.contributedKg === "number" && r.contributedKg > 0);

  function updateFarmerRow(key: string, patch: Partial<FarmerRow>) {
    setFarmerRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addFarmerRow() {
    setFarmerRows((rows) => [...rows, { key: crypto.randomUUID(), farmerId: null, contributedKg: "" }]);
  }
  function removeFarmerRow(key: string) {
    setFarmerRows((rows) => rows.filter((r) => r.key !== key));
  }

  function handlePersonCreated(person: { uid: string; fullName: string }) {
    if (!createModal) return;
    const newPerson: EligiblePerson = { uid: person.uid, fullName: person.fullName, phone: "", province: null, avatarUrl: null, isActive: true, kycApproved: true };
    if (createModal.role === "farmer") {
      setCreatedFarmers((prev) => [...prev, newPerson]);
      if (createModal.forRowKey) updateFarmerRow(createModal.forRowKey, { farmerId: person.uid });
    } else {
      setCreatedMerchants((prev) => [...prev, newPerson]);
      setMerchantId(person.uid);
    }
    setCreateModal(null);
  }

  /** Client-side only — there is no server-side draft/save endpoint for this flow, so this persists the in-progress selections locally (same pattern as the sidebar's collapsed-group state) so an admin can safely navigate away and resume later on this device. It is not a shared or synced draft. */
  function saveDraft() {
    const state: DraftState = {
      savedAt: new Date().toISOString(),
      farmerIds: filledFarmerRows.map((r) => r.farmerId),
      merchantId,
      saleMode: effectiveSaleMode,
      listingId,
      adHocCommodity,
      adHocPriceCdf,
      consentMethod,
      note,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      setDraft(state);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2500);
    } catch {
      /* private mode — non-fatal, the admin just can't resume later on this device */
    }
  }

  function resumeDraft() {
    if (!draft) return;
    setFarmerRows(draft.farmerIds.length > 0
      ? draft.farmerIds.map((id) => ({ key: crypto.randomUUID(), farmerId: id, contributedKg: "" }))
      : [{ key: crypto.randomUUID(), farmerId: null, contributedKg: "" }]);
    setMerchantId(draft.merchantId);
    setSaleMode(draft.saleMode);
    setListingId(draft.listingId);
    setAdHocCommodity(draft.adHocCommodity);
    setAdHocPriceCdf(draft.adHocPriceCdf);
    setConsentMethod(draft.consentMethod);
    setNote(draft.note);
    setDraft(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* non-fatal */ }
  }

  function discardDraft() {
    setDraft(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* non-fatal */ }
  }

  async function submit() {
    if (!merchantId || filledFarmerRows.length === 0) return;
    const payload = {
      clientRequestId,
      farmers: filledFarmerRows.map((r) => ({ farmerId: r.farmerId, contributedKg: Number(r.contributedKg) })),
      merchantId,
      consentMethod,
      consentAt: new Date(`${consentDate}T${consentTime}:00`).toISOString(),
      note: note.trim() || undefined,
      ...(effectiveSaleMode === "listing" && listingId
        ? { listingId }
        : { commodity: adHocCommodity.trim(), pricePerKgCdf: Number(adHocPriceCdf) }),
    };
    const result = await create.mutateAsync(payload);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* non-fatal */ }
    onClose();
    navigate(`/admin/partner-invoices/${result.invoiceId}`);
  }

  const stepDisabled =
    (step === 1 && !step1Valid) ||
    (step === 2 && !merchantId) ||
    (step === 3 && !step3Valid);

  function primaryAction() {
    if (step < 5) setStep((s) => (s + 1) as Step);
    else void submit();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 20px", overflowY: "auto" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
    <section className="page" style={{ background: "hsl(var(--background, 42 25% 95%))", borderRadius: 20, padding: 24, width: "100%", maxWidth: 920, boxShadow: "var(--shadow-elevated)" }}>
      <div className="page-header">
        <div>
          <div className="section-kicker">Factures partenaires</div>
          <h1 className="page-title">Créer une facture avec assistance</h1>
          <p className="page-copy">Créez une facture au nom d'un agriculteur qui vous a donné son accord.</p>
        </div>
        <button onClick={onClose} className="button-outline" style={{ height: 40, width: 40, padding: 0, justifyContent: "center" }} aria-label="Fermer">
          <X size={16} />
        </button>
      </div>

      <div className="hint-box info" style={{ marginTop: 16, marginBottom: 16 }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: 1, marginRight: 8, display: "inline" }} />
        L'agriculteur restera l'émetteur de la facture. Votre intervention sera enregistrée.
      </div>

      {draft && (
        <div className="hint-box" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>Un brouillon enregistré le {fmtDraftDate(draft.savedAt)} est disponible.</span>
          <span className="flex gap-2">
            <button type="button" onClick={resumeDraft} className="button-outline" style={{ height: 30 }}>Reprendre</button>
            <button type="button" onClick={discardDraft} className="button-outline" style={{ height: 30 }}>Ignorer</button>
          </span>
        </div>
      )}

      <StepCircles step={step} />

      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 320px" }}>
        <article className="panel">
          {step === 1 && (
            <>
              <div className="section-header"><h3>1. Sélectionner l'agriculteur</h3></div>
              {isCooperative || farmerRows.length > 1 ? (
                <p className="muted text-sm" style={{ marginBottom: 12 }}>
                  Ajoutez plusieurs agriculteurs s'ils vendent leur récolte ensemble, en coopérative.
                </p>
              ) : null}
              {farmerRows.map((row, i) => {
                const optionsForRow = farmers.filter(
                  (f) => f.uid === row.farmerId || !farmerRows.some((r) => r.key !== row.key && r.farmerId === f.uid),
                );
                return (
                  <div key={row.key} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: farmerRows.length > 1 ? "1px solid hsl(var(--gray-100))" : undefined }}>
                    {farmerRows.length > 1 && (
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <p className="muted text-sm" style={{ fontWeight: 600 }}>Agriculteur {i + 1}</p>
                        <button type="button" onClick={() => removeFarmerRow(row.key)} className="button-outline danger" style={{ height: 28, padding: "0 10px" }}>
                          <Trash2 size={13} /> Retirer
                        </button>
                      </div>
                    )}
                    <PersonCardList
                      people={optionsForRow}
                      totalCount={farmersTotalCount}
                      isLoading={farmersLoading}
                      selected={row.farmerId}
                      onSelect={(uid) => updateFarmerRow(row.key, { farmerId: uid })}
                      searchPlaceholder="Rechercher par nom ou téléphone"
                      onCreateNew={() => setCreateModal({ role: "farmer", forRowKey: row.key })}
                      createLabel="+ Créer un nouvel agriculteur"
                      emptyRoleLabel="agriculteur"
                    />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addFarmerRow}
                disabled={farmerRows.some((r) => !r.farmerId)}
                className="button-outline"
                style={{ height: 36, marginTop: 4, marginBottom: 24 }}
              >
                + Ajouter un agriculteur (coopérative)
              </button>

              <div className="section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <h3>2. Accord {isCooperative ? "des agriculteurs" : "de l'agriculteur"}</h3>
              </div>
              <p className="form-label" style={{ marginBottom: 8 }}>Méthode d'obtention de l'accord</p>
              <div className="flex gap-2 flex-wrap" style={{ marginBottom: 16 }}>
                {CONSENT_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setConsentMethod(c.key)}
                    className={`button-outline ${consentMethod === c.key ? "active" : ""}`}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <p className="form-label" style={{ marginBottom: 8 }}>Date et heure de l'accord</p>
              <div className="flex gap-2" style={{ marginBottom: 16 }}>
                <input
                  type="date"
                  value={consentDate}
                  onChange={(e) => setConsentDate(e.target.value)}
                  className="form-input"
                  aria-label="Date de l'accord"
                  max={now.toISOString().slice(0, 10)}
                />
                <input
                  type="time"
                  value={consentTime}
                  onChange={(e) => setConsentTime(e.target.value)}
                  className="form-input"
                  aria-label="Heure de l'accord"
                />
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={consentConfirmed} onChange={(e) => setConsentConfirmed(e.target.checked)} />
                Je confirme avoir reçu l'accord {isCooperative ? "de chaque agriculteur" : "de l'agriculteur"} <span className="pill status-pending">Requis</span>
              </label>
              <label className="form-label" htmlFor="note">Note (optionnelle)</label>
              <textarea id="note" className="form-textarea" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} maxLength={500} />
              <p className="muted" style={{ fontSize: 11, textAlign: "right", marginTop: 2 }}>{note.length} / 500</p>

              <button
                type="button"
                onClick={() => setShowAssistanceRules((v) => !v)}
                className="text-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "hsl(217 91% 60%)", marginTop: 8, padding: 0 }}
              >
                <HelpCircle size={14} /> Voir les règles d'assistance {showAssistanceRules ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showAssistanceRules && (
                <div className="hint-box" style={{ marginTop: 10, fontSize: 12 }}>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                    <li>L'agriculteur (ou chaque membre de la coopérative) reste l'émetteur légal de la facture — l'assistance admin ne transfère pas cette qualité.</li>
                    <li>Le commerçant ne peut ni créer ni modifier la facture d'un agriculteur.</li>
                    <li>Cette facture ne peut pas être marquée comme payée manuellement — seule une confirmation du prestataire de paiement le permet.</li>
                    <li>La méthode d'obtention de l'accord, sa date et l'administrateur intervenant sont enregistrés avec la facture, de façon permanente.</li>
                  </ul>
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <div className="section-header"><h3>2. Sélectionner le commerçant</h3></div>
              <PersonCardList
                people={merchants}
                totalCount={merchantsTotalCount}
                isLoading={merchantsLoading}
                selected={merchantId}
                onSelect={setMerchantId}
                searchPlaceholder="Rechercher par nom ou téléphone"
                onCreateNew={() => setCreateModal({ role: "merchant" })}
                createLabel="+ Créer un nouveau commerçant"
                emptyRoleLabel="commerçant"
              />
            </>
          )}
          {step === 3 && (
            <>
              <div className="section-header"><h3>3. Livraison</h3></div>
              {!isCooperative && (
                <div className="flex gap-2" style={{ marginBottom: 16 }}>
                  <button type="button" onClick={() => setSaleMode("listing")} className={`button-outline ${saleMode === "listing" ? "active" : ""}`}>
                    Depuis une annonce publiée
                  </button>
                  <button type="button" onClick={() => setSaleMode("adhoc")} className={`button-outline ${saleMode === "adhoc" ? "active" : ""}`}>
                    Vente directe (sans annonce)
                  </button>
                </div>
              )}
              {isCooperative && (
                <p className="muted text-sm" style={{ marginBottom: 16 }}>
                  Une vente en coopérative ne peut pas être rattachée à une seule annonce — indiquez le produit et le prix convenus, puis la quantité apportée par chaque agriculteur.
                </p>
              )}

              {effectiveSaleMode === "listing" ? (
                <>
                  <ListingPicker
                    listings={listings}
                    isLoading={listingsLoading}
                    selected={listingId}
                    onSelect={(id) => { setListingId(id); updateFarmerRow(filledFarmerRows[0].key, { contributedKg: "" }); }}
                  />
                  {listing && (
                    <div style={{ marginTop: 16 }}>
                      <label className="form-label" htmlFor="quantity">Quantité (kg, max {listing.quantityKg})</label>
                      <input
                        id="quantity"
                        type="number"
                        min={1}
                        max={listing.quantityKg}
                        value={filledFarmerRows[0]?.contributedKg ?? ""}
                        onChange={(e) => updateFarmerRow(filledFarmerRows[0].key, { contributedKg: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="form-input"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label className="form-label" htmlFor="commodity">Produit</label>
                  <input id="commodity" className="form-input" value={adHocCommodity} onChange={(e) => setAdHocCommodity(e.target.value)} placeholder="Ex: Maïs" style={{ marginBottom: 12 }} />
                  <label className="form-label" htmlFor="priceCdf">Prix convenu (CDF/kg)</label>
                  <input
                    id="priceCdf"
                    type="number"
                    min={1}
                    value={adHocPriceCdf}
                    onChange={(e) => setAdHocPriceCdf(e.target.value === "" ? "" : Number(e.target.value))}
                    className="form-input"
                    style={{ marginBottom: 16 }}
                  />
                  {filledFarmerRows.map((row) => {
                    const person = farmers.find((f) => f.uid === row.farmerId);
                    return (
                      <div key={row.key} style={{ marginBottom: 12 }}>
                        <label className="form-label" htmlFor={`kg-${row.key}`}>Quantité apportée par {person?.fullName ?? "cet agriculteur"} (kg)</label>
                        <input
                          id={`kg-${row.key}`}
                          type="number"
                          min={1}
                          value={row.contributedKg}
                          onChange={(e) => updateFarmerRow(row.key, { contributedKg: e.target.value === "" ? "" : Number(e.target.value) })}
                          className="form-input"
                        />
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <div className="section-header"><h3>4. Montants</h3></div>
              <dl className="space-y-0">
                <div className="flex justify-between border-b border-gray-50 py-2">
                  <dt className="text-[13px] text-gray-500">Sous-total ({totalKg} kg × {pricePerKgCdf?.toLocaleString("fr-FR") ?? "—"} CDF)</dt>
                  <dd className="text-[13px] font-semibold">{pricePerKgCdf != null && totalKg > 0 ? (pricePerKgCdf * totalKg).toLocaleString("fr-FR") : "—"} CDF</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-[13px] text-gray-500">Total estimé (USD)</dt>
                  <dd className="text-[13px] font-semibold">{previewTotalUsd != null ? `${previewTotalUsd} $` : "—"}</dd>
                </div>
              </dl>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Le montant final en USD est recalculé par le serveur au moment de la création, au taux de change en vigueur.
              </p>
            </>
          )}
          {step === 5 && (
            <>
              <div className="section-header"><h3>5. Vérification</h3></div>
              <p className="muted text-sm" style={{ marginBottom: 16 }}>
                Relisez les informations avant de créer la facture. Une fois créée, elle ne peut plus être annulée depuis cette interface.
              </p>
              <dl className="space-y-0">
                <div className="flex justify-between border-b border-gray-50 py-2">
                  <dt className="text-[13px] text-gray-500">{isCooperative ? "Agriculteurs" : "Agriculteur"}</dt>
                  <dd className="text-[13px] font-semibold" style={{ textAlign: "right" }}>
                    {filledFarmerRows.map((r) => farmers.find((f) => f.uid === r.farmerId)?.fullName ?? "—").join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-gray-50 py-2">
                  <dt className="text-[13px] text-gray-500">Commerçant</dt>
                  <dd className="text-[13px] font-semibold">{merchant?.fullName ?? "—"}</dd>
                </div>
                <div className="flex justify-between border-b border-gray-50 py-2">
                  <dt className="text-[13px] text-gray-500">Livraison</dt>
                  <dd className="text-[13px] font-semibold">{commodityLabel ?? "—"} · {totalKg} kg</dd>
                </div>
                <div className="flex justify-between border-b border-gray-50 py-2">
                  <dt className="text-[13px] text-gray-500">Total estimé</dt>
                  <dd className="text-[13px] font-semibold">{previewTotalUsd != null ? `${previewTotalUsd} $` : "—"}</dd>
                </div>
                <div className="flex justify-between border-b border-gray-50 py-2">
                  <dt className="text-[13px] text-gray-500">Accord obtenu</dt>
                  <dd className="text-[13px] font-semibold">{CONSENT_OPTIONS.find((c) => c.key === consentMethod)?.label} · {consentDate} {consentTime}</dd>
                </div>
                {note.trim() && (
                  <div className="flex justify-between py-2">
                    <dt className="text-[13px] text-gray-500">Note</dt>
                    <dd className="text-[13px]" style={{ textAlign: "right", maxWidth: "60%" }}>{note}</dd>
                  </div>
                )}
              </dl>
              {create.isError && (
                <p role="alert" className="error-text text-sm" style={{ marginTop: 12 }}>
                  {create.error instanceof Error ? create.error.message : "Une erreur est survenue."}
                </p>
              )}
            </>
          )}

          {step > 1 && (
            <div className="button-row" style={{ marginTop: 20 }}>
              <button onClick={() => setStep((s) => (s - 1) as Step)} className="button-outline">Retour</button>
            </div>
          )}
        </article>

        <aside className="panel">
          <div className="section-header"><h3>Résumé de la facture</h3></div>
          <div style={{ padding: "0 20px 20px" }}>
            <SummaryRow
              icon={<User size={16} />} iconColor="hsl(var(--green-700))" iconBg="hsl(var(--green-100))"
              label={isCooperative ? "Agriculteurs (émetteurs)" : "Agriculteur (émetteur)"}
              value={filledFarmerRows.length === 0
                ? "À sélectionner"
                : filledFarmerRows.map((r) => {
                    const p = farmers.find((f) => f.uid === r.farmerId);
                    const kg = typeof r.contributedKg === "number" ? ` (${r.contributedKg} kg)` : "";
                    return `${p?.fullName ?? "—"}${kg}`;
                  }).join(", ")}
              badge={filledFarmerRows.length > 0 ? "Identité vérifiée" : undefined}
            />
            <SummaryRow
              icon={<Store size={16} />} iconColor="hsl(var(--gray-700))" iconBg="hsl(var(--gray-100))"
              label="Commerçant (acheteur)" value={merchant?.fullName ?? "À sélectionner"}
            />
            <SummaryRow
              icon={<Truck size={16} />} iconColor="hsl(var(--info))" iconBg="hsl(var(--info) / 14%)"
              label="Livraison" value={commodityLabel ? `${commodityLabel} · ${totalKg || "—"} kg` : "À sélectionner"}
            />
            <SummaryRow
              icon={<DollarSign size={16} />} iconColor="hsl(var(--amber-700))" iconBg="hsl(var(--amber-100))"
              label="Total de la facture" value={previewTotalUsd != null ? `${previewTotalUsd} $` : "—"} last
            />
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            <p className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Source</p>
            <p className="pill status-active" style={{ display: "inline-block" }}>Créée avec assistance admin</p>
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            <div className="hint-box" style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>Trace d'audit</strong><br />
                Cette facture sera enregistrée avec les détails de votre intervention et de l'accord obtenu.
              </span>
            </div>
          </div>

          <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={primaryAction}
              disabled={stepDisabled || (step === 5 && create.isPending)}
              className="btn-primary"
              style={{ height: 44, width: "100%", justifyContent: "center" }}
            >
              {step === 5 && create.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : step === 5 ? <ClipboardCheck size={14} /> : null}
              {CONTINUE_LABEL[step]}
            </button>
            <button onClick={saveDraft} className="button-outline" style={{ height: 44, width: "100%", justifyContent: "center" }}>
              <Bookmark size={14} /> Enregistrer comme brouillon
            </button>
            {draftSaved && <p style={{ fontSize: 12, color: "hsl(var(--green-700))", textAlign: "center" }}>Brouillon enregistré.</p>}
            <button
              onClick={onClose}
              className="muted"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, textAlign: "center", padding: "6px 0" }}
            >
              Annuler et revenir
            </button>
          </div>
        </aside>
      </div>

      {createModal && (
        <CreatePersonModal
          role={createModal.role}
          consentMethod={consentMethod}
          onClose={() => setCreateModal(null)}
          onCreated={handlePersonCreated}
        />
      )}
    </section>
    </div>
  );
}
