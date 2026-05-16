import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function AccessDeniedScreen() {
  const { signOut } = useAuth();

  return (
    <div className="empty-state">
      <div className="empty-card">
        <div className="section-kicker">Accès refusé</div>
        <h1 className="page-title">Ce panneau est réservé aux administrateurs.</h1>
        <p className="page-copy">
          Votre session est valide, mais ce compte ne possède pas le rôle requis pour accéder à l'administration.
        </p>
        <div className="button-row" style={{ justifyContent: "center" }}>
          <button type="button" className="button" onClick={() => void signOut()}>
            <ShieldAlert size={18} />
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}