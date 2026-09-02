import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, UserCheck, Users2, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { Combobox } from "@/components/Combobox";
import { CreatePersonModal } from "@/components/CreatePersonModal";
import {
  useEligibleFarmers, useEligibleMerchants, useFarmerListings, useExchangeRatePreview,
  useCreateAssistedInvoice, type EligiblePerson, type ConsentMethod,
} from "@/hooks/useAssistedInvoice";
import type { FarmerListing } from "@/hooks/useAssistedInvoice";

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS: [Step, string][] = [[1, "Agriculteur(s)"], [2, "Commerçant"], [3, "Détails de la vente"], [4, "Montants"], [5, "Vérification"]];

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

function PersonPicker({
  people, isLoading, selected, onSelect, placeholder, onCreateNew, createLabel,
}: {
  people: EligiblePerson[]; isLoading: boolean; selected: string | null; onSelect: (uid: string) => void;
  placeholder: string; onCreateNew?: () => void; createLabel?: string;
}) {
  return (
    <Combobox
      options={people.map((p) => ({
        id: p.uid,
        label: p.fullName,
        sublabel: `${p.phone || "—"}${p.province ? ` · ${p.province}` : ""}`,
        badge: "Identité vérifiée",
      }))}
      isLoading={isLoading}
      selectedId={selected}
      onSelect={onSelect}
      placeholder={placeholder}
      emptyLabel="Aucun compte vérifié ne correspond."
      onCreateNew={onCreateNew}
      createLabel={createLabel}
    />
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

export function AdminCreateAssistedInvoice() {
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
  const [note, setNote] = useState("");
  const [clientRequestId] = useState(() => crypto.randomUUID());

  const [createModal, setCreateModal] = useState<null | { role: "farmer" | "merchant"; forRowKey?: string }>(null);
  const [createdFarmers, setCreatedFarmers] = useState<EligiblePerson[]>([]);
  const [createdMerchants, setCreatedMerchants] = useState<EligiblePerson[]>([]);

  const { data: fetchedFarmers = [], isLoading: farmersLoading } = useEligibleFarmers();
  const { data: fetchedMerchants = [], isLoading: merchantsLoading } = useEligibleMerchants();
  const farmers = [...fetchedFarmers, ...createdFarmers.filter((c) => !fetchedFarmers.some((f) => f.uid === c.uid))];
  const merchants = [...fetchedMerchants, ...createdMerchants.filter((c) => !fetchedMerchants.some((m) => m.uid === c.uid))];

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

  const step1Valid = filledFarmerRows.length > 0 && farmerRows.every((r) => r.farmerId);
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
    const newPerson: EligiblePerson = { uid: person.uid, fullName: person.fullName, phone: "", province: null, kycApproved: true };
    if (createModal.role === "farmer") {
      setCreatedFarmers((prev) => [...prev, newPerson]);
      if (createModal.forRowKey) updateFarmerRow(createModal.forRowKey, { farmerId: person.uid });
    } else {
      setCreatedMerchants((prev) => [...prev, newPerson]);
      setMerchantId(person.uid);
    }
    setCreateModal(null);
  }

  async function submit() {
    if (!merchantId || filledFarmerRows.length === 0) return;
    const payload = {
      clientRequestId,
      farmers: filledFarmerRows.map((r) => ({ farmerId: r.farmerId, contributedKg: Number(r.contributedKg) })),
      merchantId,
      consentMethod,
      consentAt: new Date().toISOString(),
      note: note.trim() || undefined,
      ...(effectiveSaleMode === "listing" && listingId
        ? { listingId }
        : { commodity: adHocCommodity.trim(), pricePerKgCdf: Number(adHocPriceCdf) }),
    };
    const result = await create.mutateAsync(payload);
    navigate(`/admin/partner-invoices/${result.invoiceId}`);
  }

  const stepDisabled =
    (step === 1 && !step1Valid) ||
    (step === 2 && !merchantId) ||
    (step === 3 && !step3Valid);

  return (
    <section className="page">
      <button onClick={() => navigate("/admin/partner-invoices")} className="text-sm text-blue-600 mb-4">← Factures</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Factures partenaires</div>
          <h1 className="page-title">Créer une facture avec assistance</h1>
          <p className="page-copy">Créez une facture au nom d'un ou plusieurs agriculteurs qui vous ont donné leur accord.</p>
        </div>
      </div>

      <div className="hint-box" style={{ marginBottom: 16 }}>
        L'agriculteur (ou chaque membre de la coopérative) reste l'émetteur de la facture. Votre intervention sera enregistrée.
      </div>

      <div className="flex gap-2 flex-wrap" style={{ marginBottom: 16 }}>
        {STEP_LABELS.map(([n, label]) => (
          <span key={n} className={`pill ${step === n ? "status-active" : ""}`}>{n}. {label}</span>
        ))}
      </div>

      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 320px" }}>
        <article className="panel">
          {step === 1 && (
            <>
              <div className="section-header"><h3>1. Sélectionner le(s) agriculteur(s)</h3></div>
              <p className="muted text-sm" style={{ marginBottom: 12 }}>
                Ajoutez plusieurs agriculteurs s'ils vendent leur récolte ensemble, en coopérative.
              </p>
              {farmerRows.map((row, i) => {
                const optionsForRow = farmers.filter(
                  (f) => f.uid === row.farmerId || !farmerRows.some((r) => r.key !== row.key && r.farmerId === f.uid),
                );
                return (
                  <div key={row.key} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <PersonPicker
                        people={optionsForRow}
                        isLoading={farmersLoading}
                        selected={row.farmerId}
                        onSelect={(uid) => updateFarmerRow(row.key, { farmerId: uid })}
                        placeholder="Rechercher par nom ou téléphone"
                        onCreateNew={() => setCreateModal({ role: "farmer", forRowKey: row.key })}
                        createLabel="+ Créer un nouvel agriculteur"
                      />
                    </div>
                    {farmerRows.length > 1 && (
                      <button type="button" onClick={() => removeFarmerRow(row.key)} className="button-outline danger" style={{ height: 40 }} aria-label={`Retirer l'agriculteur ${i + 1}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addFarmerRow}
                disabled={farmerRows.some((r) => !r.farmerId)}
                className="button-outline"
                style={{ height: 36, marginTop: 4 }}
              >
                + Ajouter un agriculteur (coopérative)
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <div className="section-header"><h3>2. Sélectionner le commerçant</h3></div>
              <PersonPicker
                people={merchants}
                isLoading={merchantsLoading}
                selected={merchantId}
                onSelect={setMerchantId}
                placeholder="Rechercher par nom ou téléphone"
                onCreateNew={() => setCreateModal({ role: "merchant" })}
                createLabel="+ Créer un nouveau commerçant"
              />
            </>
          )}
          {step === 3 && (
            <>
              <div className="section-header"><h3>3. Détails de la vente</h3></div>
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
              <div className="section-header"><h3>5. Accord {isCooperative ? "des agriculteurs" : "de l'agriculteur"}</h3></div>
              <p className="form-label" style={{ marginBottom: 8 }}>Méthode d'obtention de l'accord</p>
              <div className="flex gap-2 flex-wrap" style={{ marginBottom: 16 }}>
                {CONSENT_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setConsentMethod(c.key)}
                    className={`button-outline ${consentMethod === c.key ? "active" : ""}`}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={consentConfirmed} onChange={(e) => setConsentConfirmed(e.target.checked)} />
                Je confirme avoir reçu l'accord {isCooperative ? "de chaque agriculteur" : "de l'agriculteur"} <span className="pill status-pending">Requis</span>
              </label>
              <label className="form-label" htmlFor="note">Note (optionnelle)</label>
              <textarea id="note" className="form-textarea" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
              {create.isError && (
                <p role="alert" className="error-text text-sm" style={{ marginTop: 12 }}>
                  {create.error instanceof Error ? create.error.message : "Une erreur est survenue."}
                </p>
              )}
            </>
          )}

          <div className="button-row" style={{ marginTop: 20 }}>
            {step > 1 && <button onClick={() => setStep((s) => (s - 1) as Step)} className="button-outline">Retour</button>}
            {step < 5 && (
              <button
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={stepDisabled}
                className="btn-primary"
                style={{ height: 40 }}
              >
                Continuer
              </button>
            )}
            {step === 5 && (
              <button onClick={submit} disabled={!consentConfirmed || create.isPending} className="btn-primary" style={{ height: 40 }}>
                {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Créer la facture
              </button>
            )}
          </div>
        </article>

        <aside className="panel">
          <div className="section-header"><h3>Résumé de la facture</h3></div>
          <dl className="space-y-0">
            <div className="py-2 border-b border-gray-50">
              <dt className="text-[12px] text-gray-500">{isCooperative ? "Agriculteurs (émetteurs)" : "Agriculteur (émetteur)"}</dt>
              <dd className="text-[13px] font-semibold">
                {filledFarmerRows.length === 0
                  ? "À sélectionner"
                  : filledFarmerRows.map((r) => {
                      const p = farmers.find((f) => f.uid === r.farmerId);
                      const kg = typeof r.contributedKg === "number" ? ` (${r.contributedKg} kg)` : "";
                      return `${p?.fullName ?? "—"}${kg}`;
                    }).join(", ")}
              </dd>
            </div>
            <div className="py-2 border-b border-gray-50">
              <dt className="text-[12px] text-gray-500">Commerçant (acheteur)</dt>
              <dd className="text-[13px] font-semibold">{merchant?.fullName ?? "À sélectionner"}</dd>
            </div>
            <div className="py-2 border-b border-gray-50">
              <dt className="text-[12px] text-gray-500">Produit</dt>
              <dd className="text-[13px] font-semibold">{commodityLabel ? `${commodityLabel} · ${totalKg || "—"} kg` : "À sélectionner"}</dd>
            </div>
            <div className="py-2">
              <dt className="text-[12px] text-gray-500">Total de la facture</dt>
              <dd className="text-[13px] font-semibold">{previewTotalUsd != null ? `${previewTotalUsd} $` : "—"}</dd>
            </div>
          </dl>
          <p className="pill" style={{ marginTop: 8, display: "inline-block" }}>Créée avec assistance admin</p>
          <div className="hint-box" style={{ marginTop: 16, fontSize: 12 }}>
            Cette facture sera enregistrée avec les détails de votre intervention et de l'accord obtenu.
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
  );
}
