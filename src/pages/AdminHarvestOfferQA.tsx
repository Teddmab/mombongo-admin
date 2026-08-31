import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { FlaskConical } from "lucide-react";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

/**
 * QA-only harness for Sprint DP (direct harvest purchase) — NOT the real
 * farmer/merchant UI, which is SDP-06/07 and hasn't been built yet. Calls
 * the real onCall functions exactly as a real user would, using your own
 * admin account as both the "farmer" (owns the test listing) and the
 * "merchant" (makes the offer) — that's fine for exercising the actual
 * validation/transaction logic (createHarvestOfferCore, selectHarvestOffer),
 * it just can't test the farmer-vs-merchant permission boundary, which is
 * already covered by unit tests in mombongo-functions.
 */

const createProductListingFn = httpsCallable<Record<string, unknown>, { listingId: string }>(
  functions,
  "createProductListing",
);
const createHarvestOfferFn = httpsCallable<Record<string, unknown>, { offerId: string }>(
  functions,
  "createHarvestOffer",
);
const getListingOffersFn = httpsCallable<{ listingId: string }, { offers: HarvestOffer[] }>(
  functions,
  "getListingOffers",
);
const selectHarvestOfferFn = httpsCallable<{ offerId: string }, { invoiceId: string }>(
  functions,
  "selectHarvestOffer",
);

interface HarvestOffer {
  id: string;
  merchantId: string;
  offerQuantityKg: number;
  offerPricePerKgCdf: number;
  status: "pending" | "accepted" | "declined";
  source: "app" | "api";
}

interface InvoiceDoc {
  origin: string;
  amountUsd: number;
  currency: string;
  status: string;
  farmerId: string;
  merchantId: string;
  listingId: string;
  offerId: string;
}

type StepStatus = "idle" | "loading" | "err";

export function AdminHarvestOfferQA() {
  const { user } = useAuth();

  const [listingId, setListingId] = useState<string | null>(null);
  const [listingStatus, setListingStatus] = useState<StepStatus>("idle");
  const [listingError, setListingError] = useState<string | null>(null);

  const [offerQuantityKg, setOfferQuantityKg] = useState("50");
  const [offerPricePerKgCdf, setOfferPricePerKgCdf] = useState("550");
  const [offerStatus, setOfferStatus] = useState<StepStatus>("idle");
  const [offerError, setOfferError] = useState<string | null>(null);

  const [offers, setOffers] = useState<HarvestOffer[] | null>(null);
  const [offersStatus, setOffersStatus] = useState<StepStatus>("idle");
  const [offersError, setOffersError] = useState<string | null>(null);

  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDoc | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  async function handleCreateListing() {
    setListingStatus("loading");
    setListingError(null);
    setOffers(null);
    setInvoice(null);
    try {
      const now = new Date();
      const later = new Date(now.getTime() + 30 * 86_400_000);
      const res = await createProductListingFn({
        commodity: "Manioc (test QA)",
        quantityKg: 100,
        quality: "A",
        province: "Kinshasa",
        territory: "",
        pricePerKgCdf: 500,
        availableFrom: now.toISOString(),
        availableUntil: later.toISOString(),
        description: `Listing de test créé par la QA harness DHP le ${now.toLocaleString("fr-FR")}`,
      });
      setListingId(res.data.listingId);
      setListingStatus("idle");
    } catch (e: unknown) {
      setListingStatus("err");
      setListingError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  async function handleCreateOffer() {
    if (!listingId) return;
    setOfferStatus("loading");
    setOfferError(null);
    try {
      await createHarvestOfferFn({
        listingId,
        offerQuantityKg: Number(offerQuantityKg),
        offerPricePerKgCdf: Number(offerPricePerKgCdf),
        message: "Offre de test QA",
      });
      setOfferStatus("idle");
      await handleRefreshOffers();
    } catch (e: unknown) {
      setOfferStatus("err");
      setOfferError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  async function handleRefreshOffers() {
    if (!listingId) return;
    setOffersStatus("loading");
    setOffersError(null);
    try {
      const res = await getListingOffersFn({ listingId });
      setOffers(res.data.offers);
      setOffersStatus("idle");
    } catch (e: unknown) {
      setOffersStatus("err");
      setOffersError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  async function handleSelectOffer(offerId: string) {
    setSelectingId(offerId);
    setSelectError(null);
    setInvoice(null);
    try {
      const res = await selectHarvestOfferFn({ offerId });
      const snap = await getDoc(doc(db, "external_invoices", res.data.invoiceId));
      if (snap.exists()) setInvoice(snap.data() as InvoiceDoc);
      await handleRefreshOffers();
    } catch (e: unknown) {
      setSelectError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Sprint DP — QA</div>
          <h1 className="page-title">Test harness : offres récolte</h1>
          <p className="page-copy">
            Pas l'interface finale (SDP-06/07, pas encore construite) — appelle les vraies fonctions
            (createHarvestOffer, getListingOffers, selectHarvestOffer) avec votre compte admin jouant
            à la fois le fermier et le marchand, pour vérifier que le pipeline fonctionne réellement.
          </p>
        </div>
        <FlaskConical size={18} className="text-gray-300" />
      </div>

      <article className="panel">
        <div className="section-header">
          <div>
            <div className="section-kicker">Étape 1</div>
            <p className="card-title">Créer un listing de test (vous = fermier)</p>
          </div>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn-primary" style={{ height: 38, alignSelf: "flex-start" }} disabled={listingStatus === "loading"} onClick={handleCreateListing}>
            {listingStatus === "loading" ? "Création…" : listingId ? "Créer un nouveau listing" : "Créer le listing"}
          </button>
          {listingStatus === "err" && listingError && <p style={{ fontSize: 13, color: "hsl(var(--danger))" }}>{listingError}</p>}
          {listingId && (
            <p style={{ fontSize: 12, fontFamily: "monospace", color: "var(--color-muted)" }}>
              listingId: {listingId} (sellerId = {user?.uid})
            </p>
          )}
        </div>
      </article>

      {listingId && (
        <article className="panel" style={{ marginTop: 16 }}>
          <div className="section-header">
            <div>
              <div className="section-kicker">Étape 2</div>
              <p className="card-title">Faire une offre de test (vous = marchand)</p>
            </div>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span style={{ color: "var(--color-muted)" }}>Quantité (kg)</span>
              <input value={offerQuantityKg} onChange={(e) => setOfferQuantityKg(e.target.value)} className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white w-full" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span style={{ color: "var(--color-muted)" }}>Prix par kg (CDF)</span>
              <input value={offerPricePerKgCdf} onChange={(e) => setOfferPricePerKgCdf(e.target.value)} className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white w-full" />
            </label>
            <button className="btn-primary" style={{ height: 38, alignSelf: "flex-start" }} disabled={offerStatus === "loading"} onClick={handleCreateOffer}>
              {offerStatus === "loading" ? "Envoi…" : "Faire l'offre"}
            </button>
            {offerStatus === "err" && offerError && <p style={{ fontSize: 13, color: "hsl(var(--danger))" }}>{offerError}</p>}
          </div>
        </article>
      )}

      {listingId && (
        <article className="panel" style={{ marginTop: 16 }}>
          <div className="section-header">
            <div>
              <div className="section-kicker">Étape 3</div>
              <p className="card-title">Offres sur ce listing (vous = fermier qui consulte)</p>
            </div>
            <button onClick={handleRefreshOffers} disabled={offersStatus === "loading"} className="text-xs text-blue-600 hover:underline">
              {offersStatus === "loading" ? "…" : "Actualiser"}
            </button>
          </div>
          {offersStatus === "err" && offersError && (
            <p style={{ padding: 20, fontSize: 13, color: "hsl(var(--danger))" }}>{offersError}</p>
          )}
          {offers && (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID offre</th>
                    <th>Quantité (kg)</th>
                    <th>Prix/kg (CDF)</th>
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{o.id}</td>
                      <td>{o.offerQuantityKg}</td>
                      <td>{o.offerPricePerKgCdf}</td>
                      <td>
                        <span className={`pill ${o.status === "pending" ? "" : o.status === "accepted" ? "status-active" : "status-blocked"}`}>
                          {o.status}
                        </span>
                      </td>
                      <td>
                        {o.status === "pending" && (
                          <button
                            className="text-xs text-blue-600 hover:underline"
                            disabled={selectingId === o.id}
                            onClick={() => handleSelectOffer(o.id)}
                          >
                            {selectingId === o.id ? "…" : "Sélectionner cette offre"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {offers.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--color-muted)", padding: 24 }}>
                        Aucune offre — faites-en une à l'étape 2, puis actualisez.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      {selectError && (
        <p style={{ marginTop: 16, fontSize: 13, color: "hsl(var(--danger))" }}>{selectError}</p>
      )}

      {invoice && (
        <article className="panel" style={{ marginTop: 16, maxWidth: 480 }}>
          <div className="section-header">
            <div>
              <div className="section-kicker">Résultat</div>
              <p className="card-title">Facture créée (external_invoices)</p>
            </div>
          </div>
          <dl style={{ padding: 20 }}>
            {(
              [
                ["Origine", invoice.origin],
                ["Montant USD", String(invoice.amountUsd)],
                ["Devise", invoice.currency],
                ["Statut", invoice.status],
                ["farmerId", invoice.farmerId],
                ["merchantId", invoice.merchantId],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2 last:border-0">
                <dt className="text-sm text-gray-500">{k}</dt>
                <dd className="text-sm font-semibold text-gray-900" style={{ fontFamily: k.endsWith("Id") ? "monospace" : undefined, fontSize: k.endsWith("Id") ? 12 : undefined }}>{v}</dd>
              </div>
            ))}
          </dl>
        </article>
      )}
    </section>
  );
}
