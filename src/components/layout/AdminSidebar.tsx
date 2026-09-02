import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, Sprout, ClipboardList, Store, ShieldCheck, Package, Briefcase,
  TrendingUp, Leaf, GraduationCap, Tag, Wheat, ShieldQuestion,
  Receipt, Coins, Handshake, KeyRound, FileBarChart, Bell, BellRing,
  Film, ChevronDown, X, LogOut, Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarDrawer } from "@/components/layout/sidebar-drawer-context";

const INVESTOR_APP_URL = "https://app.mombongo.coop";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  end?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/* Full information architecture from ADM-UI-00-overview.md, extended to
   cover every route actually registered in App.tsx — no route dropped,
   several (offers, qa/harvest-offers) had no nav entry at all before this. */
const GROUPS: NavGroup[] = [
  {
    id: "personnes",
    label: "Personnes",
    items: [
      { to: "/admin/investors", label: "Investisseurs", icon: Users },
      { to: "/admin/farmers", label: "Agriculteurs", icon: Sprout },
      { to: "/admin/agents", label: "Agents terrain", icon: ClipboardList },
      { to: "/admin/merchants", label: "Commerçants", icon: Store },
      { to: "/admin/kyc", label: "KYC & conformité", icon: ShieldCheck },
    ],
  },
  {
    id: "marche",
    label: "Marché & agriculture",
    items: [
      { to: "/admin/products", label: "Produits", icon: Package },
      { to: "/admin/opportunities", label: "Opportunités", icon: Briefcase },
      { to: "/admin/bourse", label: "Bourse", icon: TrendingUp },
      { to: "/admin/harvest-offers", label: "Offres récolte", icon: Tag },
      { to: "/admin/qa/harvest-offers", label: "QA · Offres récolte", icon: ShieldQuestion },
      { to: "/admin/agronomie", label: "Agronomie", icon: Leaf },
      { to: "/admin/academia", label: "Academia", icon: GraduationCap },
      { to: "/admin/offers", label: "Offres formation", icon: Tag },
      { to: "/admin/agro-exchange", label: "Agro Exchange", icon: Wheat },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/admin/transactions", label: "Transactions", icon: Receipt },
      { to: "/admin/financing", label: "Financement", icon: Coins },
      { to: "/admin/investments", label: "Investissements", icon: TrendingUp },
    ],
  },
  {
    id: "partenaires",
    label: "Partenaires",
    items: [
      { to: "/admin/partner-invoices", label: "Factures", icon: Handshake },
      { to: "/admin/partners", label: "Intégrations API", icon: KeyRound },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { to: "/admin/reports", label: "Rapports", icon: FileBarChart },
      { to: "/admin/alerts", label: "Alertes", icon: Bell },
      { to: "/admin/notifications", label: "Notifications", icon: BellRing },
      { to: "/admin/videos", label: "Vidéos", icon: Film },
      { to: "/admin/did-you-know", label: "Le saviez-vous ?", icon: Leaf },
      { to: "/admin/roles", label: "Rôles & accès", icon: ShieldCheck },
      { to: "/admin/settings", label: "Paramètres", icon: Settings },
    ],
  },
];

const STORAGE_KEY = "admin-sidebar-collapsed-groups";

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function SidebarGroup({ group, collapsed, onToggle }: {
  group: NavGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        className="sidebar-group-toggle"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span className="sidebar-group-label">{group.label}</span>
        <ChevronDown
          size={13}
          style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>
      {!collapsed && (
        <div className="sidebar-group-items">
          {group.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminSidebar() {
  const { signOut, user } = useAuth();
  const { open, close } = useSidebarDrawer();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode — non-fatal */ }
      return next;
    });
  }

  return (
    <aside className={`admin-sidebar${open ? " open" : ""}`} aria-label="Navigation principale">
      <div className="admin-brand">
        <div className="admin-brand-row">
          <a href={INVESTOR_APP_URL} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg">🌿</div>
            <div>
              <div className="brand-kicker">Mombongo Coop</div>
              <h1>Admin</h1>
            </div>
          </a>
          <button type="button" className="sidebar-close" onClick={close} aria-label="Fermer le menu">
            <X size={18} />
          </button>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Sections">
        <div className="sidebar-single">
          <NavLink to="/admin" end className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <LayoutDashboard size={16} />
            <span>Vue d'ensemble</span>
          </NavLink>
        </div>
        {GROUPS.map((group) => (
          <SidebarGroup
            key={group.id}
            group={group}
            collapsed={!!collapsed[group.id]}
            onToggle={() => toggleGroup(group.id)}
          />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="brand-kicker">Session</div>
        <p style={{ margin: "8px 0 2px", fontWeight: 700 }}>
          {user?.displayName ?? user?.email ?? "Administrateur"}
        </p>
        <button type="button" onClick={() => void signOut()}>
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
