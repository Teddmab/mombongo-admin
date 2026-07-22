import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, Wallet, Wheat, Ship, ArrowDownToLine } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatUsd } from "@/lib/utils";
import { useAdminKpis } from "@/hooks/useAdminKpis";
import { useMonthlyVolume } from "@/hooks/useMonthlyVolume";

/* ─── Live activity feed ─────────────────────────────────────────────────── */

interface FeedItem {
  id: string;
  type: string;
  amountUsd?: number;
  userId?: string;
  createdAt?: { seconds: number };
}

const TX_ICON: Record<string, string> = {
  investment: "🌿", bourse_investment: "🚂", financing: "🌾",
  deposit: "💳", withdrawal: "💸",
};

function useActivityFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(20));
    return onSnapshot(q, snap => {
      setFeed(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedItem)));
    });
  }, []);
  return feed;
}

/* ─── KPI cards config ───────────────────────────────────────────────────── */

const STAT_CARDS = [
  { key: "activeUsers" as const,      label: "Utilisateurs actifs", icon: Activity,        format: (v: number) => v.toLocaleString("fr-FR") },
  { key: "pendingKyc" as const,       label: "KYC en attente",      icon: ShieldCheck,     format: (v: number) => v.toLocaleString("fr-FR") },
  { key: "monthlyVolumeUsd" as const, label: "Volume mensuel",       icon: Wallet,          format: formatUsd },
  { key: "financingOpen" as const,    label: "Financements actifs",  icon: Wheat,           format: (v: number) => v.toLocaleString("fr-FR") },
  { key: "bourseOpen" as const,       label: "Bourse ouverte",       icon: Ship,            format: (v: number) => v.toLocaleString("fr-FR") },
  { key: "totalDepositsUsd" as const, label: "Total dépôts",         icon: ArrowDownToLine, format: formatUsd },
] as const;

/* ─── Component ──────────────────────────────────────────────────────────── */

export function AdminDashboard() {
  const kpis = useAdminKpis();
  const { data: monthlyData = [] } = useMonthlyVolume();
  const feed = useActivityFeed();

  return (
    <motion.section
      data-testid="admin-dashboard"
      className="page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div>
        <div className="section-kicker">Tableau de bord</div>
        <h1 className="page-title">Supervision des opérations Mombongo</h1>
        <p className="page-copy">Données en direct depuis Firestore — actualisées toutes les 60 secondes.</p>
      </div>

      {/* KPI cards */}
      <div className="stats-grid">
        {STAT_CARDS.map(({ key, label, icon: Icon, format }) => (
          <article key={key} className="metric-card">
            <div className="metric-top">
              <span className="badge">{label}</span>
              <Icon size={18} />
            </div>
            <p className="metric-value">{format(kpis[key])}</p>
          </article>
        ))}
      </div>

      <div className="panel-grid">
        {/* Monthly volume bar chart */}
        <article className="panel">
          <div className="section-header">
            <div>
              <div className="section-kicker">Volume</div>
              <h3 style={{ margin: "8px 0 0" }}>Transactions sur 6 mois</h3>
            </div>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="rgba(16,32,51,0.08)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis
                  tickLine={false} axisLine={false} tick={{ fontSize: 11 }}
                  tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                />
                <Tooltip formatter={(v: number) => [`$${v.toFixed(0)}`, "Volume"]} />
                <Bar dataKey="volumeUsd" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Live activity feed */}
        <article className="panel">
          <div className="section-header">
            <div>
              <div className="section-kicker">Activité</div>
              <h3 style={{ margin: "8px 0 0" }}>Transactions récentes</h3>
            </div>
            <span className="pill status-active">Live</span>
          </div>
          {feed.length === 0
            ? <p style={{ color: "var(--color-muted)", fontSize: 13, padding: "16px 0" }}>Aucune transaction récente</p>
            : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {feed.map(tx => (
                  <li key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{TX_ICON[tx.type] ?? "💰"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>
                        {tx.type?.replace(/_/g, " ")}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)" }}>
                        {tx.userId?.slice(0, 8)}…
                      </p>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                      {tx.amountUsd !== undefined ? formatUsd(tx.amountUsd) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </article>
      </div>

      {(kpis.pendingKyc > 0 || kpis.financingOpen > 0) && (
        <article className="panel">
          <div className="section-header">
            <div>
              <div className="section-kicker">Priorités</div>
              <h3 style={{ margin: "8px 0 0" }}>Actions recommandées</h3>
            </div>
          </div>
          <div className="feature-grid" style={{ gridTemplateColumns: "1fr" }}>
            {kpis.pendingKyc > 0 && (
              <div className="feature-card">
                <strong>Revoir les dossiers KYC</strong>
                <p className="muted">{kpis.pendingKyc} profil{kpis.pendingKyc > 1 ? "s" : ""} en attente de validation documentaire.</p>
              </div>
            )}
            {kpis.financingOpen > 0 && (
              <div className="feature-card">
                <strong>Financements actifs à surveiller</strong>
                <p className="muted">{kpis.financingOpen} demande{kpis.financingOpen > 1 ? "s" : ""} de financement en cours.</p>
              </div>
            )}
          </div>
        </article>
      )}
    </motion.section>
  );
}
