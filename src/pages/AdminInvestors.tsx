import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInvestors, useInvestorDetail } from "@/hooks/useInvestors";
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

export function AdminInvestors() {
  const navigate = useNavigate();
  const { data: investors = [], isLoading, error } = useInvestors();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return investors;
    return investors.filter((i) => i.fullName.toLowerCase().includes(q) || i.phone.includes(q) || i.email.toLowerCase().includes(q));
  }, [investors, search]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Personnes</div>
          <h1 className="page-title">Investisseurs</h1>
          <p className="page-copy">Comptes investisseurs, portefeuille et historique d'investissement.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un nom, téléphone ou email"
          className="form-input"
          style={{ maxWidth: 320 }}
          aria-label="Rechercher un investisseur"
        />
      </div>

      <article className="panel">
        {error ? (
          <p role="alert" className="error-text" style={{ padding: 24 }}>Impossible de charger les investisseurs. Réessayez plus tard.</p>
        ) : isLoading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Investisseur</th>
                  <th>Wallet USD</th>
                  <th>Investi total</th>
                  <th>Gagné total</th>
                  <th>KYC</th>
                  <th>Inscrit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} onClick={() => navigate(`/admin/investors/${i.id}`)} style={{ cursor: "pointer", opacity: i.isActive ? 1 : 0.5 }}>
                    <td>
                      <div className="font-semibold">{i.fullName}</div>
                      <div style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>{i.phone || i.email || "—"}</div>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(i.walletUsd)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(i.totalInvestedUsd)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(i.totalEarnedUsd)}</td>
                    <td><span className={`pill ${KYC_CLASS[i.kycStatus] ?? ""}`}>{KYC_LABEL[i.kycStatus] ?? i.kycStatus}</span></td>
                    <td style={{ fontSize: 12 }}>{fmtDate(i.createdAt)}</td>
                    <td><span className="text-xs text-blue-600">Détails</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "hsl(var(--gray-500))", padding: 32 }}>Aucun investisseur ne correspond aux filtres actuels.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

export function AdminInvestorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: investor, isLoading, error } = useInvestorDetail(id);

  if (isLoading) {
    return <section className="page"><div className="space-y-4">{[1, 2].map((n) => <div key={n} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}</div></section>;
  }
  if (error) {
    return <section className="page"><p role="alert" className="error-text text-center py-20">Impossible de charger cet investisseur.</p></section>;
  }
  if (!investor) {
    return <section className="page"><p className="text-center text-gray-400 py-20">Investisseur introuvable</p></section>;
  }

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Investisseur</div>
          <h1 className="page-title">{investor.fullName}</h1>
          <p className="page-copy">{investor.phone || investor.email || "—"}</p>
        </div>
        <span className={`pill ${KYC_CLASS[investor.kycStatus] ?? ""}`}>{KYC_LABEL[investor.kycStatus] ?? investor.kycStatus}</span>
      </div>

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header"><h3>Informations</h3></div>
          <dl className="space-y-0">
            {([
              ["Email", investor.email || "—"],
              ["Téléphone", investor.phone || "—"],
              ["Wallet USD", formatUsd(investor.walletUsd)],
              ["Wallet CDF", `${investor.walletCdf.toLocaleString("fr-FR")} FC`],
              ["Investi total", formatUsd(investor.totalInvestedUsd)],
              ["Gagné total", formatUsd(investor.totalEarnedUsd)],
              ["Statut KYC", KYC_LABEL[investor.kycStatus] ?? investor.kycStatus],
              ["Inscrit le", fmtDate(investor.createdAt)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 py-2">
                <dt className="text-[13px] text-gray-500">{k}</dt>
                <dd className="text-[13px] font-semibold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        <AccountActions
          userId={investor.id}
          currentRole="investor"
          disabled={!investor.isActive}
          invalidateKeys={[["admin-investors"], ["admin-investor-detail", investor.id]]}
        />

        <article className="panel">
          <div className="section-header"><h3>Investissements ({investor.investments.length})</h3></div>
          {investor.investments.length === 0 ? (
            <p className="text-sm text-gray-400" style={{ padding: "0 20px 20px" }}>Aucun investissement</p>
          ) : (
            <ul className="space-y-0" style={{ padding: "0 20px 20px" }}>
              {investor.investments.map((inv) => (
                <li key={inv.id} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600 truncate flex-1">{inv.productTitle}</span>
                  <span className="font-semibold mx-3">{formatUsd(inv.amountUsd)}</span>
                  <span className={`pill ${inv.status === "active" ? "status-active" : ""}`}>{inv.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <div className="section-header"><h3>Transactions ({investor.transactions.length})</h3></div>
          {investor.transactions.length === 0 ? (
            <p className="text-sm text-gray-400" style={{ padding: "0 20px 20px" }}>Aucune transaction</p>
          ) : (
            <ul className="space-y-0" style={{ padding: "0 20px 20px" }}>
              {investor.transactions.map((tx) => (
                <li key={tx.id} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600 capitalize">{tx.type.replace(/_/g, " ")}</span>
                  <span className="text-gray-400 text-xs mx-2">{fmtDate(tx.createdAt)}</span>
                  <span className="font-semibold">{formatUsd(tx.amountUsd)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
