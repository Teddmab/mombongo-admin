import { Fragment, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Download, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Send, Loader2, FileDown, Headset,
  ShieldAlert, ShieldCheck, RefreshCw, Wallet, CheckCircle2, Hourglass, Scale, Search, X,
} from "lucide-react";
import {
  useTransactions, useTransactionDetail, useResendPartnerNotification,
  useResolveReconciliationException, useCreateSupportTicket, useSupportTickets, useRunReconciliationCheck,
  downloadReceipt, LEDGER_PAGE_SIZE,
  type TransactionRow, type TxDirection,
} from "@/hooks/useTransactions";
import { STATUS_LABEL, STATUS_PILL, STATUS_FILTER_GROUPS, formatAmount, maskPhone } from "@/lib/transactionDisplay";

type Segment = "all" | "in" | "out" | "exception";
type PeriodKey = "" | "today" | "7d" | "month" | "prev_month" | "custom";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "", label: "Toutes les dates" },
  { key: "today", label: "Aujourd'hui" },
  { key: "7d", label: "7 derniers jours" },
  { key: "month", label: "Ce mois" },
  { key: "prev_month", label: "Mois précédent" },
  { key: "custom", label: "Période personnalisée" },
];

function fmtDateTime(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";
}
function fmtTime(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
}
function toDate(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000) : null;
}
function isToday(ts?: { seconds: number } | null) {
  const d = toDate(ts);
  if (!d) return false;
  return d.toDateString() === new Date().toDateString();
}
function isYesterday(ts?: { seconds: number } | null) {
  const d = toDate(ts);
  if (!d) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString();
}
function isThisMonth(ts?: { seconds: number } | null) {
  const d = toDate(ts);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function isWithinLastDays(ts: { seconds: number } | null | undefined, days: number) {
  const d = toDate(ts);
  if (!d) return false;
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return d >= from;
}
function isPrevMonth(ts?: { seconds: number } | null) {
  const d = toDate(ts);
  if (!d) return false;
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
}
function dateGroupLabel(ts?: { seconds: number } | null) {
  const d = toDate(ts);
  if (!d) return "Date inconnue";
  const dateStr = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  if (isToday(ts)) return `Aujourd'hui • ${dateStr}`;
  if (isYesterday(ts)) return `Hier • ${dateStr}`;
  return dateStr;
}
function isInPeriod(ts: { seconds: number } | null | undefined, period: PeriodKey, from: string, to: string) {
  if (!period) return true;
  if (!ts) return false;
  if (period === "today") return isToday(ts);
  if (period === "7d") return isWithinLastDays(ts, 7);
  if (period === "month") return isThisMonth(ts);
  if (period === "prev_month") return isPrevMonth(ts);
  if (period === "custom") {
    if (!from && !to) return true;
    const d = toDate(ts)!;
    if (from && d < new Date(`${from}T00:00:00`)) return false;
    if (to && d > new Date(`${to}T23:59:59`)) return false;
    return true;
  }
  return true;
}

function DirectionIcon({ row }: { row: TransactionRow }) {
  if (row.reconciliationStatus === "exception") return <Scale size={16} color="hsl(32 92% 30%)" />;
  if (row.status === "pending" || row.status === "processing") return <Hourglass size={16} color="hsl(32 92% 30%)" />;
  if (row.direction === "in") return <ArrowDownLeft size={16} color="#15803d" />;
  if (row.direction === "out") return <ArrowUpRight size={16} color="#b91c1c" />;
  return <ArrowLeftRight size={16} color="#6b7280" />;
}

function signedAmount(row: TransactionRow) {
  const formatted = formatAmount(row.amount, row.currency);
  if (row.direction === "in") return { text: `+${formatted}`, color: "#15803d" };
  if (row.direction === "out") return { text: `−${formatted}`, color: "#b91c1c" };
  return { text: formatted, color: "#374151" };
}

function downloadCsv(rows: TransactionRow[], options: { maskPersonalData: boolean }) {
  const headers = ["Référence", "Type", "Participant", "Téléphone", "Montant", "Devise", "Statut", "Date"];
  const lines = rows.map((r) =>
    [
      r.reference,
      r.label,
      r.participantName,
      options.maskPersonalData ? (maskPhone(r.phone) ?? "—") : (r.phone ?? "—"),
      r.amount,
      r.currency,
      STATUS_LABEL[r.status] ?? r.status,
      fmtDateTime(r.createdAt),
    ]
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

/* ─── Export dialog ───────────────────────────────────────────────────────── */

function ExportDialog({ rows, onClose }: { rows: TransactionRow[]; onClose: () => void }) {
  const [maskPersonalData, setMaskPersonalData] = useState(true);
  const [includeFailedAttempts, setIncludeFailedAttempts] = useState(true);

  const scoped = includeFailedAttempts ? rows : rows.filter((r) => r.source === "ledger");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 16 }}>
      <div className="panel" style={{ width: "100%", maxWidth: 420 }}>
        <div className="section-header">
          <h3>Exporter les transactions</h3>
          <button type="button" onClick={onClose} className="button-outline" style={{ height: 28, width: 28, padding: 0, justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="muted">
            {scoped.length} transaction{scoped.length !== 1 ? "s" : ""} seront exportées, selon les filtres actuellement appliqués à la liste.
          </p>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={maskPersonalData} onChange={(e) => setMaskPersonalData(e.target.checked)} />
            Masquer les numéros de téléphone
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={includeFailedAttempts} onChange={(e) => setIncludeFailedAttempts(e.target.checked)} />
            Inclure les tentatives en cours / échouées
          </label>
          <p className="muted" style={{ fontSize: 11 }}>Format : CSV. L'export reflète les filtres actifs et les données déjà chargées dans cette session.</p>
          <div className="button-row" style={{ marginTop: 4 }}>
            <button
              className="btn-primary"
              style={{ height: 36 }}
              onClick={() => {
                downloadCsv(scoped, { maskPersonalData });
                onClose();
              }}
            >
              <Download size={14} /> Télécharger le CSV
            </button>
            <button onClick={onClose} className="button-outline">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Transactions list ───────────────────────────────────────────────────── */

export function AdminTransactions() {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(LEDGER_PAGE_SIZE);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useTransactions(pageSize);
  const all = useMemo(() => data?.rows ?? [], [data]);
  const runReconciliation = useRunReconciliationCheck();

  const [segment, setSegment] = useState<Segment>("all");
  const [methodFilter, setMethodFilter] = useState("");
  const [statusGroupKey, setStatusGroupKey] = useState("");
  const [periodKey, setPeriodKey] = useState<PeriodKey>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [openFilter, setOpenFilter] = useState<"period" | "method" | "status" | null>(null);

  const methods = useMemo(() => Array.from(new Set(all.map((r) => r.method).filter((m): m is string => !!m))), [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = search.replace(/\D/g, "");
    const statusGroup = STATUS_FILTER_GROUPS.find((g) => g.key === statusGroupKey);
    return all
      .filter((r) => segment === "all" || (segment === "exception" ? r.reconciliationStatus === "exception" : r.direction === segment))
      .filter((r) => !methodFilter || r.method === methodFilter)
      .filter((r) => !statusGroup || statusGroup.matches(r.status))
      .filter((r) => isInPeriod(r.createdAt, periodKey, customFrom, customTo))
      .filter((r) => {
        if (!q) return true;
        if (r.participantName.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q)) return true;
        if (qDigits.length >= 3 && r.phone) return r.phone.replace(/\D/g, "").includes(qDigits);
        return false;
      });
  }, [all, segment, methodFilter, statusGroupKey, periodKey, customFrom, customTo, search]);

  const activeFilterCount = [methodFilter, statusGroupKey, periodKey].filter(Boolean).length;

  const stats = useMemo(() => {
    const thisMonthLedger = all.filter((r) => r.source === "ledger" && isThisMonth(r.createdAt));
    const volumeUsd = thisMonthLedger.filter((r) => r.status === "completed" && r.currency === "USD").reduce((s, r) => s + r.amount, 0);
    return {
      volumeUsd,
      completed: thisMonthLedger.filter((r) => r.status === "completed").length,
      pending: all.filter((r) => r.status === "pending" || r.status === "processing").length,
      exceptions: all.filter((r) => r.reconciliationStatus === "exception").length,
    };
  }, [all]);

  const todaySummary = useMemo(() => {
    const today = all.filter((r) => r.source === "ledger" && r.status === "completed" && isToday(r.createdAt));
    const byCurrency = (dir: TxDirection) => {
      const map = new Map<string, { amount: number; count: number }>();
      today.filter((r) => r.direction === dir).forEach((r) => {
        const cur = map.get(r.currency) ?? { amount: 0, count: 0 };
        cur.amount += r.amount;
        cur.count += 1;
        map.set(r.currency, cur);
      });
      return Array.from(map.entries()).map(([currency, v]) => ({ currency, ...v }));
    };
    const feeRows = all.filter((r) => r.feeUsd != null && isThisMonth(r.createdAt));
    return {
      in: byCurrency("in"),
      out: byCurrency("out"),
      feeTotalUsd: feeRows.reduce((s, r) => s + (r.feeUsd ?? 0), 0),
      feeCount: feeRows.length,
      count: today.length,
    };
  }, [all]);

  function clearFilters() {
    setSegment("all");
    setMethodFilter("");
    setStatusGroupKey("");
    setPeriodKey("");
    setCustomFrom("");
    setCustomTo("");
    setSearch("");
  }

  // Date-group the already-sorted (desc by createdAt) filtered rows.
  const groups: { label: string; rows: TransactionRow[] }[] = [];
  for (const row of filtered) {
    const label = dateGroupLabel(row.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Finance</div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-copy">Suivez les mouvements d'argent et les paiements.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExport(true)} className="button-outline" style={{ height: 44 }}>
            <Download size={14} /> Exporter
          </button>
          <button onClick={() => refetch()} disabled={isFetching} className="button-outline" style={{ height: 44 }}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : undefined} /> Actualiser
          </button>
        </div>
      </div>

      {showExport && <ExportDialog rows={filtered} onClose={() => setShowExport(false)} />}

      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 280px" }}>
        <div>
          <div className="stats-grid">
            <div className="metric-card">
              <div className="metric-icon tone-green"><Wallet size={16} /></div>
              <p className="section-kicker">Volume ce mois</p>
              <p className="metric-value">{formatAmount(stats.volumeUsd, "USD")}</p>
            </div>
            <button
              type="button"
              className={`metric-card clickable ${statusGroupKey === "completed" ? "active" : ""}`}
              onClick={() => { setSegment("all"); setStatusGroupKey(statusGroupKey === "completed" ? "" : "completed"); }}
            >
              <div className="metric-icon tone-green"><CheckCircle2 size={16} /></div>
              <p className="section-kicker">Réussies</p>
              <p className="metric-value">{stats.completed}</p>
              <p className="muted" style={{ marginTop: 4 }}>Transactions réussies</p>
            </button>
            <button
              type="button"
              className={`metric-card clickable ${statusGroupKey === "pending" ? "active" : ""}`}
              onClick={() => { setSegment("all"); setStatusGroupKey(statusGroupKey === "pending" ? "" : "pending"); }}
            >
              <div className="metric-icon tone-amber"><Hourglass size={16} /></div>
              <p className="section-kicker">En cours</p>
              <p className="metric-value">{stats.pending}</p>
              <p className="muted" style={{ marginTop: 4 }}>En attente de confirmation</p>
            </button>
            <button
              type="button"
              className={`metric-card clickable ${segment === "exception" ? "active" : ""}`}
              onClick={() => { setStatusGroupKey(""); setSegment(segment === "exception" ? "all" : "exception"); }}
            >
              <div className="metric-icon tone-amber"><Scale size={16} /></div>
              <p className="section-kicker">À rapprocher</p>
              <p className="metric-value" style={{ color: stats.exceptions > 0 ? "hsl(var(--danger))" : undefined }}>{stats.exceptions}</p>
              <p className="muted" style={{ marginTop: 4 }}>Nécessitent votre attention</p>
            </button>
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
            <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 260 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--gray-400))" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, référence ou téléphone"
                className="form-input"
                style={{ paddingLeft: 30 }}
                aria-label="Rechercher une transaction"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Effacer la recherche"
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--gray-400))" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 10 }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => setOpenFilter(openFilter === "period" ? null : "period")} className={`button-outline ${periodKey ? "active" : ""}`}>
                Période{periodKey ? `: ${PERIOD_OPTIONS.find((p) => p.key === periodKey)?.label}` : ""}
              </button>
              {openFilter === "period" && (
                <div className="panel" style={{ position: "absolute", top: 40, left: 0, zIndex: 20, padding: 10, minWidth: 220 }}>
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.key || "all"}
                      className="select-row"
                      style={{ marginBottom: 4, padding: "8px 10px" }}
                      onClick={() => { setPeriodKey(opt.key); if (opt.key !== "custom") setOpenFilter(null); }}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {periodKey === "custom" && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <input type="date" className="form-input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="Du" />
                      <input type="date" className="form-input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="Au" />
                    </div>
                  )}
                </div>
              )}
            </div>

            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="form-select" style={{ width: "auto" }} aria-label="Filtrer par méthode">
              <option value="">Toutes les méthodes</option>
              {methods.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
            </select>
            <select value={statusGroupKey} onChange={(e) => setStatusGroupKey(e.target.value)} className="form-select" style={{ width: "auto" }} aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {STATUS_FILTER_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="button-outline">Effacer les filtres ({activeFilterCount})</button>
            )}
          </div>

          <article className="panel" style={{ marginTop: 12 }}>
            {error ? (
              <div role="alert" style={{ padding: 32, textAlign: "center" }}>
                <p className="error-text">Impossible de charger les transactions.</p>
                <button onClick={() => refetch()} className="button-outline" style={{ marginTop: 12 }}>Réessayer</button>
              </div>
            ) : isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : all.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <p className="font-semibold">Aucune transaction</p>
                <p className="muted" style={{ marginTop: 4 }}>Les mouvements d'argent apparaîtront ici lorsqu'ils seront enregistrés.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <p className="font-semibold">Aucune transaction ne correspond à vos filtres.</p>
                <button onClick={clearFilters} className="button-outline" style={{ marginTop: 12 }}>Effacer les filtres</button>
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
                    {groups.map((group) => (
                      <Fragment key={group.label}>
                        <tr>
                          <td colSpan={7} style={{ background: "hsl(var(--gray-50))", fontSize: 11, fontWeight: 700, color: "hsl(var(--gray-500))", textTransform: "uppercase", letterSpacing: "0.04em", padding: "8px 16px" }}>
                            {group.label}
                          </td>
                        </tr>
                        {group.rows.map((row) => {
                          const signed = signedAmount(row);
                          const isException = row.reconciliationStatus === "exception";
                          return (
                            <tr
                              key={row.id}
                              onClick={() => navigate(`/admin/transactions/${row.id}`)}
                              className={isException ? "attention-row" : undefined}
                              style={{ cursor: "pointer" }}
                            >
                              <td><DirectionIcon row={row} /></td>
                              <td>
                                <div className="font-semibold">{row.label} — {row.participantName}{row.secondaryParticipantName ? ` → ${row.secondaryParticipantName}` : ""}</div>
                                <div style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>
                                  <span style={{ fontFamily: "monospace" }}>Réf. {row.reference.slice(0, 12)}</span>
                                  {maskPhone(row.phone) && <span> • {maskPhone(row.phone)}</span>}
                                </div>
                              </td>
                              <td style={{ fontSize: 13 }}>{row.method ? row.method.replace(/_/g, " ") : "—"}{row.operator ? ` · ${row.operator}` : ""}</td>
                              <td style={{ fontSize: 12 }}>{fmtTime(row.createdAt)}</td>
                              <td style={{ fontVariantNumeric: "tabular-nums", color: signed.color, fontWeight: 600 }}>{signed.text}</td>
                              <td>
                                <span className={`pill ${STATUS_PILL[row.status] ?? ""}`}>
                                  {isException ? "À vérifier" : (STATUS_LABEL[row.status] ?? row.status)}
                                </span>
                              </td>
                              <td>{isException && <span className="pill status-blocked">Examiner</span>}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: 16, textAlign: "center", borderTop: "1px solid hsl(var(--gray-100))" }}>
                  {data?.hasMore ? (
                    <button onClick={() => setPageSize((s) => s + LEDGER_PAGE_SIZE)} disabled={isFetching} className="button-outline">
                      {isFetching ? <Loader2 size={14} className="animate-spin" /> : null} Charger plus de transactions
                    </button>
                  ) : (
                    <p className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={14} color="hsl(var(--green-700))" /> Chargement terminé
                    </p>
                  )}
                </div>
              </div>
            )}
          </article>
        </div>

        <aside className="panel">
          <div className="section-header"><h3>Résumé du jour</h3></div>
          <p className="muted" style={{ marginBottom: 12 }}>
            Dernière mise à jour : {dataUpdatedAt ? fmtTime({ seconds: Math.floor(dataUpdatedAt / 1000) }) : "—"}
          </p>

          <div className="metric-card" style={{ marginBottom: 8 }}>
            <p className="section-kicker">Total entrant</p>
            {todaySummary.in.length === 0 ? (
              <p className="metric-value" style={{ color: "#15803d", fontSize: 20 }}>+{formatAmount(0, "USD")}</p>
            ) : todaySummary.in.map((c) => (
              <p key={c.currency} className="metric-value" style={{ color: "#15803d", fontSize: 20 }}>+{formatAmount(c.amount, c.currency)}</p>
            ))}
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              {todaySummary.in.reduce((s, c) => s + c.count, 0)} transaction{todaySummary.in.reduce((s, c) => s + c.count, 0) !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="metric-card" style={{ marginBottom: 8 }}>
            <p className="section-kicker">Total sortant</p>
            {todaySummary.out.length === 0 ? (
              <p className="metric-value" style={{ color: "#b91c1c", fontSize: 20 }}>−{formatAmount(0, "USD")}</p>
            ) : todaySummary.out.map((c) => (
              <p key={c.currency} className="metric-value" style={{ color: "#b91c1c", fontSize: 20 }}>−{formatAmount(c.amount, c.currency)}</p>
            ))}
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              {todaySummary.out.reduce((s, c) => s + c.count, 0)} transaction{todaySummary.out.reduce((s, c) => s + c.count, 0) !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="metric-card" style={{ marginBottom: 8 }}>
            <p className="section-kicker">Frais (ce mois)</p>
            <p className="metric-value" style={{ fontSize: 20 }}>
              {todaySummary.feeCount > 0 ? formatAmount(todaySummary.feeTotalUsd, "USD") : "non communiqué"}
            </p>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              {todaySummary.feeCount} transaction{todaySummary.feeCount !== 1 ? "s" : ""} avec frais opérateur connus
            </p>
          </div>

          <div className="metric-card">
            <p className="section-kicker">État de rapprochement</p>
            {stats.exceptions > 0 ? (
              <>
                <p className="pill status-blocked" style={{ display: "inline-flex", marginTop: 4 }}><ShieldAlert size={12} /> Attention requise</p>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{stats.exceptions} transaction{stats.exceptions !== 1 ? "s" : ""} à vérifier</p>
              </>
            ) : (
              <>
                <p className="pill status-active" style={{ display: "inline-flex", marginTop: 4 }}><ShieldCheck size={12} /> Tout est rapproché</p>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Aucune transaction ne nécessite votre attention.</p>
              </>
            )}
            <button
              onClick={() => runReconciliation.mutate()}
              disabled={runReconciliation.isPending}
              className="button-outline"
              style={{ marginTop: 10, width: "100%" }}
            >
              {runReconciliation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Relancer la vérification"}
            </button>
            <button
              onClick={() => { setStatusGroupKey(""); setSegment("exception"); }}
              className="btn-primary"
              style={{ marginTop: 8, width: "100%", height: 36 }}
            >
              Voir le rapport complet
            </button>
          </div>
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
  const isAttempt = tx.source !== "ledger";
  const maskedPhone = maskPhone(tx.phone);

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
          {!isAttempt && (
            <button onClick={() => downloadReceipt(tx)} className="button-outline">
              <FileDown size={14} /> Télécharger le reçu
            </button>
          )}
        </div>
      </div>

      {(tx.status === "pending" || tx.status === "processing") && (
        <div className="panel" style={{ padding: 16, marginBottom: 16, background: "hsl(var(--amber-50))", border: "1px solid hsl(var(--amber-100))" }}>
          <p className="text-[13px]" style={{ fontWeight: 600 }}>La confirmation du paiement prend plus de temps que prévu si ce statut persiste.</p>
          <p className="muted" style={{ marginTop: 4 }}>Ne lancez pas un deuxième paiement avant vérification — ce mouvement d'argent est encore suivi par l'opérateur.</p>
        </div>
      )}

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header"><h3>Détails du paiement</h3></div>
          <dl className="space-y-0">
            {([
              ["Référence", tx.reference],
              ["Type", tx.label],
              ["Méthode", tx.method ? `${tx.method.replace(/_/g, " ")}${tx.operator ? " · " + tx.operator : ""}` : "—"],
              ...(maskedPhone ? ([["Téléphone", maskedPhone]] as [string, string][]) : []),
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
