import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { Tags } from "lucide-react";
import { db } from "@/lib/firebase";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface HarvestOfferRow {
  id: string;
  listingId: string;
  farmerId: string;
  merchantId: string;
  source: "app" | "api";
  partnerId: string | null;
  offerQuantityKg: number;
  offerPricePerKgCdf: number;
  status: "pending" | "accepted" | "declined";
  createdAt?: { seconds: number };
}

const STATUS_OPTIONS = ["pending", "accepted", "declined"] as const;

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function statusPillClass(status: string) {
  if (status === "accepted") return "status-active";
  if (status === "declined") return "status-blocked";
  return "status-pending";
}

function fmtCdf(n: number) {
  return `${n.toLocaleString("fr-FR")} CDF`;
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export function AdminHarvestOffers() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("");
  const [listingFilter, setListingFilter] = useState(searchParams.get("listingId") ?? "");
  const [farmerFilter, setFarmerFilter] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");

  const { data: all = [], isLoading, error } = useQuery({
    queryKey: ["admin-harvest-offers"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "harvest_offers"), orderBy("createdAt", "desc"), limit(100)),
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HarvestOfferRow);
    },
  });

  const rows = all.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (listingFilter && r.listingId !== listingFilter) return false;
    if (farmerFilter && r.farmerId !== farmerFilter) return false;
    if (merchantFilter && r.merchantId !== merchantFilter) return false;
    return true;
  });

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Vente récolte</div>
          <h1 className="page-title">Offres récolte</h1>
          <p className="page-copy">{all.length} offre{all.length !== 1 ? "s" : ""} · {rows.length} affichées</p>
        </div>
        <Tags size={18} className="text-gray-300" />
      </div>

      <article className="panel">
        <div style={{ padding: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            value={listingFilter}
            onChange={(e) => setListingFilter(e.target.value)}
            placeholder="Filtrer par listingId"
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white font-mono"
            style={{ minWidth: 180 }}
          />
          <input
            value={farmerFilter}
            onChange={(e) => setFarmerFilter(e.target.value)}
            placeholder="Filtrer par farmerId"
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white font-mono"
            style={{ minWidth: 180 }}
          />
          <input
            value={merchantFilter}
            onChange={(e) => setMerchantFilter(e.target.value)}
            placeholder="Filtrer par merchantId"
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white font-mono"
            style={{ minWidth: 180 }}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : error ? (
          <p style={{ padding: 20, fontSize: 13, color: "hsl(var(--danger))" }}>
            Impossible de charger les offres : {error instanceof Error ? error.message : "erreur inconnue"}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Agriculteur</th>
                  <th>Marchand</th>
                  <th>Source</th>
                  <th>Quantité (kg)</th>
                  <th>Prix/kg (CDF)</th>
                  <th>Statut</th>
                  <th>Créée le</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{row.listingId}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{row.farmerId}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{row.merchantId}</td>
                    <td>
                      {row.source === "api" ? (
                        <span className="pill">API{row.partnerId ? ` · ${row.partnerId}` : ""}</span>
                      ) : (
                        <span className="pill">App</span>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{row.offerQuantityKg}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCdf(row.offerPricePerKgCdf)}</td>
                    <td>
                      <span className={`pill ${statusPillClass(row.status)}`}>{row.status}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(row.createdAt)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "var(--color-muted)", padding: "32px" }}>
                      Aucune offre trouvée
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
