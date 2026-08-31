import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck, Handshake, AlertTriangle, Activity, Wallet, KeyRound,
  UserPlus, FileSearch, Receipt as ReceiptIcon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { formatUsd } from "@/lib/utils";
import { useAdminKpis } from "@/hooks/useAdminKpis";
import {
  useInvoiceSummary, usePartnerSummary, useOperationalAlertCount,
  usePaymentActivity, type PaymentActivityPeriod,
} from "@/hooks/useCommandCenter";

/* ─── Live activity feed ─────────────────────────────────────────────────── */

interface FeedItem {
  id: string;
  type: string;
  description?: string;
  amountUsd?: number;
  userId?: string;
  createdAt?: Timestamp;
}

const TX_ICON: Record<string, string> = {
  investment: "🌿", bourse_investment: "🚂", financing: "🌾",
  deposit: "💳", withdrawal: "💸",
};

function useActivityFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(8));
    return onSnapshot(q, (snap) => {
      setFeed(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedItem)));
      setLastUpdated(Date.now());
    });
  }, []);
  return { feed, lastUpdated };
}

function operationLabel(tx: FeedItem): string {
  // Human description first (real field on the transaction doc) — the
  // userId fallback is a technical reference, kept secondary/truncated.
  if (tx.description) return tx.description;
  return tx.type ? tx.type.replace(/_/g, " ") : "Opération";
}

/* ─── Priority queue card ─────────────────────────────────────────────── */

function PriorityCard({ to, tone, icon: Icon, count, label, sub, loading, error }: {
  to: string; tone: "green" | "amber" | "red";
  icon: React.ComponentType<{ size?: number }>;
  count: number; label: string; sub: string; loading?: boolean; error?: boolean;
}) {
  return (
    <Link to={to} className={`priority-card tone-${tone}`}>
      <div className="priority-icon"><Icon size={20} /></div>
      <div>
        <p className="priority-count">{error ? "—" : loading ? "…" : count}</p>
        <p className="priority-label">{label}</p>
        <p className="priority-sub">{error ? "Données indisponibles" : sub}</p>
      </div>
    </Link>
  );
}

/* ─── KPI card ────────────────────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, sub, loading, error }: {
  icon: React.ComponentType<{ size?: number }>; label: string; value: string; sub: string;
  loading?: boolean; error?: boolean;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className="badge">{label}</span>
        <Icon size={18} />
      </div>
      <p className="metric-value">{error ? "—" : loading ? "…" : value}</p>
      <p style={{ fontSize: 11, color: "hsl(var(--gray-400))", marginTop: 4 }}>
        {error ? "Données indisponibles" : sub}
      </p>
    </article>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

const PERIODS: { value: PaymentActivityPeriod; label: string }[] = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
];

export function AdminDashboard() {
  const { user } = useAuth();
  const kpis = useAdminKpis();
  const invoiceQuery = useInvoiceSummary();
  const partnerQuery = usePartnerSummary();
  const alertQuery = useOperationalAlertCount();
  const { data: invoiceSummary, isLoading: invoicesLoading, error: invoicesError } = invoiceQuery;
  const { data: partnerSummary, isLoading: partnersLoading, error: partnersError } = partnerQuery;
  const { data: alertCount, isLoading: alertsLoading, error: alertsError } = alertQuery;
  const [period, setPeriod] = useState<PaymentActivityPeriod>(30);
  const { data: activity = [], isLoading: activityLoading } = usePaymentActivity(period);
  const { feed, lastUpdated } = useActivityFeed();

  const firstName = (user?.displayName ?? user?.email ?? "Admin").split(" ")[0].split("@")[0];
  const today = useMemo(
    () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    [],
  );
  const liveFeedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  // KPI/priority queries refetch every 60s (see useCommandCenter.ts). Use the
  // OLDEST of their fetch timestamps (not the newest) — if even one card
  // hasn't refreshed recently, the dashboard as a whole should read as
  // stale rather than hiding that behind the other cards' fresher data.
  //
  // Staleness must keep re-evaluating even when nothing else re-renders
  // the component (e.g. queries are stuck retrying in the background), so
  // `now` ticks on an interval instead of reading Date.now() during render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const kpiUpdatedAt = Math.min(
    invoiceQuery.dataUpdatedAt, partnerQuery.dataUpdatedAt, alertQuery.dataUpdatedAt,
  );
  const kpiUpdatedLabel = kpiUpdatedAt
    ? new Date(kpiUpdatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const kpiStale = kpiUpdatedAt > 0 && now - kpiUpdatedAt > 150_000; // 2.5x the 60s refetch cadence

  return (
    <motion.section
      data-testid="admin-dashboard"
      className="page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="greeting-row">
        <div>
          <h1 className="greeting-title">Bonjour {firstName}</h1>
          <p className="greeting-date" style={{ textTransform: "capitalize" }}>{today}</p>
        </div>
      </div>

      {kpiStale && (
        <div className="stale-banner">
          <AlertTriangle size={14} />
          Les priorités et KPI n'ont pas pu se rafraîchir depuis {kpiUpdatedLabel} — vérifiez votre connexion.
        </div>
      )}

      <p style={{ fontSize: 12, color: "hsl(var(--gray-400))", margin: kpiStale ? 0 : "-8px 0 0" }}>
        {kpiUpdatedLabel && `Priorités et KPI actualisés à ${kpiUpdatedLabel}`}
        {kpiUpdatedLabel && liveFeedLabel && " · "}
        {liveFeedLabel && `Activité en direct · dernière opération à ${liveFeedLabel}`}
      </p>

      {/* Priority queue: KYC, invoices, alerts */}
      <div className="priority-grid">
        <PriorityCard
          to="/admin/kyc"
          tone="green"
          icon={ShieldCheck}
          count={kpis.pendingKyc}
          label={`Dossier${kpis.pendingKyc > 1 ? "s" : ""} KYC à vérifier`}
          sub="Validations en attente de votre décision"
        />
        <PriorityCard
          to="/admin/partner-invoices"
          tone="amber"
          icon={Handshake}
          count={invoiceSummary?.pendingCount ?? 0}
          loading={invoicesLoading}
          error={!!invoicesError}
          label={`Facture${(invoiceSummary?.pendingCount ?? 0) > 1 ? "s" : ""} en attente`}
          sub={
            invoiceSummary && invoiceSummary.overdueCount > 0
              ? `dont ${invoiceSummary.overdueCount} en retard de plus de 7 jours`
              : "Paiements en attente de traitement"
          }
        />
        <PriorityCard
          to="/admin/alerts"
          tone="red"
          icon={AlertTriangle}
          count={alertCount?.count ?? 0}
          loading={alertsLoading}
          error={!!alertsError}
          label={`Alerte${(alertCount?.count ?? 0) > 1 ? "s" : ""} à traiter`}
          sub="Éléments nécessitant votre attention"
        />
      </div>

      {/* Four essential KPIs */}
      <div className="stats-grid">
        <KpiCard icon={Activity} label="Utilisateurs actifs" value={kpis.activeUsers.toLocaleString("fr-FR")} sub="Comptes non désactivés" />
        <KpiCard icon={Wallet} label="Paiements ce mois" value={formatUsd(kpis.monthlyVolumeUsd)} sub="Depuis le 1er du mois" />
        <KpiCard
          icon={ReceiptIcon}
          label="Factures à payer"
          value={String(invoiceSummary?.pendingCount ?? 0)}
          loading={invoicesLoading}
          error={!!invoicesError}
          sub="Factures partenaires en attente"
        />
        <KpiCard
          icon={KeyRound}
          label="Partenaires actifs"
          value={String(partnerSummary?.activeCount ?? 0)}
          loading={partnersLoading}
          error={!!partnersError}
          sub="Intégrations API actives"
        />
      </div>

      <div className="panel-grid">
        {/* Payment activity, with period control */}
        <article className="panel">
          <div className="section-header">
            <div>
              <div className="section-kicker">Activité des paiements</div>
              <h3 style={{ margin: "8px 0 0" }}>Volume de transactions</h3>
            </div>
            <div className="period-toggle">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`period-btn${period === p.value ? " active" : ""}`}
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-shell">
            {activityLoading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--gray-400))", fontSize: 13 }}>
                Chargement…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activity} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke="rgba(16,32,51,0.08)" vertical={false} />
                  <XAxis
                    dataKey="day" tickLine={false} axisLine={false}
                    tick={{ fontSize: 11 }}
                    interval={period === 90 ? 13 : period === 30 ? 4 : 0}
                  />
                  <YAxis
                    tickLine={false} axisLine={false} tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                  />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(0)}`, "Volume"]} />
                  <Bar dataKey="volumeUsd" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        {/* Recent operations, human description first */}
        <article className="panel">
          <div className="section-header">
            <div>
              <div className="section-kicker">Activité</div>
              <h3 style={{ margin: "8px 0 0" }}>Opérations récentes</h3>
            </div>
            <span className="pill status-active">Live</span>
          </div>
          {feed.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: 13, padding: "16px 0" }}>Aucune transaction récente</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {feed.map((tx) => (
                <li key={tx.id} className="ops-row">
                  <span className="ops-icon" style={{ background: "hsl(var(--green-50))", fontSize: 16 }}>
                    {TX_ICON[tx.type] ?? "💰"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{operationLabel(tx)}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)" }}>
                      {tx.userId ? `Utilisateur ${tx.userId.slice(0, 8)}…` : "—"}
                    </p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                    {tx.amountUsd !== undefined ? formatUsd(tx.amountUsd) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      {/* Quick actions — only destinations that are actually built today.
          "Créer une facture" (assisted invoice creation) is ADM-UI-04
          scope and doesn't exist yet, so it's deliberately not listed
          here rather than linking somewhere that doesn't do anything. */}
      <article className="panel">
        <div className="section-header">
          <div>
            <div className="section-kicker">Actions rapides</div>
            <h3 style={{ margin: "8px 0 0" }}>Aller directement à</h3>
          </div>
        </div>
        <div className="quick-actions-grid" style={{ padding: 20 }}>
          <Link to="/admin/partners" className="quick-action-card">
            <UserPlus size={18} style={{ color: "hsl(var(--green-700))" }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Ajouter un partenaire</span>
          </Link>
          <Link to="/admin/kyc" className="quick-action-card">
            <FileSearch size={18} style={{ color: "hsl(var(--amber-500))" }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Examiner les KYC</span>
          </Link>
          <Link to="/admin/partner-invoices" className="quick-action-card">
            <Handshake size={18} style={{ color: "hsl(var(--gray-700))" }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Voir les factures partenaires</span>
          </Link>
        </div>
      </article>
    </motion.section>
  );
}
