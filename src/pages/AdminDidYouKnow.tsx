import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Pencil, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";

interface Fact {
  id: string;
  fr: string;
  en: string;
  ln: string;
  active: boolean;
  order: number;
}

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000); };
  return { msg, success: (t: string) => show(t, true), error: (t: string) => show(t, false) };
}

function useFacts() {
  return useQuery<Fact[]>({
    queryKey: ["did-you-know"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "did_you_know"), orderBy("order", "asc")));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Fact));
    },
    staleTime: 30_000,
  });
}

const cls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";

interface FormState { fr: string; en: string; ln: string }
const EMPTY: FormState = { fr: "", en: "", ln: "" };

export function AdminDidYouKnow() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: facts = [], isLoading } = useFacts();
  const [editing, setEditing] = useState<Fact | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (f: Fact) => { setEditing(f); setForm({ fr: f.fr, en: f.en, ln: f.ln }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.fr.trim()) throw new Error("Le texte français est requis");
      if (editing) {
        await updateDoc(doc(db, "did_you_know", editing.id), {
          fr: form.fr.trim(), en: form.en.trim(), ln: form.ln.trim(),
        });
      } else {
        await addDoc(collection(db, "did_you_know"), {
          fr: form.fr.trim(), en: form.en.trim(), ln: form.ln.trim(),
          active: true, order: facts.length, createdAt: serverTimestamp(),
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["did-you-know"] }); toast.success(editing ? "Fait modifié" : "Fait ajouté"); closeForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (f: Fact) => updateDoc(doc(db, "did_you_know", f.id), { active: !f.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["did-you-know"] }),
    onError: () => toast.error("Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteDoc(doc(db, "did_you_know", id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["did-you-know"] }); toast.success("Fait supprimé"); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const moveUp = useMutation({
    mutationFn: async (f: Fact) => {
      const prev = [...facts].sort((a, b) => a.order - b.order).find(x => x.order < f.order);
      if (!prev) return;
      await updateDoc(doc(db, "did_you_know", f.id), { order: prev.order });
      await updateDoc(doc(db, "did_you_know", prev.id), { order: f.order });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["did-you-know"] }),
  });

  const moveDown = useMutation({
    mutationFn: async (f: Fact) => {
      const sorted = [...facts].sort((a, b) => a.order - b.order);
      const next = sorted.find(x => x.order > f.order);
      if (!next) return;
      await updateDoc(doc(db, "did_you_know", f.id), { order: next.order });
      await updateDoc(doc(db, "did_you_know", next.id), { order: f.order });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["did-you-know"] }),
  });

  return (
    <section className="page">
      {/* Toast */}
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-[13px] font-semibold shadow-lg ${toast.msg.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg.text}
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="section-kicker">Contenu</div>
          <h1 className="page-title">Le saviez-vous ?</h1>
          <p className="page-copy">
            Faits affichés sur l'écran de chargement de l'application, en 3 langues. L'ordre est configurable.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-9 px-4 bg-green-700 hover:bg-green-800 text-white rounded-lg text-[13px] font-semibold transition"
        >
          <Plus className="w-4 h-4" /> Ajouter un fait
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="font-bold text-[16px] mb-4">{editing ? "Modifier le fait" : "Nouveau fait"}</h2>
            <div className="space-y-3">
              {(["fr", "en", "ln"] as const).map(lng => (
                <div key={lng}>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {lng === "fr" ? "🇫🇷 Français *" : lng === "en" ? "🇬🇧 Anglais" : "🇨🇩 Lingala"}
                  </label>
                  <textarea
                    rows={2}
                    value={form[lng]}
                    onChange={e => setForm(f => ({ ...f, [lng]: e.target.value }))}
                    className={cls}
                    placeholder={lng === "fr" ? "Texte en français…" : lng === "en" ? "Text in English…" : "Maloba na lingala…"}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={closeForm} className="flex-1 h-9 border border-gray-200 rounded-lg text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending || !form.fr.trim()}
                className="flex-1 h-9 bg-green-700 hover:bg-green-800 text-white rounded-lg text-[13px] font-semibold transition disabled:opacity-50"
              >
                {save.isPending ? "Enregistrement…" : editing ? "Mettre à jour" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-[13px] text-gray-400">Chargement…</div>
      ) : facts.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <p className="text-[32px] mb-3">💡</p>
          <p className="text-[14px]">Aucun fait pour l'instant. Ajoutez-en un !</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...facts].sort((a, b) => a.order - b.order).map((f, i, arr) => (
            <div key={f.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 transition ${f.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
              {/* Order controls */}
              <div className="flex flex-col gap-1 pt-0.5 text-gray-300">
                <button
                  onClick={() => moveUp.mutate(f)}
                  disabled={i === 0}
                  className="hover:text-gray-500 disabled:opacity-20 transition text-[10px] leading-none"
                >▲</button>
                <GripVertical className="w-3.5 h-3.5 mx-auto" />
                <button
                  onClick={() => moveDown.mutate(f)}
                  disabled={i === arr.length - 1}
                  className="hover:text-gray-500 disabled:opacity-20 transition text-[10px] leading-none"
                >▼</button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[13px] font-semibold text-gray-800">{f.fr}</p>
                {f.en && <p className="text-[12px] text-gray-500">🇬🇧 {f.en}</p>}
                {f.ln && <p className="text-[12px] text-gray-500">🇨🇩 {f.ln}</p>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => toggle.mutate(f)}
                  title={f.active ? "Désactiver" : "Activer"}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition text-gray-400 hover:text-gray-700"
                >
                  {f.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => openEdit(f)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition text-gray-400 hover:text-gray-700"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (confirm(`Supprimer ce fait ?`)) remove.mutate(f.id); }}
                  className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
