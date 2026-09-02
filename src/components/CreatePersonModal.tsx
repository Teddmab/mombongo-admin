import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useAdminCreatePerson, type ConsentMethod } from "@/hooks/useAssistedInvoice";

interface CreatePersonModalProps {
  role: "farmer" | "merchant";
  consentMethod: ConsentMethod;
  onClose: () => void;
  onCreated: (person: { uid: string; fullName: string }) => void;
}

/**
 * Inline "create a farmer/merchant on the spot" dialog, opened from the
 * assisted-invoice wizard's Combobox when the person being searched for
 * isn't on the platform yet. Creates a real, immediately-usable account
 * (kycStatus: 'approved', admin-attested) via adminCreatePerson — see that
 * function for why this is safe (audit trail, never disguised as
 * self-service KYC).
 */
export function CreatePersonModal({ role, consentMethod, onClose, onCreated }: CreatePersonModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [businessType, setBusinessType] = useState("");
  const create = useAdminCreatePerson();

  const canSubmit = fullName.trim().length > 0 && phone.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    const result = await create.mutateAsync({
      role,
      fullName: fullName.trim(),
      phone: phone.trim(),
      ...(role === "farmer" && province.trim() ? { province: province.trim() } : {}),
      ...(role === "merchant" && businessType.trim() ? { businessType: businessType.trim() } : {}),
      consentMethod,
      consentAt: new Date().toISOString(),
    });
    onCreated({ uid: result.uid, fullName: result.fullName });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 16 }}>
      <div className="panel" style={{ width: "100%", maxWidth: 420 }}>
        <div className="section-header">
          <h3>{role === "farmer" ? "Créer un nouvel agriculteur" : "Créer un nouveau commerçant"}</h3>
          <button type="button" onClick={onClose} className="button-outline" style={{ height: 28, width: 28, padding: 0, justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="hint-box" style={{ marginBottom: 16, fontSize: 12 }}>
            Ce compte sera créé immédiatement avec un KYC attesté par vous. Il sera clairement marqué comme créé par un administrateur.
          </div>

          <label className="form-label" htmlFor="cp-fullName">Nom complet</label>
          <input id="cp-fullName" className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ marginBottom: 12 }} />

          <label className="form-label" htmlFor="cp-phone">Téléphone</label>
          <input id="cp-phone" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+243..." style={{ marginBottom: 12 }} />

          {role === "farmer" ? (
            <>
              <label className="form-label" htmlFor="cp-province">Province (optionnel)</label>
              <input id="cp-province" className="form-input" value={province} onChange={(e) => setProvince(e.target.value)} style={{ marginBottom: 12 }} />
            </>
          ) : (
            <>
              <label className="form-label" htmlFor="cp-businessType">Type de commerce (optionnel)</label>
              <input id="cp-businessType" className="form-input" value={businessType} onChange={(e) => setBusinessType(e.target.value)} style={{ marginBottom: 12 }} />
            </>
          )}

          {create.isError && (
            <p role="alert" className="error-text text-sm" style={{ marginTop: 4, marginBottom: 12 }}>
              {create.error instanceof Error ? create.error.message : "Une erreur est survenue."}
            </p>
          )}

          <div className="button-row" style={{ marginTop: 8 }}>
            <button type="button" onClick={onClose} className="button-outline" style={{ height: 40 }}>Annuler</button>
            <button type="button" onClick={submit} disabled={!canSubmit || create.isPending} className="btn-primary" style={{ height: 40 }}>
              {create.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Créer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
