import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  doc, getDoc, getDocs, collection, query, where, orderBy, limit, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { adminService } from "@/services/admin.service";
import { formatUsd } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente", approved: "Approuvé", active: "Actif", completed: "Terminé",
};
const STATUS_CLASS: Record<string, string> = {
  pending: "status-pending", approved: "status-active", active: "status-active", completed: "",
};
const fmtDate = (ts?: { seconds: number }) =>
  ts ? new Date(ts.seconds * 1000).toLocaleDateString("fr-FR") : "—";

/* ─── Farmers list ─────────────────────────────────────────────────────────── */

export function AdminFarmers() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");

  const { data: farmers = [], isLoading } = useQuery({
    queryKey: ["admin-farmers", status],
    queryFn: () => adminService.getFarmers(status ? { status } : undefined),
  });

  return (
    <section className="page">
      <div className="section-header">
        <div>
          <div className="section-kicker">Agriculteurs</div>
          <h1 className="page-title">Partenaires agricoles</h1>
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvé</option>
          <option value="active">Actif</option>
          <option value="completed">Terminé</option>
        </select>
      </div>

      <article className="panel">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Région</th>
                  <th>Culture</th>
                  <th>Surface (ha)</th>
                  <th>Demandé</th>
                  <th>Décaissé</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {farmers.map(f => (
                  <tr key={f.id}>
                    <td className="font-semibold">{f.name || "—"}</td>
                    <td>{f.region}</td>
                    <td>{f.cropType}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{f.farmSizeHa}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(f.requestedAmountUsd)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(f.disbursedAmountUsd)}</td>
                    <td>
                      <span className={`pill ${STATUS_CLASS[f.status] ?? ""}`}>
                        {STATUS_LABEL[f.status] ?? f.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/admin/farmers/${f.id}`)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        Détails <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {farmers.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "var(--color-muted)", padding: "32px" }}>
                      Aucun agriculteur trouvé
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

/* ─── Farmer detail ─────────────────────────────────────────────────────────── */

export function AdminFarmerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const { data: farmer, isLoading } = useQuery({
    queryKey: ["admin-farmer", id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "farmers", id!));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Record<string, unknown>;
    },
    enabled: !!id,
  });

  const { data: apps = [] } = useQuery({
    queryKey: ["admin-farmer-apps", id],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, "financing_applications"),
        where("farmerId", "==", id),
        orderBy("createdAt", "desc"),
        limit(20),
      ));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    enabled: !!id,
  });

  async function handleApprove() {
    if (!id || !window.confirm("Approuver cet agriculteur ?")) return;
    setApproving(true);
    try {
      await adminService.approveFarmer(id);
      qc.invalidateQueries({ queryKey: ["admin-farmer", id] });
      qc.invalidateQueries({ queryKey: ["admin-farmers"] });
    } finally { setApproving(false); }
  }

  async function handleReject() {
    const reason = window.prompt("Raison du rejet :");
    if (!id || !reason) return;
    setRejecting(true);
    try {
      await updateDoc(doc(db, "farmers", id), { status: "rejected", rejectionReason: reason });
      qc.invalidateQueries({ queryKey: ["admin-farmer", id] });
      qc.invalidateQueries({ queryKey: ["admin-farmers"] });
    } finally { setRejecting(false); }
  }

  if (isLoading) {
    return (
      <section className="page">
        <div className="space-y-4">
          {[1, 2].map(n => <div key={n} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </section>
    );
  }
  if (!farmer) {
    return (
      <section className="page">
        <p className="text-center text-gray-400 py-20">Agriculteur introuvable</p>
      </section>
    );
  }

  const status = farmer.status as string;

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="section-header">
        <div>
          <div className="section-kicker">Agriculteur</div>
          <h1 className="page-title">{(farmer.name as string) || "—"}</h1>
          <p className="page-copy">{farmer.region as string} · {farmer.cropType as string}</p>
        </div>
        {status === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={approving}
              className="h-9 px-4 bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {approving ? "…" : "Approuver"}
            </button>
            <button
              onClick={handleReject}
              disabled={rejecting}
              className="h-9 px-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {rejecting ? "…" : "Rejeter"}
            </button>
          </div>
        )}
      </div>

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header"><h3>Informations</h3></div>
          <dl className="space-y-0">
            {([
              ["Surface", `${farmer.farmSizeHa ?? "—"} ha`],
              ["Montant demandé", formatUsd((farmer.requestedAmountUsd as number) ?? 0)],
              ["Montant décaissé", formatUsd((farmer.disbursedAmountUsd as number) ?? 0)],
              ["Agent ID", (farmer.agentId as string) || "—"],
              ["Statut", STATUS_LABEL[status] ?? status],
              ["Inscrit le", fmtDate(farmer.createdAt as { seconds: number })],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500">{k}</dt>
                <dd className="text-[13px] font-semibold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="panel">
          <div className="section-header">
            <h3>Financements ({apps.length})</h3>
          </div>
          {apps.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun financement</p>
          ) : (
            <ul className="space-y-0">
              {apps.map((a: Record<string, unknown>) => (
                <li key={a.id as string} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600">{(a.cropType as string) || "—"}</span>
                  <span className="font-semibold">{formatUsd((a.amountUsd as number) ?? 0)}</span>
                  <span className={`pill ${a.status === "active" ? "status-active" : ""}`}>{a.status as string}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
