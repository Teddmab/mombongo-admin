import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Download, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Send, Loader2, FileDown, Headset,
  ShieldAlert, ShieldCheck, RefreshCw, Wallet, CheckCircle2, Hourglass, Scale, Search, X,
  Smartphone, Copy, Info, ChevronDown, ChevronUp, ChevronRight, Calendar, ExternalLink, XCircle, RotateCcw,
} from "lucide-react";
import {
  useTransactions, useTransactionDetail, useResendPartnerNotification,
  useResolveReconciliationException, useCreateSupportTicket, useSupportTickets, useRunReconciliationCheck,
  downloadReceipt, LEDGER_PAGE_SIZE,
  type TransactionRow, type TransactionDetail, type TxDirection,
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
/** Full precision (with seconds) for the payment progression timeline — the list/summary views only ever need minute precision. */
function fmtDateTimeSec(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(",", " à") : "—";
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
  // Filters live in the URL (not just component state) so that navigating to a
  // transaction's detail page and back — via the browser's own history, e.g.
  // the "← Transactions" button — restores the exact same search/filter/page
  // state instead of resetting to defaults.
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageSize, setPageSize] = useState(() => {
    const fromUrl = Number(searchParams.get("pageSize"));
    return fromUrl > 0 ? fromUrl : LEDGER_PAGE_SIZE;
  });
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useTransactions(pageSize);
  const all = useMemo(() => data?.rows ?? [], [data]);
  const runReconciliation = useRunReconciliationCheck();

  const [segment, setSegment] = useState<Segment>((searchParams.get("segment") as Segment) || "all");
  const [methodFilter, setMethodFilter] = useState(searchParams.get("method") ?? "");
  const [statusGroupKey, setStatusGroupKey] = useState(searchParams.get("status") ?? "");
  const [periodKey, setPeriodKey] = useState<PeriodKey>((searchParams.get("period") as PeriodKey) || "");
  const [customFrom, setCustomFrom] = useState(searchParams.get("from") ?? "");
  const [customTo, setCustomTo] = useState(searchParams.get("to") ?? "");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [showExport, setShowExport] = useState(false);
  const [openFilter, setOpenFilter] = useState<"period" | "method" | "status" | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    if (segment !== "all") next.segment = segment;
    if (methodFilter) next.method = methodFilter;
    if (statusGroupKey) next.status = statusGroupKey;
    if (periodKey) next.period = periodKey;
    if (customFrom) next.from = customFrom;
    if (customTo) next.to = customTo;
    if (search) next.q = search;
    if (pageSize !== LEDGER_PAGE_SIZE) next.pageSize = String(pageSize);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, methodFilter, statusGroupKey, periodKey, customFrom, customTo, search, pageSize]);

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

const TIMELINE_DESCRIPTIONS: Record<string, string> = {
  "Transaction enregistrée": "La transaction a été enregistrée dans le registre Mombongo.",
  "Paiement initié": "La demande de paiement a été créée.",
  "Demande envoyée à l'opérateur": "La demande a été envoyée à l'opérateur.",
  "Envoyé à l'opérateur": "La demande a été envoyée à l'opérateur.",
  "Confirmé par l'opérateur": "L'opérateur a confirmé le paiement.",
  "Facture marquée payée": "La facture a été marquée comme payée.",
  "AROM notifié": "AROM a été notifié avec succès.",
  "Échec signalé par l'opérateur": "L'opérateur a signalé un échec du paiement.",
};

/** For a terminal (completed/failed/refunded) transaction, the last recorded timeline event is the closest real completion moment — falls back to createdAt only when no later event exists. */
function completionMoment(tx: TransactionDetail): { value: string; label: string } {
  const lastEvent = tx.timeline[tx.timeline.length - 1];
  if (tx.status === "completed") return { value: fmtDateTime(lastEvent?.at ?? tx.createdAt), label: "Date et heure du paiement" };
  if (tx.status === "failed") return { value: fmtDateTime(lastEvent?.at ?? tx.createdAt), label: "Échoué le" };
  if (tx.status === "refunded") return { value: fmtDateTime(lastEvent?.at ?? tx.createdAt), label: "Remboursé le" };
  if (tx.status === "processing") return { value: fmtDateTime(lastEvent?.at ?? tx.createdAt), label: "Envoyé le" };
  return { value: fmtDateTime(tx.createdAt), label: "Créé le" };
}

function PaymentMethodIcon({ tx }: { tx: TransactionDetail }) {
  if (tx.type.includes("refund")) return <RotateCcw size={26} color="hsl(var(--green-700))" />;
  if (tx.method === "mobile_money" || tx.source !== "ledger") return <Smartphone size={26} color="hsl(var(--green-700))" />;
  if (tx.type === "investment" || tx.type === "bourse_investment" || tx.type === "financing") return <Wallet size={26} color="hsl(var(--green-700))" />;
  return <ArrowLeftRight size={26} color="hsl(var(--green-700))" />;
}

function HeroStatusBadge({ tx }: { tx: TransactionDetail }) {
  if (tx.reconciliationStatus === "exception") {
    return <span className="pill status-blocked" style={{ fontSize: 13, padding: "6px 12px" }}><ShieldAlert size={14} /> À vérifier</span>;
  }
  if (tx.status === "completed") {
    return <span className="pill status-active" style={{ fontSize: 13, padding: "6px 12px" }}><CheckCircle2 size={14} /> Réussi</span>;
  }
  if (tx.status === "failed") {
    return <span className="pill status-blocked" style={{ fontSize: 13, padding: "6px 12px" }}><XCircle size={14} /> Échec</span>;
  }
  return <span className={`pill ${STATUS_PILL[tx.status] ?? ""}`} style={{ fontSize: 13, padding: "6px 12px" }}><Hourglass size={14} /> {STATUS_LABEL[tx.status] ?? tx.status}</span>;
}

function CopyField({ label, value, field, copiedField, onCopy, mono }: {
  label: string; value: string; field: string; copiedField: string | null; onCopy: (field: string, value: string) => void; mono?: boolean;
}) {
  return (
    <div className="border-b border-gray-50 py-2">
      <div className="flex justify-between items-center">
        <dt className="text-[13px] text-gray-500">{label}</dt>
        <div className="flex items-center gap-2">
          <dd className="text-[13px] font-semibold text-gray-900" style={{ fontFamily: mono ? "monospace" : undefined }}>{value}</dd>
          <button
            type="button"
            onClick={() => onCopy(field, value)}
            aria-label={`Copier ${label.toLowerCase()}`}
            style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--gray-400))", padding: 2 }}
          >
            <Copy size={13} />
          </button>
        </div>
      </div>
      {copiedField === field && <p style={{ fontSize: 11, color: "hsl(var(--green-700))", textAlign: "right", marginTop: 2 }}>Référence copiée</p>}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <section className="page">
      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
      <div className="h-9 w-64 bg-gray-100 rounded animate-pulse" style={{ marginTop: 12 }} />
      <div className="h-28 bg-gray-100 rounded-2xl animate-pulse" style={{ marginTop: 16 }} />
      <div className="panel-grid" style={{ marginTop: 16 }}>
        {[1, 2, 3, 4].map((n) => <div key={n} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    </section>
  );
}

export function AdminTransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tx, isLoading, error, refetch } = useTransactionDetail(id);
  const resend = useResendPartnerNotification();
  const resolveException = useResolveReconciliationException();
  const [resolutionNote, setResolutionNote] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);
  const { data: tickets = [] } = useSupportTickets(id);
  const createTicket = useCreateSupportTicket();
  const [ticketDescription, setTicketDescription] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showResendConfirm, setShowResendConfirm] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  function copy(field: string, value: string) {
    void navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 2000);
  }

  if (isLoading) return <DetailSkeleton />;
  if (error) {
    return (
      <section className="page">
        <div role="alert" style={{ textAlign: "center", padding: "60px 0" }}>
          <p className="error-text">Impossible de charger cette transaction.</p>
          <div className="button-row" style={{ justifyContent: "center", marginTop: 12 }}>
            <button onClick={() => refetch()} className="button-outline">Réessayer</button>
            <button onClick={() => navigate("/admin/transactions")} className="button-outline">Contacter l'assistance</button>
          </div>
        </div>
      </section>
    );
  }
  if (!tx) {
    return (
      <section className="page">
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p className="font-semibold">Transaction introuvable</p>
          <div className="button-row" style={{ justifyContent: "center", marginTop: 12 }}>
            <button onClick={() => navigate("/admin/transactions")} className="button-outline">Retour aux transactions</button>
            <button onClick={() => refetch()} className="button-outline">Actualiser</button>
          </div>
        </div>
      </section>
    );
  }

  const signed = signedAmount(tx);
  const isAttempt = tx.source !== "ledger";
  const maskedPhone = maskPhone(tx.phone);
  const isInvoicePayment = tx.type === "external_invoice_payment";
  const completion = completionMoment(tx);
  const hasProof = !isAttempt && (tx.status === "completed" || tx.status === "refunded");
  const alreadyNotified = tx.notificationStatus === "sent";

  return (
    <section className="page">
      <nav aria-label="Fil d'ariane" className="flex items-center gap-1.5" style={{ fontSize: 13 }}>
        <span style={{ color: "hsl(var(--green-700))", fontWeight: 600 }}>Finance</span>
        <span className="muted">/</span>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "hsl(var(--green-700))", fontWeight: 600 }}>
          Transactions
        </button>
        <span className="muted">/</span>
        <span className="muted">{tx.reference.slice(0, 20)}</span>
      </nav>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="section-kicker">{tx.label}</div>
          <h1 className="page-title">{tx.label}</h1>
          {isInvoicePayment && tx.invoiceNumber && (
            <p className="page-copy">Facture {tx.invoiceNumber} · {tx.participantName}</p>
          )}
        </div>
        <HeroStatusBadge tx={tx} />
      </div>

      {(tx.status === "pending" || tx.status === "processing") && (
        <div className="panel" style={{ padding: 16, marginBottom: 16, background: "hsl(var(--amber-50))", border: "1px solid hsl(var(--amber-100))" }}>
          <p className="text-[13px]" style={{ fontWeight: 600 }}>La confirmation peut prendre quelques minutes.</p>
          <p className="muted" style={{ marginTop: 4 }}>Ne lancez pas un deuxième paiement avant la vérification — ce mouvement d'argent est encore suivi par l'opérateur.</p>
        </div>
      )}
      {tx.status === "failed" && (
        <div className="panel" style={{ padding: 16, marginBottom: 16, background: "hsl(0 84% 97%)", border: "1px solid hsl(0 84% 90%)" }}>
          <p className="text-[13px]" style={{ fontWeight: 600 }}>Ce paiement a échoué.</p>
          <p className="muted" style={{ marginTop: 4 }}>
            {tx.notificationFailureReason ?? "Aucun détail supplémentaire n'a été communiqué par l'opérateur."} Le statut de débit du client n'est pas confirmé — n'invitez pas à relancer immédiatement sans vérification.
          </p>
        </div>
      )}

      {/* Payment hero card */}
      <article className="panel" style={{ padding: 24, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "hsl(var(--green-50))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <PaymentMethodIcon tx={tx} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, color: signed.color, margin: 0, fontVariantNumeric: "tabular-nums" }}>{signed.text}</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
            {tx.direction === "in" ? "Reçu de " : "Payé à "}{tx.participantName}{tx.secondaryParticipantName ? ` → ${tx.secondaryParticipantName}` : ""}
          </p>
          <p className="muted" style={{ marginTop: 2 }}>{tx.method ? tx.method.replace(/_/g, " ") : "—"}{tx.operator ? ` · ${tx.operator}` : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "hsl(var(--gray-100))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Calendar size={18} color="hsl(var(--gray-500))" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{completion.value}</p>
            <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{completion.label}</p>
          </div>
        </div>
      </article>

      {/* Fixed 2-column grid, not the generic auto-fit .panel-grid — at the
          1536px reference width auto-fit crams all four cards into one row
          since each already clears its 300px minimum. */}
      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <article className="panel">
          <div className="section-header"><h3>Détails du paiement</h3></div>
          <dl className="space-y-0">
            <CopyField label="Référence de transaction" value={tx.id} field="tx-ref" copiedField={copiedField} onCopy={copy} mono />
            {isInvoicePayment && tx.invoiceNumber && tx.externalInvoiceDocId && (
              <div className="flex justify-between border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500">Numéro de facture</dt>
                <dd className="text-[13px] font-semibold" style={{ fontFamily: "monospace" }}>
                  <button
                    onClick={() => navigate(`/admin/partner-invoices/${tx.externalInvoiceDocId}`)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--green-700))", display: "inline-flex", alignItems: "center", gap: 4, padding: 0 }}
                  >
                    {tx.invoiceNumber} <ExternalLink size={12} />
                  </button>
                </dd>
              </div>
            )}
            {isInvoicePayment && (
              <div className="flex justify-between border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500">Payeur</dt>
                <dd className="text-[13px] font-semibold text-gray-900">{tx.payerName ?? "—"}</dd>
              </div>
            )}
            <div className="flex justify-between border-b border-gray-50 py-2">
              <dt className="text-[13px] text-gray-500">Bénéficiaire</dt>
              <dd className="text-[13px] font-semibold text-gray-900">{tx.participantName}</dd>
            </div>
            {maskedPhone && (
              <div className="flex justify-between border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500">Téléphone du bénéficiaire</dt>
                <dd className="text-[13px] font-semibold text-gray-900">{maskedPhone}</dd>
              </div>
            )}
            <CopyField label="Référence opérateur" value={tx.reference} field="provider-ref" copiedField={copiedField} onCopy={copy} mono />
            <div className="flex justify-between border-b border-gray-50 py-2">
              <dt className="text-[13px] text-gray-500">Devise</dt>
              <dd className="text-[13px] font-semibold text-gray-900">{tx.currency}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[13px] text-gray-500">Frais opérateur</dt>
              <dd className="text-[13px] font-semibold text-gray-900">{tx.feeUsd != null ? formatAmount(tx.feeUsd, tx.currency) : "non communiqué"}</dd>
            </div>
          </dl>

          <button
            onClick={() => setShowDiagnostics((v) => !v)}
            className="muted"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, background: "none", border: "none", cursor: "pointer", fontSize: 12 }}
          >
            {showDiagnostics ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Diagnostics admin
          </button>
          {showDiagnostics && (
            <dl className="space-y-0" style={{ marginTop: 8, background: "hsl(var(--gray-50))", borderRadius: 10, padding: "4px 10px" }}>
              {([
                ["ID interne", tx.id],
                ["Type technique", tx.type],
                ["Source", tx.source],
                ...(tx.partnerId ? ([["Partner ID", tx.partnerId]] as [string, string][]) : []),
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-gray-100 py-1.5 last:border-0">
                  <dt style={{ fontSize: 11 }} className="text-gray-500">{k}</dt>
                  <dd style={{ fontSize: 11, fontFamily: "monospace" }}>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </article>

        <article className="panel">
          <div className="section-header"><h3>Progression</h3></div>
          {tx.timeline.length === 0 ? (
            <p className="muted text-sm">Aucun évènement enregistré pour cette transaction.</p>
          ) : (
            <div>
              {tx.timeline.map((step, i) => (
                <div key={i} className="flex" style={{ gap: 12 }}>
                  <div className="flex flex-col items-center">
                    <CheckCircle2 size={16} color="hsl(var(--green-700))" style={{ flexShrink: 0 }} />
                    {i < tx.timeline.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 20, background: "hsl(var(--green-100))", marginTop: 2 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 14 }}>
                    <div className="flex justify-between">
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{step.label}</p>
                      <p className="muted" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtDateTimeSec(step.at)}</p>
                    </div>
                    {TIMELINE_DESCRIPTIONS[step.label] && <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{TIMELINE_DESCRIPTIONS[step.label]}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="section-header"><h3>Rapprochement</h3></div>
          {tx.reconciliationStatus === "unchecked" ? (
            <p className="muted text-sm">Pas encore vérifié — le contrôle automatique passe toutes les 6 heures.</p>
          ) : tx.reconciliationStatus === "not_applicable" ? (
            <p className="muted text-sm">Sans objet pour ce type de transaction — aucune source secondaire à comparer.</p>
          ) : tx.reconciliationStatus === "matched" || tx.reconciliationStatus === "resolved_manually" ? (
            <>
              <div className="panel" style={{ background: "hsl(var(--green-50))", border: "1px solid hsl(var(--green-100))", padding: 12 }}>
                <p className="pill status-active" style={{ display: "inline-flex" }}>
                  <ShieldCheck size={12} /> {tx.reconciliationStatus === "matched" ? "Rapproché automatiquement" : "Rapproché manuellement"}
                </p>
                <p className="muted" style={{ marginTop: 6 }}>
                  {tx.reconciliationStatus === "matched"
                    ? "Le paiement a été rapproché avec succès."
                    : `Par ${tx.reconciliationResolvedByName} — ${tx.reconciliationResolutionNote}`}
                </p>
              </div>
              {isInvoicePayment && tx.externalInvoiceDocId && (
                <div className="flex justify-between border-b border-gray-50 py-2" style={{ marginTop: 10 }}>
                  <dt className="text-[13px] text-gray-500">Facture rapprochée</dt>
                  <dd className="text-[13px] font-semibold">
                    <button
                      onClick={() => navigate(`/admin/partner-invoices/${tx.externalInvoiceDocId}`)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--green-700))", display: "inline-flex", alignItems: "center", gap: 4, padding: 0 }}
                    >
                      {tx.invoiceNumber ?? tx.externalInvoiceDocId} <ExternalLink size={12} />
                    </button>
                  </dd>
                </div>
              )}
              {isInvoicePayment && (
                <div className="flex justify-between py-2">
                  <dt className="text-[13px] text-gray-500">Réception AROM</dt>
                  <dd className="muted text-[13px]" style={{ textAlign: "right" }}>Référence de réception non communiquée</dd>
                </div>
              )}
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

        {hasProof && (
          <article className="panel">
            <div className="section-header"><h3>Preuve de paiement</h3></div>
            <div className="flex" style={{ gap: 16, flexWrap: "wrap" }}>
              <div style={{
                width: 96, height: 120, borderRadius: 10, border: "1px dashed hsl(var(--gray-200))",
                background: "hsl(var(--gray-50))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 6,
              }}>
                <FileDown size={22} color="hsl(var(--gray-400))" />
                <p style={{ fontSize: 9, color: "hsl(var(--gray-400))", textAlign: "center", padding: "0 6px" }}>Confirmation Mombongo</p>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Reçu de paiement</p>
                <p className="muted" style={{ marginTop: 2 }}>Document généré à la demande — pas un reçu officiel de l'opérateur.</p>
                <div className="button-row" style={{ marginTop: 12 }}>
                  <button onClick={() => downloadReceipt(tx)} className="button-outline">
                    <FileDown size={14} /> Télécharger le reçu
                  </button>
                  <button onClick={() => copy("receipt-ref", tx.reference)} className="button-outline">
                    <Copy size={14} /> Copier la référence
                  </button>
                </div>
                {copiedField === "receipt-ref" && <p style={{ fontSize: 11, color: "hsl(var(--green-700))", marginTop: 6 }}>Référence copiée</p>}
              </div>
            </div>
          </article>
        )}

        {isInvoicePayment && tx.notificationStatus === "failed" && (
          <article className="panel">
            <div className="section-header"><h3>Notification partenaire</h3></div>
            <p className="pill status-blocked" style={{ display: "inline-block", marginBottom: 8 }}>Échec de notification</p>
            {tx.notificationFailureReason && <p className="muted text-sm">{tx.notificationFailureReason}</p>}
          </article>
        )}
      </div>

      <article className="panel" style={{ marginTop: 16 }}>
        <div className="section-header"><h3>Actions administrateur</h3></div>
        <div style={{ padding: "12px 20px 4px", display: "grid", gridTemplateColumns: isInvoicePayment && tx.externalInvoiceDocId ? "1fr 1fr" : "1fr", gap: 4 }}>
          {isInvoicePayment && tx.externalInvoiceDocId && (
            <div style={{ borderRight: "1px solid hsl(var(--gray-50))", paddingRight: 20, paddingBottom: 12 }}>
              {!showResendConfirm ? (
                <button
                  onClick={() => setShowResendConfirm(true)}
                  disabled={resend.isPending}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "8px 0" }}
                >
                  <div className="metric-icon tone-green" style={{ marginBottom: 0 }}><Send size={16} /></div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>Renvoyer la notification</p>
                    <p className="muted">Renvoyer la confirmation de paiement à AROM.</p>
                  </div>
                  <ChevronRight size={16} color="hsl(var(--gray-400))" />
                </button>
              ) : (
                <div style={{ padding: "8px 0" }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>Confirmer le renvoi de la notification</p>
                  <p className="muted" style={{ marginTop: 4 }}>
                    Statut actuel : {tx.notificationStatus === "sent" ? "notifié" : tx.notificationStatus === "failed" ? "échec de notification" : "sans objet"}.
                    Seule la notification partenaire sera renvoyée — le paiement ne sera pas retraité et aucune nouvelle transaction ne sera créée.
                    {alreadyNotified && " AROM a déjà été notifié avec succès pour ce paiement — ne renvoyez que si le partenaire signale ne pas l'avoir reçue."}
                  </p>
                  <div className="button-row" style={{ marginTop: 10 }}>
                    <button
                      onClick={() => resend.mutate(tx.externalInvoiceDocId!, { onSuccess: () => setShowResendConfirm(false) })}
                      disabled={resend.isPending}
                      className="btn-primary"
                      style={{ height: 36 }}
                    >
                      {resend.isPending ? <Loader2 size={14} className="animate-spin" /> : "Confirmer l'envoi"}
                    </button>
                    <button onClick={() => setShowResendConfirm(false)} className="button-outline">Annuler</button>
                  </div>
                  {resend.isError && <p role="alert" className="error-text text-sm" style={{ marginTop: 8 }}>Échec de l'envoi.</p>}
                </div>
              )}
              {resend.isSuccess && <p className="muted text-sm" style={{ marginTop: 4 }}>Notification renvoyée.</p>}
            </div>
          )}

          <div style={{ paddingLeft: isInvoicePayment && tx.externalInvoiceDocId ? 20 : 0 }}>
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
              <button
                onClick={() => setShowTicketForm(true)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "8px 0" }}
              >
                <div className="metric-icon tone-green" style={{ marginBottom: 0 }}><Headset size={16} /></div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>Ouvrir un dossier de support</p>
                  <p className="muted">Signaler un problème ou demander une assistance.</p>
                </div>
                <ChevronRight size={16} color="hsl(var(--gray-400))" />
              </button>
            )}
            {tickets.length > 0 && (
              <ul className="space-y-0" style={{ marginTop: 8 }}>
                {tickets.map((t) => (
                  <li key={t.id} className="text-sm py-2 border-b border-gray-50 last:border-0">
                    <p>{t.description}</p>
                    <p className="muted" style={{ fontSize: 11 }}>{t.createdByName} · {fmtDateTime(t.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="muted" style={{ fontSize: 12, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 6 }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Pour la sécurité des données, les paiements ne peuvent pas être marqués comme payés manuellement.
        </p>
      </article>
    </section>
  );
}
