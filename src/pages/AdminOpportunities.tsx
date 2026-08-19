import { useQuery } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { formatUsd } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  icon?: string;
  category: string;
  location?: string;
  farmer?: string;
  roi: number;
  minInvest: number;
  duration: number;
  targetUsd: number;
  invested: number;
  investorsCount: number;
  status: "active" | "inactive" | "draft";
}

const getProductsAdminFn = httpsCallable<Record<string, never>, { products: Product[] }>(functions, "getProductsAdmin");

function useProducts() {
  return useQuery({
    queryKey: ["admin-products-opps"],
    queryFn: async () => {
      const res = await getProductsAdminFn({});
      return (res.data as { products: Product[] }).products;
    },
    staleTime: 60_000,
  });
}

const STATUS_LABELS: Record<Product["status"], string> = {
  active: "Ouverte",
  inactive: "Clôturée",
  draft: "Brouillon",
};
const STATUS_CLASSES: Record<Product["status"], string> = {
  active: "pill status-active",
  inactive: "pill",
  draft: "pill status-pending",
};

export function AdminOpportunities() {
  const { data: products = [], isLoading } = useProducts();

  const open = products.filter(p => p.status === "active");
  const totalRaised = products.reduce((s, p) => s + (p.invested ?? 0), 0);
  const totalTarget = products.reduce((s, p) => s + (p.targetUsd ?? 0), 0);
  const avgRoi = open.length ? (open.reduce((s, p) => s + p.roi, 0) / open.length).toFixed(0) : "—";

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Opportunités</div>
          <h1 className="page-title">Pipeline d'investissement</h1>
          <p className="page-copy">Produits agricoles proposés aux investisseurs.</p>
        </div>
      </div>

      <div className="stats-grid">
        <article className="metric-card">
          <p className="section-kicker">Ouvertes</p>
          <p className="metric-value">{isLoading ? "…" : open.length}</p>
        </article>
        <article className="metric-card">
          <p className="section-kicker">Capital levé</p>
          <p className="metric-value">{isLoading ? "…" : formatUsd(totalRaised)}</p>
        </article>
        <article className="metric-card">
          <p className="section-kicker">Capital cible</p>
          <p className="metric-value">{isLoading ? "…" : formatUsd(totalTarget)}</p>
        </article>
        <article className="metric-card">
          <p className="section-kicker">ROI moyen</p>
          <p className="metric-value">{isLoading ? "…" : `${avgRoi}%`}</p>
        </article>
      </div>

      <article className="panel">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map(n => <div key={n} className="h-14 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Aucune opportunité</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Opportunité</th>
                  <th>Localisation</th>
                  <th>ROI</th>
                  <th>Durée</th>
                  <th>Progression</th>
                  <th>Investisseurs</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const pct = p.targetUsd > 0 ? Math.min(100, (p.invested / p.targetUsd) * 100) : 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          {p.icon && <span style={{ fontSize: 18 }}>{p.icon}</span>}
                          <div>
                            <p className="font-semibold text-sm">{p.name}</p>
                            {p.farmer && <p style={{ fontSize: 11, color: "var(--color-muted)" }}>{p.farmer}</p>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{p.location || "—"}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-success, #166534)", fontWeight: 700 }}>
                        {p.roi}%
                      </td>
                      <td style={{ fontSize: 12 }}>{p.duration}j</td>
                      <td style={{ minWidth: 140 }}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(p.invested)}</span>
                          <span style={{ color: "var(--color-muted)" }}>{formatUsd(p.targetUsd)}</span>
                        </div>
                        <div style={{ height: 4, background: "hsl(var(--gray-100))", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "hsl(142 70% 35%)" }} />
                        </div>
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.investorsCount}</td>
                      <td>
                        <span className={STATUS_CLASSES[p.status]}>{STATUS_LABELS[p.status]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
