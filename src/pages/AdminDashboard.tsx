import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, Wallet, Wheat } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUsd } from "@/lib/utils";
import { adminService } from "@/services/admin.service";

const statCards = [
  { key: "activeUsers", label: "Utilisateurs actifs", icon: Activity },
  { key: "pendingKyc", label: "KYC en attente", icon: ShieldCheck },
  { key: "monthlyVolumeUsd", label: "Volume mensuel", icon: Wallet },
  { key: "financingOpen", label: "Demandes ouvertes", icon: Wheat },
] as const;

export function AdminDashboard() {
  const { data: kpis } = useQuery({ queryKey: ["dashboard-kpis"], queryFn: () => adminService.getDashboardKpis() });
  const { data: activity } = useQuery({ queryKey: ["dashboard-activity"], queryFn: () => adminService.getActivity() });

  return (
    <motion.section className="page" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
      <div>
        <div className="section-kicker">Tableau de bord</div>
        <h1 className="page-title">Supervision des opérations Mombongo</h1>
        <p className="page-copy">Vue synthétique des signaux métier les plus sensibles avant passage à des intégrations réelles.</p>
      </div>

      <div className="stats-grid">
        {statCards.map(({ key, label, icon: Icon }) => (
          <article key={key} className="metric-card">
            <div className="metric-top">
              <span className="badge">{label}</span>
              <Icon size={18} />
            </div>
            <p className="metric-value">
              {key === "monthlyVolumeUsd" ? formatUsd(kpis?.[key] ?? 0) : (kpis?.[key] ?? 0).toLocaleString("fr-FR")}
            </p>
            <p className="muted">Mise en scène avec données stub prêtes à être remplacées par Firestore.</p>
          </article>
        ))}
      </div>

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header">
            <div>
              <div className="section-kicker">Activité hebdo</div>
              <h3 style={{ margin: "8px 0 0" }}>Volume et approbations</h3>
            </div>
            <span className="pill">Stub analytics</span>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#1E3A5F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(16,32,51,0.08)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke="#1E3A5F" fill="url(#volumeGradient)" strokeWidth={3} />
                <Area type="monotone" dataKey="approvals" stroke="#F4A11B" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <div className="section-header">
            <div>
              <div className="section-kicker">Priorités</div>
              <h3 style={{ margin: "8px 0 0" }}>Actions recommandées</h3>
            </div>
          </div>
          <div className="feature-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="feature-card">
              <strong>Revoir les dossiers KYC</strong>
              <p className="muted">27 profils attendent une validation documentaire avant activation complète.</p>
            </div>
            <div className="feature-card">
              <strong>Vérifier les retraits bloqués</strong>
              <p className="muted">Une transaction est marquée à risque et nécessite un arbitrage humain.</p>
            </div>
            <div className="feature-card">
              <strong>Arbitrer la bourse du jour</strong>
              <p className="muted">Deux routes logistiques demandent une décision avant publication.</p>
            </div>
          </div>
        </article>
      </div>
    </motion.section>
  );
}