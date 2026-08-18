import { httpsCallable } from "firebase/functions";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

const claimInviteFn = httpsCallable<{ token: string }, { success: boolean }>(functions, "claimAdminInvite");

export function JoinScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const tokenFromUrl = params.get("token") ?? "";

  const [token, setToken]   = useState(tokenFromUrl);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  // Auto-claim when token is in URL and user is signed in
  useEffect(() => {
    if (!loading && user && tokenFromUrl && status === "idle") {
      void claim(tokenFromUrl);
    }
  }, [loading, user, tokenFromUrl]);

  async function claim(t: string) {
    setStatus("loading");
    setMessage("");
    try {
      await claimInviteFn({ token: t });
      setStatus("ok");
      setMessage("Votre compte est maintenant administrateur. Rechargez la page ou reconnectez-vous pour accéder au panneau.");
    } catch (err) {
      setStatus("err");
      setMessage(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="login-layout">
        <div className="login-panel">
          <div className="login-card">
            <div className="brand-kicker">Invitation admin</div>
            <h1 className="login-title">Connexion requise</h1>
            <p className="login-copy">
              Connectez-vous d'abord avec votre compte, puis revenez sur ce lien pour activer votre accès administrateur.
            </p>
            <div className="button-row">
              <button className="button" onClick={() => navigate(`/login?redirect=/join?token=${token}`)}>
                Se connecter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-layout">
      <div className="login-panel">
        <div className="login-card">
          <div className="brand-kicker">Invitation admin</div>
          <h1 className="login-title">Activer l'accès admin</h1>
          <p className="login-copy">
            Entrez le code d'invitation reçu, ou il a été détecté automatiquement dans l'URL.
          </p>

          {status === "ok" ? (
            <div className="hint-box" style={{ marginTop: 0 }}>
              <ShieldCheck size={16} style={{ display: "inline", marginRight: 6, color: "hsl(var(--success))" }} />
              <strong>Accès activé.</strong> {message}
              <br />
              <button className="button" style={{ marginTop: 14 }} onClick={() => navigate("/admin")}>
                Aller au panneau admin
              </button>
            </div>
          ) : (
            <div className="field-stack">
              <div className="field">
                <label htmlFor="token">Code d'invitation</label>
                <input
                  id="token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Collez le code ici"
                  disabled={status === "loading"}
                />
              </div>
              <div className="button-row">
                <button
                  className="button"
                  onClick={() => void claim(token)}
                  disabled={!token || status === "loading"}
                >
                  {status === "loading" ? "Vérification…" : "Activer l'accès admin"}
                </button>
              </div>
              {status === "err" && <p className="error-text">{message}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
