import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AccessDeniedScreen } from "@/pages/AccessDeniedScreen";

export function ProtectedRoute() {
  const { loading, user, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-green-700">
            Chargement
          </div>
          <h1 className="mt-3 font-display text-[24px] font-black text-gray-900">
            Connexion au panneau admin…
          </h1>
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

  return <Outlet />;
}
