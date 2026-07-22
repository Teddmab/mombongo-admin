import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, where, orderBy, limit, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldCheck } from "lucide-react";

const fmtDate = (ts?: { seconds: number }) =>
  ts ? new Date(ts.seconds * 1000).toLocaleDateString("fr-FR") : "—";

const STATUS_FILTER_OPTIONS = ["pending", "verified", "rejected", "none"] as const;
type StatusFilter = typeof STATUS_FILTER_OPTIONS[number] | "";

interface KycUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  kycStatus: string;
  kycDocumentUrl?: string;
  kycSubmittedAt?: { seconds: number };
  createdAt?: { seconds: number };
}

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000); };
  return { msg, success: (t: string) => show(t, true), error: (t: string) => show(t, false) };
}

export function AdminKyc() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [selected, setSelected] = useState<KycUser | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-kyc-users", filter],
    queryFn: async () => {
      const constraints = [orderBy("createdAt", "desc"), limit(100)] as Parameters<typeof query>[1][];
      if (filter) constraints.unshift(where("kycStatus", "==", filter));
      const snap = await getDocs(query(collection(db, "users"), ...constraints));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as KycUser));
    },
  });

  async function updateKyc(userId: string, kycStatus: string) {
    setSaving(true);
    try {
      let extra: Record<string, unknown> = { kycStatus };
      if (kycStatus === "verified") extra = { ...extra, kycVerifiedAt: new Date() };
      await updateDoc(doc(db, "users", userId), extra);
      toast.success(`KYC mis à jour → ${kycStatus}`);
      qc.invalidateQueries({ queryKey: ["admin-kyc-users"] });
      setSelected(null);
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally { setSaving(false); }
  }

  async function rejectKyc(userId: string) {
    const reason = window.prompt("Raison du rejet :");
    if (!reason) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", userId), {
        kycStatus: "rejected",
        kycRejectionReason: reason,
        kycRejectedAt: new Date(),
      });
      toast.success("KYC rejeté");
      qc.invalidateQueries({ queryKey: ["admin-kyc-users"] });
      setSelected(null);
    } catch {
      toast.error("Erreur lors du rejet");
    } finally { setSaving(false); }
  }

  const pending = users.filter(u => u.kycStatus === "pending");
  const verified = users.filter(u => u.kycStatus === "verified");
  const rejected = users.filter(u => u.kycStatus === "rejected");

  return (
    <section className="page">
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-2 rounded-lg text-sm font-semibold shadow-lg ${toast.msg.ok ? "bg-green-600 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg.text}
        </div>
      )}

      <div className="section-header">
        <div>
          <div className="section-kicker">Conformité</div>
          <h1 className="page-title">Vérification KYC</h1>
          <p className="page-copy">Validez les documents d'identité des utilisateurs pour activer leurs comptes.</p>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as StatusFilter)}
          className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">Tous</option>
          {STATUS_FILTER_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        <div className="metric-card" style={{ minWidth: 120 }}>
          <p className="section-kicker">En attente</p>
          <p className="metric-value">{pending.length}</p>
        </div>
        <div className="metric-card" style={{ minWidth: 120 }}>
          <p className="section-kicker">Vérifiés</p>
          <p className="metric-value">{verified.length}</p>
        </div>
        <div className="metric-card" style={{ minWidth: 120 }}>
          <p className="section-kicker">Rejetés</p>
          <p className="metric-value">{rejected.length}</p>
        </div>
      </div>

      <article className="panel">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map(n => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Statut KYC</th>
                  <th>Soumis le</th>
                  <th>Inscrit le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.fullName || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--color-muted)" }}>{u.email}</td>
                    <td>
                      <span className="badge">{u.role}</span>
                    </td>
                    <td>
                      <span className={`pill ${
                        u.kycStatus === "verified" ? "status-active"
                        : u.kycStatus === "pending" ? "status-pending"
                        : u.kycStatus === "rejected" ? "status-blocked"
                        : ""
                      }`}>
                        {u.kycStatus}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(u.kycSubmittedAt)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(u.createdAt)}</td>
                    <td>
                      <div className="flex gap-1.5">
                        {u.kycDocumentUrl && (
                          <a
                            href={u.kycDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <ShieldCheck size={12} /> Docs
                          </a>
                        )}
                        {u.kycStatus === "pending" && (
                          <>
                            <button
                              onClick={() => updateKyc(u.id, "verified")}
                              disabled={saving}
                              className="h-7 px-3 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-semibold disabled:opacity-50"
                            >
                              Valider
                            </button>
                            <button
                              onClick={() => rejectKyc(u.id)}
                              disabled={saving}
                              className="h-7 px-3 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-semibold disabled:opacity-50"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                        {u.kycStatus === "verified" && (
                          <button
                            onClick={() => updateKyc(u.id, "none")}
                            disabled={saving}
                            className="h-7 px-3 bg-gray-100 text-gray-600 border border-gray-200 rounded text-xs disabled:opacity-50"
                          >
                            Annuler
                          </button>
                        )}
                        {u.kycStatus === "rejected" && (
                          <button
                            onClick={() => updateKyc(u.id, "pending")}
                            disabled={saving}
                            className="h-7 px-3 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-semibold disabled:opacity-50"
                          >
                            Remettre
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--color-muted)", padding: "32px" }}>
                      Aucun utilisateur {filter ? `avec le statut « ${filter} »` : ""}
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
