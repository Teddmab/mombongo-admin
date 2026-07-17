import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/admin.service";
import { formatUsd } from "@/lib/utils";
import { CheckCircle, Clock } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  completed: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-50 text-red-600",
};

function formatDate(ts?: { seconds: number }) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR");
}

export function AdminFinancing() {
  const qc = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["admin-financing-apps"],
    queryFn: () => adminService.getFinancingApplications(),
  });

  const disburse = useMutation({
    mutationFn: ({ appId, farmerId, trancheIndex, amount }: { appId: string; farmerId: string; trancheIndex: number; amount: number }) =>
      adminService.disburseTranche(appId, farmerId, trancheIndex, amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-financing-apps"] }),
  });

  if (isLoading) {
    return (
      <section className="page">
        <div className="section-kicker">Financement</div>
        <h1 className="page-title">Dossiers agriculteurs</h1>
        <div className="space-y-2 mt-6">
          {[1, 2, 3].map((n) => <div key={n} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div>
        <div className="section-kicker">Financement</div>
        <h1 className="page-title">Dossiers agriculteurs</h1>
        <p className="page-copy">
          {applications.length} dossier{applications.length !== 1 ? "s" : ""} enregistré{applications.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-3 mt-6">
        {applications.map((app) => {
          const pendingTranche = app.tranches.findIndex((t) => t.status === "pending");
          const pendingAmount = pendingTranche >= 0 ? app.tranches[pendingTranche].amountUsd : 0;
          const disbursedTotal = app.tranches
            .filter((t) => t.status === "disbursed")
            .reduce((sum, t) => sum + (t.amountUsd ?? 0), 0);

          return (
            <div key={app.id} className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-[14px] text-gray-900">Dossier #{app.id.slice(-6).toUpperCase()}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] ?? "bg-gray-100"}`}>
                      {app.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    Culture: <span className="font-semibold text-gray-700">{app.cropType}</span>
                    {" · "}Investisseur: <span className="font-mono text-[11px]">{app.investorId.slice(0, 8)}…</span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-display font-extrabold text-[18px] tabular-nums text-gray-900">{formatUsd(app.amountUsd)}</p>
                  <p className="text-[11px] text-gray-400">Demande totale</p>
                </div>
              </div>

              <div className="mt-4 border-t border-gray-50 pt-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tranches</p>
                <div className="space-y-1.5">
                  {app.tranches.map((tranche, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-2">
                        {tranche.status === "disbursed" ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="font-semibold tabular-nums">{formatUsd(tranche.amountUsd)}</span>
                        <span className={`font-bold ${tranche.status === "disbursed" ? "text-green-600" : "text-amber-500"}`}>
                          {tranche.status}
                        </span>
                      </div>
                      {tranche.status === "pending" && (
                        <button
                          onClick={() => disburse.mutate({ appId: app.id, farmerId: app.farmerId, trancheIndex: idx, amount: tranche.amountUsd })}
                          disabled={disburse.isPending}
                          className="h-7 px-3 bg-green-700 text-white rounded-lg text-[11px] font-bold hover:bg-green-800 disabled:opacity-50 transition"
                        >
                          {disburse.isPending ? "…" : "Débloquer"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Déboursé: <span className="font-bold text-gray-700">{formatUsd(disbursedTotal)}</span></span>
                  {pendingTranche >= 0 && <span>En attente: <span className="font-bold text-amber-600">{formatUsd(pendingAmount)}</span></span>}
                  <span>Créé le {formatDate(app.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {applications.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-[13px]">
            Aucun dossier de financement — les investissements apparaîtront ici.
          </div>
        )}
      </div>
    </section>
  );
}
