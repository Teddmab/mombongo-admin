import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Send, Loader2, FileDown, Headset, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  useTransactions, useTransactionDetail, useResendPartnerNotification,
  useResolveReconciliationException, useCreateSupportTicket, useSupportTickets, downloadReceipt,
  type TransactionRow, type TxDirection,
} from "@/hooks/useTransactions";
import { STATUS_LABEL, STATUS_PILL, formatAmount } from "@/lib/transactionDisplay";

type Segment = "all" | "in" | "out" | "exception";

function fmtDateTime(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";
}
function fmtTime(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
}
function isToday(ts?: { seconds: number } | null) {
  if (!ts) return false;
  const d = new Date(ts.seconds * 1000);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}
function isThisMonth(ts?: { seconds: number } | null) {
  if (!ts) return false;
  const d = new Date(ts.seconds * 1000);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function DirectionIcon({ direction }: { direction: TxDirection }) {
  if (direction === "in") return <ArrowDownLeft size={16} color="#15803d" />;
  if (direction === "out") return <ArrowUpRight size={16} color="#b91c1c" />;
  return <ArrowLeftRight size={16} color="#6b7280" />;
}

function signedAmount(row: TransactionRow) {
  const formatted = formatAmount(row.amount, row.currency);
  if (row.direction === "in") return { text: `+${formatted}`, color: "#15803d" };
  if (row.direction === "out") return { text: `−${formatted}`, color: "#b91c1c" };
  return { text: formatted, color: "#374151" };
}

function downloadCsv(rows: TransactionRow[]) {
  const headers = ["Référence", "Type", "Participant", "Montant", "Devise", "Statut", "Date"];
  const lines = rows.map((r) =>
    [r.reference, r.label, r.participantName, r.amount, r.currency, STATUS_LABEL[r.status] ?? r.status, fmtDateTime(r.createdAt)]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Transactions list ───────────────────────────────────────────────────── */

export function AdminTransactions() {
  const navigate = useNavigate();
  const { data: all = [], isLoading, error } = useTransactions();
  const [segment, setSegment] = useState<Segment>("all");
  const [methodFilter, setMethodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const methods = useMemo(() => Array.from(new Set(all.map((r) => r.method).filter((m): m is string => !!m))), [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((r) => segment === "all" || (segment === "exception" ? r.reconciliationStatus === "exception" : r.direction === segment))
      .filter((r) => !methodFilter || r.method === methodFilter)
      .filter((r) => !statusFilter || r.status === statusFilter)
      .filter((r) => !q || r.participantName.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q));
  }, [all, segment, methodFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const thisMonth = all.filter((r) => isThisMonth(r.createdAt));
    const volumeUsd = thisMonth.filter((r) => r.currency === "USD").reduce((s, r) => s + r.amount, 0);
    return {
      volumeUsd,
      completed: thisMonth.filter((r) => r.status === "completed").length,
      pending: all.filter((r) => r.status === "pending").length,
      failed: all.filter((r) => r.status === "failed").length,
      exceptions: all.filter((r) => r.reconciliationStatus === "exception").length,
    };
  }, [all]);

  const todaySummary = useMemo(() => {
    const today = all.filter((r) => isToday(r.createdAt));
    const inUsd = today.filter((r) => r.direction === "in" && r.currency === "USD").reduce((s, r) => s + r.amount, 0);
    const outUsd = today.filter((r) => r.direction === "out" && r.currency === "USD").reduce((s, r) => s + r.amount, 0);
    return { inUsd, outUsd, count: today.length };
  }, [all]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Finance</div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-copy">Suivez les mouvements d'argent et les paiements.</p>
        </div>
        <button onClick={() => downloadCsv(filtered)} className="button">
          <Download size={14} /> Exporter
        </button>
      </div>

      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 280px" }}>
        <div>
          <div className="stats-grid">
            <div className="metric-card">
              <p className="section-kicker">Volume ce mois (USD)</p>
              <p className="metric-value">{formatAmount(stats.volumeUsd, "USD")}</p>
            </div>
            <div className="metric-card">
              <p className="section-kicker">Réussies ce mois</p>
              <p className="metric-value">{stats.completed}</p>
            </div>
            <div className="metric-card">
              <p className="section-kicker">En cours</p>
              <p className="metric-value">{stats.pending}</p>
            </div>
            <div className="metric-card">
              <p className="section-kicker">Échouées</p>
              <p className="metric-value">{stats.failed}</p>
            </div>
            <div className="metric-card">
              <p className="section-kicker">À rapprocher</p>
              <p className="metric-value" style={{ color: stats.exceptions > 0 ? "hsl(var(--danger))" : undefined }}>{stats.exceptions}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 16 }}>
            <div className="flex gap-1.5" role="tablist">
              {([["all", "Toutes"], ["in", "Entrées"], ["out", "Sorties"], ["exception", "À rapprocher"]] as [Segment, string][]).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={segment === key}
                  onClick={() => setSegment(key)}
                  className={`button-outline ${segment === key ? "active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou référence"
              className="form-input"
              style={{ maxWidth: 220 }}
              aria-label="Rechercher une transaction"
            />
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="form-select" aria-label="Filtrer par méthode">
              <option value="">Toutes les méthodes</option>
              {methods.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-select" aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <article className="panel" style={{ marginTop: 12 }}>
            {error ? (
              <p role="alert" className="error-text" style={{ padding: 24 }}>Impossible de charger les transactions. Réessayez plus tard.</p>
            ) : isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Transaction</th>
                      <th>Méthode</th>
                      <th>Heure</th>
                      <th>Montant</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const signed = signedAmount(row);
                      return (
                        <tr key={row.id} onClick={() => navigate(`/admin/transactions/${row.id}`)} style={{ cursor: "pointer" }}>
                          <td><DirectionIcon direction={row.direction} /></td>
                          <td>
                            <div className="font-semibold">{row.label} — {row.participantName}{row.secondaryParticipantName ? ` → ${row.secondaryParticipantName}` : ""}</div>
                            <div style={{ fontSize: 12, color: "hsl(var(--gray-500))", fontFamily: "monospace" }}>{row.reference.slice(0, 16)}</div>
                          </td>
                          <td style={{ fontSize: 13 }}>{row.method ? row.method.replace(/_/g, " ") : "—"}{row.operator ? ` · ${row.operator}` : ""}</td>
                          <td style={{ fontSize: 12 }}>{fmtTime(row.createdAt)}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums", color: signed.color, fontWeight: 600 }}>{signed.text}</td>
                          <td><span className={`pill ${STATUS_PILL[row.status] ?? ""}`}>{STATUS_LABEL[row.status] ?? row.status}</span></td>
                          <td>{row.reconciliationStatus === "exception" && <span className="pill status-blocked">Examiner</span>}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "hsl(var(--gray-500))", padding: 32 }}>
                          Aucune transaction ne correspond aux filtres actuels.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>

        <aside className="panel">
          <div className="section-header"><h3>Résumé du jour</h3></div>
          <div className="metric-card" style={{ marginBottom: 8 }}>
            <p className="section-kicker">Total entrant</p>
            <p className="metric-value" style={{ color: "#15803d" }}>+{formatAmount(todaySummary.inUsd, "USD")}</p>
          </div>
          <div className="metric-card" style={{ marginBottom: 8 }}>
            <p className="section-kicker">Total sortant</p>
            <p className="metric-value" style={{ color: "#b91c1c" }}>−{formatAmount(todaySummary.outUsd, "USD")}</p>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>{todaySummary.count} transaction{todaySummary.count !== 1 ? "s" : ""} aujourd'hui</p>
        </aside>
      </div>
    </section>
  );
}

/* ─── Transaction detail ─────────────────────────────────────────────────── */

export function AdminTransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tx, isLoading, error } = useTransactionDetail(id);
  const resend = useResendPartnerNotification();
  const resolveException = useResolveReconciliationException();
  const [resolutionNote, setResolutionNote] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);
  const { data: tickets = [] } = useSupportTickets(id);
  const createTicket = useCreateSupportTicket();
  const [ticketDescription, setTicketDescription] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);

  if (isLoading) {
    return <section className="page"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></section>;
  }
  if (error) {
    return <section className="page"><p role="alert" className="error-text text-center py-20">Impossible de charger cette transaction.</p></section>;
  }
  if (!tx) {
    return <section className="page"><p className="text-center text-gray-400 py-20">Transaction introuvable</p></section>;
  }

  const signed = signedAmount(tx);

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">{tx.label}</div>
          <h1 className="page-title" style={{ color: signed.color }}>{signed.text}</h1>
          <p className="page-copy">{tx.participantName}{tx.secondaryParticipantName ? ` → ${tx.secondaryParticipantName}` : ""} · {fmtDateTime(tx.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`pill ${STATUS_PILL[tx.status] ?? ""}`}>{STATUS_LABEL[tx.status] ?? tx.status}</span>
          <button onClick={() => downloadReceipt(tx)} className="button-outline">
            <FileDown size={14} /> Télécharger le reçu
          </button>
        </div>
      </div>

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header"><h3>Détails du paiement</h3></div>
          <dl className="space-y-0">
            {([
              ["Référence", tx.reference],
              ["Type", tx.label],
              ["Méthode", tx.method ? `${tx.method.replace(/_/g, " ")}${tx.operator ? " · " + tx.operator : ""}` : "—"],
              ["Devise", tx.currency],
              ["Frais opérateur", tx.feeUsd != null ? formatAmount(tx.feeUsd, tx.currency) : "non communiqué"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500">{k}</dt>
                <dd className="text-[13px] font-semibold text-gray-900" style={{ fontFamily: k === "Référence" ? "monospace" : undefined }}>{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="panel">
          <div className="section-header"><h3>Progression</h3></div>
          {tx.timeline.length === 0 ? (
            <p className="muted text-sm">Aucun évènement enregistré pour cette transaction.</p>
          ) : (
            <ul className="space-y-0">
              {tx.timeline.map((step, i) => (
                <li key={i} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600">{step.label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(step.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        {tx.type === "external_invoice_payment" && (
          <article className="panel">
            <div className="section-header"><h3>Notification partenaire</h3></div>
            {tx.notificationStatus === "not_applicable" ? (
              <p className="muted text-sm">Sans objet.</p>
            ) : tx.notificationStatus === "sent" ? (
              <p className="pill status-active" style={{ display: "inline-block" }}>Aucun échec enregistré</p>
            ) : (
              <>
                <p className="pill status-blocked" style={{ display: "inline-block", marginBottom: 8 }}>Échec de notification</p>
                {tx.notificationFailureReason && <p className="muted text-sm">{tx.notificationFailureReason}</p>}
              </>
            )}
            {tx.externalInvoiceDocId && (
              <button
                onClick={() => resend.mutate(tx.externalInvoiceDocId!)}
                disabled={resend.isPending}
                className="button"
                style={{ marginTop: 12 }}
              >
                {resend.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Renvoyer la notification
              </button>
            )}
            {resend.isSuccess && <p className="muted text-sm" style={{ marginTop: 8 }}>Notification renvoyée.</p>}
            {resend.isError && <p role="alert" className="error-text text-sm" style={{ marginTop: 8 }}>Échec de l'envoi.</p>}
          </article>
        )}

        <article className="panel">
          <div className="section-header"><h3>Rapprochement</h3></div>
          {tx.reconciliationStatus === "unchecked" ? (
            <p className="muted text-sm">Pas encore vérifié — le contrôle automatique passe toutes les 6 heures.</p>
          ) : tx.reconciliationStatus === "not_applicable" ? (
            <p className="muted text-sm">Sans objet pour ce type de transaction — aucune source secondaire à comparer.</p>
          ) : tx.reconciliationStatus === "matched" ? (
            <p className="pill status-active" style={{ display: "inline-block" }}>
              <ShieldCheck size={12} /> Rapproché automatiquement
            </p>
          ) : tx.reconciliationStatus === "resolved_manually" ? (
            <>
              <p className="pill status-active" style={{ display: "inline-block", marginBottom: 8 }}>Résolu manuellement</p>
              <p className="muted text-sm">Par {tx.reconciliationResolvedByName} — {tx.reconciliationResolutionNote}</p>
            </>
          ) : (
            <>
              <p className="pill status-blocked" style={{ display: "inline-block", marginBottom: 8 }}>
                <ShieldAlert size={12} /> Exception détectée
              </p>
              {tx.reconciliationNote && <p className="muted text-sm" style={{ marginBottom: 12 }}>{tx.reconciliationNote}</p>}
              {showResolveForm ? (
                <div>
                  <label className="form-label" htmlFor="resolution-note">Note de résolution</label>
                  <textarea id="resolution-note" className="form-textarea" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} rows={2} />
                  <div className="button-row" style={{ marginTop: 8 }}>
                    <button
                      onClick={() => resolveException.mutate({ transactionId: tx.id, note: resolutionNote }, { onSuccess: () => setShowResolveForm(false) })}
                      disabled={resolveException.isPending || !resolutionNote.trim()}
                      className="btn-primary"
                      style={{ height: 36 }}
                    >
                      {resolveException.isPending ? <Loader2 size={14} className="animate-spin" /> : "Confirmer"}
                    </button>
                    <button onClick={() => setShowResolveForm(false)} className="button-outline">Annuler</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowResolveForm(true)} className="button-outline">Examiner</button>
              )}
              {resolveException.isError && <p role="alert" className="error-text text-sm" style={{ marginTop: 8 }}>Échec de la résolution.</p>}
            </>
          )}
        </article>

        <article className="panel">
          <div className="section-header"><h3>Support</h3></div>
          {tickets.length > 0 && (
            <ul className="space-y-0" style={{ marginBottom: 12 }}>
              {tickets.map((t) => (
                <li key={t.id} className="text-sm py-2 border-b border-gray-50 last:border-0">
                  <p>{t.description}</p>
                  <p className="muted" style={{ fontSize: 11 }}>{t.createdByName} · {fmtDateTime(t.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          {showTicketForm ? (
            <div>
              <label className="form-label" htmlFor="ticket-description">Décrire le problème</label>
              <textarea id="ticket-description" className="form-textarea" value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} rows={3} />
              <div className="button-row" style={{ marginTop: 8 }}>
                <button
                  onClick={() => createTicket.mutate(
                    { transactionId: tx.id, description: ticketDescription },
                    { onSuccess: () => { setShowTicketForm(false); setTicketDescription(""); } },
                  )}
                  disabled={createTicket.isPending || !ticketDescription.trim()}
                  className="btn-primary"
                  style={{ height: 36 }}
                >
                  {createTicket.isPending ? <Loader2 size={14} className="animate-spin" /> : "Ouvrir le dossier"}
                </button>
                <button onClick={() => setShowTicketForm(false)} className="button-outline">Annuler</button>
              </div>
              {createTicket.isError && <p role="alert" className="error-text text-sm" style={{ marginTop: 8 }}>Échec de la création.</p>}
            </div>
          ) : (
            <button onClick={() => setShowTicketForm(true)} className="button-outline">
              <Headset size={14} /> Ouvrir un dossier de support
            </button>
          )}
        </article>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Pour la sécurité des données, les paiements ne peuvent pas être marqués comme payés manuellement.
      </p>
    </section>
  );
}
