import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AccessDeniedScreen } from "@/pages/AccessDeniedScreen";

export function ProtectedRoute() {
  const { status, refreshAuthorization } = useAuth();
  const location = useLocation();

  if (status === "loading") {
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

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (status === "error") {
    // Deliberately generic — no claim values, error codes, or stack traces
    // are shown to the user. The real error is logged to the console by
    // AuthContext, for developers, not surfaced here. Inline rather than a
    // shared ErrorState component — that component only exists on an
    // unrelated, unmerged branch (fix/admin-design-system-consistency) as
    // of this PR; not worth making this focused security fix depend on it.
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm" role="alert">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-700">
            Erreur
          </div>
          <p className="mt-3 text-[14px] font-semibold text-gray-900">
            Impossible de vérifier votre session. Réessayez, ou reconnectez-vous si le problème persiste.
          </p>
          <button
            type="button"
            onClick={() => void refreshAuthorization()}
            className="mt-4 h-10 px-4 rounded-xl border border-gray-300 bg-white text-[13px] font-bold text-gray-900 hover:bg-gray-50"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (status === "unauthorized") {
    return <AccessDeniedScreen />;
  }

  return <Outlet />;
}
