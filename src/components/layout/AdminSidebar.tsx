import {
  BarChart3,
  BriefcaseBusiness,
  Landmark,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "Utilisateurs", icon: Users },
  { to: "/transactions", label: "Transactions", icon: BarChart3 },
  { to: "/financing", label: "Financement", icon: BriefcaseBusiness },
  { to: "/bourse", label: "Bourse", icon: Landmark },
] as const;

export function AdminSidebar() {
  const { signOut, user } = useAuth();
  const { role } = useRole();

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <div className="brand-kicker">Mombongo Coop</div>
        <h1>🌿 Mombongo Admin</h1>
        <p className="muted">Pilotage interne, conformité et opérations.</p>
      </div>

      <nav className="sidebar-links" aria-label="Navigation principale">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="brand-kicker">Session</div>
        <p style={{ margin: "8px 0 2px", fontWeight: 700 }}>
          {user?.displayName ?? user?.email ?? "Administrateur"}
        </p>
        <p
          className="muted"
          style={{ marginTop: 0, color: "rgba(255,255,255,0.72)" }}
        >
          {role ?? "non défini"}
        </p>
        <button type="button" onClick={() => void signOut()}>
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
