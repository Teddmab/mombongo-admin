import { useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Download, FileBarChart } from "lucide-react";

type ReportDef = {
  id: string;
  title: string;
  description: string;
  icon: string;
  generate: () => Promise<{ headers: string[]; rows: (string | number)[][] }>;
};

const fmtDate = (ts?: { seconds: number } | string) => {
  if (!ts) return "";
  const d = typeof ts === "string" ? new Date(ts) : new Date((ts as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString("fr-FR");
};

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [
    headers.map(h => `"${h}"`).join(","),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const REPORTS: ReportDef[] = [
  {
    id: "transactions",
    title: "Transactions",
    description: "Journal complet des paiements, dépôts, retraits et investissements",
    icon: "💳",
    generate: async () => {
      const snap = await getDocs(query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(5000)));
      const headers = ["ID", "Type", "Description", "Montant USD", "Devise", "Statut", "Utilisateur", "Prestataire", "Référence", "Date"];
      const rows = snap.docs.map(d => {
        const data = d.data();
        return [d.id, data.type ?? "", data.description ?? "", data.amountUsd ?? 0, data.currency ?? "USD", data.status ?? "", data.userId ?? "", data.provider ?? "", data.reference ?? "", fmtDate(data.createdAt)];
      });
      return { headers, rows };
    },
  },
  {
    id: "investments",
    title: "Investissements",
    description: "Positions des investisseurs par produit agricole",
    icon: "📈",
    generate: async () => {
      const snap = await getDocs(query(collection(db, "investments"), orderBy("investedAt", "desc"), limit(5000)));
      const headers = ["ID", "Produit", "Investisseur ID", "Montant USD", "ROI %", "Statut", "Date"];
      const rows = snap.docs.map(d => {
        const data = d.data();
        return [d.id, data.productTitle ?? data.productId ?? "", data.investorId ?? "", data.amountUsd ?? 0, data.roiPercent ?? "", data.status ?? "", fmtDate(data.investedAt)];
      });
      return { headers, rows };
    },
  },
  {
    id: "farmers",
    title: "Agriculteurs",
    description: "Profils des agriculteurs partenaires et statuts de financement",
    icon: "🌾",
    generate: async () => {
      const snap = await getDocs(query(collection(db, "farmers"), orderBy("createdAt", "desc"), limit(5000)));
      const headers = ["ID", "Nom", "Région", "Culture", "Surface (ha)", "Montant demandé USD", "Montant décaissé USD", "Statut", "Agent ID", "Date"];
      const rows = snap.docs.map(d => {
        const data = d.data();
        return [d.id, data.name ?? "", data.region ?? "", data.cropType ?? "", data.farmSizeHa ?? 0, data.requestedAmountUsd ?? 0, data.disbursedAmountUsd ?? 0, data.status ?? "", data.agentId ?? "", fmtDate(data.createdAt)];
      });
      return { headers, rows };
    },
  },
  {
    id: "financing",
    title: "Financements",
    description: "Applications de financement agricole et état des tranches",
    icon: "🏦",
    generate: async () => {
      const snap = await getDocs(query(collection(db, "financing_applications"), orderBy("createdAt", "desc"), limit(5000)));
      const headers = ["ID", "Agriculteur ID", "Investisseur ID", "Montant USD", "Culture", "Statut", "Tranches", "Date"];
      const rows = snap.docs.map(d => {
        const data = d.data();
        const tranches = (data.tranches ?? []) as { status: string; amountUsd: number }[];
        const tranchesSummary = tranches.map((t, i) => `T${i + 1}:${t.status}(${t.amountUsd})`).join("|");
        return [d.id, data.farmerId ?? "", data.investorId ?? "", data.amountUsd ?? 0, data.cropType ?? "", data.status ?? "", tranchesSummary, fmtDate(data.createdAt)];
      });
      return { headers, rows };
    },
  },
  {
    id: "users",
    title: "Utilisateurs",
    description: "Comptes inscrits avec statut KYC et rôle",
    icon: "👥",
    generate: async () => {
      const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5000)));
      const headers = ["ID", "Nom", "Email", "Téléphone", "Rôle", "KYC", "Wallet USD", "Wallet CDF", "Date inscription"];
      const rows = snap.docs.map(d => {
        const data = d.data();
        return [d.id, data.fullName ?? "", data.email ?? "", data.phone ?? "", data.role ?? "", data.kycStatus ?? "none", data.walletUsd ?? 0, data.walletCdf ?? 0, fmtDate(data.createdAt)];
      });
      return { headers, rows };
    },
  },
];

export function AdminReports() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(report: ReportDef) {
    if (loading) return;
    setLoading(report.id);
    setError(null);
    try {
      const { headers, rows } = await report.generate();
      downloadCsv(`mombongo-${report.id}`, headers, rows);
    } catch (e) {
      setError(`Erreur lors de l'export de « ${report.title} » : ${(e as Error).message}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Rapports</div>
          <h1 className="page-title">Exports de données</h1>
          <p className="page-copy">Téléchargez les données de la plateforme au format CSV.</p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="panel-grid">
        {REPORTS.map(report => (
          <article key={report.id} className="panel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="flex items-start gap-3">
              <div style={{ fontSize: 32 }}>{report.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="card-title">{report.title}</div>
                <p className="text-sm" style={{ color: "var(--color-muted)", marginTop: 2 }}>{report.description}</p>
              </div>
              <FileBarChart size={16} style={{ color: "var(--color-muted)", flexShrink: 0, marginTop: 4 }} />
            </div>
            <button
              onClick={() => handleDownload(report)}
              disabled={loading !== null}
              className="flex items-center justify-center gap-2 h-9 w-full bg-gray-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-gray-800 transition"
            >
              {loading === report.id ? (
                <>Chargement…</>
              ) : (
                <><Download size={14} /> Exporter CSV</>
              )}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
