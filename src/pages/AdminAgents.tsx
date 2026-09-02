import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAgents, useAgentDetail } from "@/hooks/useAgents";
import { AccountActions } from "@/components/AccountActions";
import { formatUsd } from "@/lib/utils";

const KYC_LABEL: Record<string, string> = {
  none: "Non vérifié", pending: "En attente", verified: "Vérifié", rejected: "Rejeté", correction_requested: "Correction demandée",
};
const KYC_CLASS: Record<string, string> = {
  none: "", pending: "status-pending", verified: "status-active", rejected: "status-blocked", correction_requested: "status-pending",
};

function fmtDate(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleDateString("fr-FR") : "—";
}

export function AdminAgents() {
  const navigate = useNavigate();
  const { data: agents = [], isLoading, error } = useAgents();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => a.fullName.toLowerCase().includes(q) || a.phone.includes(q) || (a.province ?? "").toLowerCase().includes(q));
  }, [agents, search]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Personnes</div>
          <h1 className="page-title">Agents terrain</h1>
          <p className="page-copy">Agents, agriculteurs assignés et rapports de visite.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un nom, téléphone ou province"
          className="form-input"
          style={{ maxWidth: 320 }}
          aria-label="Rechercher un agent"
        />
      </div>

      <article className="panel">
        {error ? (
          <p role="alert" className="error-text" style={{ padding: 24 }}>Impossible de charger les agents. Réessayez plus tard.</p>
        ) : isLoading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Province</th>
                  <th>Agriculteurs assignés</th>
                  <th>KYC</th>
                  <th>Inscrit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} onClick={() => navigate(`/admin/agents/${a.id}`)} style={{ cursor: "pointer", opacity: a.isActive ? 1 : 0.5 }}>
                    <td>
                      <div className="font-semibold">{a.fullName}</div>
                      <div style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>{a.phone || "—"}</div>
                    </td>
                    <td>{a.province ?? "—"}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{a.assignedFarmerCount}</td>
                    <td><span className={`pill ${KYC_CLASS[a.kycStatus] ?? ""}`}>{KYC_LABEL[a.kycStatus] ?? a.kycStatus}</span></td>
                    <td style={{ fontSize: 12 }}>{fmtDate(a.createdAt)}</td>
                    <td><span className="text-xs text-blue-600">Détails</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "hsl(var(--gray-500))", padding: 32 }}>Aucun agent ne correspond aux filtres actuels.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

export function AdminAgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: agent, isLoading, error } = useAgentDetail(id);

  if (isLoading) {
    return <section className="page"><div className="space-y-4">{[1, 2].map((n) => <div key={n} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}</div></section>;
  }
  if (error) {
    return <section className="page"><p role="alert" className="error-text text-center py-20">Impossible de charger cet agent.</p></section>;
  }
  if (!agent) {
    return <section className="page"><p className="text-center text-gray-400 py-20">Agent introuvable</p></section>;
  }

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Agent terrain</div>
          <h1 className="page-title">{agent.fullName}</h1>
          <p className="page-copy">{agent.province ?? "—"}</p>
        </div>
        <span className={`pill ${KYC_CLASS[agent.kycStatus] ?? ""}`}>{KYC_LABEL[agent.kycStatus] ?? agent.kycStatus}</span>
      </div>

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header"><h3>Informations</h3></div>
          <dl className="space-y-0">
            {([
              ["Email", agent.email || "—"],
              ["Téléphone", agent.phone || "—"],
              ["Province", agent.province ?? "—"],
              ["Agriculteurs assignés", String(agent.assignedFarmerCount)],
              ["Statut KYC", KYC_LABEL[agent.kycStatus] ?? agent.kycStatus],
              ["Inscrit le", fmtDate(agent.createdAt)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500">{k}</dt>
                <dd className="text-[13px] font-semibold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        <AccountActions
          userId={agent.id}
          currentRole="agent"
          disabled={!agent.isActive}
          invalidateKeys={[["admin-agents"], ["admin-agent-detail", agent.id]]}
        />

        <article className="panel">
          <div className="section-header"><h3>Agriculteurs assignés ({agent.assignedFarmers.length})</h3></div>
          {agent.assignedFarmers.length === 0 ? (
            <p className="text-sm text-gray-400" style={{ padding: "0 20px 20px" }}>Aucun agriculteur assigné</p>
          ) : (
            <ul className="space-y-0" style={{ padding: "0 20px 20px" }}>
              {agent.assignedFarmers.map((f) => (
                <li key={f.id} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <button onClick={() => navigate(`/admin/farmers/${f.id}`)} className="text-blue-600 hover:underline text-left truncate flex-1">{f.fullName}</button>
                  <span className="text-gray-500 mx-2">{f.province ?? "—"}</span>
                  <span className={`pill ${f.kycStatus === "verified" ? "status-active" : ""}`}>{KYC_LABEL[f.kycStatus] ?? f.kycStatus}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <div className="section-header"><h3>Rapports de visite récents ({agent.recentReports.length})</h3></div>
          {agent.recentReports.length === 0 ? (
            <p className="text-sm text-gray-400" style={{ padding: "0 20px 20px" }}>Aucun rapport de visite</p>
          ) : (
            <ul className="space-y-0" style={{ padding: "0 20px 20px" }}>
              {agent.recentReports.map((r) => (
                <li key={r.id} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700 truncate flex-1">{r.farmerName} · {r.cropType}</span>
                  <span className="text-gray-400 text-xs mx-2">{fmtDate(r.visitDate ?? r.createdAt)}</span>
                  {r.disbursedUsd > 0 && <span className="font-semibold mx-2">{formatUsd(r.disbursedUsd)}</span>}
                  <span className="pill">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
