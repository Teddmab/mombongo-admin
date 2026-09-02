import { useMemo, useState } from "react";
import {
  ChevronRight, ChevronLeft, Search, FileSearch, AlertCircle, CheckCircle2, XCircle,
  ShieldX, ShieldAlert, ShieldCheck, Loader2, WifiOff, RefreshCw, X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ApproveKycDialog, RejectKycDialog, RequestCorrectionDialog } from "@/components/kyc/KycDecisionDialogs";
import {
  useKycSubmissions, useKycSubmissionDetail, useKycDocumentUrls, useReviewKyc,
  queueTabFilter, isThisMonth, type KycQueueItem, type KycQueueTab, type KycStatus, type KycSubmissionDetail,
} from "@/hooks/useKyc";

const TABS: { key: KycQueueTab; label: string }[] = [
  { key: "pending", label: "À vérifier" },
  { key: "correction_requested", label: "En attente d'informations" },
  { key: "done", label: "Terminés" },
];

const STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Dossier complet",
  verified: "Validé",
  rejected: "Rejeté",
  correction_requested: "Informations manquantes",
};
const STATUS_PILL: Record<KycStatus, string> = {
  pending: "status-pending",
  verified: "status-active",
  rejected: "status-blocked",
  correction_requested: "status-pending",
};

const PAGE_SIZE = 10;

function fmtDate(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";
}
function fmtDateShort(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleDateString("fr-FR") : "—";
}

type DoneFilter = "all" | "verified" | "rejected";

export function AdminKyc() {
  const { data: allRows = [], isLoading, error, refetch, isRefetching } = useKycSubmissions();
  const online = useOnlineStatus();

  const [tab, setTab] = useState<KycQueueTab>("pending");
  const [doneFilter, setDoneFilter] = useState<DoneFilter>("all");
  const [monthOnly, setMonthOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const stats = useMemo(() => ({
    pending: allRows.filter((r) => r.status === "pending").length,
    correctionRequested: allRows.filter((r) => r.status === "correction_requested").length,
    verifiedThisMonth: allRows.filter((r) => r.status === "verified" && isThisMonth(r.reviewedAt)).length,
    rejectedThisMonth: allRows.filter((r) => r.status === "rejected" && isThisMonth(r.reviewedAt)).length,
  }), [allRows]);

  function selectKpi(nextTab: KycQueueTab, nextDoneFilter: DoneFilter, nextMonthOnly: boolean) {
    setTab(nextTab); setDoneFilter(nextDoneFilter); setMonthOnly(nextMonthOnly); setPage(1);
  }

  function selectTab(nextTab: KycQueueTab) {
    setTab(nextTab); setDoneFilter("all"); setMonthOnly(false); setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value); setPage(1);
  }

  function clearFilters() {
    setSearch(""); setTab("pending"); setDoneFilter("all"); setMonthOnly(false); setPage(1);
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows
      .filter((r) => queueTabFilter(r, tab))
      .filter((r) => tab !== "done" || doneFilter === "all" || r.status === doneFilter)
      .filter((r) => !monthOnly || isThisMonth(r.reviewedAt))
      .filter((r) => !q
        || r.fullName.toLowerCase().includes(q)
        || r.role.toLowerCase().includes(q)
        || (r.province ?? "").toLowerCase().includes(q));
  }, [allRows, tab, doneFilter, monthOnly, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = selectedUid ?? pagedRows[0]?.uid;

  function handleDecided() {
    // Auto-advance: clear the explicit selection so the next dossier still
    // in view (if any) becomes selected once the queue refetches. The
    // reviewer can still search/switch tabs to come back to this one.
    setSelectedUid(null);
  }

  return (
    <section className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 13 }}>
        <ChevronLeft size={14} style={{ color: "hsl(var(--gray-400))" }} />
        <span style={{ color: "hsl(var(--gray-400))" }}>Personnes</span>
        <span style={{ color: "hsl(var(--gray-300))" }}>/</span>
        <span style={{ color: "hsl(var(--gray-700))", fontWeight: 600 }}>KYC &amp; conformité</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Vérification KYC</h1>
          <p className="page-copy">Examinez les dossiers qui nécessitent une décision.</p>
        </div>
      </div>

      {!online && (
        <div className="hint-box" style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center", background: "hsl(var(--amber-50))", borderColor: "hsl(var(--amber-100))" }}>
          <WifiOff size={16} />
          <span>Connexion perdue. Reconnectez-vous pour prendre une décision.</span>
        </div>
      )}

      <div className="stats-grid">
        <button type="button" onClick={() => selectKpi("pending", "all", false)} className="metric-card" style={{ textAlign: "left", cursor: "pointer" }}>
          <div className="flex items-center justify-between">
            <FileSearch size={18} style={{ color: "hsl(var(--gray-700))" }} />
            <ChevronRight size={16} className="muted" />
          </div>
          <p className="section-kicker" style={{ marginTop: 8 }}>À vérifier</p>
          <p className="metric-value">{stats.pending}</p>
        </button>
        <button type="button" onClick={() => selectKpi("correction_requested", "all", false)} className="metric-card" style={{ textAlign: "left", cursor: "pointer" }}>
          <div className="flex items-center justify-between">
            <AlertCircle size={18} style={{ color: "hsl(var(--info))" }} />
            <ChevronRight size={16} className="muted" />
          </div>
          <p className="section-kicker" style={{ marginTop: 8 }}>Informations manquantes</p>
          <p className="metric-value">{stats.correctionRequested}</p>
        </button>
        <button type="button" onClick={() => selectKpi("done", "verified", true)} className="metric-card" style={{ textAlign: "left", cursor: "pointer" }}>
          <div className="flex items-center justify-between">
            <CheckCircle2 size={18} style={{ color: "hsl(var(--green-700))" }} />
            <ChevronRight size={16} className="muted" />
          </div>
          <p className="section-kicker" style={{ marginTop: 8 }}>Validés ce mois</p>
          <p className="metric-value">{stats.verifiedThisMonth}</p>
        </button>
        <button type="button" onClick={() => selectKpi("done", "rejected", true)} className="metric-card" style={{ textAlign: "left", cursor: "pointer" }}>
          <div className="flex items-center justify-between">
            <XCircle size={18} style={{ color: "hsl(var(--danger))" }} />
            <ChevronRight size={16} className="muted" />
          </div>
          <p className="section-kicker" style={{ marginTop: 8 }}>Rejetés ce mois</p>
          <p className="metric-value">{stats.rejectedThisMonth}</p>
        </button>
      </div>

      {error ? (
        <p role="alert" className="error-text" style={{ padding: 24 }}>
          Impossible de charger la file KYC. Réessayez plus tard.
        </p>
      ) : (
        <div className="panel-grid" style={{ gridTemplateColumns: "minmax(360px, 42%) 1fr", alignItems: "start" }}>
          <article className="panel">
            <div style={{ padding: 20 }}>
              <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Statut">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => selectTab(t.key)}
                    className={`button-outline ${tab === t.key ? "active" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ position: "relative", marginTop: 12 }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--gray-400))" }} />
                <input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Rechercher une personne, un rôle ou une province…"
                  className="form-input"
                  style={{ paddingLeft: 34, paddingRight: search ? 34 : undefined, width: "100%" }}
                  aria-label="Rechercher dans la file KYC"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    aria-label="Effacer la recherche"
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--gray-400))" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2" style={{ padding: "0 20px 20px" }}>
                {[1, 2, 3, 4].map((n) => <div key={n} style={{ height: 68 }} className="bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : allRows.length === 0 ? (
              <div style={{ padding: "0 20px 32px", textAlign: "center" }}>
                <p className="font-semibold text-sm">Aucun dossier à vérifier</p>
                <p className="muted" style={{ marginTop: 4 }}>Les nouveaux dossiers apparaîtront ici.</p>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: "0 20px 32px", textAlign: "center" }}>
                <p className="text-sm text-gray-500">Aucun dossier ne correspond à votre recherche.</p>
                <button type="button" onClick={clearFilters} className="button-outline" style={{ marginTop: 8 }}>
                  Effacer les filtres
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between" style={{ padding: "0 20px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--gray-400))" }}>
                  <span>Personne</span>
                  <span>Statut</span>
                </div>
                <ul style={{ padding: "0 20px 12px" }} className="space-y-2">
                  {pagedRows.map((r) => (
                    <li key={r.uid}>
                      <QueueRow row={r} selected={selected === r.uid} onSelect={() => setSelectedUid(r.uid)} />
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between" style={{ padding: "12px 20px 20px", borderTop: "1px solid hsl(var(--gray-50))" }}>
                  <span className="muted">{rows.length} résultat{rows.length > 1 ? "s" : ""}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="button-outline" style={{ height: 32, padding: "0 10px" }}>
                      <ChevronLeft size={14} />
                    </button>
                    <span className="muted">{page} / {totalPages}</span>
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="button-outline" style={{ height: 32, padding: "0 10px" }}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </article>

          <KycDetailPane uid={selected} online={online} onDecided={handleDecided} onRefetchQueue={refetch} queueRefetching={isRefetching} />
        </div>
      )}
    </section>
  );
}

function QueueRow({ row, selected, onSelect }: { row: KycQueueItem; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`select-row ${selected ? "selected" : ""}`} style={{ alignItems: "flex-start", height: "auto", minHeight: 68 }}>
      <div className="flex items-start gap-3" style={{ minWidth: 0 }}>
        <Avatar name={row.fullName} url={null} />
        <div style={{ minWidth: 0 }}>
          <div className="font-semibold text-sm">{row.fullName}</div>
          <div style={{ fontSize: 12, color: "hsl(var(--gray-500))" }}>{row.role} · {row.province ?? "—"}</div>
          <div style={{ fontSize: 11, color: "hsl(var(--gray-400))", marginTop: 2 }}>Soumis le {fmtDateShort(row.submittedAt)}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span className={`pill ${STATUS_PILL[row.status]}`}>{STATUS_LABEL[row.status]}</span>
        <span className="muted" style={{ fontSize: 11 }}>Risque : non évalué</span>
        {selected && <ShieldCheck size={14} style={{ color: "hsl(var(--green-700))" }} />}
      </div>
    </button>
  );
}

function KycDetailPane({ uid, online, onDecided, onRefetchQueue, queueRefetching }: {
  uid: string | undefined; online: boolean; onDecided: () => void;
  onRefetchQueue: () => void; queueRefetching: boolean;
}) {
  const { data: detail, isLoading, error, refetch: refetchDetail } = useKycSubmissionDetail(uid);
  const { data: docs, isLoading: docsLoading, error: docsError, refetch: refetchDocs } = useKycDocumentUrls(uid);
  const review = useReviewKyc();
  const [dialog, setDialog] = useState<null | "approve" | "reject" | "correction">(null);

  if (!uid) {
    return <article className="panel"><p className="text-center text-gray-400 py-20">Sélectionnez un dossier</p></article>;
  }
  if (isLoading) {
    return <article className="panel"><div style={{ padding: 20 }}><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></div></article>;
  }
  if (error || !detail) {
    return (
      <article className="panel" style={{ padding: 32, textAlign: "center" }}>
        <p className="font-semibold text-sm">Ce dossier n'est plus disponible.</p>
        <p className="muted" style={{ marginTop: 4 }}>Il a peut-être été examiné ou modifié par un autre administrateur.</p>
        <div className="button-row" style={{ justifyContent: "center", marginTop: 16 }}>
          <button type="button" onClick={() => refetchDetail()} className="button-outline"><RefreshCw size={14} /> Actualiser</button>
          <button type="button" onClick={onRefetchQueue} disabled={queueRefetching} className="btn-primary" style={{ height: 40 }}>Retour à la liste</button>
        </div>
      </article>
    );
  }

  const decided = detail.status === "verified" || detail.status === "rejected";
  const busy = review.isPending;
  const reviewErrorMessage = review.isError
    ? (review.error instanceof Error ? review.error.message : "Une erreur est survenue.")
    : null;

  async function submitDecision(decision: KycStatus, reason?: string) {
    try {
      await review.mutateAsync({ uid: uid!, decision, reason });
      setDialog(null);
      onDecided();
    } catch {
      // surfaced via review.isError below; dialog stays open so the admin sees it and can retry
    }
  }

  return (
    <article className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 20 }}>
        <div className="flex items-start justify-between">
          <h3 style={{ margin: 0 }}>Dossier de {detail.fullName}</h3>
          <span className={`pill ${STATUS_PILL[detail.status]}`}>{STATUS_LABEL[detail.status]}</span>
        </div>

        <div className="hint-box" style={{ marginTop: 12, fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1, color: "hsl(var(--amber-500))" }} />
          <span>Vérifiez que le nom sur la pièce d'identité correspond au nom du compte avant de décider.</span>
        </div>

        <div className="section-header" style={{ marginTop: 20, padding: 0 }}>
          <h3 style={{ fontSize: 15 }}>Pièce d'identité — {detail.documentType}</h3>
        </div>
        <DocumentComparison docs={docs} isLoading={docsLoading} error={!!docsError} onRetry={refetchDocs} photoCount={detail.documentPhotoCount} />

        <div className="section-header" style={{ marginTop: 20, padding: 0 }}>
          <h3 style={{ fontSize: 15 }}>Informations du dossier</h3>
        </div>
        <ApplicantInfo detail={detail} />

        <div className="section-header" style={{ marginTop: 20, padding: 0 }}>
          <h3 style={{ fontSize: 15 }}>Historique du dossier</h3>
        </div>
        <KycTimeline detail={detail} />
      </div>

      <div style={{ marginTop: "auto", position: "sticky", bottom: 0, background: "white", borderTop: "1px solid hsl(var(--gray-100))", padding: 16 }}>
        {reviewErrorMessage && !dialog && (
          <p role="alert" className="error-text text-sm" style={{ marginBottom: 8 }}>{reviewErrorMessage}</p>
        )}
        {decided ? (
          <p className="muted text-sm" style={{ textAlign: "center" }}>Ce dossier a déjà été traité.</p>
        ) : (
          <div className="button-row">
            <button type="button" onClick={() => setDialog("reject")} disabled={busy || !online} className="button-outline danger">
              <ShieldX size={14} /> Rejeter
            </button>
            <button type="button" onClick={() => setDialog("correction")} disabled={busy || !online} className="button-outline">
              <ShieldAlert size={14} /> Demander une correction
            </button>
            <button type="button" onClick={() => setDialog("approve")} disabled={busy || !online} className="btn-primary" style={{ height: 40 }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Valider le dossier
            </button>
          </div>
        )}
      </div>

      {dialog === "approve" && (
        <ApproveKycDialog detail={detail} busy={busy} error={reviewErrorMessage} onClose={() => setDialog(null)} onConfirm={() => submitDecision("verified")} />
      )}
      {dialog === "reject" && (
        <RejectKycDialog detail={detail} busy={busy} error={reviewErrorMessage} onClose={() => setDialog(null)} onConfirm={(reason) => submitDecision("rejected", reason)} />
      )}
      {dialog === "correction" && (
        <RequestCorrectionDialog detail={detail} busy={busy} error={reviewErrorMessage} onClose={() => setDialog(null)} onConfirm={(reason) => submitDecision("correction_requested", reason)} />
      )}
    </article>
  );
}

function DocumentComparison({ docs, isLoading, error, onRetry, photoCount }: {
  docs: { documentType: string; urls: string[] } | undefined; isLoading: boolean; error: boolean; onRetry: () => void; photoCount: number;
}) {
  if (isLoading) {
    return <div className="flex gap-3" style={{ marginTop: 8 }}>{Array.from({ length: Math.max(photoCount, 1) }).map((_, i) => <div key={i} style={{ width: 160, height: 160 }} className="bg-gray-100 rounded-xl animate-pulse" />)}</div>;
  }
  if (error) {
    return (
      <div className="hint-box" style={{ marginTop: 8, textAlign: "center" }}>
        <p className="text-sm font-semibold">Document indisponible</p>
        <button type="button" onClick={onRetry} className="button-outline" style={{ marginTop: 8 }}>Réessayer</button>
      </div>
    );
  }
  const urls = docs?.urls ?? [];
  const labels = urls.length === 2 ? ["Recto", "Verso"] : ["Document"];
  return (
    <>
      <div className="flex gap-3 flex-wrap" style={{ marginTop: 8 }}>
        {urls.length === 0 ? (
          <p className="muted">Aucun document.</p>
        ) : urls.map((url, i) => (
          <figure key={i} style={{ margin: 0 }}>
            <a href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt={`${labels[i] ?? "Document"} — pièce d'identité`}
                style={{ width: 200, height: 200, objectFit: "cover", borderRadius: 14, border: "1px solid hsl(var(--gray-200))", display: "block" }}
              />
            </a>
            <figcaption className="muted" style={{ marginTop: 4, textAlign: "center" }}>{labels[i] ?? "Document"}</figcaption>
          </figure>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Aperçu généré via une URL signée temporaire — jamais un lien public. Aucune vérification faciale automatique n'existe dans cette application : comparez le nom et la photo manuellement.
      </p>
    </>
  );
}

function ApplicantInfo({ detail }: { detail: KycSubmissionDetail }) {
  return (
    <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 8 }}>
      <dl className="space-y-0">
        {([
          ["Nom complet", detail.fullName],
          ["Téléphone", detail.phone || "—"],
          ["Province", detail.province ?? "—"],
          ["Rôle demandé", detail.role],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-gray-50 py-2">
            <dt className="text-[13px] text-gray-500">{k}</dt>
            <dd className="text-[13px] font-semibold text-gray-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Informations supplémentaires</p>
        <dl className="space-y-0">
          <div className="flex justify-between border-b border-gray-50 py-2">
            <dt className="text-[13px] text-gray-500">Soumis le</dt>
            <dd className="text-[13px] font-semibold text-gray-900">{fmtDate(detail.submittedAt)}</dd>
          </div>
          <div className="flex justify-between border-b border-gray-50 py-2">
            <dt className="text-[13px] text-gray-500">Source</dt>
            <dd className="text-[13px] font-semibold text-gray-900">Non disponible</dd>
          </div>
          <div className="flex justify-between border-b border-gray-50 py-2">
            <dt className="text-[13px] text-gray-500">Complétude</dt>
            <dd className="text-[13px] font-semibold text-gray-900">100 % (dossier soumis)</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[13px] text-gray-500">Signal de risque</dt>
            <dd className="text-[13px] font-semibold text-gray-900">Non évalué</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function KycTimeline({ detail }: { detail: KycSubmissionDetail }) {
  const events: { label: string; description: string; date?: { seconds: number } | null }[] = [
    { label: "Dossier soumis", description: `Par ${detail.fullName}`, date: detail.submittedAt },
  ];
  if (detail.reviewedAt) {
    const decisionLabel = detail.status === "verified" ? "Dossier validé"
      : detail.status === "rejected" ? "Dossier rejeté"
      : "Correction demandée";
    const who = detail.reviewerName ? `Par ${detail.reviewerName}` : "Décision enregistrée";
    events.push({
      label: decisionLabel,
      description: detail.rejectionReason ? `${who} — ${detail.rejectionReason}` : who,
      date: detail.reviewedAt,
    });
  } else {
    events.push({ label: "En attente de décision", description: "En attente d'un examinateur" });
  }

  return (
    <ul className="space-y-0" style={{ marginTop: 8 }}>
      {events.map((e, i) => (
        <li key={i} className="flex justify-between gap-4" style={{ padding: "10px 0", borderBottom: i < events.length - 1 ? "1px solid hsl(var(--gray-50))" : undefined }}>
          <div>
            <p className="font-semibold text-sm">{e.label}</p>
            <p className="muted" style={{ marginTop: 2 }}>{e.description}</p>
          </div>
          <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(e.date)}</span>
        </li>
      ))}
    </ul>
  );
}
