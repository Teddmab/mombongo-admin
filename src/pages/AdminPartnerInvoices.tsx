import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RotateCw, Plus, Search, X, Clock, CheckCircle2, AlertTriangle, Wallet } from "lucide-react";
import { formatUsd } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import {
  usePartnerInvoices, usePartnerInvoiceDetail, useFailedNotifications, useRetryPartnerNotification,
  ORIGIN_LABEL, CONSENT_LABEL, type InvoiceOrigin, type PartnerInvoiceRow, type PartnerInvoiceDetail,
} from "@/hooks/usePartnerInvoices";

const STATUS_OPTIONS = ["pending", "checkout_created", "paid", "failed"] as const;

type Tab = "all" | "pending" | "paid" | "failed";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "paid", label: "Payées" },
  { key: "failed", label: "Échouées" },
];

function tabFilter(row: PartnerInvoiceRow, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "pending") return row.status === "pending" || row.status === "checkout_created";
  return row.status === tab;
}

function isThisMonth(ts: { seconds: number } | null): boolean {
  if (!ts) return false;
  const d = new Date(ts.seconds * 1000);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

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
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"" | "month">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const kpis = useMemo(() => ({
    pendingCount: all.filter((r) => r.status === "pending" || r.status === "checkout_created").length,
    pendingAmountUsd: all.filter((r) => r.status === "pending" || r.status === "checkout_created").reduce((s, r) => s + r.amountUsd, 0),
    paidThisMonth: all.filter((r) => r.status === "paid" && isThisMonth(r.paidAt ?? r.createdAt)).length,
    failedCount: all.filter((r) => r.status === "failed").length,
  }), [all]);

  const q = search.trim().toLowerCase();
  const rows = all
    .filter((r) => tabFilter(r, tab))
    .filter((r) => !originFilter || r.origin === originFilter)
    .filter((r) => !statusFilter || r.status === statusFilter)
    .filter((r) => !periodFilter || isThisMonth(r.createdAt))
    .filter((r) => !q
      || r.farmerNames.some((n) => n.toLowerCase().includes(q))
      || (r.merchantName ?? "").toLowerCase().includes(q)
      || r.id.toLowerCase().includes(q));

  function resetFilters() {
    setSearch(""); setOriginFilter(""); setStatusFilter(""); setPeriodFilter(""); setTab("all");
  }
  const hasActiveFilters = !!search || !!originFilter || !!statusFilter || !!periodFilter || tab !== "all";

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Partenaires</div>
          <h1 className="page-title">Factures partenaires</h1>
          <p className="page-copy">Suivez les factures des agriculteurs et leur paiement.</p>
        </div>
        <button onClick={() => navigate("/admin/partner-invoices/new")} className="btn-primary" style={{ height: 36 }}>
          <Plus size={14} /> Créer une facture
        </button>
      </div>

      <div className="stats-grid">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <p className="section-kicker">En attente de paiement</p>
            <Clock size={16} className="muted" />
          </div>
          <p className="metric-value">{kpis.pendingCount}</p>
          <button onClick={() => setTab("pending")} className="muted" style={{ fontSize: 12, color: "hsl(var(--green-700))", fontWeight: 600 }}>Voir la liste →</button>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <p className="section-kicker">Montant en attente</p>
            <Wallet size={16} className="muted" />
          </div>
          <p className="metric-value" style={{ fontSize: 22 }}>{formatUsd(kpis.pendingAmountUsd)}</p>
          <p className="muted">Toutes factures non payées</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <p className="section-kicker">Payées ce mois</p>
            <CheckCircle2 size={16} className="muted" />
          </div>
          <p className="metric-value">{kpis.paidThisMonth}</p>
          <button onClick={() => setTab("paid")} className="muted" style={{ fontSize: 12, color: "hsl(var(--green-700))", fontWeight: 600 }}>Voir le rapport →</button>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <p className="section-kicker">Échouées</p>
            <AlertTriangle size={16} className="muted" />
          </div>
          <p className="metric-value">{kpis.failedCount}</p>
          <button onClick={() => setTab("failed")} className="muted" style={{ fontSize: 12, color: "hsl(var(--green-700))", fontWeight: 600 }}>Voir la liste →</button>
        </div>
      </div>

      <div className="panel-grid" style={{ gridTemplateColumns: selectedId ? "1fr 380px" : "1fr" }}>
        <article className="panel">
          <div className="section-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
            <div className="flex gap-1.5" role="tablist" aria-label="Statut">
              {TABS.map((t) => (
                <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`button-outline ${tab === t.key ? "active" : ""}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--gray-400))" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Agriculteur, commerçant ou numéro"
                  className="form-input"
                  style={{ paddingLeft: 34, width: "100%" }}
                  aria-label="Rechercher une facture"
                />
              </div>
              <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as "" | "month")} className="form-select" aria-label="Période">
                <option value="">Toute période</option>
                <option value="month">Ce mois</option>
              </select>
              <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} className="form-select" aria-label="Origine">
                <option value="">Toutes les origines</option>
                {(Object.keys(ORIGIN_LABEL) as InvoiceOrigin[]).map((o) => <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select" aria-label="Statut détaillé">
                <option value="">Tous les statuts</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="button-outline">Réinitialiser</button>
              )}
            </div>
          </div>

          {error ? (
            <p role="alert" className="error-text" style={{ padding: 20 }}>Impossible de charger les factures. Réessayez plus tard.</p>
          ) : isLoading ? (
            <div className="space-y-2 p-4">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Agriculteur</th>
                    <th>Commerçant</th>
                    <th>Origine</th>
                    <th>Montant</th>
                    <th>Créée le</th>
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      style={{ cursor: "pointer", background: selectedId === row.id ? "hsl(var(--green-50))" : undefined }}
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.farmerNames[0] ?? row.partnerId ?? "?"} url={row.farmerAvatarUrl} size={28} />
                          <div>
                            {row.farmerNames.length > 0 ? row.farmerNames.join(", ") : (row.partnerId ?? "—")}
                            {row.isCooperative && <span className="pill" style={{ marginLeft: 6 }}>Coopérative</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {row.merchantName ? (
                          <div className="flex items-center gap-2.5">
                            <Avatar name={row.merchantName} url={row.merchantAvatarUrl} size={28} />
                            {row.merchantName}
                          </div>
                        ) : "—"}
                      </td>
                      <td><span className="pill">{ORIGIN_LABEL[row.origin]}</span></td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(row.amountUsd)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(row.createdAt)}</td>
                      <td><span className={`pill ${statusPillClass(row.status)}`}>{row.status.replace(/_/g, " ")}</span></td>
                      <td><span className="text-xs text-blue-600">Détails</span></td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "hsl(var(--gray-500))", padding: 32 }}>
                        Aucune facture ne correspond aux filtres actuels.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {selectedId && (
          <InvoiceDetailPanel
            id={selectedId}
            onClose={() => setSelectedId(null)}
            onOpenFullPage={() => navigate(`/admin/partner-invoices/${selectedId}`)}
          />
        )}
      </div>

      <FailedNotificationsSection />
    </section>
  );
}

/* ─── Detail panel content (shared between the list's side panel and the standalone page) ─ */

function InvoiceDetailFields({ invoice }: { invoice: PartnerInvoiceDetail }) {
  const fields: [string, string][] = [
    ["Origine", ORIGIN_LABEL[invoice.origin]],
    ...(invoice.partnerId ? [["Partenaire", invoice.partnerId] as [string, string]] : []),
    ["ID facture", invoice.externalInvoiceId],
    ["Référence", invoice.reference || "—"],
    ["Devise", invoice.currency],
    ["Mode test", invoice.testMode ? "Oui" : "Non"],
    ["Méthode de paiement", invoice.method?.replace(/_/g, " ") || "—"],
    ["Référence prestataire", invoice.providerRef || "—"],
    ["Créée le", fmtDate(invoice.createdAt)],
    ["Payée le", fmtDate(invoice.paidAt)],
    ["Échouée le", fmtDate(invoice.failedAt)],
  ];
  return (
    <dl className="space-y-0">
      {fields.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-gray-50 py-2.5 last:border-0">
          <dt className="text-[13px] text-gray-500">{k}</dt>
          <dd className="text-[13px] font-semibold text-gray-900 capitalize text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function InvoiceDetailPanel({ id, onClose, onOpenFullPage }: { id: string; onClose: () => void; onOpenFullPage: () => void }) {
  const { data: invoice, isLoading, error } = usePartnerInvoiceDetail(id);

  if (isLoading) return <aside className="panel" style={{ padding: 20 }}><div className="h-48 bg-gray-100 rounded-xl animate-pulse" /></aside>;
  if (error || !invoice) return <aside className="panel" style={{ padding: 20 }}><p role="alert" className="error-text">Impossible de charger cette facture.</p></aside>;

  return (
    <aside className="panel" aria-label={`Facture ${invoice.id}`}>
      <div className="flex items-start justify-between" style={{ padding: 20, paddingBottom: 0 }}>
        <div>
          <p className="section-kicker" style={{ fontFamily: "monospace" }}>{invoice.id.slice(0, 12)}</p>
          <div className="flex gap-1.5" style={{ marginTop: 6 }}>
            <span className={`pill ${statusPillClass(invoice.status)}`}>{invoice.status.replace(/_/g, " ")}</span>
            <span className="pill">{ORIGIN_LABEL[invoice.origin]}</span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="button-outline" style={{ height: 32, width: 32, padding: 0, justifyContent: "center" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 20 }}>
        <p className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Parties</p>
        {invoice.farmerNames.map((name, i) => (
          <div key={i} className="flex items-center gap-2.5" style={{ marginBottom: 8 }}>
            <Avatar name={name} url={i === 0 ? invoice.farmerAvatarUrl : null} />
            <div>
              <p className="font-semibold text-sm">{name}</p>
              <p className="muted" style={{ fontSize: 11 }}>Agriculteur{invoice.isCooperative ? " (coopérative)" : ""}</p>
            </div>
          </div>
        ))}
        {invoice.merchantName && (
          <div className="flex items-center gap-2.5">
            <Avatar name={invoice.merchantName} url={invoice.merchantAvatarUrl} />
            <div>
              <p className="font-semibold text-sm">{invoice.merchantName}</p>
              <p className="muted" style={{ fontSize: 11 }}>Commerçant</p>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "0 20px 20px" }}>
        <div className="flex justify-between border-t border-gray-100 pt-3" style={{ marginBottom: 4 }}>
          <span className="text-[13px] text-gray-500">Total</span>
          <span className="font-bold text-[16px]">{formatUsd(invoice.amountUsd)}</span>
        </div>
      </div>

      <div style={{ padding: "0 20px 20px" }}>
        <InvoiceDetailFields invoice={invoice} />
      </div>

      {invoice.adminAssisted && (
        <div style={{ padding: "0 20px 20px" }}>
          <p className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Trace d'assistance admin</p>
          <dl className="space-y-0">
            {([
              ["Créée par", invoice.adminAssisted.actorName],
              ["Méthode d'accord", CONSENT_LABEL[invoice.adminAssisted.consentMethod] ?? invoice.adminAssisted.consentMethod],
              ["Accord obtenu le", fmtDate(invoice.adminAssisted.consentAt)],
              ["Note", invoice.adminAssisted.note || "—"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2 last:border-0">
                <dt className="text-[12px] text-gray-500">{k}</dt>
                <dd className="text-[12px] font-semibold text-gray-900 text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div style={{ padding: "0 20px 20px" }}>
        <button onClick={onOpenFullPage} className="button-outline" style={{ width: "100%", justifyContent: "center" }}>
          Voir la page complète
        </button>
      </div>
    </aside>
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

/* ─── Standalone detail page (direct links, e.g. from a merchant profile) ─ */

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
          <div className="section-header"><h3>Parties</h3></div>
          <div style={{ padding: "0 20px 20px" }}>
            {invoice.farmerNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2.5" style={{ marginBottom: 10 }}>
                <Avatar name={name} url={i === 0 ? invoice.farmerAvatarUrl : null} />
                <div>
                  <p className="font-semibold text-sm">{name}</p>
                  <p className="muted" style={{ fontSize: 11 }}>Agriculteur{invoice.isCooperative ? " (coopérative)" : ""}</p>
                </div>
              </div>
            ))}
            {invoice.merchantName && (
              <div className="flex items-center gap-2.5">
                <Avatar name={invoice.merchantName} url={invoice.merchantAvatarUrl} />
                <div>
                  <p className="font-semibold text-sm">{invoice.merchantName}</p>
                  <p className="muted" style={{ fontSize: 11 }}>Commerçant</p>
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-[13px] text-gray-500">Total</span>
              <span className="font-bold text-[16px]">{formatUsd(invoice.amountUsd)}</span>
            </div>
          </div>
          <div className="section-header"><h3>Détails</h3></div>
          <div style={{ padding: "0 20px 20px" }}>
            <InvoiceDetailFields invoice={invoice} />
          </div>
        </article>

        {invoice.adminAssisted && (
          <article className="panel">
            <div className="section-header"><h3>Trace d'assistance admin</h3></div>
            <div style={{ padding: "0 20px 20px" }}>
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
            </div>
          </article>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Pour la sécurité des données, les factures ne peuvent pas être marquées comme payées manuellement.
      </p>
    </section>
  );
}
