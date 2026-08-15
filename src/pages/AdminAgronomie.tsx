import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { CheckCircle2, Loader2 } from "lucide-react";

const DRC_PROVINCES = [
  "National (toutes provinces)",
  "Kinshasa","Kongo Central","Kwango","Kwilu","Mai-Ndombe",
  "Kasaï","Kasaï-Central","Kasaï-Oriental","Lomami","Sankuru",
  "Maniema","Sud-Kivu","Nord-Kivu","Ituri","Haut-Uele","Tshopo",
  "Bas-Uele","Nord-Ubangi","Mongala","Sud-Ubangi","Équateur","Tshuapa",
  "Tanganyika","Haut-Lomami","Lualaba","Haut-Katanga",
]

const COMMODITIES = [
  "","Manioc","Maïs","Riz","Haricot","Arachide","Soja","Café","Cacao",
  "Plantain","Banane","Tomate","Oignon","Piment","Patate douce","Igname",
]

type Severity = "info" | "warning" | "critical"

const today = new Date().toISOString().split("T")[0]
const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]

export default function AdminAgronomie() {
  const [province, setProvince]   = useState(DRC_PROVINCES[0])
  const [commodity, setCommodity] = useState("")
  const [title, setTitle]         = useState("")
  const [body, setBody]           = useState("")
  const [severity, setSeverity]   = useState<Severity>("warning")
  const [source, setSource]       = useState("METTELSAT · Direction Météorologique")
  const [from, setFrom]           = useState(today)
  const [to, setTo]               = useState(in7days)
  const [loading, setLoading]     = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState("")

  const canSubmit = title.trim() && body.trim() && from && to && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError("")
    try {
      const fn = httpsCallable(functions, "createAgroAdvisory")
      await fn({
        province: province === "National (toutes provinces)" ? "all" : province,
        commodity: commodity || null,
        title: title.trim(),
        body: body.trim(),
        severity,
        source: source.trim(),
        effectiveFrom: new Date(from).toISOString(),
        effectiveTo:   new Date(to).toISOString(),
      })
      setSuccess(true)
      setTitle(""); setBody("")
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Erreur lors de la publication")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agronomie</h1>
          <p className="page-subtitle">Publier un conseil ou une alerte agronomique aux agriculteurs</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header">
          <h2 className="card-title">Publier un conseil</h2>
        </div>

        {success && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0" }}>
            <CheckCircle2 size={18} color="#16a34a" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>Conseil publié avec succès</span>
            <button onClick={() => setSuccess(false)} style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>Nouveau</button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Severity */}
          <div>
            <label className="form-label">Sévérité *</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["info", "warning", "critical"] as Severity[]).map(s => (
                <button key={s} type="button" onClick={() => setSeverity(s)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid",
                    fontWeight: 700, fontSize: 12, cursor: "pointer",
                    borderColor: severity === s ? (s === "critical" ? "#ef4444" : s === "warning" ? "#f59e0b" : "#3b82f6") : "#e5e7eb",
                    background: severity === s ? (s === "critical" ? "#fef2f2" : s === "warning" ? "#fffbeb" : "#eff6ff") : "#fff",
                    color: severity === s ? (s === "critical" ? "#dc2626" : s === "warning" ? "#d97706" : "#2563eb") : "#6b7280",
                  }}>
                  {s === "info" ? "ℹ️ Info" : s === "warning" ? "⚠️ Avertissement" : "🚨 Critique"}
                </button>
              ))}
            </div>
          </div>

          {/* Province + Commodity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label">Province *</label>
              <select value={province} onChange={e => setProvince(e.target.value)} className="form-select">
                {DRC_PROVINCES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Culture (optionnel)</label>
              <select value={commodity} onChange={e => setCommodity(e.target.value)} className="form-select">
                {COMMODITIES.map(c => <option key={c} value={c}>{c || "— Toutes cultures"}</option>)}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="form-label">Titre *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="form-input"
              placeholder="Ex: ⚠️ Alerte sécheresse — Kasaï Oriental" />
          </div>

          {/* Body */}
          <div>
            <label className="form-label">Corps du message *</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} className="form-textarea" rows={5}
              placeholder="Détails de l'alerte ou du conseil agronomique..." />
          </div>

          {/* Source */}
          <div>
            <label className="form-label">Source</label>
            <input value={source} onChange={e => setSource(e.target.value)} className="form-input"
              placeholder="Ex: METTELSAT · Direction Météorologique" />
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label">Valable du *</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Valable jusqu'au *</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input" />
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{error}</p>}

          <button type="submit" disabled={!canSubmit} className="btn-primary" style={{ height: 44, fontSize: 14 }}>
            {loading ? <Loader2 size={16} className="animate-spin" style={{ marginRight: 6 }} /> : null}
            Publier le conseil
          </button>
        </form>
      </div>
    </div>
  )
}
