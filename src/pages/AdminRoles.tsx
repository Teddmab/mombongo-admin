import { httpsCallable } from "firebase/functions";
import { Copy, Link, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { functions } from "@/lib/firebase";

const bootstrapAdminFn   = httpsCallable<Record<string, never>, { success: boolean }>(functions, "bootstrapAdmin");
const createInviteFn     = httpsCallable<Record<string, never>, { token: string }>(functions, "createAdminInvite");

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? window.location.origin;

export function AdminRoles() {
  const [bootstrapStatus, setBootstrapStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [bootstrapMsg, setBootstrapMsg]       = useState("");

  const [inviteStatus, setInviteStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [inviteLink, setInviteLink]     = useState("");
  const [copied, setCopied]             = useState(false);

  async function handleBootstrap() {
    setBootstrapStatus("loading");
    setBootstrapMsg("");
    try {
      await bootstrapAdminFn({});
      setBootstrapStatus("ok");
      setBootstrapMsg("Vous êtes maintenant administrateur. Rechargez la page pour actualiser votre session.");
    } catch (err) {
      setBootstrapStatus("err");
      setBootstrapMsg(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  async function handleCreateInvite() {
    setInviteStatus("loading");
    setInviteLink("");
    try {
      const result = await createInviteFn({});
      const link = `${ADMIN_URL}/join?token=${result.data.token}`;
      setInviteLink(link);
      setInviteStatus("ok");
    } catch (err) {
      setInviteStatus("err");
      setInviteLink(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  function copyLink() {
    void navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Accès</div>
          <h1 className="page-title">Rôles &amp; Administrateurs</h1>
          <p className="page-subtitle">Promotions de premier administrateur et invitations.</p>
        </div>
      </div>

      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>

        {/* ── Bootstrap ── */}
        <div className="panel">
          <div className="section-header">
            <div>
              <p className="card-title">Premier administrateur</p>
              <p className="page-subtitle" style={{ margin: 0 }}>Fonctionne uniquement si aucun admin n'existe encore.</p>
            </div>
            <ShieldCheck size={20} style={{ color: "hsl(var(--green-700))", flexShrink: 0 }} />
          </div>
          <div style={{ padding: "20px" }}>
            <p style={{ fontSize: 13, color: "hsl(var(--gray-500))", marginBottom: 16, lineHeight: 1.6 }}>
              Ce bouton se bloque dès qu'un administrateur existe. Cliquez une seule fois pour obtenir les droits admin sur votre compte connecté.
            </p>
            <button
              className="btn-primary"
              style={{ height: 38 }}
              onClick={handleBootstrap}
              disabled={bootstrapStatus === "loading" || bootstrapStatus === "ok"}
            >
              {bootstrapStatus === "loading" ? "En cours…" :
               bootstrapStatus === "ok"      ? "✓ Effectué" : "Me promouvoir administrateur"}
            </button>
            {bootstrapMsg && (
              <p style={{
                marginTop: 12, fontSize: 13, lineHeight: 1.5,
                color: bootstrapStatus === "ok" ? "hsl(var(--success))" : "hsl(var(--danger))",
              }}>
                {bootstrapMsg}
              </p>
            )}
          </div>
        </div>

        {/* ── Invite ── */}
        <div className="panel">
          <div className="section-header">
            <div>
              <p className="card-title">Inviter un administrateur</p>
              <p className="page-subtitle" style={{ margin: 0 }}>Génère un lien valable 7 jours.</p>
            </div>
            <UserPlus size={20} style={{ color: "hsl(var(--amber-400))", flexShrink: 0 }} />
          </div>
          <div style={{ padding: "20px" }}>
            <p style={{ fontSize: 13, color: "hsl(var(--gray-500))", marginBottom: 16, lineHeight: 1.6 }}>
              La personne invitée doit se connecter avec un compte Firebase, puis ouvrir ce lien pour obtenir les droits admin.
            </p>
            <button
              className="btn-primary"
              style={{ height: 38 }}
              onClick={handleCreateInvite}
              disabled={inviteStatus === "loading"}
            >
              <Link size={14} />
              {inviteStatus === "loading" ? "Génération…" : "Générer un lien d'invitation"}
            </button>

            {inviteStatus === "ok" && inviteLink && (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "hsl(var(--gray-50))", border: "1px solid hsl(var(--gray-200))",
                  borderRadius: 10, padding: "8px 12px",
                }}>
                  <span style={{ flex: 1, fontSize: 12, color: "hsl(var(--gray-700))", wordBreak: "break-all", lineHeight: 1.4 }}>
                    {inviteLink}
                  </span>
                  <button onClick={copyLink} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--green-700))", flexShrink: 0 }}>
                    <Copy size={15} />
                  </button>
                </div>
                {copied && <p style={{ fontSize: 12, color: "hsl(var(--success))", marginTop: 6 }}>Copié !</p>}
              </div>
            )}
            {inviteStatus === "err" && (
              <p style={{ marginTop: 12, fontSize: 13, color: "hsl(var(--danger))" }}>{inviteLink}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
