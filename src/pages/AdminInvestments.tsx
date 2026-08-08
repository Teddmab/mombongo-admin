import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { getDocs, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatUsd } from "@/lib/utils";
import { CheckCircle2, Clock, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface InvestmentRow {
  id: string;
  investorId: string;
  productId: string;
  productName: string;
  amountUsd: number;
  roi: number;
  status: "active" | "matured" | "repaid" | "cancelled";
  maturityDate?: { seconds: number };
  expectedReturnUsd?: number;
  repaidAmountUsd?: number;
  investedAt?: { seconds: number };
}

const STATUS_CFG: Record<string, { label: string; bg: string }> = {
  active:    { label: "En cours",        bg: "bg-blue-50 text-blue-700" },
  matured:   { label: "Arrivé à terme",  bg: "bg-amber-50 text-amber-700" },
  repaid:    { label: "Remboursé",       bg: "bg-green-50 text-green-700" },
  cancelled: { label: "Annulé",          bg: "bg-gray-100 text-gray-500" },
};

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR");
}

async function fetchInvestments(): Promise<InvestmentRow[]> {
  const snap = await getDocs(
    query(collection(db, "investments"), orderBy("investedAt", "desc"), limit(200))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestmentRow));
}

interface RepayModalProps {
  inv: InvestmentRow;
  onClose: () => void;
}

function RepayModal({ inv, onClose }: RepayModalProps) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(inv.expectedReturnUsd ?? inv.amountUsd));
  const repay = useMutation({
    mutationFn: async ({ investmentId, repaidAmountUsd }: { investmentId: string; repaidAmountUsd: number }) => {
      const call = httpsCallable<{ investmentId: string; repaidAmountUsd: number }, { ok: boolean }>(
        functions, "repayInvestment"
      );
      return (await call({ investmentId, repaidAmountUsd })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-investments"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm space-y-4">
        <h2 className="font-bold text-[18px]">Marquer comme remboursé</h2>
        <p className="text-[13px] text-gray-500">
          Investissement <span className="font-mono font-bold">{inv.id.slice(-8).toUpperCase()}</span>
          {" · "}{inv.productName}
        </p>
        <div>
          <label className="block text-[12px] font-bold text-gray-700 mb-1">Montant remboursé (USD)</label>
          <input
            type="number" min={0} step={0.01}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full h-11 px-3 border border-gray-300 rounded-xl text-[14px] focus:outline-none focus:border-green-600"
          />
          {inv.expectedReturnUsd && (
            <p className="text-[11px] text-gray-400 mt-1">Rendement attendu : {formatUsd(inv.expectedReturnUsd)}</p>
          )}
        </div>
        {repay.error && (
          <p className="text-[12px] text-red-600">{(repay.error as { message?: string }).message ?? "Erreur"}</p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 border border-gray-300 rounded-xl font-bold text-[13px] text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={() => repay.mutate({ investmentId: inv.id, repaidAmountUsd: Number(amount) })}
            disabled={repay.isPending || Number(amount) <= 0}
            className="flex-1 h-10 bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {repay.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminInvestments() {
  const [repayTarget, setRepayTarget] = useState<InvestmentRow | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ["admin-investments"],
    queryFn: fetchInvestments,
    staleTime: 60_000,
  });

  const filtered = statusFilter ? investments.filter(i => i.status === statusFilter) : investments;
  const matured = investments.filter(i => i.status === "matured").length;

  if (isLoading) {
    return (
      <section className="page">
        <div className="section-kicker">Portefeuilles</div>
        <h1 className="page-title">Investissements</h1>
        <div className="space-y-2 mt-6">
          {[1, 2, 3].map(n => <div key={n} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      {repayTarget && <RepayModal inv={repayTarget} onClose={() => setRepayTarget(null)} />}

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="section-kicker">Portefeuilles</div>
          <h1 className="page-title">Investissements</h1>
          <p className="page-copy">
            {investments.length} investissement{investments.length !== 1 ? "s" : ""}
            {matured > 0 && (
              <span className="ml-2 bg-amber-100 text-amber-700 text-[11px] font-bold rounded-full px-2 py-0.5">
                {matured} à rembourser
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {["", "active", "matured", "repaid", "cancelled"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
              statusFilter === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}>
            {s === "" ? "Tous" : STATUS_CFG[s]?.label ?? s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(inv => {
          const s = STATUS_CFG[inv.status] ?? STATUS_CFG.active;
          const expanded = expandedId === inv.id;
          return (
            <div key={inv.id} className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-[14px] text-gray-900">
                      #{inv.id.slice(-8).toUpperCase()}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg}`}>{s.label}</span>
                    {inv.maturityDate && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Échéance: {fmtDate(inv.maturityDate)}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-500 mt-1">
                    {inv.productName}
                    {" · "}+{inv.roi}% ROI
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-display font-extrabold text-[18px] tabular-nums">{formatUsd(inv.amountUsd)}</p>
                  {inv.expectedReturnUsd && (
                    <p className="text-[11px] text-green-600 font-bold">{formatUsd(inv.expectedReturnUsd)} attendu</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setExpandedId(expanded ? null : inv.id)}
                  className="text-[11px] text-gray-500 font-bold flex items-center gap-1 hover:text-gray-700"
                >
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expanded ? "Moins" : "Détails"}
                </button>
                {(inv.status === "active" || inv.status === "matured") && (
                  <button
                    onClick={() => setRepayTarget(inv)}
                    className="h-8 px-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold text-[12px] flex items-center gap-1.5 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Marquer remboursé
                  </button>
                )}
                {inv.status === "repaid" && inv.repaidAmountUsd && (
                  <span className="text-[12px] text-green-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {formatUsd(inv.repaidAmountUsd)} remboursé
                  </span>
                )}
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  {[
                    { k: "Investisseur", v: inv.investorId.slice(0, 12) + "…" },
                    { k: "Produit", v: inv.productId },
                    { k: "Investi le", v: fmtDate(inv.investedAt) },
                    { k: "Échéance", v: fmtDate(inv.maturityDate) },
                  ].map(r => (
                    <div key={r.k} className="flex justify-between text-[12px]">
                      <span className="text-gray-400 font-bold">{r.k}</span>
                      <span className="text-gray-700 font-mono">{r.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[14px] text-gray-400">Aucun investissement</p>
          </div>
        )}
      </div>
    </section>
  );
}
