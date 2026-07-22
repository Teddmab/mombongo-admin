import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface PlatformSettings {
  investmentFeePercent: number;
  withdrawalFeePercent: number;
  depositFeePercent: number;
  maintenanceMode: boolean;
  minInvestmentUsd: number;
  maxInvestmentUsd: number;
  kycRequired: boolean;
  supportEmail: string;
  supportPhone: string;
  annualTargetVolumeUsd: number;
}

const DEFAULTS: PlatformSettings = {
  investmentFeePercent: 2,
  withdrawalFeePercent: 1.5,
  depositFeePercent: 0,
  maintenanceMode: false,
  minInvestmentUsd: 10,
  maxInvestmentUsd: 50000,
  kycRequired: true,
  supportEmail: "support@mombongo.com",
  supportPhone: "+243 XXX XXX XXX",
  annualTargetVolumeUsd: 1000000,
};

const SETTINGS_DOC = "platform_settings/global";

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500); };
  return { msg, success: (t: string) => show(t, true), error: (t: string) => show(t, false) };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <label className="text-sm text-gray-600 font-medium">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function NumInput({ value, onChange, min, max, step = 0.5 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(Number(e.target.value))}
      className="w-28 h-9 px-3 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-green-600"
    />
  );
}

export function AdminSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  // Store only unsaved edits as a delta; derive final form = saved + edits.
  // This avoids copying query data into state and eliminates the useEffect anti-pattern.
  const [edits, setEdits] = useState<Partial<PlatformSettings>>({});
  const [dirty, setDirty] = useState(false);

  const { data: saved, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const snap = await getDoc(doc(db, SETTINGS_DOC));
      if (!snap.exists()) return DEFAULTS;
      return { ...DEFAULTS, ...snap.data() } as PlatformSettings;
    },
  });

  const form = { ...(saved ?? DEFAULTS), ...edits } as PlatformSettings;

  function set<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setEdits(e => ({ ...e, [key]: value }));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      await setDoc(doc(db, SETTINGS_DOC), { ...form, updatedAt: serverTimestamp() }, { merge: true });
    },
    onSuccess: () => {
      toast.success("Paramètres sauvegardés");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      setEdits({});
      setDirty(false);
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  function handleReset() {
    if (!window.confirm("Restaurer les paramètres sauvegardés ?")) return;
    setEdits({});
    setDirty(false);
  }

  if (isLoading) {
    return (
      <section className="page">
        <div className="space-y-4">
          {[1, 2, 3].map(n => <div key={n} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-2 rounded-lg text-sm font-semibold shadow-lg ${toast.msg.ok ? "bg-green-600 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg.text}
        </div>
      )}

      <div className="section-header">
        <div>
          <div className="section-kicker">Configuration</div>
          <h1 className="page-title">Paramètres de la plateforme</h1>
          <p className="page-copy">Modifiez les paramètres globaux de Mombongo. Les changements prennent effet immédiatement.</p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button
              onClick={handleReset}
              className="h-9 px-4 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
            >
              Annuler
            </button>
          )}
          <button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            className="h-9 px-4 bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-green-800 transition"
          >
            {save.isPending ? "Enregistrement…" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {form.maintenanceMode && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-semibold">
          ⚠️ La plateforme est en mode maintenance — les utilisateurs voient une page de maintenance.
        </div>
      )}

      <div className="panel-grid">
        <article className="panel">
          <div className="section-header">
            <h3>Frais de transaction</h3>
          </div>
          <Field label="Commission investissement (%)">
            <NumInput value={form.investmentFeePercent} onChange={v => set("investmentFeePercent", v)} min={0} max={10} />
          </Field>
          <Field label="Frais de retrait (%)">
            <NumInput value={form.withdrawalFeePercent} onChange={v => set("withdrawalFeePercent", v)} min={0} max={10} />
          </Field>
          <Field label="Frais de dépôt (%)">
            <NumInput value={form.depositFeePercent} onChange={v => set("depositFeePercent", v)} min={0} max={10} />
          </Field>
        </article>

        <article className="panel">
          <div className="section-header">
            <h3>Limites d'investissement</h3>
          </div>
          <Field label="Investissement minimum (USD)">
            <NumInput value={form.minInvestmentUsd} onChange={v => set("minInvestmentUsd", v)} min={1} step={5} />
          </Field>
          <Field label="Investissement maximum (USD)">
            <NumInput value={form.maxInvestmentUsd} onChange={v => set("maxInvestmentUsd", v)} min={100} step={1000} />
          </Field>
          <Field label="Objectif annuel de volume (USD)">
            <NumInput value={form.annualTargetVolumeUsd} onChange={v => set("annualTargetVolumeUsd", v)} min={0} step={10000} />
          </Field>
        </article>

        <article className="panel">
          <div className="section-header">
            <h3>Accès et conformité</h3>
          </div>
          <Field label="KYC obligatoire">
            <button
              onClick={() => set("kycRequired", !form.kycRequired)}
              className={`h-8 px-4 rounded-lg text-sm font-semibold transition ${
                form.kycRequired ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500"
              }`}
            >
              {form.kycRequired ? "Activé" : "Désactivé"}
            </button>
          </Field>
          <Field label="Mode maintenance">
            <button
              onClick={() => set("maintenanceMode", !form.maintenanceMode)}
              className={`h-8 px-4 rounded-lg text-sm font-semibold transition ${
                form.maintenanceMode ? "bg-red-50 text-red-600 border border-red-200" : "bg-gray-100 text-gray-500"
              }`}
            >
              {form.maintenanceMode ? "Actif" : "Inactif"}
            </button>
          </Field>
        </article>

        <article className="panel">
          <div className="section-header">
            <h3>Informations de contact</h3>
          </div>
          <Field label="Email support">
            <input
              type="email"
              value={form.supportEmail}
              onChange={e => set("supportEmail", e.target.value)}
              className="w-56 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-600"
            />
          </Field>
          <Field label="Téléphone support">
            <input
              type="tel"
              value={form.supportPhone}
              onChange={e => set("supportPhone", e.target.value)}
              className="w-56 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-600"
            />
          </Field>
        </article>
      </div>
    </section>
  );
}
