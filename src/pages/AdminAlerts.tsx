import { useQuery } from "@tanstack/react-query";
import {
  collection, getDocs, query, where, orderBy, limit, getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AlertTriangle, ShieldAlert, Banknote, Clock, TrendingDown } from "lucide-react";

const fmtDate = (ts?: { seconds: number }) =>
  ts ? new Date(ts.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";

interface AlertSummary {
  pendingKyc: number;
  pendingFarmers: number;
  failedTransactions: number;
  overdueFinancing: number;
  lowWalletAlerts: number;
}

interface RecentFailedTx {
  id: string;
  type: string;
  amountUsd: number;
  userId?: string;
  createdAt?: { seconds: number };
  failureReason?: string;
}

function useAlertSummary() {
  return useQuery<AlertSummary>({
    queryKey: ["admin-alert-summary"],
    queryFn: async () => {
      const [kycSnap, farmersSnap, txSnap, finSnap] = await Promise.all([
        getCountFromServer(query(collection(db, "users"), where("kycStatus", "==", "pending"))),
        getCountFromServer(query(collection(db, "farmers"), where("status", "==", "pending"))),
        getCountFromServer(query(collection(db, "transactions"), where("status", "==", "failed"))),
        getCountFromServer(query(collection(db, "financing_applications"), where("status", "==", "overdue"))),
      ]);
      return {
        pendingKyc: kycSnap.data().count,
        pendingFarmers: farmersSnap.data().count,
        failedTransactions: txSnap.data().count,
        overdueFinancing: finSnap.data().count,
        lowWalletAlerts: 0,
      };
    },
    staleTime: 60_000,
  });
}

function useRecentFailedTransactions() {
  return useQuery<RecentFailedTx[]>({
    queryKey: ["admin-failed-transactions"],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, "transactions"),
        where("status", "==", "failed"),
        orderBy("createdAt", "desc"),
        limit(20),
      ));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as RecentFailedTx));
    },
  });
}

const ALERT_CARDS = [
  {
    key: "pendingKyc" as const,
    label: "KYC en attente",
    icon: ShieldAlert,
    description: "Dossiers d'identité non validés",
    severity: "warning",
    href: "/admin/kyc",
  },
  {
    key: "pendingFarmers" as const,
    label: "Agriculteurs en attente",
    icon: Clock,
    description: "Agriculteurs non encore approuvés",
    severity: "warning",
    href: "/admin/farmers",
  },
  {
    key: "failedTransactions" as const,
    label: "Transactions échouées",
    icon: TrendingDown,
    description: "Transactions en erreur dans le journal",
    severity: "critical",
    href: "/admin/transactions",
  },
  {
    key: "overdueFinancing" as const,
    label: "Financements en retard",
    icon: Banknote,
    description: "Applications de financement en retard de remboursement",
    severity: "critical",
    href: "/admin/financing",
  },
] as const;

const SEVERITY_CLASS: Record<string, string> = {
  critical: "border-red-200 bg-red-50",
  warning: "border-amber-200 bg-amber-50",
  info: "border-blue-200 bg-blue-50",
};
const SEVERITY_ICON_CLASS: Record<string, string> = {
  critical: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};

export function AdminAlerts() {
  const { data: summary, isLoading } = useAlertSummary();
  const { data: failedTxs = [] } = useRecentFailedTransactions();

  const totalAlerts = summary
    ? summary.pendingKyc + summary.failedTransactions + summary.overdueFinancing + summary.pendingFarmers
    : 0;

  return (
    <section className="page">
      <div className="section-header">
        <div>
          <div className="section-kicker">Alertes</div>
          <h1 className="page-title">Centre de surveillance</h1>
          <p className="page-copy">
            {isLoading ? "Calcul en cours…" : `${totalAlerts} élément${totalAlerts !== 1 ? "s" : ""} nécessitant une attention`}
          </p>
        </div>
        {totalAlerts > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-red-600">{totalAlerts} alerte{totalAlerts !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Alert cards */}
      <div className="stats-grid">
        {ALERT_CARDS.map(({ key, label, icon: Icon, description, severity, href }) => {
          const count = summary?.[key] ?? 0;
          return (
            <a
              key={key}
              href={href}
              className={`metric-card border-2 transition hover:shadow-md ${count > 0 ? SEVERITY_CLASS[severity] : "border-gray-100"}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="metric-top">
                <span className="section-kicker">{label}</span>
                <Icon size={18} className={count > 0 ? SEVERITY_ICON_CLASS[severity] : "text-gray-300"} />
              </div>
              <p className="metric-value" style={{ color: count > 0 && severity === "critical" ? "var(--color-error, #dc2626)" : undefined }}>
                {isLoading ? "…" : count}
              </p>
              <p className="text-xs text-gray-400 mt-1">{description}</p>
            </a>
          );
        })}
      </div>

      {/* Failed transactions detail */}
      {failedTxs.length > 0 && (
        <article className="panel">
          <div className="section-header">
            <div>
              <div className="section-kicker">Erreurs récentes</div>
              <h3>Transactions échouées ({failedTxs.length})</h3>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Utilisateur</th>
                  <th>Date</th>
                  <th>Raison</th>
                </tr>
              </thead>
              <tbody>
                {failedTxs.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{tx.id.slice(0, 10)}…</td>
                    <td className="capitalize">{tx.type?.replace(/_/g, " ") || "—"}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      ${(tx.amountUsd ?? 0).toFixed(2)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--color-muted)" }}>
                      {tx.userId ? `${tx.userId.slice(0, 8)}…` : "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(tx.createdAt)}</td>
                    <td>
                      <span className="pill status-blocked">{tx.failureReason || "unknown"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {totalAlerts === 0 && !isLoading && (
        <article className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <h3 className="font-semibold text-gray-700">Aucune alerte active</h3>
          <p className="text-sm text-gray-400 mt-1">Toutes les métriques sont dans les normes.</p>
        </article>
      )}
    </section>
  );
}
