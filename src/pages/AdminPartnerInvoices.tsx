import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { collection, getDocs, doc, getDoc, query, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { RotateCw } from "lucide-react";
import { db, functions } from "@/lib/firebase";
import { formatUsd } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface InvoiceRow {
  id: string;
  origin?: "partner_api" | "harvest_sale";
  partnerId: string | null;
  externalInvoiceId: string;
  amountUsd: number;
  currency?: string;
  method?: string;
  status: string;
  reference?: string | null;
  providerRef?: string;
  testMode?: boolean;
  createdAt?: { seconds: number };
  checkoutCreatedAt?: { seconds: number };
  paidAt?: { seconds: number };
  failedAt?: { seconds: number };
  notifiedAt?: { seconds: number };
  invoiceIssuedNotifiedAt?: { seconds: number };
  // harvest_sale only (SDP-02/04)
  farmerId?: string;
  listingId?: string;
  offerId?: string;
  merchantId?: string;
}

interface FailedNotificationRow {
  id: string;
  invoiceId: string;
  partnerId: string;
  kind?: "payment_complete" | "invoice_issued";
  error: string;
  failedAt?: { seconds: number };
}

const STATUS_OPTIONS = ["pending", "checkout_created", "paid", "failed"] as const;

const adminRetryPartnerNotificationFn = httpsCallable<
  { invoiceId: string; kind?: "payment_complete" | "invoice_issued" },
  { success: true }
>(functions, "adminRetryPartnerNotification");

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function statusPillClass(status: string) {
  if (status === "paid") return "status-active";
  if (status === "failed") return "status-blocked";
  return "status-pending";
}

function originLabel(origin?: string) {
  return origin === "harvest_sale" ? "Vente récolte" : "Partenaire API";
}

function originPillClass(origin?: string) {
  return origin === "harvest_sale" ? "status-active" : "";
}

/* ─── List ──────────────────────────────────────────────────────────────── */

export function AdminPartnerInvoices() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [partnerFilter, setPartnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: all = [], isLoading, error } = useQuery({
    queryKey: ["admin-partner-invoices"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "external_invoices"), orderBy("createdAt", "desc"), limit(50)),
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InvoiceRow);
    },
  });

  const partners = Array.from(new Set(all.map((r) => r.partnerId))).sort();

  const rows = all.filter((r) => {
    if (partnerFilter && r.partnerId !== partnerFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Partenaires</div>
          <h1 className="page-title">Factures</h1>
          <p className="page-copy">{all.length} facture{all.length !== 1 ? "s" : ""} · {rows.length} affichées</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={partnerFilter}
            onChange={(e) => setPartnerFilter(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">Tous les partenaires</option>
            {partners.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>

      <article className="panel">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : error ? (
          <p style={{ padding: 20, fontSize: 13, color: "hsl(var(--danger))" }}>
            Impossible de charger les factures : {error instanceof Error ? error.message : "erreur inconnue"}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Origine</th>
                  <th>Partenaire</th>
                  <th>Facture (ID partenaire)</th>
                  <th>Montant</th>
                  <th>Méthode</th>
                  <th>Créée le</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={`pill ${originPillClass(row.origin)}`}>{originLabel(row.origin)}</span>
                    </td>
                    <td>{row.partnerId || "—"}{row.testMode && <span className="pill" style={{ marginLeft: 6 }}>test</span>}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--color-muted)" }}>
                      {row.externalInvoiceId}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(row.amountUsd)}</td>
                    <td className="capitalize">{row.method?.replace(/_/g, " ") || "—"}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(row.createdAt)}</td>
                    <td>
                      <span className={`pill ${statusPillClass(row.status)}`}>{row.status}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/admin/partner-invoices/${row.id}`)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "var(--color-muted)", padding: "32px" }}>
                      Aucune facture trouvée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <FailedNotificationsSection onRetried={() => qc.invalidateQueries({ queryKey: ["admin-partner-invoices"] })} />
    </section>
  );
}

/* ─── Failed outbound notifications (SAI-04) ───────────────────────────── */

function FailedNotificationsSection({ onRetried }: { onRetried: () => void }) {
  const qc = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: failures = [], isLoading, error: queryError } = useQuery({
    queryKey: ["admin-partner-notification-failures"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "outbound_notification_failures"), orderBy("failedAt", "desc"), limit(50)),
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FailedNotificationRow);
    },
  });

  const retry = async (row: FailedNotificationRow) => {
    setRetryingId(row.id);
    setError(null);
    try {
      // kind is undefined for a pre-SDP-04 failure doc — the Cloud
      // Function defaults that to 'payment_complete', matching what it
      // always meant before this field existed.
      await adminRetryPartnerNotificationFn({ invoiceId: row.invoiceId, kind: row.kind });
      await qc.invalidateQueries({ queryKey: ["admin-partner-notification-failures"] });
      onRetried();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setRetryingId(null);
    }
  };

  if (!isLoading && !queryError && failures.length === 0) return null;

  return (
    <article className="panel" style={{ marginTop: 24 }}>
      <div className="section-header">
        <div>
          <div className="section-kicker">Notifications sortantes</div>
          <h2 className="card-title">Notifications échouées</h2>
        </div>
      </div>
      {queryError ? (
        <p style={{ padding: 20, fontSize: 13, color: "hsl(var(--danger))" }}>
          Impossible de charger les notifications échouées : {queryError instanceof Error ? queryError.message : "erreur inconnue"}
        </p>
      ) : (
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Facture</th>
              <th>Partenaire</th>
              <th>Type</th>
              <th>Erreur</th>
              <th>Échec le</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {failures.map((row) => (
              <tr key={row.id}>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{row.invoiceId}</td>
                <td>{row.partnerId}</td>
                <td>
                  <span className="pill">{row.kind === "invoice_issued" ? "Facture émise" : "Paiement complété"}</span>
                </td>
                <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.error}
                </td>
                <td style={{ fontSize: 12 }}>{fmtDate(row.failedAt)}</td>
                <td>
                  <button
                    onClick={() => retry(row)}
                    disabled={retryingId === row.id}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
                  >
                    <RotateCw size={12} className={retryingId === row.id ? "animate-spin" : ""} />
                    {retryingId === row.id ? "Nouvel essai…" : "Réessayer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {error && <p className="text-sm text-red-600 p-4">{error}</p>}
    </article>
  );
}

/* ─── Detail ────────────────────────────────────────────────────────────── */

export function AdminPartnerInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["admin-partner-invoice", id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "external_invoices", id!));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as InvoiceRow;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <section className="page">
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </section>
    );
  }
  if (!invoice) {
    return (
      <section className="page">
        <p className="text-center text-gray-400 py-20">Facture introuvable</p>
      </section>
    );
  }

  const isHarvestSale = invoice.origin === "harvest_sale";

  // Full lifecycle, in order: intake → checkout → payment/failure → notification.
  const fields: [string, string][] = [
    ["Partenaire", invoice.partnerId || "—"],
    ["ID facture partenaire", invoice.externalInvoiceId],
    ["Référence", invoice.reference || "—"],
    ["Montant", formatUsd(invoice.amountUsd)],
    ["Devise", invoice.currency || "USD"],
    ["Mode test", invoice.testMode ? "Oui" : "Non"],
    ["Statut", invoice.status],
    ["Méthode de paiement", invoice.method?.replace(/_/g, " ") || "—"],
    ["Référence prestataire", invoice.providerRef || "—"],
    ["Créée le", fmtDate(invoice.createdAt)],
    ["Checkout créé le", fmtDate(invoice.checkoutCreatedAt)],
    ["Payée le", fmtDate(invoice.paidAt)],
    ["Échouée le", fmtDate(invoice.failedAt)],
    ["Partenaire notifié le", fmtDate(invoice.notifiedAt)],
  ];

  const harvestSaleFields: [string, string][] = [
    ["Agriculteur", invoice.farmerId || "—"],
    ["Marchand", invoice.merchantId || "—"],
    ["Facture émise, notifiée le", fmtDate(invoice.invoiceIssuedNotifiedAt)],
  ];

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Facture</div>
          <h1 className="page-title" style={{ fontFamily: "monospace", fontSize: 18 }}>{invoice.id}</h1>
        </div>
        <div className="flex gap-2">
          <span className={`pill ${originPillClass(invoice.origin)}`}>{originLabel(invoice.origin)}</span>
          <span className={`pill ${statusPillClass(invoice.status)}`}>{invoice.status}</span>
        </div>
      </div>

      <article className="panel" style={{ maxWidth: 560 }}>
        <dl>
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-gray-50 py-2.5 last:border-0">
              <dt className="text-sm text-gray-500">{k}</dt>
              <dd className="text-sm font-semibold text-gray-900 capitalize">{v}</dd>
            </div>
          ))}
        </dl>
      </article>

      {isHarvestSale && (
        <article className="panel" style={{ maxWidth: 560, marginTop: 16 }}>
          <div className="section-header">
            <div>
              <div className="section-kicker">Vente récolte</div>
              <p className="card-title">Contexte agriculteur / offre / marchand</p>
            </div>
          </div>
          <dl style={{ padding: 20 }}>
            {harvestSaleFields.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2.5 last:border-0">
                <dt className="text-sm text-gray-500">{k}</dt>
                <dd className="text-sm font-semibold text-gray-900" style={{ fontFamily: "monospace", fontSize: 12 }}>{v}</dd>
              </div>
            ))}
            {invoice.listingId && invoice.offerId && (
              <div className="flex justify-between py-2.5">
                <dt className="text-sm text-gray-500">Voir l'historique des offres</dt>
                <dd>
                  <button onClick={() => navigate(`/admin/harvest-offers?listingId=${invoice.listingId}`)} className="text-xs text-blue-600 hover:underline">
                    Ouvrir
                  </button>
                </dd>
              </div>
            )}
          </dl>
        </article>
      )}
    </section>
  );
}
