import { useMemo, useState } from "react";
import { useSearchParams, useNavigate, useParams, Link } from "react-router-dom";
import {
  Search, ChevronRight, ChevronLeft, MapPin, Sprout, Clock, X, FileText,
  Users, ClipboardList, ShieldCheck, ArrowLeft,
} from "lucide-react";
import { doc, getDocs, collection, query, where, orderBy, limit, updateDoc } from "firebase/firestore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/firebase";
import { formatUsd } from "@/lib/utils";
import { useAdminFarmers, useAdminFarmerExploitation, useAdminFarmerByUid, type AdminFarmerRow } from "@/hooks/useAdminFarmers";

const PER_PAGE = 8;

const KYC_LABEL: Record<string, { label: string; cls: string }> = {
  none: { label: "Non soumis", cls: "" },
  pending: { label: "En attente", cls: "status-pending" },
  approved: { label: "Vérifié", cls: "status-active" },
  rejected: { label: "Rejeté", cls: "status-blocked" },
};

type Segment = "all" | "incomplete" | "active" | "suspended";
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "incomplete", label: "À compléter" },
  { id: "active", label: "Actifs" },
  { id: "suspended", label: "Suspendus" },
];

function relativeTime(ms: number | null): string {
  if (!ms) return "—";
  const diffH = (Date.now() - ms) / 3_600_000;
  if (diffH < 1) return "À l'instant";
  if (diffH < 24) return `Il y a ${Math.round(diffH)} h`;
  const diffD = Math.round(diffH / 24);
  return diffD === 1 ? "Hier" : `Il y a ${diffD} j`;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

function matchesSegment(f: AdminFarmerRow, segment: Segment): boolean {
  if (segment === "incomplete") return f.profileCompletePct < 100;
  if (segment === "active") return f.isActive && f.kycStatus === "approved";
  if (segment === "suspended") return !f.isActive;
  return true;
}

/* ─── List + preview ──────────────────────────────────────────────────── */

export function AdminFarmers() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const segment = (params.get("segment") as Segment) ?? "all";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: farmers = [], isLoading, error } = useAdminFarmers();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return farmers
      .filter((f) => matchesSegment(f, segment))
      .filter((f) => !needle
        || f.name.toLowerCase().includes(needle)
        || f.phone.toLowerCase().includes(needle)
        || f.province.toLowerCase().includes(needle));
  }, [farmers, segment, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // Lazy useState initializer, not a bare Date.now() during render — this
  // count doesn't need to live-tick, just a stable "now" for the session.
  const [now] = useState(() => Date.now());
  const counts = useMemo(() => ({
    total: farmers.length,
    incomplete: farmers.filter((f) => f.profileCompletePct < 100).length,
    kycPending: farmers.filter((f) => f.kycStatus === "pending").length,
    active30d: farmers.filter((f) => f.lastActivityAt && now - f.lastActivityAt < 30 * 86_400_000).length,
  }), [farmers, now]);

  const selected = farmers.find((f) => f.id === selectedId) ?? null;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Personnes</div>
          <h1 className="page-title">Agriculteurs</h1>
          <p className="page-copy">Suivez les profils, exploitations et activité des agriculteurs.</p>
        </div>
      </div>

      <div className="stats-grid">
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Agriculteurs</span><Users size={18} /></div>
          <p className="metric-value">{isLoading ? "…" : counts.total}</p>
          <p style={{ fontSize: 11, color: "hsl(var(--gray-400))", marginTop: 4 }}>Total enregistrés</p>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Profils à compléter</span><ClipboardList size={18} /></div>
          <p className="metric-value">{isLoading ? "…" : counts.incomplete}</p>
          <p style={{ fontSize: 11, color: "hsl(var(--gray-400))", marginTop: 4 }}>Besoin d'informations</p>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="badge">KYC à vérifier</span><ShieldCheck size={18} /></div>
          <p className="metric-value">{isLoading ? "…" : counts.kycPending}</p>
          <p style={{ fontSize: 11, color: "hsl(var(--gray-400))", marginTop: 4 }}>En attente de validation</p>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Actifs (30j)</span><Sprout size={18} /></div>
          <p className="metric-value">{isLoading ? "…" : counts.active30d}</p>
          <p style={{ fontSize: 11, color: "hsl(var(--gray-400))", marginTop: 4 }}>Mis à jour récemment</p>
        </article>
      </div>

      <div className="toolbar-row">
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--gray-400))" }} />
          <input
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Rechercher un nom, téléphone ou province"
            className="search-input"
            style={{ paddingLeft: 36 }}
          />
        </div>
        <div className="period-toggle">
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`period-btn${segment === s.id ? " active" : ""}`}
              onClick={() => setParam("segment", s.id === "all" ? "" : s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="queue-detail-grid">
        <article className="panel">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((n) => <div key={n} className="h-12 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : error ? (
            <p style={{ padding: 24, fontSize: 13, color: "hsl(var(--danger))" }}>
              Impossible de charger les agriculteurs : {error instanceof Error ? error.message : "erreur inconnue"}
            </p>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <Sprout size={28} style={{ color: "hsl(var(--gray-300, 220 13% 85%))", margin: "0 auto 10px" }} />
              <p style={{ fontWeight: 700, fontSize: 14 }}>Aucun agriculteur trouvé</p>
              <p style={{ fontSize: 12, color: "hsl(var(--gray-400))", marginTop: 4 }}>
                {q || segment !== "all" ? "Ajustez la recherche ou le segment." : "Les agriculteurs inscrits apparaîtront ici."}
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Agriculteur</th>
                      <th>Province</th>
                      <th>Culture principale</th>
                      <th>Profil</th>
                      <th>Statut</th>
                      <th>Dernière activité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((f) => {
                      const kyc = KYC_LABEL[f.kycStatus] ?? KYC_LABEL.none;
                      return (
                        <tr
                          key={f.id}
                          onClick={() => setSelectedId(f.id)}
                          style={{ cursor: "pointer", background: selectedId === f.id ? "hsl(var(--green-50))" : undefined }}
                        >
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="avatar-chip" style={{ width: 32, height: 32, fontSize: 11 }}>{initials(f.name || "—")}</span>
                              <div>
                                <p style={{ fontWeight: 600 }}>{f.name || "—"}</p>
                                <p style={{ fontSize: 11, color: "hsl(var(--gray-400))" }}>{f.phone || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td>{f.province || "—"}</td>
                          <td>{f.primaryCrop || "—"}</td>
                          <td style={{ minWidth: 100 }}>
                            <div className="progress-bar"><div className="progress-fill" style={{ width: `${f.profileCompletePct}%` }} /></div>
                            <p style={{ fontSize: 10, color: "hsl(var(--gray-400))", marginTop: 3 }}>{f.profileCompletePct}%</p>
                          </td>
                          <td><span className={`pill ${kyc.cls}`}>{kyc.label}</span></td>
                          <td style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>{relativeTime(f.lastActivityAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid hsl(var(--gray-100))" }}>
                <p style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>
                  {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} sur {filtered.length}
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="outline-button" disabled={currentPage <= 1}
                    onClick={() => setParam("page", String(currentPage - 1))}>
                    <ChevronLeft size={14} />
                  </button>
                  <button type="button" className="outline-button" disabled={currentPage >= totalPages}
                    onClick={() => setParam("page", String(currentPage + 1))}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </article>

        {selected && <FarmerPreview farmer={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </section>
  );
}

function FarmerPreview({ farmer, onClose }: { farmer: AdminFarmerRow; onClose: () => void }) {
  const { data: exploitation } = useAdminFarmerExploitation(farmer.id);
  const kyc = KYC_LABEL[farmer.kycStatus] ?? KYC_LABEL.none;
  const otherCultures = (exploitation?.cultures ?? []).filter((c) => (c as { commodity?: string }).commodity !== farmer.primaryCrop);

  return (
    <article className="panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--gray-400))" }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ textAlign: "center", marginTop: -16 }}>
        <span className="avatar-chip" style={{ width: 56, height: 56, fontSize: 18, margin: "0 auto" }}>{initials(farmer.name || "—")}</span>
        <h3 style={{ marginTop: 10, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17 }}>{farmer.name || "—"}</h3>
        {farmer.phone && <p style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>{farmer.phone}</p>}
        <span className={`pill ${kyc.cls}`} style={{ marginTop: 6, display: "inline-block" }}>{kyc.label}</span>
      </div>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--gray-400))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Exploitation</p>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
            {farmer.exploitationHectares != null ? `${farmer.exploitationHectares} ha` : "Aucune exploitation enregistrée"}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--gray-400))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Localisation</p>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin size={13} /> {farmer.province || "—"}
          </p>
        </div>
        {farmer.primaryCrop && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--gray-400))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cultures</p>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{farmer.primaryCrop} <span style={{ fontWeight: 400, color: "hsl(var(--gray-400))" }}>(principale)</span></p>
            {otherCultures.length > 0 && (
              <p style={{ fontSize: 12, color: "hsl(var(--gray-500))", marginTop: 2 }}>
                {otherCultures.map((c) => (c as { commodity?: string }).commodity).filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        )}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--gray-400))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dernière activité</p>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={13} /> {relativeTime(farmer.lastActivityAt)}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
        <Link to={`/admin/farmers/${farmer.id}`} className="button" style={{ textDecoration: "none", justifyContent: "center" }}>
          Voir le profil <ChevronRight size={14} />
        </Link>
        {/* Navigation handoff only — the assisted invoice-creation flow itself is ADM-UI-04 scope */}
        <Link to={`/admin/partner-invoices?farmerId=${farmer.id}`} className="outline-button" style={{ textDecoration: "none", justifyContent: "center" }}>
          <FileText size={14} /> Créer une facture
        </Link>
      </div>
    </article>
  );
}

/* ─── Full profile page ───────────────────────────────────────────────── */

async function fetchAgents() {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "agent")));
  return snap.docs.map((d) => ({
    id: d.id,
    displayName: (d.data().displayName as string) || (d.data().fullName as string) || (d.data().email as string),
  }));
}

export function AdminFarmerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [assigningAgent, setAssigningAgent] = useState(false);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);

  const { data: farmer, isLoading } = useAdminFarmerByUid(id);
  const { data: exploitation } = useAdminFarmerExploitation(id);
  const { data: agents = [] } = useQuery({ queryKey: ["admin-agents"], queryFn: fetchAgents, staleTime: 5 * 60 * 1000 });
  const { data: apps = [] } = useQuery({
    queryKey: ["admin-farmer-apps", id],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, "financing_applications"), where("farmerId", "==", id), orderBy("createdAt", "desc"), limit(20),
      ));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    enabled: !!id,
  });

  // Agent assignment still writes directly from the client — pre-existing,
  // out of ADM-UI-02's scope (KYC decisions specifically), flagged not fixed.
  async function handleAssignAgent(agentId: string) {
    if (!id) return;
    setAssigningAgent(true);
    try {
      await updateDoc(doc(db, "users", id), { agentId: agentId || null });
      qc.invalidateQueries({ queryKey: ["admin-farmer-user", id] });
      qc.invalidateQueries({ queryKey: ["admin-farmers"] });
    } finally { setAssigningAgent(false); }
  }

  if (isLoading) {
    return <section className="page"><div className="h-48 bg-gray-100 rounded-2xl animate-pulse" /></section>;
  }
  if (!farmer) {
    return <section className="page"><p style={{ textAlign: "center", color: "hsl(var(--gray-400))", padding: "80px 0" }}>Agriculteur introuvable</p></section>;
  }

  const status = (farmer.kycStatus as string) ?? "none";
  const kyc = KYC_LABEL[status] ?? KYC_LABEL.none;
  const name = ((farmer.fullName ?? farmer.displayName ?? "") as string) || "—";
  const province = (exploitation?.province as string) ?? (farmer.province as string) ?? "";

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "hsl(var(--gray-500))", fontSize: 13, cursor: "pointer", marginBottom: 4 }}>
        <ArrowLeft size={14} /> Agriculteurs
      </button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Agriculteur</div>
          <h1 className="page-title">{name}</h1>
          {province && <p className="page-copy">{province}</p>}
        </div>
        <span className={`pill ${kyc.cls}`}>{kyc.label}</span>
      </div>

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header"><h3>Informations</h3></div>
          <dl className="space-y-0">
            {([
              ["Email", (farmer.email as string) || "—"],
              ["Téléphone", (farmer.phone as string) || "—"],
              ["Province", province || "—"],
              ["Culture principale", exploitation?.cultures?.[0] ? ((exploitation.cultures[0] as { commodity?: string }).commodity ?? "—") : "—"],
              ["Surface", exploitation?.totalHectares ? `${exploitation.totalHectares as number} ha` : "—"],
              ["Statut KYC", kyc.label],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500 flex-shrink-0">{k}</dt>
                <dd className="text-[13px] font-semibold text-gray-900 text-right break-all">{v}</dd>
              </div>
            ))}
            <div className="flex items-start justify-between py-3 gap-3">
              <dt className="text-[13px] text-gray-500 flex-shrink-0 mt-1">Agent terrain</dt>
              <dd className="flex flex-col items-end gap-2">
                <select
                  value={pendingAgentId ?? (farmer.agentId as string) ?? ""}
                  onChange={(e) => setPendingAgentId(e.target.value)}
                  disabled={assigningAgent}
                  className="h-8 px-2 border border-gray-200 rounded-lg text-[13px] font-semibold text-gray-900 bg-white disabled:opacity-60 min-w-[200px]"
                >
                  <option value="">— Non assigné —</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
                </select>
                {pendingAgentId !== null && pendingAgentId !== ((farmer.agentId as string) ?? "") && (
                  <div className="flex gap-2">
                    <button onClick={() => { handleAssignAgent(pendingAgentId); setPendingAgentId(null); }} disabled={assigningAgent}
                      className="h-7 px-3 bg-green-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                      {assigningAgent ? "…" : "Confirmer"}
                    </button>
                    <button onClick={() => setPendingAgentId(null)} className="h-7 px-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold">
                      Annuler
                    </button>
                  </div>
                )}
              </dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <div className="section-header"><h3>Financements ({apps.length})</h3></div>
          {apps.length === 0 ? (
            <p style={{ padding: "0 20px 20px", fontSize: 13, color: "hsl(var(--gray-400))" }}>Aucun financement</p>
          ) : (
            <ul style={{ padding: "0 20px 16px" }}>
              {apps.map((a) => (
                <li key={a.id} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600">{((a as Record<string, unknown>).cropType as string) || "—"}</span>
                  <span className="font-semibold">{formatUsd(((a as Record<string, unknown>).amountUsd as number) ?? 0)}</span>
                  <span className={`pill ${(a as Record<string, unknown>).status === "active" ? "status-active" : ""}`}>{(a as Record<string, unknown>).status as string}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
