import { useState } from "react";
import { Loader2, CheckCircle2, ShieldX, ShieldAlert } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { KycSubmissionDetail } from "@/hooks/useKyc";

function fmtDate(ts?: { seconds: number } | null) {
  return ts ? new Date(ts.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

interface DialogProps {
  detail: KycSubmissionDetail;
  busy: boolean;
  error: string | null;
  onClose: () => void;
}

export function ApproveKycDialog({ detail, busy, error, onConfirm, onClose }: DialogProps & { onConfirm: () => void }) {
  return (
    <Modal title="Valider le dossier" onClose={onClose}>
      <p className="text-sm" style={{ marginBottom: 16 }}>
        Vous êtes sur le point de valider l'identité de <strong>{detail.fullName}</strong>.
      </p>
      <dl className="space-y-0" style={{ marginBottom: 16 }}>
        <div className="flex justify-between border-b border-gray-50 py-2">
          <dt className="text-[13px] text-gray-500">Rôle demandé</dt>
          <dd className="text-[13px] font-semibold">{detail.role}</dd>
        </div>
        <div className="flex justify-between border-b border-gray-50 py-2">
          <dt className="text-[13px] text-gray-500">Document examiné</dt>
          <dd className="text-[13px] font-semibold capitalize">{detail.documentType} ({detail.documentPhotoCount} photo{detail.documentPhotoCount > 1 ? "s" : ""})</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[13px] text-gray-500">Soumis le</dt>
          <dd className="text-[13px] font-semibold">{fmtDate(detail.submittedAt)}</dd>
        </div>
      </dl>
      <div className="hint-box" style={{ fontSize: 12, marginBottom: 16 }}>
        Le compte de {detail.fullName} passera au statut KYC "approuvé" et pourra accéder aux fonctionnalités réservées aux comptes vérifiés. Cette action est enregistrée avec votre identité et horodatée.
      </div>
      {error && <p role="alert" className="error-text text-sm" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="button-row">
        <button type="button" onClick={onClose} disabled={busy} className="button-outline">Annuler</button>
        <button type="button" onClick={onConfirm} disabled={busy} className="btn-primary" style={{ height: 40 }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirmer la validation
        </button>
      </div>
    </Modal>
  );
}

const REJECT_QUICK_REASONS = ["Photo illisible", "Nom différent du document", "Document expiré", "Numéro de document illisible", "Autre"];
const CORRECTION_QUICK_REASONS = ["Recto illisible", "Verso illisible", "Nom différent", "Document expiré", "Numéro de document illisible", "Province manquante", "Autre"];

function ReasonDialog({
  detail, busy, error, onClose, onConfirm, title, quickReasons, reasonLabel, confirmLabel, confirmIcon, danger,
}: DialogProps & {
  onConfirm: (reason: string) => void;
  title: string;
  quickReasons: string[];
  reasonLabel: string;
  confirmLabel: string;
  confirmIcon: React.ReactNode;
  danger?: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm" style={{ marginBottom: 12 }}>Dossier de <strong>{detail.fullName}</strong></p>
      <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
        {quickReasons.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason((prev) => (prev ? `${prev}\n${r}` : r))}
            className="button-outline"
            style={{ height: 30, fontSize: 12, padding: "0 10px" }}
          >
            {r}
          </button>
        ))}
      </div>
      <label className="form-label" htmlFor="reason-textarea">{reasonLabel}</label>
      <textarea
        id="reason-textarea"
        className="form-textarea"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        placeholder="Écrivez une phrase simple et claire — elle sera visible par la personne concernée."
        style={{ marginBottom: 16 }}
      />
      {error && <p role="alert" className="error-text text-sm" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="button-row">
        <button type="button" onClick={onClose} disabled={busy} className="button-outline">Annuler</button>
        <button
          type="button"
          onClick={() => onConfirm(reason.trim())}
          disabled={busy || !reason.trim()}
          className={danger ? "button-outline danger" : "btn-primary"}
          style={{ height: 40 }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : confirmIcon} {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function RejectKycDialog(props: DialogProps & { onConfirm: (reason: string) => void }) {
  return (
    <ReasonDialog
      {...props}
      title="Rejeter le dossier"
      quickReasons={REJECT_QUICK_REASONS}
      reasonLabel="Raison du rejet (visible par la personne concernée)"
      confirmLabel="Confirmer le rejet"
      confirmIcon={<ShieldX size={14} />}
      danger
    />
  );
}

export function RequestCorrectionDialog(props: DialogProps & { onConfirm: (reason: string) => void }) {
  return (
    <ReasonDialog
      {...props}
      title="Demander une correction"
      quickReasons={CORRECTION_QUICK_REASONS}
      reasonLabel="Ce que la personne doit corriger ou renvoyer"
      confirmLabel="Envoyer la demande"
      confirmIcon={<ShieldAlert size={14} />}
    />
  );
}
