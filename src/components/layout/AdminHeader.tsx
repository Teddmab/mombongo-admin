import { Bell, LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const labels: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Vue d'ensemble",
    description: "Suivi des KPI, activité et signaux critiques.",
  },
  "/users": {
    title: "Utilisateurs",
    description:
      "Administration des rôles, vérification KYC et statut des comptes.",
  },
  "/transactions": {
    title: "Transactions",
    description: "Traçabilité des flux financiers et opérations sensibles.",
  },
  "/financing": {
    title: "Financement",
    description:
      "Pipeline des demandes agriculteurs et arbitrage des dossiers.",
  },
  "/bourse": {
    title: "Bourse",
    description: "Suivi des routes commerciales et des levées logistiques.",
  },
};

export function AdminHeader() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const current = labels[location.pathname] ?? labels["/dashboard"];

  return (
    <header className="admin-header">
      <div>
        <p className="section-kicker">Administration</p>
        <h2 className="header-title">{current.title}</h2>
        <p className="header-meta">{current.description}</p>
      </div>

      <div className="button-row" style={{ marginTop: 0 }}>
        <div className="user-chip">
          <Bell size={16} />
          <span>{user?.email ?? "admin@mombongo.coop"}</span>
        </div>
        <button
          type="button"
          className="outline-button"
          onClick={() => void signOut()}
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </header>
  );
}
