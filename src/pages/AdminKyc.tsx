import { useMemo, useState } from "react";
import { ShieldCheck, ShieldX, ShieldAlert, Loader2 } from "lucide-react";
import {
  useKycSubmissions, useKycSubmissionDetail, useKycDocumentUrls, useReviewKyc,
  queueTabFilter, isThisMonth, type KycQueueTab, type KycStatus,
} from "@/hooks/useKyc";

const TABS: { key: KycQueueTab; label: string }[] = [
  { key: "pending", label: "À vérifier" },
  { key: "correction_requested", label: "En attente d'informations" },
  { key: "done", label: "Terminés" },
];

const STATUS_LABEL: Record<KycStatus, string> = {
  pending: "En attente",
  verified: "Validé",
  rejected: "Rejeté",
  correction_requested: "Correction demandée",
};
const STATUS_PILL: Record<KycStatus, string> = {
  pending: "status-pending",
  verified: "status-active",
  rejected: "status-blocked",
  correction_requested: "status-pending",
};

function fmtDateTime(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

export function AdminKyc() {
  const { data: allRows = [], isLoading, error } = useKycSubmissions();
  const [tab, setTab] = useState<KycQueueTab>("pending");
  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const stats = useMemo(() => ({
    pending: allRows.filter((r) => r.status === "pending").length,
    correctionRequested: allRows.filter((r) => r.status === "correction_requested").length,
    verifiedThisMonth: allRows.filter((r) => r.status === "verified" && isThisMonth(r.reviewedAt)).length,
    rejectedThisMonth: allRows.filter((r) => r.status === "rejected" && isThisMonth(r.reviewedAt)).length,
  }), [allRows]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows
      .filter((r) => queueTabFilter(r, tab))
      .filter((r) => !q || r.fullName.toLowerCase().includes(q) || r.role.toLowerCase().includes(q));
  }, [allRows, tab, search]);

  const selected = selectedUid ?? rows[0]?.uid;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Conformité</div>
          <h1 className="page-title">Vérification KYC</h1>
          <p className="page-copy">Examinez les dossiers qui nécessitent une décision.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="metric-card">
          <p className="section-kicker">À vérifier</p>
          <p className="metric-value">{stats.pending}</p>
        </div>
        <div className="metric-card">
          <p className="section-kicker">Informations manquantes</p>
          <p className="metric-value">{stats.correctionRequested}</p>
        </div>
        <div className="metric-card">
          <p className="section-kicker">Validés ce mois</p>
          <p className="metric-value">{stats.verifiedThisMonth}</p>
        </div>
        <div className="metric-card">
          <p className="section-kicker">Rejetés ce mois</p>
          <p className="metric-value">{stats.rejectedThisMonth}</p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="error-text" style={{ padding: 24 }}>
          Impossible de charger la file KYC. Réessayez plus tard.
        </p>
      ) : (
        <div className="panel-grid" style={{ gridTemplateColumns: "380px 1fr" }}>
          <article className="panel">
            <div className="flex gap-1.5 flex-wrap" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className="button"
                  style={tab === t.key ? { background: "var(--color-accent, #0f5132)", color: "#fff" } : undefined}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une personne ou un rôle…"
              className="form-input"
              style={{ marginTop: 12 }}
              aria-label="Rechercher dans la file KYC"
            />

            {isLoading ? (
              <div className="space-y-2" style={{ marginTop: 12 }}>
                {[1, 2, 3].map((n) => <div key={n} className="h-14 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">Aucun dossier dans cette file.</p>
            ) : (
              <ul className="space-y-1" style={{ marginTop: 12 }}>
                {rows.map((r) => (
                  <li key={r.uid}>
                    <button
                      onClick={() => setSelectedUid(r.uid)}
                      className="list-row w-full text-left"
                      style={{ background: selected === r.uid ? "var(--color-row-active, #f0f7f2)" : undefined }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-sm">{r.fullName}</div>
                          <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{r.role} · {fmtDateTime(r.submittedAt)}</div>
                        </div>
                        <span className={`pill ${STATUS_PILL[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <KycDetailPane uid={selected} />
        </div>
      )}
    </section>
  );
}

function KycDetailPane({ uid }: { uid: string | undefined }) {
  const { data: detail, isLoading } = useKycSubmissionDetail(uid);
  const { data: docs, isLoading: docsLoading, error: docsError } = useKycDocumentUrls(uid);
  const review = useReviewKyc();
  const [reasonPrompt, setReasonPrompt] = useState<"rejected" | "correction_requested" | null>(null);
  const [reason, setReason] = useState("");

  if (!uid) {
    return <article className="panel"><p className="text-center text-gray-400 py-20">Sélectionnez un dossier</p></article>;
  }
  if (isLoading || !detail) {
    return <article className="panel"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></article>;
  }

  const busy = review.isPending;
  const decided = detail.status === "verified" || detail.status === "rejected";

  async function submitDecision(decision: KycStatus, decisionReason?: string) {
    await review.mutateAsync({ uid: uid!, decision, reason: decisionReason });
    setReasonPrompt(null);
    setReason("");
  }

  return (
    <article className="panel">
      <div className="flex items-start justify-between">
        <div>
          <h3 style={{ margin: 0 }}>Dossier de {detail.fullName}</h3>
          <p className="muted" style={{ marginTop: 4 }}>{detail.role} · {detail.province ?? "—"} · Soumis le {fmtDateTime(detail.submittedAt)}</p>
        </div>
        <span className={`pill ${STATUS_PILL[detail.status]}`}>{STATUS_LABEL[detail.status]}</span>
      </div>

      <div className="section-header" style={{ marginTop: 16 }}><h3>Pièce d'identité — {detail.documentType}</h3></div>
      {docsError ? (
        <p role="alert" className="error-text">Impossible de charger les documents.</p>
      ) : docsLoading ? (
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <div className="flex gap-3 flex-wrap">
          {(docs?.urls ?? []).map((url, i) => (
            <img key={i} src={url} alt={`Document ${i + 1}`} style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 12, border: "1px solid var(--color-border, #eee)" }} />
          ))}
          {docs?.urls.length === 0 && <p className="muted">Aucun document.</p>}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Aperçu généré via une URL signée temporaire — jamais un lien public.
      </p>

      <div className="section-header" style={{ marginTop: 16 }}><h3>Historique</h3></div>
      <ul className="space-y-0">
        <li className="flex justify-between text-sm py-2 border-b border-gray-50">
          <span className="text-gray-600">Dossier soumis</span>
          <span>{fmtDateTime(detail.submittedAt)}</span>
        </li>
        {detail.reviewedAt && (
          <li className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
            <span className="text-gray-600">Décision — {STATUS_LABEL[detail.status]}{detail.rejectionReason ? ` (${detail.rejectionReason})` : ""}</span>
            <span>{fmtDateTime(detail.reviewedAt)}</span>
          </li>
        )}
      </ul>

      {reasonPrompt && (
        <div style={{ marginTop: 16 }}>
          <label className="form-label" htmlFor="kyc-reason">
            {reasonPrompt === "rejected" ? "Raison du rejet" : "Informations manquantes à demander"}
          </label>
          <textarea
            id="kyc-reason"
            className="form-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <div className="button-row" style={{ marginTop: 8 }}>
            <button
              onClick={() => submitDecision(reasonPrompt, reason)}
              disabled={busy || !reason.trim()}
              className="btn-primary"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : "Confirmer"}
            </button>
            <button onClick={() => { setReasonPrompt(null); setReason(""); }} className="button">Annuler</button>
          </div>
        </div>
      )}

      {!decided && !reasonPrompt && (
        <div className="button-row" style={{ marginTop: 16 }}>
          <button
            onClick={() => setReasonPrompt("rejected")}
            disabled={busy}
            className="button"
            style={{ color: "var(--color-danger, #b91c1c)" }}
          >
            <ShieldX size={14} /> Rejeter
          </button>
          <button
            onClick={() => setReasonPrompt("correction_requested")}
            disabled={busy}
            className="button"
          >
            <ShieldAlert size={14} /> Demander une correction
          </button>
          <button
            onClick={() => submitDecision("verified")}
            disabled={busy}
            className="btn-primary"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <><ShieldCheck size={14} /> Valider le dossier</>}
          </button>
        </div>
      )}
    </article>
  );
}
