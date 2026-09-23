import { useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function AccessDeniedScreen() {
  const { signOut, refreshAuthorization } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshAuthorization();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="empty-state">
      <div className="empty-card">
        <div className="section-kicker">Accès refusé</div>
        <h1 className="page-title">Accès administrateur requis</h1>
        <p className="page-copy">
          Votre compte est connecté, mais il ne dispose pas des autorisations nécessaires pour
          accéder à Mombongo Admin.
        </p>
        <div className="button-row" style={{ justifyContent: "center" }}>
          <button
            type="button"
            className="button-outline"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            <RefreshCw size={18} />
            {refreshing ? "Actualisation…" : "Actualiser mes autorisations"}
          </button>
          <button type="button" className="button" onClick={() => void signOut()}>
            <ShieldAlert size={18} />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
