import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, UserCheck, Users2, Loader2, CheckCircle2 } from "lucide-react";
import { Combobox } from "@/components/Combobox";
import {
  useEligibleFarmers, useEligibleMerchants, useFarmerListings, useExchangeRatePreview,
  useCreateAssistedInvoice, type EligiblePerson, type ConsentMethod,
} from "@/hooks/useAssistedInvoice";
import type { FarmerListing } from "@/hooks/useAssistedInvoice";

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_LABELS: [Step, string][] = [[1, "Agriculteur"], [2, "Commerçant"], [3, "Annonce"], [4, "Montants"], [5, "Vérification"]];

const CONSENT_OPTIONS: { key: ConsentMethod; label: string; icon: React.ReactNode }[] = [
  { key: "phone", label: "Appel téléphonique", icon: <Phone size={14} /> },
  { key: "in_person", label: "Présent avec moi", icon: <UserCheck size={14} /> },
  { key: "field_agent", label: "Agent terrain", icon: <Users2 size={14} /> },
];

function PersonPicker({
  people, isLoading, selected, onSelect, placeholder,
}: { people: EligiblePerson[]; isLoading: boolean; selected: string | null; onSelect: (uid: string) => void; placeholder: string }) {
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
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const [quantityKg, setQuantityKg] = useState<number | "">("");
  const [consentMethod, setConsentMethod] = useState<ConsentMethod>("phone");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [clientRequestId] = useState(() => crypto.randomUUID());

  const { data: farmers = [], isLoading: farmersLoading } = useEligibleFarmers();
  const { data: merchants = [], isLoading: merchantsLoading } = useEligibleMerchants();
  const { data: listings = [], isLoading: listingsLoading } = useFarmerListings(farmerId ?? undefined);
  const { data: usdToCdf } = useExchangeRatePreview();
  const create = useCreateAssistedInvoice();

  const farmer = farmers.find((f) => f.uid === farmerId) ?? null;
  const merchant = merchants.find((m) => m.uid === merchantId) ?? null;
  const listing = listings.find((l) => l.id === listingId) ?? null;

  const previewTotalUsd = listing && quantityKg && usdToCdf
    ? Math.round(((listing.pricePerKgCdf * Number(quantityKg)) / usdToCdf) * 100) / 100
    : null;

  const quantityValid = listing && typeof quantityKg === "number" && quantityKg > 0 && quantityKg <= listing.quantityKg;

  async function submit() {
    if (!farmerId || !merchantId || !listingId || !quantityValid) return;
    const result = await create.mutateAsync({
      clientRequestId,
      farmerId, merchantId, listingId,
      quantityKg: Number(quantityKg),
      consentMethod,
      consentAt: new Date().toISOString(),
      note: note.trim() || undefined,
    });
    navigate(`/admin/partner-invoices/${result.invoiceId}`);
  }

  return (
    <section className="page">
      <button onClick={() => navigate("/admin/partner-invoices")} className="text-sm text-blue-600 mb-4">← Factures</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Factures partenaires</div>
          <h1 className="page-title">Créer une facture avec assistance</h1>
          <p className="page-copy">Créez une facture au nom d'un agriculteur qui vous a donné son accord.</p>
        </div>
      </div>

      <div className="hint-box" style={{ marginBottom: 16 }}>
        L'agriculteur restera l'émetteur de la facture. Votre intervention sera enregistrée.
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
              <div className="section-header"><h3>1. Sélectionner l'agriculteur</h3></div>
              <PersonPicker people={farmers} isLoading={farmersLoading} selected={farmerId} onSelect={setFarmerId} placeholder="Rechercher par nom ou téléphone" />
            </>
          )}
          {step === 2 && (
            <>
              <div className="section-header"><h3>2. Sélectionner le commerçant</h3></div>
              <PersonPicker people={merchants} isLoading={merchantsLoading} selected={merchantId} onSelect={setMerchantId} placeholder="Rechercher par nom ou téléphone" />
            </>
          )}
          {step === 3 && (
            <>
              <div className="section-header"><h3>3. Sélectionner l'annonce</h3></div>
              <ListingPicker
                listings={listings}
                isLoading={listingsLoading}
                selected={listingId}
                onSelect={(id) => { setListingId(id); setQuantityKg(""); }}
              />
              {listing && (
                <div style={{ marginTop: 16 }}>
                  <label className="form-label" htmlFor="quantity">Quantité (kg, max {listing.quantityKg})</label>
                  <input
                    id="quantity"
                    type="number"
                    min={1}
                    max={listing.quantityKg}
                    value={quantityKg}
                    onChange={(e) => setQuantityKg(e.target.value === "" ? "" : Number(e.target.value))}
                    className="form-input"
                  />
                </div>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <div className="section-header"><h3>4. Montants</h3></div>
              <dl className="space-y-0">
                <div className="flex justify-between border-b border-gray-50 py-2">
                  <dt className="text-[13px] text-gray-500">Sous-total ({quantityKg} kg × {listing?.pricePerKgCdf.toLocaleString("fr-FR")} CDF)</dt>
                  <dd className="text-[13px] font-semibold">{listing && quantityKg ? (listing.pricePerKgCdf * Number(quantityKg)).toLocaleString("fr-FR") : "—"} CDF</dd>
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
              <div className="section-header"><h3>5. Accord de l'agriculteur</h3></div>
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
                Je confirme avoir reçu l'accord de l'agriculteur <span className="pill status-pending">Requis</span>
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
                disabled={(step === 1 && !farmerId) || (step === 2 && !merchantId) || (step === 3 && !quantityValid)}
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
              <dt className="text-[12px] text-gray-500">Agriculteur (émetteur)</dt>
              <dd className="text-[13px] font-semibold">{farmer?.fullName ?? "À sélectionner"}</dd>
            </div>
            <div className="py-2 border-b border-gray-50">
              <dt className="text-[12px] text-gray-500">Commerçant (acheteur)</dt>
              <dd className="text-[13px] font-semibold">{merchant?.fullName ?? "À sélectionner"}</dd>
            </div>
            <div className="py-2 border-b border-gray-50">
              <dt className="text-[12px] text-gray-500">Annonce</dt>
              <dd className="text-[13px] font-semibold">{listing ? `${listing.commodity} · ${quantityKg || "—"} kg` : "À sélectionner"}</dd>
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
    </section>
  );
}
