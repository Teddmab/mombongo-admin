import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs, getDoc, doc, query, orderBy, where } from "firebase/firestore";
import { Copy, Eye, EyeOff, Handshake } from "lucide-react";
import { db, functions } from "@/lib/firebase";

interface MerchantOption {
  uid: string;
  fullName: string;
  email: string;
}

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface PartnerRow {
  id: string;
  name: string;
  active: boolean;
  testMode?: boolean;
  webhookUrl?: string | null;
  merchantUid?: string;
  hmacSecret?: string;
  outboundHmacSecret?: string;
  createdAt?: { seconds: number };
}

interface ProvisionResult {
  partnerId: string;
  merchantUid: string;
  hmacSecret: string;
  outboundHmacSecret: string;
}

type MerchantMode = "new" | "existing";

const adminProvisionPartnerFn = httpsCallable<Record<string, unknown>, ProvisionResult>(
  functions,
  "adminProvisionPartner",
);

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export function AdminPartners() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: partners = [], isLoading, error } = useQuery({
    queryKey: ["admin-partners"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "partners"), orderBy("createdAt", "desc")));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PartnerRow);
    },
  });

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <div className="section-kicker">Partenaires</div>
          <h1 className="page-title">Partenaires API</h1>
          <p className="page-copy">{partners.length} partenaire{partners.length !== 1 ? "s" : ""} provisionné{partners.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <ProvisionPartnerForm onProvisioned={() => qc.invalidateQueries({ queryKey: ["admin-partners"] })} />

      <article className="panel" style={{ marginTop: 24 }}>
        <div className="section-header">
          <div>
            <div className="section-kicker">Existants</div>
            <h2 className="card-title">Tous les partenaires</h2>
          </div>
          <Handshake size={18} className="text-gray-300" />
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((n) => <div key={n} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : error ? (
          <p style={{ padding: 20, fontSize: 13, color: "hsl(var(--danger))" }}>
            Impossible de charger les partenaires : {error instanceof Error ? error.message : "erreur inconnue"}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Webhook</th>
                  <th>Mode</th>
                  <th>Statut</th>
                  <th>Créé le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.id}</td>
                    <td>{p.name}</td>
                    <td style={{ fontSize: 12, color: p.webhookUrl ? "hsl(var(--gray-900))" : "var(--color-muted)" }}>
                      {p.webhookUrl || "non configuré"}
                    </td>
                    <td>{p.testMode ? <span className="pill">test</span> : <span className="pill status-active">live</span>}</td>
                    <td>
                      <span className={`pill ${p.active ? "status-active" : "status-blocked"}`}>
                        {p.active ? "actif" : "inactif"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{fmtDate(p.createdAt)}</td>
                    <td>
                      <button
                        onClick={() => navigate(`/admin/partners/${p.id}`)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
                {partners.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--color-muted)", padding: "32px" }}>
                      Aucun partenaire pour le moment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

/* ─── Provision form ────────────────────────────────────────────────────── */

function ProvisionPartnerForm({ onProvisioned }: { onProvisioned: () => void }) {
  const [partnerId, setPartnerId] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testMode, setTestMode] = useState(true);
  const [merchantMode, setMerchantMode] = useState<MerchantMode>("new");
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantDisplayName, setMerchantDisplayName] = useState("");
  const [existingMerchantUid, setExistingMerchantUid] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "err">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: merchants = [], isLoading: merchantsLoading } = useQuery({
    queryKey: ["admin-merchant-users"],
    queryFn: async () => {
      // No orderBy here deliberately — where("role","==",...) + orderBy on
      // a different field needs a composite Firestore index that may not
      // exist yet; sort client-side instead of depending on one.
      const snap = await getDocs(query(collection(db, "users"), where("role", "==", "merchant")));
      return snap.docs
        .map((d) => ({ uid: d.id, fullName: d.data().fullName ?? "", email: d.data().email ?? "" }) as MerchantOption)
        .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
    },
    enabled: merchantMode === "existing",
  });

  const canSubmit =
    partnerId.trim() && partnerName.trim() &&
    (merchantMode === "new" ? merchantEmail.trim() && merchantDisplayName.trim() : existingMerchantUid.trim());

  async function handleSubmit() {
    setStatus("loading");
    setError(null);
    try {
      const res = await adminProvisionPartnerFn({
        partnerId: partnerId.trim(),
        partnerName: partnerName.trim(),
        webhookUrl: webhookUrl.trim() || undefined,
        testMode,
        merchantMode,
        ...(merchantMode === "new"
          ? { merchantEmail: merchantEmail.trim(), merchantDisplayName: merchantDisplayName.trim() }
          : { existingMerchantUid: existingMerchantUid.trim() }),
      });
      setResult(res.data);
      setStatus("idle");
      onProvisioned();
    } catch (e: unknown) {
      setStatus("err");
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  function copy(field: string, value: string) {
    void navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  if (result) {
    return (
      <article className="panel">
        <div className="section-header">
          <div>
            <p className="card-title">✓ Partenaire « {result.partnerId} » provisionné</p>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Copiez ces secrets maintenant — envoyez-les au partenaire par un canal sécurisé, hors de cette interface.
            </p>
          </div>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <SecretRow label="hmacSecret (le partenaire signe ses appels entrants avec ceci)" value={result.hmacSecret}
            copied={copiedField === "hmac"} onCopy={() => copy("hmac", result.hmacSecret)} />
          <SecretRow label="outboundHmacSecret (Mombongo signe les notifications sortantes avec ceci)" value={result.outboundHmacSecret}
            copied={copiedField === "outbound"} onCopy={() => copy("outbound", result.outboundHmacSecret)} />
          <button className="btn-primary" style={{ height: 38, marginTop: 4, alignSelf: "flex-start" }} onClick={() => setResult(null)}>
            Provisionner un autre partenaire
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="panel">
      <div className="section-header">
        <div>
          <p className="card-title">Nouveau partenaire</p>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Crée les identifiants d'API et le compte marchand qui reçoit les paiements.
          </p>
        </div>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
        <Field label="ID partenaire (ex: arom)">
          <input value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white w-full" placeholder="arom" />
        </Field>
        <Field label="Nom du partenaire">
          <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white w-full" placeholder="AROM" />
        </Field>
        <Field label="URL du webhook (facultatif — peut être ajoutée plus tard)">
          <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white w-full" placeholder="https://…" />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
          Mode test
        </label>

        <div style={{ borderTop: "1px solid hsl(var(--gray-200))", paddingTop: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Compte marchand</p>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="radio" checked={merchantMode === "new"} onChange={() => setMerchantMode("new")} />
              Nouveau compte
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="radio" checked={merchantMode === "existing"} onChange={() => setMerchantMode("existing")} />
              Compte marchand existant
            </label>
          </div>

          {merchantMode === "new" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Email du compte marchand">
                <input value={merchantEmail} onChange={(e) => setMerchantEmail(e.target.value)} className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white w-full" placeholder="partner-api@partners.mombongo.coop" />
              </Field>
              <Field label="Nom affiché">
                <input value={merchantDisplayName} onChange={(e) => setMerchantDisplayName(e.target.value)} className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white w-full" placeholder="AROM — compte API" />
              </Field>
            </div>
          ) : (
            <Field label="Compte marchand">
              <select
                value={existingMerchantUid}
                onChange={(e) => setExistingMerchantUid(e.target.value)}
                disabled={merchantsLoading}
                className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white w-full"
              >
                <option value="">
                  {merchantsLoading ? "Chargement…" : merchants.length === 0 ? "Aucun compte marchand trouvé" : "Sélectionner un marchand"}
                </option>
                {merchants.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.fullName || "(sans nom)"} — {m.email || m.uid}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <button
          className="btn-primary"
          style={{ height: 40, marginTop: 4, alignSelf: "flex-start" }}
          disabled={!canSubmit || status === "loading"}
          onClick={handleSubmit}
        >
          {status === "loading" ? "Provisionnement…" : "Provisionner"}
        </button>
        {status === "err" && error && <p style={{ fontSize: 13, color: "hsl(var(--danger))" }}>{error}</p>}
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      <span style={{ color: "var(--color-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function SecretRow({
  label, value, copied, onCopy, maskable,
}: {
  label: string; value: string; copied: boolean; onCopy: () => void; maskable?: boolean;
}) {
  // Masked by default when maskable (the detail-view reveal case) — the
  // creation-time success panel doesn't pass maskable, since that's the
  // one moment the value is meant to be read off the screen directly.
  const [revealed, setRevealed] = useState(!maskable);
  const display = revealed ? value : "•".repeat(Math.min(40, value.length));

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>{label}</p>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "hsl(var(--gray-50))", border: "1px solid hsl(var(--gray-200))",
        borderRadius: 10, padding: "8px 12px",
      }}>
        <span style={{ flex: 1, fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}>{display}</span>
        {maskable && (
          <button onClick={() => setRevealed((r) => !r)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
            {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        <button onClick={onCopy} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
          <Copy size={15} />
        </button>
      </div>
      {copied && <p style={{ fontSize: 12, color: "hsl(var(--success))", marginTop: 4 }}>Copié !</p>}
    </div>
  );
}

/* ─── Detail ────────────────────────────────────────────────────────────── */

export function AdminPartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: partner, isLoading, error } = useQuery({
    queryKey: ["admin-partner", id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "partners", id!));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as PartnerRow;
    },
    enabled: !!id,
  });

  function copy(field: string, value: string) {
    void navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  if (isLoading) {
    return (
      <section className="page">
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </section>
    );
  }
  if (error) {
    return (
      <section className="page">
        <p style={{ padding: 20, fontSize: 13, color: "hsl(var(--danger))" }}>
          Impossible de charger ce partenaire : {error instanceof Error ? error.message : "erreur inconnue"}
        </p>
      </section>
    );
  }
  if (!partner) {
    return (
      <section className="page">
        <p className="text-center text-gray-400 py-20">Partenaire introuvable</p>
      </section>
    );
  }

  const fields: [string, string][] = [
    ["Nom", partner.name],
    ["Mode", partner.testMode ? "Test" : "Live"],
    ["Statut", partner.active ? "Actif" : "Inactif"],
    ["Webhook", partner.webhookUrl || "non configuré"],
    ["Compte marchand (uid)", partner.merchantUid || "—"],
    ["Créé le", fmtDate(partner.createdAt)],
  ];

  return (
    <section className="page">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 mb-4">← Retour</button>

      <div className="page-header">
        <div>
          <div className="section-kicker">Partenaire</div>
          <h1 className="page-title" style={{ fontFamily: "monospace", fontSize: 18 }}>{partner.id}</h1>
        </div>
        <span className={`pill ${partner.active ? "status-active" : "status-blocked"}`}>
          {partner.active ? "actif" : "inactif"}
        </span>
      </div>

      <article className="panel" style={{ maxWidth: 560 }}>
        <dl>
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-gray-50 py-2.5 last:border-0">
              <dt className="text-sm text-gray-500">{k}</dt>
              <dd className="text-sm font-semibold text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
      </article>

      <article className="panel" style={{ maxWidth: 560, marginTop: 16 }}>
        <div className="section-header">
          <div>
            <p className="card-title">Secrets API</p>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Masqués par défaut — cliquez sur l'œil pour afficher avant de copier.
            </p>
          </div>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {partner.hmacSecret && (
            <SecretRow
              label="hmacSecret (le partenaire signe ses appels entrants avec ceci)"
              value={partner.hmacSecret}
              maskable
              copied={copiedField === "hmac"}
              onCopy={() => copy("hmac", partner.hmacSecret!)}
            />
          )}
          {partner.outboundHmacSecret && (
            <SecretRow
              label="outboundHmacSecret (Mombongo signe les notifications sortantes avec ceci)"
              value={partner.outboundHmacSecret}
              maskable
              copied={copiedField === "outbound"}
              onCopy={() => copy("outbound", partner.outboundHmacSecret!)}
            />
          )}
        </div>
      </article>
    </section>
  );
}
