import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductListing {
  id: string;
  sellerName: string;
  sellerRole: string;
  commodity: string;
  quantityKg: number;
  quality: "A" | "B" | "C";
  province: string;
  territory: string;
  pricePerKgCdf: number;
  status: "active" | "matched" | "sold" | "expired" | "cancelled";
  availableFrom?: { seconds: number };
  availableUntil?: { seconds: number };
}

interface BuyerOrder {
  id: string;
  buyerName: string;
  buyerRole: string;
  commodity: string;
  quantityKg: number;
  maxPricePerKgCdf: number;
  deliveryProvince: string;
  status: "open" | "matched" | "contracted" | "closed";
  neededBy?: { seconds: number };
}

interface PriceRow {
  id: string;
  commodity: string;
  province: string;
  priceCdfPerKg: number;
  previousPriceCdfPerKg?: number;
  volumeKgTraded: number;
  recordedDate: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR");
}

const STATUS_CHIP: Record<string, string> = {
  active:    "bg-green-50 text-green-700",
  matched:   "bg-blue-50 text-blue-700",
  sold:      "bg-gray-100 text-gray-500",
  expired:   "bg-red-50 text-red-600",
  cancelled: "bg-red-50 text-red-600",
  open:      "bg-green-50 text-green-700",
  contracted:"bg-blue-50 text-blue-700",
  closed:    "bg-gray-100 text-gray-500",
};

const QUALITY_CHIP: Record<string, string> = {
  A: "bg-amber-50 text-amber-700",
  B: "bg-sky-50 text-sky-700",
  C: "bg-gray-100 text-gray-500",
};

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchListings(): Promise<ProductListing[]> {
  const snap = await getDocs(
    query(collection(db, "product_listings"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductListing, "id">) }));
}

async function fetchOrders(): Promise<BuyerOrder[]> {
  const snap = await getDocs(
    query(collection(db, "buyer_orders"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BuyerOrder, "id">) }));
}

async function fetchPrices(): Promise<PriceRow[]> {
  const snap = await getDocs(
    query(collection(db, "bourse_prices_by_province"), orderBy("recordedAt", "desc"))
  );
  // Latest per commodity+province
  const latest = new Map<string, PriceRow>();
  snap.docs.forEach((d) => {
    const row = d.data() as Omit<PriceRow, "id">;
    const key = `${row.commodity}|${row.province}`;
    if (!latest.has(key)) latest.set(key, { id: d.id, ...row });
  });
  return [...latest.values()];
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

function ListingsTab() {
  const qc = useQueryClient();
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["admin-listings"],
    queryFn: fetchListings,
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const next = status === "active" ? "cancelled" : "active";
      await updateDoc(doc(db, "product_listings", id), { status: next });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-listings"] }),
  });

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Chargement…</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 text-left">
            <th className="pb-2 font-semibold pr-4">Vendeur</th>
            <th className="pb-2 font-semibold pr-4">Produit</th>
            <th className="pb-2 font-semibold pr-4 text-right">Qté (kg)</th>
            <th className="pb-2 font-semibold pr-4">Qualité</th>
            <th className="pb-2 font-semibold pr-4">Province</th>
            <th className="pb-2 font-semibold pr-4 text-right">Prix/kg (FC)</th>
            <th className="pb-2 font-semibold pr-4">Statut</th>
            <th className="pb-2 font-semibold pr-4">Dispo</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2.5 pr-4">
                <p className="font-semibold">{l.sellerName}</p>
                <p className="text-gray-400 text-[11px] capitalize">{l.sellerRole}</p>
              </td>
              <td className="py-2.5 pr-4 font-semibold">{l.commodity}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(l.quantityKg)}</td>
              <td className="py-2.5 pr-4">
                <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${QUALITY_CHIP[l.quality] ?? ""}`}>
                  {l.quality}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-gray-600">{l.province}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">{fmt(l.pricePerKgCdf)}</td>
              <td className="py-2.5 pr-4">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CHIP[l.status] ?? ""}`}>
                  {l.status}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-gray-400 text-[11px]">
                {fmtDate(l.availableFrom)} – {fmtDate(l.availableUntil)}
              </td>
              <td className="py-2.5">
                <button
                  onClick={() => toggleStatus.mutate({ id: l.id, status: l.status })}
                  className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 text-gray-600"
                >
                  {l.status === "active" ? "Suspendre" : "Activer"}
                </button>
              </td>
            </tr>
          ))}
          {listings.length === 0 && (
            <tr>
              <td colSpan={9} className="py-10 text-center text-gray-400">
                Aucune offre — lancez le script de seed
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTab() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-buyer-orders"],
    queryFn: fetchOrders,
  });

  const closeOrder = useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, "buyer_orders", id), { status: "closed" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-buyer-orders"] }),
  });

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Chargement…</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 text-left">
            <th className="pb-2 font-semibold pr-4">Acheteur</th>
            <th className="pb-2 font-semibold pr-4">Produit</th>
            <th className="pb-2 font-semibold pr-4 text-right">Qté (kg)</th>
            <th className="pb-2 font-semibold pr-4 text-right">Prix max/kg (FC)</th>
            <th className="pb-2 font-semibold pr-4">Livraison</th>
            <th className="pb-2 font-semibold pr-4">Statut</th>
            <th className="pb-2 font-semibold pr-4">Besoin avant</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2.5 pr-4">
                <p className="font-semibold">{o.buyerName}</p>
                <p className="text-gray-400 text-[11px] capitalize">{o.buyerRole}</p>
              </td>
              <td className="py-2.5 pr-4 font-semibold">{o.commodity}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(o.quantityKg)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">{fmt(o.maxPricePerKgCdf)}</td>
              <td className="py-2.5 pr-4 text-gray-600">{o.deliveryProvince}</td>
              <td className="py-2.5 pr-4">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CHIP[o.status] ?? ""}`}>
                  {o.status}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-gray-400 text-[11px]">{fmtDate(o.neededBy)}</td>
              <td className="py-2.5">
                {o.status === "open" && (
                  <button
                    onClick={() => closeOrder.mutate(o.id)}
                    className="text-[11px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 text-gray-600"
                  >
                    Clôturer
                  </button>
                )}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={8} className="py-10 text-center text-gray-400">
                Aucune demande
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface NewPriceForm {
  commodity: string;
  province: string;
  priceCdfPerKg: string;
  volumeKgTraded: string;
}

const COMMODITIES = ["Maïs", "Manioc", "Riz", "Haricot", "Cacao", "Café", "Palmier", "Arachide"];
const PROVINCES = [
  "Kinshasa", "Kongo-Central", "Kwango", "Kwilu", "Mai-Ndombe",
  "Kasaï", "Kasaï-Central", "Kasaï-Oriental", "Lomami", "Sankuru",
  "Maniema", "Sud-Kivu", "Nord-Kivu", "Ituri",
  "Haut-Uele", "Tshopo", "Bas-Uele", "Nord-Ubangi", "Mongala",
  "Sud-Ubangi", "Équateur", "Tshuapa",
  "Tanganyika", "Haut-Lomami", "Lualaba", "Haut-Katanga", "Bandundu",
];

function PricesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewPriceForm>({
    commodity: "Maïs",
    province: "Kinshasa",
    priceCdfPerKg: "",
    volumeKgTraded: "",
  });

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["admin-bourse-prices"],
    queryFn: fetchPrices,
  });

  const addPrice = useMutation({
    mutationFn: async (f: NewPriceForm) => {
      // Get the current price for this pair to set as previous
      const snap = await getDocs(
        query(
          collection(db, "bourse_prices_by_province"),
          where("commodity", "==", f.commodity),
          where("province", "==", f.province),
          orderBy("recordedAt", "desc"),
        )
      );
      const current = snap.docs[0]?.data()?.priceCdfPerKg as number | undefined;
      await addDoc(collection(db, "bourse_prices_by_province"), {
        commodity: f.commodity,
        province: f.province,
        priceCdfPerKg: Number(f.priceCdfPerKg),
        previousPriceCdfPerKg: current ?? null,
        volumeKgTraded: Number(f.volumeKgTraded) || 0,
        recordedDate: new Date().toISOString().split("T")[0],
        recordedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bourse-prices"] });
      setShowForm(false);
      setForm({ commodity: "Maïs", province: "Kinshasa", priceCdfPerKg: "", volumeKgTraded: "" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="h-9 px-3 bg-green-700 text-white rounded-lg text-[12px] font-semibold flex items-center gap-1.5 hover:bg-green-800"
        >
          <Plus className="w-3.5 h-3.5" /> Mettre à jour le prix
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Produit</label>
            <select
              value={form.commodity}
              onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))}
              className="w-full h-9 px-2 rounded-lg border border-gray-200 text-[13px] bg-white"
            >
              {COMMODITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Province</label>
            <select
              value={form.province}
              onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
              className="w-full h-9 px-2 rounded-lg border border-gray-200 text-[13px] bg-white"
            >
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Prix/kg (FC)</label>
            <input
              type="number"
              value={form.priceCdfPerKg}
              onChange={(e) => setForm((f) => ({ ...f, priceCdfPerKg: e.target.value }))}
              placeholder="430"
              className="w-full h-9 px-2 rounded-lg border border-gray-200 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Volume (kg)</label>
            <input
              type="number"
              value={form.volumeKgTraded}
              onChange={(e) => setForm((f) => ({ ...f, volumeKgTraded: e.target.value }))}
              placeholder="45000"
              className="w-full h-9 px-2 rounded-lg border border-gray-200 text-[13px]"
            />
          </div>
          <div className="col-span-2 md:col-span-4 flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="h-9 px-4 rounded-lg border border-gray-200 text-[12px] font-semibold hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              onClick={() => form.priceCdfPerKg && addPrice.mutate(form)}
              disabled={addPrice.isPending || !form.priceCdfPerKg}
              className="h-9 px-4 bg-green-700 text-white rounded-lg text-[12px] font-semibold hover:bg-green-800 disabled:opacity-50"
            >
              {addPrice.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Chargement…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-left">
                <th className="pb-2 font-semibold pr-4">Produit</th>
                <th className="pb-2 font-semibold pr-4">Province</th>
                <th className="pb-2 font-semibold pr-4 text-right">Prix/kg (FC)</th>
                <th className="pb-2 font-semibold pr-4 text-right">Variation</th>
                <th className="pb-2 font-semibold pr-4 text-right">Volume (kg)</th>
                <th className="pb-2 font-semibold pr-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => {
                const prev = p.previousPriceCdfPerKg;
                const diff = prev ? p.priceCdfPerKg - prev : 0;
                const pct = prev ? ((diff / prev) * 100).toFixed(1) : null;
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 pr-4 font-semibold">{p.commodity}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{p.province}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">{fmt(p.priceCdfPerKg)}</td>
                    <td className="py-2.5 pr-4 text-right">
                      {pct !== null && (
                        <span className={`flex items-center justify-end gap-0.5 text-[12px] font-semibold ${diff >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {diff >= 0 ? "+" : ""}{pct}%
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-500">{fmt(p.volumeKgTraded)}</td>
                    <td className="py-2.5 pr-4 text-gray-400 text-[11px]">{p.recordedDate}</td>
                  </tr>
                );
              })}
              {prices.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">
                    Aucun prix enregistré
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "listings", label: "Offres" },
  { id: "orders",   label: "Demandes" },
  { id: "prices",   label: "Prix par province" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminAgroExchange() {
  const [tab, setTab] = useState<TabId>("listings");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display font-black text-[28px]">Agro Exchange</h1>
        <p className="text-gray-500 text-[14px]">Bourse de produits agricoles — offres, demandes et prix</p>
      </header>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition ${
              tab === t.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        {tab === "listings" && <ListingsTab />}
        {tab === "orders"   && <OrdersTab />}
        {tab === "prices"   && <PricesTab />}
      </div>
    </div>
  );
}
