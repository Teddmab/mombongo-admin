import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMerchants, useMerchantDetail } from "@/hooks/useMerchants";
import { AccountActions } from "@/components/AccountActions";
import { formatUsd } from "@/lib/utils";
import { ORIGIN_LABEL } from "@/hooks/usePartnerInvoices";

const KYC_LABEL: Record<string, string> = {
  none: "Non vérifié", pending: "En attente", verified: "Vérifié", rejected: "Rejeté", correction_requested: "Correction demandée",
};
const KYC_CLASS: Record<string, string> = {
  none: "", pending: "status-pending", verified: "status-active", rejected: "status-blocked", correction_requested: "status-pending",
};

function fmtDate(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleDateString("fr-FR") : "—";
}

export function AdminMerchants() {
  const navigate = useNavigate();
  const { data: merchants = [], isLoading, error } = useMerchants();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter((m) => m.fullName.toLowerCase().includes(q) || m.phone.includes(q) || m.email.toLowerCase().includes(q));
  }, [merchants, search]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Personnes</div>
          <h1 className="page-title">Commerçants</h1>
          <p className="page-copy">Comptes commerçants, offres sur récolte et factures.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un nom, téléphone ou email"
          className="form-input"
          style={{ maxWidth: 320 }}
          aria-label="Rechercher un commerçant"
        />
      </div>

      <article className="panel">
        {error ? (
          <p role="alert" className="error-text" style={{ padding: 24 }}>Impossible de charger les commerçants. Réessayez plus tard.</p>
        ) : isLoading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Commerçant</th>
                  <th>Type de commerce</th>
                  <th>Wallet USD</th>
                  <th>Offres faites</th>
                  <th>KYC</th>
                  <th>Inscrit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} onClick={() => navigate(`/admin/merchants/${m.id}`)} style={{ cursor: "pointer", opacity: m.isActive ? 1 : 0.5 }}>
                    <td>
                      <div className="font-semibold">{m.fullName}</div>
                      <div style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>{m.phone || m.email || "—"}</div>
                    </td>
                    <td>{m.businessType ?? "—"}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(m.walletUsd)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{m.offersCount}</td>
                    <td><span className={`pill ${KYC_CLASS[m.kycStatus] ?? ""}`}>{KYC_LABEL[m.kycStatus] ?? m.kycStatus}</span></td>
                    <td style={{ fontSize: 12 }}>{fmtDate(m.createdAt)}</td>
                    <td><span className="text-xs text-blue-600">Détails</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "hsl(var(--gray-500))", padding: 32 }}>Aucun commerçant ne correspond aux filtres actuels.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

export function AdminMerchantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: merchant, isLoading, error } = useMerchantDetail(id);

  if (isLoading) {
    return <section className="page"><div className="space-y-4">{[1, 2].map((n) => <div key={n} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}</div></section>;
  }
  if (error) {
    return <section className="page"><p role="alert" className="error-text text-center py-20">Impossible de charger ce commerçant.</p></section>;
  }
  if (!merchant) {
    return <section className="page"><p className="text-center text-gray-400 py-20">Commerçant introuvable</p></section>;
  }

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Commerçant</div>
          <h1 className="page-title">{merchant.fullName}</h1>
          <p className="page-copy">{merchant.businessType ?? "—"}</p>
        </div>
        <span className={`pill ${KYC_CLASS[merchant.kycStatus] ?? ""}`}>{KYC_LABEL[merchant.kycStatus] ?? merchant.kycStatus}</span>
      </div>

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header"><h3>Informations</h3></div>
          <dl className="space-y-0">
            {([
              ["Email", merchant.email || "—"],
              ["Téléphone", merchant.phone || "—"],
              ["Type de commerce", merchant.businessType ?? "—"],
              ["Wallet USD", formatUsd(merchant.walletUsd)],
              ["Offres faites", String(merchant.offersCount)],
              ["Statut KYC", KYC_LABEL[merchant.kycStatus] ?? merchant.kycStatus],
              ["Inscrit le", fmtDate(merchant.createdAt)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500">{k}</dt>
                <dd className="text-[13px] font-semibold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        <AccountActions
          userId={merchant.id}
          currentRole="merchant"
          disabled={!merchant.isActive}
          invalidateKeys={[["admin-merchants"], ["admin-merchant-detail", merchant.id]]}
        />

        <article className="panel">
          <div className="section-header"><h3>Offres sur récolte ({merchant.recentOffers.length})</h3></div>
          {merchant.recentOffers.length === 0 ? (
            <p className="text-sm text-gray-400" style={{ padding: "0 20px 20px" }}>Aucune offre</p>
          ) : (
            <ul className="space-y-0" style={{ padding: "0 20px 20px" }}>
              {merchant.recentOffers.map((o) => (
                <li key={o.id} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700 truncate flex-1">{o.farmerName} · {o.offerQuantityKg} kg</span>
                  <span className="font-semibold mx-2">{o.offerPricePerKgCdf.toLocaleString("fr-FR")} CDF/kg</span>
                  <span className="pill">{o.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <div className="section-header"><h3>Factures ({merchant.recentInvoices.length})</h3></div>
          {merchant.recentInvoices.length === 0 ? (
            <p className="text-sm text-gray-400" style={{ padding: "0 20px 20px" }}>Aucune facture</p>
          ) : (
            <ul className="space-y-0" style={{ padding: "0 20px 20px" }}>
              {merchant.recentInvoices.map((inv) => (
                <li key={inv.id} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <button onClick={() => navigate(`/admin/partner-invoices/${inv.id}`)} className="text-blue-600 hover:underline text-left truncate flex-1">
                    {ORIGIN_LABEL[inv.origin as keyof typeof ORIGIN_LABEL] ?? inv.origin}
                  </button>
                  <span className="font-semibold mx-2">{formatUsd(inv.amountUsd)}</span>
                  <span className={`pill ${inv.status === "paid" ? "status-active" : ""}`}>{inv.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
