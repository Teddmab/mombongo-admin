import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/admin.service";
import type { BoursePriceRow } from "@/services/admin.service";
import { formatCdf } from "@/lib/utils";
import { Truck, Warehouse, Factory, TrendingUp, TrendingDown, Plus, ChevronDown } from "lucide-react";

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  transport: Truck,
  stockage: Warehouse,
  transformation: Factory,
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-50 text-green-700",
  review: "bg-amber-50 text-amber-700",
  completed: "bg-gray-100 text-gray-500",
};

const STATUS_NEXT: Record<string, string[]> = {
  open: ["review", "completed"],
  review: ["open", "completed"],
  completed: [],
};

function formatDate(ts?: { seconds: number }) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR");
}

function OpportunitiesTab() {
  const qc = useQueryClient();
  const { data: opps = [], isLoading } = useQuery({
    queryKey: ["admin-bourse-opps"],
    queryFn: () => adminService.getBourseOpportunities(),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminService.updateBourseStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-bourse-opps"] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            <th className="pb-3 pr-4">Opportunité</th>
            <th className="pb-3 pr-4">Type</th>
            <th className="pb-3 pr-4">Départ</th>
            <th className="pb-3 pr-4">Places</th>
            <th className="pb-3 pr-4">Objectif</th>
            <th className="pb-3 pr-4">Rempli</th>
            <th className="pb-3 pr-4">Statut</th>
            <th className="pb-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {opps.map((o) => {
            const Icon = TYPE_ICONS[o.type] ?? Truck;
            const fillPct = o.capacityKg > 0 ? Math.round((o.filledKg / o.capacityKg) * 100) : 0;
            return (
              <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 line-clamp-1">{o.title}</p>
                      <p className="text-[11px] text-gray-400">{o.origin} → {o.destination}</p>
                    </div>
                  </div>
                </td>
                <td className="pr-4 text-gray-500 capitalize">{o.type}</td>
                <td className="pr-4 text-gray-500">{formatDate(o.departureDate)}</td>
                <td className="pr-4">
                  <span className="font-semibold">{o.spotsLeft}</span>
                  <span className="text-gray-400">/{o.spotsTotal}</span>
                </td>
                <td className="pr-4 font-semibold tabular-nums">{formatCdf(o.targetCdf)}</td>
                <td className="pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${fillPct}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-500">{fillPct}%</span>
                  </div>
                </td>
                <td className="pr-4">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {o.status}
                  </span>
                </td>
                <td>
                  {STATUS_NEXT[o.status]?.length > 0 && (
                    <div className="relative group inline-block">
                      <button className="flex items-center gap-1 text-[12px] font-semibold text-green-700 hover:text-green-800">
                        Changer <ChevronDown className="w-3 h-3" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[120px]">
                        {STATUS_NEXT[o.status].map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus.mutate({ id: o.id, status: s })}
                            className="w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50 capitalize"
                          >
                            → {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {opps.length === 0 && (
            <tr>
              <td colSpan={8} className="py-12 text-center text-gray-400 text-[13px]">
                Aucune opportunité trouvée — lancez le seed script pour peupler la base.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PricesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbol: "", productName: "", price: "", change: "" });

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["admin-bourse-prices"],
    queryFn: () => adminService.getBoursePrices(),
  });

  const addPrice = useMutation({
    mutationFn: (row: Omit<BoursePriceRow, "id">) => adminService.addBoursePrice(row),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bourse-prices"] });
      setShowForm(false);
      setForm({ symbol: "", productName: "", price: "", change: "" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addPrice.mutate({
      symbol: form.symbol,
      productName: form.productName,
      price: form.price,
      change: parseFloat(form.change) || 0,
    });
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 h-9 px-4 bg-amber-500 text-white rounded-lg text-[12px] font-semibold hover:bg-amber-600 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter un prix
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-xl grid grid-cols-2 gap-3">
          <input required placeholder="Symbole (ex: TOM-MAT)" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-[13px]" />
          <input required placeholder="Produit (ex: Tomates Matadi)" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-[13px]" />
          <input required placeholder="Prix (ex: 1,250 FC/kg)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-[13px]" />
          <input type="number" step="0.1" placeholder="Variation % (ex: 2.4)" value={form.change} onChange={(e) => setForm({ ...form, change: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-[13px]" />
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 border border-gray-200 rounded-lg text-[12px]">Annuler</button>
            <button type="submit" disabled={addPrice.isPending} className="h-9 px-4 bg-amber-500 text-white rounded-lg text-[12px] font-semibold disabled:opacity-50">
              {addPrice.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <th className="pb-3 pr-4">Symbole</th>
              <th className="pb-3 pr-4">Produit</th>
              <th className="pb-3 pr-4">Prix</th>
              <th className="pb-3 pr-4">Variation</th>
              <th className="pb-3">Mis à jour</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p) => (
              <tr key={p.id} className="border-t border-gray-50">
                <td className="py-2.5 pr-4 font-mono font-bold text-[12px] text-gray-700">{p.symbol}</td>
                <td className="pr-4 text-gray-600">{p.productName}</td>
                <td className="pr-4 font-semibold tabular-nums">{p.price}</td>
                <td className="pr-4">
                  <span className={`flex items-center gap-0.5 text-[12px] font-bold ${p.change >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {p.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {p.change >= 0 ? "+" : ""}{p.change}%
                  </span>
                </td>
                <td className="text-gray-400 text-[11px]">{formatDate(p.recordedAt)}</td>
              </tr>
            ))}
            {prices.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400 text-[13px]">Aucun prix enregistré</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function AdminBourse() {
  const [tab, setTab] = useState<"opps" | "prices">("opps");

  return (
    <section className="page">
      <div>
        <div className="section-kicker">Bourse</div>
        <h1 className="page-title">Routes et opérations commerciales</h1>
        <p className="page-copy">Gérez les opportunités de transport, stockage et transformation.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-100">
        {(["opps", "prices"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-1 text-[13px] font-semibold border-b-2 transition ${tab === t ? "border-amber-500 text-amber-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
          >
            {t === "opps" ? "Opportunités" : "Prix du marché"}
          </button>
        ))}
      </div>

      {tab === "opps" ? <OpportunitiesTab /> : <PricesTab />}
    </section>
  );
}
