import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatUsd } from "@/lib/utils";
import { adminService } from "@/services/admin.service";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface TxRow {
  id: string;
  type: string;
  description?: string;
  amountUsd: number;
  currency?: string;
  status: string;
  userId?: string;
  createdAt?: string | { seconds: number };
  failureReason?: string;
  provider?: string;
  reference?: string;
}

const TYPE_OPTIONS = [
  "investment", "bourse_investment", "financing", "deposit", "withdrawal",
] as const;
const STATUS_OPTIONS = ["completed", "pending", "failed", "refunded"] as const;

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmtDate(ts?: string | { seconds: number }) {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts.seconds * 1000);
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function downloadCsv(rows: TxRow[]) {
  const headers = ["ID", "Type", "Description", "Montant USD", "Statut", "Utilisateur", "Date"];
  const lines = rows.map(r => [
    r.id, r.type, r.description ?? "", r.amountUsd, r.status, r.userId ?? "", fmtDate(r.createdAt),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([headers.join(",") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
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
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: all = [], isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: () => adminService.getTransactions() as Promise<TxRow[]>,
  });

  const rows = all.filter(r => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        (r.userId ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.reference ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <section className="page">
      <div className="section-header">
        <div>
          <div className="section-kicker">Transactions</div>
          <h1 className="page-title">Journal financier</h1>
          <p className="page-copy">{all.length} transaction{all.length !== 1 ? "s" : ""} · {rows.length} affichées</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ID, utilisateur…"
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white w-40"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">Tous les types</option>
            {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => downloadCsv(rows)}
            className="flex items-center gap-1.5 h-9 px-3 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      <article className="panel">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map(n => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Montant</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--color-muted)" }}>
                      {row.id.slice(0, 12)}…
                    </td>
                    <td className="capitalize">{row.type?.replace(/_/g, " ") || "—"}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.description || "—"}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(row.amountUsd)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(row.createdAt)}</td>
                    <td>
                      <span className={`pill ${
                        row.status === "completed" ? "status-active"
                        : row.status === "failed" ? "status-blocked"
                        : row.status === "pending" ? "status-pending"
                        : ""
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/admin/transactions/${row.id}`)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--color-muted)", padding: "32px" }}>
                      Aucune transaction trouvée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

/* ─── Transaction detail ─────────────────────────────────────────────────── */

export function AdminTransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: tx, isLoading } = useQuery({
    queryKey: ["admin-transaction", id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "transactions", id!));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as TxRow;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <section className="page">
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </section>
    );
  }
  if (!tx) {
    return (
      <section className="page">
        <p className="text-center text-gray-400 py-20">Transaction introuvable</p>
      </section>
    );
  }

  const fields: [string, string][] = [
    ["Type", tx.type?.replace(/_/g, " ") || "—"],
    ["Montant", formatUsd(tx.amountUsd)],
    ["Devise", tx.currency || "USD"],
    ["Statut", tx.status],
    ["Utilisateur ID", tx.userId || "—"],
    ["Prestataire", tx.provider || "—"],
    ["Référence externe", tx.reference || "—"],
    ["Raison d'échec", tx.failureReason || "—"],
    ["Date", fmtDate(tx.createdAt)],
  ];

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="section-header">
        <div>
          <div className="section-kicker">Transaction</div>
          <h1 className="page-title" style={{ fontFamily: "monospace", fontSize: 18 }}>{tx.id}</h1>
        </div>
        <span className={`pill ${
          tx.status === "completed" ? "status-active"
          : tx.status === "failed" ? "status-blocked"
          : "status-pending"
        }`}>
          {tx.status}
        </span>
      </div>

      <article className="panel" style={{ maxWidth: 560 }}>
        <dl>
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-gray-50 py-2.5 last:border-0">
              <dt className="text-sm text-gray-500">{k}</dt>
              <dd className="text-sm font-semibold text-gray-900 capitalize">{v}</dd>
            </div>
          ))}
        </dl>
      </article>
    </section>
  );
}
