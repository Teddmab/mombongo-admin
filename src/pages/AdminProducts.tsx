import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { httpsCallable } from "firebase/functions";
import {
  Plus, CheckCircle2, XCircle, Clock, Pencil, ChevronRight,
  TrendingUp, Package, X, AlertTriangle,
} from "lucide-react";
import { functions, isDevMode } from "@/lib/firebase";

/* ─── types ─────────────────────────────────────────────────────────────────── */

interface Product {
  id: string
  name: string
  icon: string
  category: string
  location: string
  farmer: string
  description: string
  roi: number
  minInvest: number
  duration: number
  stock: number
  unit: string
  targetUsd: number
  invested: number
  investorsCount: number
  status: 'active' | 'inactive' | 'draft'
}

/* ─── mock data ──────────────────────────────────────────────────────────────── */

const MOCK_PRODUCTS: Product[] = [
  { id: "p1", name: "Pastèques Songololo", icon: "🍉", category: "agriculture", location: "Songololo", farmer: "Jean-Baptiste Mwamba", description: "Culture de pastèques.", roi: 22, minInvest: 200, duration: 45, stock: 180, unit: "bacs", targetUsd: 5000, invested: 3250, investorsCount: 16, status: "active" },
  { id: "p2", name: "Tomates Matadi", icon: "🍅", category: "agriculture", location: "Matadi", farmer: "Marie Lutumba", description: "Tomates fraîches.", roi: 18, minInvest: 150, duration: 30, stock: 95, unit: "bacs", targetUsd: 3000, invested: 960, investorsCount: 6, status: "active" },
  { id: "p3", name: "Café export Kivu", icon: "☕", category: "export", location: "Kivu", farmer: "Coopérative Kivu Arabica", description: "Café Arabica haute altitude.", roi: 28, minInvest: 500, duration: 90, stock: 500, unit: "kg", targetUsd: 20000, invested: 0, investorsCount: 0, status: "draft" },
]

/* ─── callable refs ──────────────────────────────────────────────────────────── */

const getProductsAdminFn = httpsCallable<Record<string, never>, { products: Product[] }>(functions, 'getProductsAdmin')
const createProductFn = httpsCallable<Omit<Product, 'id' | 'invested' | 'investorsCount' | 'status'>, { productId: string }>(functions, 'createProduct')
const updateProductStatusFn = httpsCallable<{ productId: string; status: string }, { success: boolean }>(functions, 'updateProductStatus')

/* ─── helpers ────────────────────────────────────────────────────────────────── */

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function StatusBadge({ status }: { status: Product['status'] }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> Actif
    </span>
  )
  if (status === 'inactive') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
      <XCircle className="w-3 h-3" /> Inactif
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
      <Clock className="w-3 h-3" /> Brouillon
    </span>
  )
}

function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>{fmt(value)} financé</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ─── create form ────────────────────────────────────────────────────────────── */

const EMPTY_FORM = {
  name: "", icon: "🌾", category: "agriculture", location: "", farmer: "",
  description: "", roi: 20, minInvest: 100, duration: 30, stock: 100,
  unit: "kg", targetUsd: 5000,
}

function CreateProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)

  const mutation = useMutation({
    mutationFn: () => createProductFn({ ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      setForm(EMPTY_FORM)
      onClose()
    },
  })

  const field = (key: keyof typeof form) => ({
    value: form[key] as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: typeof f[key] === 'number' ? Number(e.target.value) : e.target.value })),
  })

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div key="panel" className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="font-display font-bold text-[16px]">Nouveau produit d'investissement</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {mutation.error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-[12px] text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {mutation.error instanceof Error ? mutation.error.message : 'Erreur lors de la création'}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nom du produit</Label>
                  <Input {...field('name')} placeholder="Ex : Pastèques Songololo" />
                </div>
                <div>
                  <Label>Icône</Label>
                  <Input {...field('icon')} placeholder="🌾" />
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <select className="select" {...field('category')}>
                    <option value="agriculture">Agriculture</option>
                    <option value="export">Export</option>
                    <option value="logistique">Logistique</option>
                    <option value="elevage">Élevage</option>
                  </select>
                </div>
                <div>
                  <Label>Localisation</Label>
                  <Input {...field('location')} placeholder="Songololo" />
                </div>
                <div>
                  <Label>Agriculteur / Coopérative</Label>
                  <Input {...field('farmer')} placeholder="Jean-Baptiste Mwamba" />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <textarea rows={2} className="select resize-none" {...field('description')} placeholder="Description courte…" />
                </div>
                <div>
                  <Label>ROI (%)</Label>
                  <Input type="number" min={1} max={100} {...field('roi')} />
                </div>
                <div>
                  <Label>Durée (jours)</Label>
                  <Input type="number" min={1} {...field('duration')} />
                </div>
                <div>
                  <Label>Investissement min ($)</Label>
                  <Input type="number" min={1} {...field('minInvest')} />
                </div>
                <div>
                  <Label>Objectif ($)</Label>
                  <Input type="number" min={1} {...field('targetUsd')} />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input type="number" min={1} {...field('stock')} />
                </div>
                <div>
                  <Label>Unité</Label>
                  <Input {...field('unit')} placeholder="kg, bacs, sacs…" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !form.name || !form.location}
                className="flex-1 h-10 bg-[#1E3A5F] hover:bg-[#162d4d] disabled:opacity-50 text-white rounded-xl text-[13px] font-bold transition flex items-center justify-center gap-1.5"
              >
                {mutation.isPending ? 'Création…' : <><Plus className="w-4 h-4" /> Créer le produit</>}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{children}</label>
}

function Input({ type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" {...props} />
}

/* ─── main page ──────────────────────────────────────────────────────────────── */

export function AdminProducts() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      if (isDevMode()) return { products: MOCK_PRODUCTS }
      const res = await getProductsAdminFn({})
      return res.data
    },
  })

  const statusMutation = useMutation({
    mutationFn: (vars: { productId: string; status: string }) => {
      if (isDevMode()) return Promise.resolve({ data: { success: true } })
      return updateProductStatusFn(vars)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  })

  const products = data?.products ?? []
  const active = products.filter(p => p.status === 'active').length
  const totalInvested = products.reduce((s, p) => s + (p.invested ?? 0), 0)

  return (
    <motion.section
      data-testid="admin-products"
      className="page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="section-kicker">Gestion des produits</div>
          <h1 className="page-title">Produits d'investissement</h1>
          <p className="page-copy">Créez et gérez les opportunités visibles par les investisseurs.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 h-9 bg-[#1E3A5F] hover:bg-[#162d4d] text-white rounded-xl text-[13px] font-bold transition"
        >
          <Plus className="w-4 h-4" /> Nouveau produit
        </button>
      </div>

      {/* KPI strip */}
      <div className="stats-grid">
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Produits actifs</span><CheckCircle2 size={18} /></div>
          <p className="metric-value">{active}</p>
          <p className="muted">sur {products.length} total</p>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Total financé</span><TrendingUp size={18} /></div>
          <p className="metric-value">{fmt(totalInvested)}</p>
          <p className="muted">à travers tous les produits</p>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Brouillons</span><Clock size={18} /></div>
          <p className="metric-value">{products.filter(p => p.status === 'draft').length}</p>
          <p className="muted">en attente d'activation</p>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span className="badge">Investisseurs</span><Package size={18} /></div>
          <p className="metric-value">{products.reduce((s, p) => s + (p.investorsCount ?? 0), 0)}</p>
          <p className="muted">actifs sur des produits</p>
        </article>
      </div>

      {/* Products table */}
      <article className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="section-header" style={{ padding: '20px 24px 16px' }}>
          <div>
            <div className="section-kicker">Catalogue</div>
            <h3 style={{ margin: "6px 0 0" }}>Tous les produits</h3>
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 pb-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="px-6 pb-10 text-center text-gray-400 text-[13px]">
            Aucun produit. Créez le premier.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {products.map(p => (
              <div key={p.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/70 transition group">
                <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-[14px] text-gray-900 truncate">{p.name}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-2">
                    <span>{p.location}</span>
                    <span>·</span>
                    <span>ROI {p.roi}%</span>
                    <span>·</span>
                    <span>{p.duration}j</span>
                    <span>·</span>
                    <span>min ${p.minInvest}</span>
                    <span>·</span>
                    <span>{p.investorsCount} investisseur(s)</span>
                  </div>
                  <Progress value={p.invested ?? 0} max={p.targetUsd} />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                  {p.status !== 'active' && (
                    <button
                      onClick={() => statusMutation.mutate({ productId: p.id, status: 'active' })}
                      disabled={statusMutation.isPending}
                      className="text-[11px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1 transition"
                    >
                      Activer
                    </button>
                  )}
                  {p.status === 'active' && (
                    <button
                      onClick={() => statusMutation.mutate({ productId: p.id, status: 'inactive' })}
                      disabled={statusMutation.isPending}
                      className="text-[11px] font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg px-2.5 py-1 transition"
                    >
                      Désactiver
                    </button>
                  )}
                  <button className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <CreateProductModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </motion.section>
  )
}
