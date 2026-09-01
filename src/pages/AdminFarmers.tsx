import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Sprout, MapPin, Clock, TrendingUp } from "lucide-react";
import {
  useFarmers, useFarmerDetail, segmentFilter,
  type FarmerListItem, type FarmerSegment,
} from "@/hooks/useFarmers";

const SEGMENTS: { key: FarmerSegment; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "incomplete", label: "À compléter" },
  { key: "active", label: "Actifs" },
  { key: "suspended", label: "Suspendus" },
];

function fmtDate(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleDateString("fr-FR") : "—";
}

function statusPill(f: FarmerListItem) {
  if (!f.isActive) return { cls: "status-blocked", label: "Suspendu" };
  if (f.completionPercent < 100) return { cls: "status-pending", label: "À compléter" };
  return { cls: "status-active", label: "Actif" };
}

/* ─── Farmers list + preview ────────────────────────────────────────────── */

export function AdminFarmers() {
  const navigate = useNavigate();
  const { data: farmers = [], isLoading, error } = useFarmers();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<FarmerSegment>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return farmers
      .filter((f) => segmentFilter(f, segment))
      .filter((f) =>
        !q ||
        f.fullName.toLowerCase().includes(q) ||
        f.phone.includes(q) ||
        (f.province ?? "").toLowerCase().includes(q),
      );
  }, [farmers, search, segment]);

  const counts = useMemo(
    () => ({
      total: farmers.length,
      incomplete: farmers.filter((f) => segmentFilter(f, "incomplete")).length,
      kycPending: farmers.filter((f) => f.kycStatus === "pending").length,
      active: farmers.filter((f) => segmentFilter(f, "active")).length,
    }),
    [farmers],
  );

  const selected = farmers.find((f) => f.id === selectedId) ?? null;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Personnes</div>
          <h1 className="page-title">Agriculteurs</h1>
          <p className="page-copy">Suivez les profils, exploitations et activités des agriculteurs.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="metric-card">
          <p className="section-kicker">Agriculteurs</p>
          <p className="metric-value">{counts.total}</p>
          <p className="muted">Total enregistrés</p>
        </div>
        <div className="metric-card">
          <p className="section-kicker">Profils à compléter</p>
          <p className="metric-value">{counts.incomplete}</p>
          <p className="muted">Besoin d'informations</p>
        </div>
        <div className="metric-card">
          <p className="section-kicker">KYC à vérifier</p>
          <p className="metric-value">{counts.kycPending}</p>
          <p className="muted">En attente de validation</p>
        </div>
        <div className="metric-card">
          <p className="section-kicker">Actifs</p>
          <p className="metric-value">{counts.active}</p>
          <p className="muted">Profil complet</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un nom, téléphone ou province"
          className="form-input"
          style={{ maxWidth: 320 }}
          aria-label="Rechercher un agriculteur"
        />
        <div className="flex gap-1.5" role="tablist" aria-label="Segments">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={segment === s.key}
              onClick={() => setSegment(s.key)}
              className={`button-outline ${segment === s.key ? "active" : ""}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-grid" style={{ gridTemplateColumns: selected ? "1fr 340px" : "1fr" }}>
        <article className="panel">
          {error ? (
            <p role="alert" className="error-text" style={{ padding: 24 }}>
              Impossible de charger les agriculteurs. Réessayez plus tard.
            </p>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Agriculteur</th>
                    <th>Province</th>
                    <th>Culture principale</th>
                    <th>Profil</th>
                    <th>Mombongo Score</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => {
                    const status = statusPill(f);
                    return (
                      <tr
                        key={f.id}
                        onClick={() => setSelectedId(f.id)}
                        style={{ cursor: "pointer", background: selectedId === f.id ? "hsl(var(--green-50))" : undefined }}
                      >
                        <td>
                          <div className="font-semibold">{f.fullName}</div>
                          <div style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>{f.phone || "—"}</div>
                        </td>
                        <td>{f.province ?? "—"}</td>
                        <td>{f.primaryCommodity ?? "—"}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{f.completionPercent}%</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{f.momBongoScore ?? "—"}</td>
                        <td><span className={`pill ${status.cls}`}>{status.label}</span></td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "hsl(var(--gray-500))", padding: 32 }}>
                        Aucun agriculteur ne correspond aux filtres actuels.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {selected && (
          <FarmerPreview farmer={selected} onClose={() => setSelectedId(null)} onOpenProfile={() => navigate(`/admin/farmers/${selected.id}`)} />
        )}
      </div>
    </section>
  );
}

function FarmerPreview({ farmer, onClose, onOpenProfile }: { farmer: FarmerListItem; onClose: () => void; onOpenProfile: () => void }) {
  const navigate = useNavigate();
  return (
    <aside className="panel" aria-label={`Aperçu de ${farmer.fullName}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="section-kicker">{farmer.phone || "—"}</div>
          <h3 style={{ margin: "4px 0" }}>{farmer.fullName}</h3>
          {farmer.kycStatus === "verified" && <span className="pill status-active">Identité vérifiée</span>}
        </div>
        <button onClick={onClose} aria-label="Fermer l'aperçu" className="button-outline" style={{ height: 32, width: 32, padding: 0, justifyContent: "center" }}>
          <X size={16} />
        </button>
      </div>

      <dl className="space-y-0" style={{ marginTop: 16 }}>
        <div className="flex items-center gap-2 py-2 border-b border-gray-50">
          <Sprout size={14} className="muted" />
          <dt className="text-[13px] text-gray-500">Exploitation</dt>
          <dd className="text-[13px] font-semibold ml-auto">{farmer.totalHectares != null ? `${farmer.totalHectares} ha` : "—"}</dd>
        </div>
        <div className="flex items-center gap-2 py-2 border-b border-gray-50">
          <MapPin size={14} className="muted" />
          <dt className="text-[13px] text-gray-500">Localisation</dt>
          <dd className="text-[13px] font-semibold ml-auto">{farmer.province ?? "—"}</dd>
        </div>
        <div className="flex items-center gap-2 py-2 border-b border-gray-50">
          <TrendingUp size={14} className="muted" />
          <dt className="text-[13px] text-gray-500">Culture principale</dt>
          <dd className="text-[13px] font-semibold ml-auto">{farmer.primaryCommodity ?? "—"}</dd>
        </div>
        <div className="flex items-center gap-2 py-2 border-b border-gray-50">
          <Clock size={14} className="muted" />
          <dt className="text-[13px] text-gray-500">Mis à jour</dt>
          <dd className="text-[13px] font-semibold ml-auto">{fmtDate(farmer.updatedAt)}</dd>
        </div>
      </dl>

      <div className="metric-card" style={{ marginTop: 16 }}>
        <p className="section-kicker">Mombongo Score</p>
        <p className="metric-value">{farmer.momBongoScore ?? "—"}{farmer.momBongoScore != null && "/100"}</p>
      </div>

      <div className="flex flex-col gap-2" style={{ marginTop: 16 }}>
        <button onClick={onOpenProfile} className="btn-primary" style={{ height: 40 }}>Voir le profil</button>
        <button
          onClick={() => navigate(`/admin/farmer-invoices/new?farmerId=${farmer.id}`)}
          className="button-outline"
          style={{ justifyContent: "center" }}
        >
          Créer une facture
        </button>
      </div>
    </aside>
  );
}

/* ─── Farmer detail (full profile) ──────────────────────────────────────── */

export function AdminFarmerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: farmer, isLoading, error } = useFarmerDetail(id);

  if (isLoading) {
    return (
      <section className="page">
        <div className="space-y-4">
          {[1, 2].map((n) => <div key={n} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </section>
    );
  }
  if (error) {
    return (
      <section className="page">
        <p role="alert" className="error-text text-center py-20">Impossible de charger cet agriculteur.</p>
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

  const status = statusPill(farmer);

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Agriculteur</div>
          <h1 className="page-title">{farmer.fullName}</h1>
          <p className="page-copy">{farmer.province ?? "—"} · {farmer.primaryCommodity ?? "Aucune culture"}</p>
        </div>
        <span className={`pill ${status.cls}`}>{status.label}</span>
      </div>

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header"><h3>Informations</h3></div>
          <dl className="space-y-0">
            {([
              ["Téléphone", farmer.phone || "—"],
              ["Email", farmer.email || "—"],
              ["Exploitation", farmer.exploitationName ?? "—"],
              ["Province / Territoire", `${farmer.province ?? "—"} / ${farmer.territory ?? "—"}`],
              ["Surface totale", farmer.totalHectares != null ? `${farmer.totalHectares} ha` : "—"],
              ["Statut KYC", farmer.kycStatus],
              ["Profil complété", `${farmer.completionPercent}%`],
              ["Mombongo Score", farmer.momBongoScore != null ? `${farmer.momBongoScore}/100` : "—"],
              ["Inscrit le", fmtDate(farmer.createdAt)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500">{k}</dt>
                <dd className="text-[13px] font-semibold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="panel">
          <div className="section-header"><h3>Cultures ({farmer.cultures.length})</h3></div>
          {farmer.cultures.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune culture enregistrée</p>
          ) : (
            <ul className="space-y-0">
              {farmer.cultures.map((c, i) => (
                <li key={i} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600">{c.commodity}</span>
                  <span className="font-semibold">{c.surfaceHa} ha</span>
                  <span className="pill status-active">{c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
