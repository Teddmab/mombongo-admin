import { useState } from "react";
import {
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Search, Clock,
  FileText, AlertTriangle, User,
} from "lucide-react";
import {
  useAdminKycQueue, useAdminKycSummary, useAdminKycDocumentUrls, useAdminReviewKyc,
  type KycQueueTab, type KycQueueRow,
} from "@/hooks/useAdminKyc";

const TABS: { id: KycQueueTab; label: string }[] = [
  { id: "pending", label: "À vérifier" },
  { id: "correction_requested", label: "En attente d'informations" },
  { id: "done", label: "Terminés" },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "status-pending" },
  correction_requested: { label: "Correction demandée", cls: "status-pending" },
  approved: { label: "Validé", cls: "status-active" },
  rejected: { label: "Rejeté", cls: "status-blocked" },
};

const ROLE_LABEL: Record<string, string> = {
  farmer: "Agriculteur", merchant: "Commerçant", agent: "Agent terrain",
  investor: "Investisseur", admin: "Administrateur",
};

function fmtDateTime(ms: number | null) {
  return ms ? new Date(ms).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export function AdminKyc() {
  const [tab, setTab] = useState<KycQueueTab>("pending");
  const [q, setQ] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const { data: summary } = useAdminKycSummary();
  const { data: rows = [], isLoading, error } = useAdminKycQueue(tab);

  const filtered = rows.filter((r) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return r.name.toLowerCase().includes(needle) || r.role.toLowerCase().includes(needle) || r.province.toLowerCase().includes(needle);
  });

  const selected = filtered.find((r) => r.uid === selectedUid) ?? null;

  function selectTab(next: KycQueueTab) {
    setTab(next);
    setSelectedUid(null);
  }

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
        <article className="metric-card">
          <div className="metric-top"><span className="badge">À vérifier</span><ShieldCheck size={18} /></div>
          <p className="metric-value">{summary ? summary.pending : "…"}</p>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Informations manquantes</span><ShieldAlert size={18} /></div>
          <p className="metric-value">{summary ? summary.correctionRequested : "…"}</p>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Validés ce mois</span><CheckCircle2 size={18} /></div>
          <p className="metric-value">{summary ? summary.approvedThisMonth : "…"}</p>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Rejetés ce mois</span><XCircle size={18} /></div>
          <p className="metric-value">{summary ? summary.rejectedThisMonth : "…"}</p>
        </article>
      </div>

      <div className="toolbar-row">
        <div className="period-toggle">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`period-btn${tab === t.id ? " active" : ""}`} onClick={() => selectTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--gray-400))" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une personne, un rôle ou une province…"
            className="search-input"
            style={{ paddingLeft: 36 }}
          />
        </div>
      </div>

      <div className="queue-detail-grid">
        <article className="panel">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((n) => <div key={n} className="h-12 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : error ? (
            <p style={{ padding: 24, fontSize: 13, color: "hsl(var(--danger))" }}>
              Impossible de charger la file KYC : {error instanceof Error ? error.message : "erreur inconnue"}
            </p>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <ShieldCheck size={28} style={{ color: "hsl(var(--gray-300, 220 13% 85%))", margin: "0 auto 10px" }} />
              <p style={{ fontWeight: 700, fontSize: 14 }}>Aucun dossier {q ? "correspondant" : "dans cette file"}</p>
            </div>
          ) : (
            filtered.map((r) => {
              const s = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
              return (
                <button
                  key={r.uid}
                  type="button"
                  className={`queue-row${selectedUid === r.uid ? " selected" : ""}`}
                  onClick={() => setSelectedUid(r.uid)}
                >
                  <span className="avatar-chip" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0 }}>{initials(r.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</p>
                    <p style={{ fontSize: 11, color: "hsl(var(--gray-500))" }}>
                      {(ROLE_LABEL[r.role] ?? r.role) || "—"}{r.province ? ` · ${r.province}` : ""}
                    </p>
                    <p style={{ fontSize: 10, color: "hsl(var(--gray-400))", marginTop: 2 }}>
                      Soumis {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("fr-FR") : "—"} · Profil {r.completePct}%
                    </p>
                  </div>
                  <span className={`pill ${s.cls}`} style={{ flexShrink: 0 }}>{s.label}</span>
                </button>
              );
            })
          )}
        </article>

        {selected ? (
          <KycDetailPane row={selected} onResolved={() => setSelectedUid(null)} />
        ) : (
          <article className="panel" style={{ padding: 40, textAlign: "center", color: "hsl(var(--gray-400))" }}>
            <User size={26} style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13 }}>Sélectionnez un dossier pour l'examiner.</p>
          </article>
        )}
      </div>
    </section>
  );
}

function KycDetailPane({ row, onResolved }: { row: KycQueueRow; onResolved: () => void }) {
  const { data: doc, isLoading: docLoading, error: docError } = useAdminKycDocumentUrls(row.uid);
  const review = useAdminReviewKyc();
  const [mode, setMode] = useState<"reject" | "correction" | null>(null);
  const [reason, setReason] = useState("");

  const s = STATUS_LABEL[row.status] ?? STATUS_LABEL.pending;
  const actionable = row.status === "pending" || row.status === "correction_requested";

  async function decide(decision: "approve" | "reject" | "request_correction") {
    try {
      await review.mutateAsync({ uid: row.uid, decision, reason: reason.trim() || undefined });
      setMode(null);
      setReason("");
      onResolved();
    } catch {
      // review.error renders below — nothing else to do here.
    }
  }

  return (
    <article className="panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16 }}>Dossier de {row.name}</h3>
          <p style={{ fontSize: 12, color: "hsl(var(--gray-500))", marginTop: 2 }}>{(ROLE_LABEL[row.role] ?? row.role) || "—"}</p>
        </div>
        <span className={`pill ${s.cls}`}>{s.label}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
        {([
          ["Téléphone", row.phone || "—"],
          ["Province", row.province || "—"],
          ["Rôle", (ROLE_LABEL[row.role] ?? row.role) || "—"],
          ["Soumis le", fmtDateTime(row.submittedAt)],
          ["Complétude du profil", `${row.completePct}%`],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--gray-400))", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</p>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--gray-400))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Pièce d'identité
        </p>
        {docLoading ? (
          <div className="doc-image-grid">
            {[1, 2].map((n) => <div key={n} style={{ height: 140, borderRadius: 12, background: "hsl(var(--gray-100))" }} className="animate-pulse" />)}
          </div>
        ) : docError ? (
          <p style={{ fontSize: 13, color: "hsl(var(--danger))" }}>
            Impossible de charger les documents : {docError instanceof Error ? docError.message : "erreur inconnue"}
          </p>
        ) : doc && doc.photoUrls.length > 0 ? (
          <div className="doc-image-grid">
            {doc.photoUrls.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={i === 0 ? "Recto" : "Verso"} />
                <p style={{ fontSize: 10, color: "hsl(var(--gray-400))", marginTop: 4, textAlign: "center" }}>{i === 0 ? "Recto" : "Verso"}</p>
              </a>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "hsl(var(--gray-400))" }}>Aucun document.</p>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--gray-400))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Historique du dossier
        </p>
        <div>
          <div className="timeline-item">
            <span className="timeline-dot" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Dossier soumis</p>
              <p style={{ fontSize: 11, color: "hsl(var(--gray-400))" }}>{fmtDateTime(row.submittedAt)}</p>
            </div>
          </div>
          <div className="timeline-item">
            <span className="timeline-dot" style={{ background: actionable ? "hsl(var(--gray-300, 220 13% 85%))" : undefined }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{actionable ? "En attente d'une décision" : s.label}</p>
              {doc?.reviewedAt && (
                <p style={{ fontSize: 11, color: "hsl(var(--gray-400))" }}>
                  {fmtDateTime((doc.reviewedAt as { seconds: number }).seconds * 1000)}
                  {doc.reviewedBy ? ` · par ${doc.reviewedBy}` : ""}
                </p>
              )}
              {doc?.rejectionReason && (
                <p style={{ fontSize: 12, color: "hsl(var(--gray-600, 220 9% 40%))", marginTop: 4 }}>« {doc.rejectionReason} »</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {actionable && (
        <div style={{ marginTop: 22, borderTop: "1px solid hsl(var(--gray-100))", paddingTop: 16 }}>
          {review.isError && (
            <p style={{ fontSize: 12, color: "hsl(var(--danger))", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={13} />
              {review.error instanceof Error ? review.error.message : "Erreur lors de la décision"}
            </p>
          )}

          {mode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                className="reason-box"
                placeholder={mode === "reject" ? "Raison du rejet (obligatoire)" : "Précisez ce qui manque (obligatoire)"}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={mode === "reject" ? "button" : "button"}
                  style={mode === "reject" ? { background: "hsl(0 72% 51%)" } : undefined}
                  disabled={!reason.trim() || review.isPending}
                  onClick={() => decide(mode === "reject" ? "reject" : "request_correction")}
                >
                  {review.isPending ? "…" : mode === "reject" ? "Confirmer le rejet" : "Envoyer la demande"}
                </button>
                <button type="button" className="outline-button" onClick={() => { setMode(null); setReason(""); }}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="outline-button"
                style={{ borderColor: "hsl(0 72% 85%)", color: "hsl(0 72% 45%)" }}
                onClick={() => setMode("reject")}
                disabled={review.isPending}
              >
                <XCircle size={14} /> Rejeter
              </button>
              <button type="button" className="outline-button" onClick={() => setMode("correction")} disabled={review.isPending}>
                <FileText size={14} /> Demander une correction
              </button>
              <button type="button" className="button" onClick={() => decide("approve")} disabled={review.isPending} style={{ marginLeft: "auto" }}>
                {review.isPending ? <Clock size={14} /> : <CheckCircle2 size={14} />} Valider le dossier
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
