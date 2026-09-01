import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RotateCw, Plus } from "lucide-react";
import { formatUsd } from "@/lib/utils";
import {
  usePartnerInvoices, usePartnerInvoiceDetail, useFailedNotifications, useRetryPartnerNotification,
  ORIGIN_LABEL, CONSENT_LABEL, type InvoiceOrigin,
} from "@/hooks/usePartnerInvoices";

const STATUS_OPTIONS = ["pending", "checkout_created", "paid", "failed"] as const;

function fmtDate(ts?: { seconds: number } | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function statusPillClass(status: string) {
  if (status === "paid") return "status-active";
  if (status === "failed") return "status-blocked";
  return "status-pending";
}

/* ─── List ──────────────────────────────────────────────────────────────── */

export function AdminPartnerInvoices() {
  const navigate = useNavigate();
  const { data: all = [], isLoading, error } = usePartnerInvoices();
  const [originFilter, setOriginFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const rows = all
    .filter((r) => !originFilter || r.origin === originFilter)
    .filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Partenaires</div>
          <h1 className="page-title">Factures partenaires</h1>
          <p className="page-copy">{all.length} facture{all.length !== 1 ? "s" : ""} · {rows.length} affichées</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} className="form-select">
            <option value="">Toutes les origines</option>
            {(Object.keys(ORIGIN_LABEL) as InvoiceOrigin[]).map((o) => <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select">
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <button onClick={() => navigate("/admin/partner-invoices/new")} className="btn-primary">
            <Plus size={14} /> Créer une facture
          </button>
        </div>
      </div>

      <article className="panel">
        {error ? (
          <p role="alert" className="error-text" style={{ padding: 20 }}>Impossible de charger les factures. Réessayez plus tard.</p>
        ) : isLoading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Origine</th>
                  <th>Agriculteur / Partenaire</th>
                  <th>Commerçant</th>
                  <th>Montant</th>
                  <th>Créée le</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} onClick={() => navigate(`/admin/partner-invoices/${row.id}`)} style={{ cursor: "pointer" }}>
                    <td>
                      <span className="pill">{ORIGIN_LABEL[row.origin]}</span>
                    </td>
                    <td>{row.farmerName ?? row.partnerId ?? "—"}</td>
                    <td>{row.merchantName ?? "—"}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(row.amountUsd)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(row.createdAt)}</td>
                    <td><span className={`pill ${statusPillClass(row.status)}`}>{row.status.replace(/_/g, " ")}</span></td>
                    <td><span className="text-xs text-blue-600">Détails</span></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--color-muted)", padding: 32 }}>
                      Aucune facture ne correspond aux filtres actuels.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <FailedNotificationsSection />
    </section>
  );
}

/* ─── Failed outbound notifications (SAI-04) ───────────────────────────── */

function FailedNotificationsSection() {
  const { data: failures = [], isLoading, error: queryError } = useFailedNotifications();
  const retry = useRetryPartnerNotification();
  const [retryingId, setRetryingId] = useState<string | null>(null);

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
        <p role="alert" className="error-text" style={{ padding: 20 }}>Impossible de charger les notifications échouées.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>Facture</th><th>Partenaire</th><th>Erreur</th><th>Échec le</th><th></th></tr>
            </thead>
            <tbody>
              {failures.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{row.invoiceId}</td>
                  <td>{row.partnerId}</td>
                  <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.error}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(row.failedAt)}</td>
                  <td>
                    <button
                      onClick={() => { setRetryingId(row.id); retry.mutate(row.invoiceId, { onSettled: () => setRetryingId(null) }); }}
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
    </article>
  );
}

/* ─── Detail ────────────────────────────────────────────────────────────── */

export function AdminPartnerInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading, error } = usePartnerInvoiceDetail(id);

  if (isLoading) {
    return <section className="page"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></section>;
  }
  if (error) {
    return <section className="page"><p role="alert" className="error-text text-center py-20">Impossible de charger cette facture.</p></section>;
  }
  if (!invoice) {
    return <section className="page"><p className="text-center text-gray-400 py-20">Facture introuvable</p></section>;
  }

  const fields: [string, string][] = [
    ["Origine", ORIGIN_LABEL[invoice.origin]],
    ...(invoice.partnerId ? [["Partenaire", invoice.partnerId] as [string, string]] : []),
    ...(invoice.farmerName ? [["Agriculteur", invoice.farmerName] as [string, string]] : []),
    ...(invoice.merchantName ? [["Commerçant", invoice.merchantName] as [string, string]] : []),
    ["ID facture", invoice.externalInvoiceId],
    ["Référence", invoice.reference || "—"],
    ["Montant", formatUsd(invoice.amountUsd)],
    ["Devise", invoice.currency],
    ["Mode test", invoice.testMode ? "Oui" : "Non"],
    ["Statut", invoice.status.replace(/_/g, " ")],
    ["Méthode de paiement", invoice.method?.replace(/_/g, " ") || "—"],
    ["Référence prestataire", invoice.providerRef || "—"],
    ["Créée le", fmtDate(invoice.createdAt)],
    ["Payée le", fmtDate(invoice.paidAt)],
    ["Échouée le", fmtDate(invoice.failedAt)],
  ];

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Facture partenaire</div>
          <h1 className="page-title" style={{ fontFamily: "monospace", fontSize: 18 }}>{invoice.id}</h1>
        </div>
        <div className="flex gap-2">
          <span className="pill">{ORIGIN_LABEL[invoice.origin]}</span>
          <span className={`pill ${statusPillClass(invoice.status)}`}>{invoice.status.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="panel-grid">
        <article className="panel">
          <dl>
            {fields.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2.5 last:border-0">
                <dt className="text-sm text-gray-500">{k}</dt>
                <dd className="text-sm font-semibold text-gray-900 capitalize">{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        {invoice.adminAssisted && (
          <article className="panel">
            <div className="section-header"><h3>Trace d'assistance admin</h3></div>
            <dl>
              {([
                ["Créée par", invoice.adminAssisted.actorName],
                ["Méthode d'accord", CONSENT_LABEL[invoice.adminAssisted.consentMethod] ?? invoice.adminAssisted.consentMethod],
                ["Accord obtenu le", fmtDate(invoice.adminAssisted.consentAt)],
                ["Note", invoice.adminAssisted.note || "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-gray-50 py-2.5 last:border-0">
                  <dt className="text-sm text-gray-500">{k}</dt>
                  <dd className="text-sm font-semibold text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
          </article>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Pour la sécurité des données, les factures ne peuvent pas être marquées comme payées manuellement.
      </p>
    </section>
  );
}
