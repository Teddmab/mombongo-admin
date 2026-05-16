import { useQuery } from "@tanstack/react-query";
import { formatCdf } from "@/lib/utils";
import { adminService } from "@/services/admin.service";

export function AdminBourse() {
  const { data = [] } = useQuery({ queryKey: ["admin-bourse"], queryFn: () => adminService.getBoursePipeline() });

  return (
    <section className="page">
      <div>
        <div className="section-kicker">Bourse</div>
        <h1 className="page-title">Routes et opérations commerciales</h1>
        <p className="page-copy">Tableau de suivi des routes logistiques et des opportunités en préparation.</p>
      </div>

      <div className="summary-grid">
        {data.map((row) => (
          <article key={row.id} className="alert-card">
            <div className="section-header">
              <strong>{row.route}</strong>
              <span className={`pill status-${row.status}`}>{row.status}</span>
            </div>
            <p className="muted">Produit: {row.commodity}</p>
            <p className="metric-value" style={{ fontSize: "1.55rem" }}>{formatCdf(row.targetCdf)}</p>
            <p className="muted">Levée visée pour {row.id}</p>
          </article>
        ))}
      </div>
    </section>
  );
}