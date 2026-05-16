import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AdminShell } from "@/components/layout/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { AccessDeniedScreen } from "@/pages/AccessDeniedScreen";

export function ProtectedRoute() {
  const { loading, user, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-card">
          <div className="section-kicker">Chargement</div>
          <h1 className="page-title">Connexion au panneau admin…</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role !== "admin") {
    return <AccessDeniedScreen />;
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
