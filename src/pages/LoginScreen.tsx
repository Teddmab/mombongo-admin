import { motion } from "framer-motion";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function LoginScreen() {
  const navigate = useNavigate();
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("Mombongo2026!");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [navigate, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      navigate("/dashboard", { replace: true });
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "Connexion impossible.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-layout">
      <div className="login-panel">
        <motion.div className="login-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="brand-kicker">Connexion sécurisée</div>
          <h1 className="login-title">Mombongo Admin</h1>
          <p className="login-copy">
            Accès réservé à l'équipe opérationnelle. Utilisez vos identifiants administrateur pour ouvrir le tableau de pilotage.
          </p>

          <form onSubmit={handleSubmit} className="field-stack">
            <div className="field">
              <label htmlFor="email">Adresse email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </div>

            <div className="field">
              <label htmlFor="password">Mot de passe</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </div>

            <div className="button-row">
              <button type="submit" className="button" disabled={loading || isSubmitting}>
                <LockKeyhole size={18} />
                {isSubmitting ? "Connexion..." : "Se connecter"}
              </button>
              <span className="muted">Démo locale activée avec admin@test.com / Mombongo2026!</span>
            </div>
          </form>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="hint-box">
            <strong>Accès restreint.</strong> Les comptes non-admin sont redirigés vers un écran d'accès refusé après authentification.
          </div>
        </motion.div>
      </div>

      <section className="login-hero">
        <div>
          <p className="brand-kicker" style={{ color: "rgba(255,255,255,0.68)" }}>Operations cockpit</p>
          <h2 className="login-title" style={{ color: "white", marginTop: 10 }}>Un poste de commande séparé du produit investisseur.</h2>
          <p className="login-copy" style={{ color: "rgba(255,255,255,0.74)" }}>
            Les parcours admin sont isolés, le bundle investisseur reste propre, et les opérations internes peuvent évoluer sans impacter l'application publique.
          </p>
        </div>

        <div className="hero-card">
          <div className="list-row">
            <div>
              <div className="brand-kicker" style={{ color: "rgba(255,255,255,0.68)" }}>Cadre</div>
              <h3 style={{ margin: "8px 0 0" }}>Panneau desktop-first</h3>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="hero-stat">
            <span>Surveillance utilisateurs</span>
            <ArrowRight size={16} />
          </div>
          <div className="hero-stat">
            <span>Transactions et conformité</span>
            <ArrowRight size={16} />
          </div>
          <div className="hero-stat">
            <span>Financement et bourse</span>
            <ArrowRight size={16} />
          </div>
        </div>
      </section>
    </div>
  );
}