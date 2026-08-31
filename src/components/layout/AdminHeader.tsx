import { Bell, LogOut, Menu } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarDrawer } from "@/components/layout/sidebar-drawer-context";

const LABELS: Record<string, { title: string; description: string }> = {
  "/admin": { title: "Vue d'ensemble", description: "Suivi des priorités, KPI et activité." },
  "/admin/users": { title: "Utilisateurs", description: "Administration des rôles, KYC et statut des comptes." },
  "/admin/farmers": { title: "Agriculteurs", description: "Profils, exploitations et activité des agriculteurs." },
  "/admin/products": { title: "Produits", description: "Catalogue des produits publiés sur la plateforme." },
  "/admin/transactions": { title: "Transactions", description: "Traçabilité des flux financiers." },
  "/admin/opportunities": { title: "Opportunités", description: "Pipeline d'investissement de la coopérative." },
  "/admin/bourse": { title: "Bourse", description: "Suivi des routes commerciales et levées logistiques." },
  "/admin/harvest-offers": { title: "Offres récolte", description: "Offres directes sur les annonces de récolte." },
  "/admin/qa/harvest-offers": { title: "QA · Offres récolte", description: "Harnais de test pour le flux d'offres directes." },
  "/admin/agronomie": { title: "Agronomie", description: "Conseils et alertes agronomiques." },
  "/admin/academia": { title: "Academia", description: "Cours et formations de la coopérative." },
  "/admin/offers": { title: "Offres formation", description: "Offres promotionnelles sur les formations." },
  "/admin/agro-exchange": { title: "Agro Exchange", description: "Échanges inter-agriculteurs." },
  "/admin/kyc": { title: "KYC & conformité", description: "Validation des identités et conformité réglementaire." },
  "/admin/financing": { title: "Financement", description: "Pipeline des demandes agriculteurs." },
  "/admin/investments": { title: "Investissements", description: "Suivi des investissements actifs." },
  "/admin/partner-invoices": { title: "Factures partenaires", description: "Factures émises par les agriculteurs aux partenaires." },
  "/admin/partners": { title: "Intégrations API", description: "Comptes partenaires et clés API." },
  "/admin/reports": { title: "Rapports", description: "Exports comptables, conformité et impact." },
  "/admin/alerts": { title: "Alertes", description: "Notifications système et incidents." },
  "/admin/notifications": { title: "Notifications", description: "Notifications envoyées aux utilisateurs." },
  "/admin/videos": { title: "Vidéos", description: "Contenu vidéo publié dans l'application." },
  "/admin/did-you-know": { title: "Le saviez-vous ?", description: "Faits publiés sur l'écran de chargement." },
  "/admin/roles": { title: "Rôles & accès", description: "Promotion et invitation d'administrateurs." },
  "/admin/settings": { title: "Paramètres", description: "Configuration de la plateforme." },
};

export function AdminHeader() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toggle } = useSidebarDrawer();
  const current = LABELS[location.pathname] ?? LABELS["/admin"];

  return (
    <header className="admin-header">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="sidebar-menu-btn" onClick={toggle} aria-label="Ouvrir le menu">
          <Menu size={20} />
        </button>
        <div>
          <p className="section-kicker">Administration</p>
          <h2 className="header-title">{current.title}</h2>
          <p className="header-meta">{current.description}</p>
        </div>
      </div>

      <div className="button-row" style={{ marginTop: 0 }}>
        <a href="/admin/notifications" className="bell-btn" aria-label="Notifications">
          <Bell size={16} />
        </a>
        <div className="user-chip">
          <span>{user?.email ?? "admin@mombongo.coop"}</span>
        </div>
        <button type="button" className="outline-button" onClick={() => void signOut()} aria-label="Déconnexion">
          <LogOut size={16} />
          <span>Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
