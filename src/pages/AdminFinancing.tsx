import { useQuery } from "@tanstack/react-query";
import { formatUsd } from "@/lib/utils";
import { adminService } from "@/services/admin.service";

export function AdminFinancing() {
  const { data = [] } = useQuery({ queryKey: ["admin-financing"], queryFn: () => adminService.getFinancingPipeline() });

  return (
    <section className="page">
      <div>
        <div className="section-kicker">Financement</div>
        <h1 className="page-title">Pipeline des demandes agriculteurs</h1>
        <p className="page-copy">Ce stub prépare les écrans d'arbitrage dossier par dossier sans dépendre encore du backend final.</p>
      </div>

      <div className="feature-grid">
        {data.map((row) => (
          <article key={row.id} className="feature-card">
            <div className="section-header">
              <strong>{row.farmer}</strong>
              <span className={`pill status-${row.status}`}>{row.status}</span>
            </div>
            <p className="muted">Culture ciblée: {row.crop}</p>
            <p className="metric-value" style={{ fontSize: "1.55rem" }}>{formatUsd(row.requestedUsd)}</p>
            <p className="muted">Dossier {row.id}</p>
          </article>
        ))}
      </div>
    </section>
  );
}