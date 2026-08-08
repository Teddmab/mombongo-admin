import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection, doc, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, BookOpen, ChevronLeft,
  CheckCircle, XCircle, Layers, ListChecks, X, Check,
} from "lucide-react";
import { db } from "@/lib/firebase";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface OfferCourse {
  courseId: string;
  accessType: "full" | "chapters";
  chapterIds: string[];
}

interface Offer {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: "USD" | "CDF";
  durationDays: number;
  status: "active" | "draft";
  courses: OfferCourse[];
}

interface Course {
  id: string;
  title: string;
  category: string;
  level: string;
  moduleCount: number;
  status: "published" | "draft";
}

interface Module {
  id: string;
  order: number;
  title: string;
  type: "video" | "pdf" | "quiz";
  durationMinutes: number;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────────── */

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };
  return { msg, success: (t: string) => show(t, true), error: (t: string) => show(t, false) };
}

const STATUS_CHIP: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  draft:  "bg-gray-100 text-gray-500",
};

const MODULE_TYPE_ICON: Record<string, string> = {
  video: "🎬",
  pdf:   "📄",
  quiz:  "✏️",
};

/* ═══════════════════════════════════════════════════════════════════════════════
   OFFERS LIST
   ═══════════════════════════════════════════════════════════════════════════════ */

export function AdminOffers() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editOffer, setEditOffer] = useState<Offer | null>(null);

  const offersQ = useQuery({
    queryKey: ["admin-offers"],
    queryFn: async (): Promise<Offer[]> => {
      const snap = await getDocs(query(collection(db, "offers"), orderBy("createdAt", "desc")));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Offer));
    },
  });

  const saveOffer = useMutation({
    mutationFn: async (data: Omit<Offer, "id" | "courses">) => {
      if (editOffer) {
        await updateDoc(doc(db, "offers", editOffer.id), { ...data, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "offers"), { ...data, courses: [], createdAt: serverTimestamp() });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
      setShowForm(false);
      setEditOffer(null);
      toast.success(editOffer ? "Offre mise à jour" : "Offre créée");
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const deleteOffer = useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, "offers", id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
      toast.success("Offre supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const offers = offersQ.data ?? [];

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-[13px] font-semibold text-white ${toast.msg.ok ? "bg-green-700" : "bg-red-600"}`}>
          {toast.msg.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Offres d'accès</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{offers.length} offre{offers.length !== 1 ? "s" : ""} · accès cours par offre ou par chapitre</p>
        </div>
        <button
          onClick={() => { setEditOffer(null); setShowForm(true); }}
          className="flex items-center gap-1.5 h-9 px-4 bg-green-700 text-white rounded-lg font-bold text-[13px] hover:bg-green-800 transition"
        >
          <Plus className="w-4 h-4" /> Nouvelle offre
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {offersQ.isLoading ? (
          <div className="p-8 text-center text-gray-400">Chargement…</div>
        ) : offers.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-[13px]">Aucune offre créée.</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Nom", "Prix", "Durée", "Cours", "Statut", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {offers.map(offer => (
                <tr key={offer.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{offer.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{offer.description}</p>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">
                    {offer.price === 0 ? "Gratuit" : `${offer.price} ${offer.currency}`}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {offer.durationDays === 0 ? "Illimité" : `${offer.durationDays}j`}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-700">
                      <BookOpen className="w-3.5 h-3.5" />
                      {(offer.courses ?? []).length} cours
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[offer.status] ?? STATUS_CHIP.draft}`}>
                      {offer.status === "active" ? "Active" : "Brouillon"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => navigate(`/admin/offers/${offer.id}/course`)}
                        title="Configurer les cours"
                        className="h-8 px-3 rounded-lg text-[12px] font-bold text-green-700 bg-green-50 hover:bg-green-100 flex items-center gap-1 transition"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> Cours
                      </button>
                      <button
                        onClick={() => { setEditOffer(offer); setShowForm(true); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                        title="Modifier"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer "${offer.name}" ?`)) deleteOffer.mutate(offer.id);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Offer form modal */}
      {showForm && (
        <OfferFormModal
          initial={editOffer}
          onSave={(data) => saveOffer.mutate(data)}
          onClose={() => { setShowForm(false); setEditOffer(null); }}
          saving={saveOffer.isPending}
        />
      )}
    </div>
  );
}

/* ─── Offer form modal ────────────────────────────────────────────────────────── */

function OfferFormModal({
  initial, onSave, onClose, saving,
}: {
  initial: Offer | null;
  onSave: (data: Omit<Offer, "id" | "courses">) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName]           = useState(initial?.name ?? "");
  const [description, setDesc]    = useState(initial?.description ?? "");
  const [price, setPrice]         = useState(String(initial?.price ?? 0));
  const [currency, setCurrency]   = useState<"USD" | "CDF">(initial?.currency ?? "USD");
  const [durationDays, setDur]    = useState(String(initial?.durationDays ?? 30));
  const [status, setStatus]       = useState<"active" | "draft">(initial?.status ?? "draft");

  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), price: Number(price), currency, durationDays: Number(durationDays), status });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-[16px] text-gray-900">{initial ? "Modifier l'offre" : "Nouvelle offre"}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label="Nom">
            <input value={name} onChange={e => setName(e.target.value)} className={INPUT} placeholder="Ex: Accès Premium Academia" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2} className={`${INPUT} resize-none`} placeholder="Description courte…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix">
              <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Devise">
              <select value={currency} onChange={e => setCurrency(e.target.value as "USD" | "CDF")} className={INPUT}>
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
              </select>
            </Field>
          </div>
          <Field label="Durée d'accès (jours, 0 = illimité)">
            <input type="number" min={0} value={durationDays} onChange={e => setDur(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Statut">
            <select value={status} onChange={e => setStatus(e.target.value as "active" | "draft")} className={INPUT}>
              <option value="draft">Brouillon</option>
              <option value="active">Active</option>
            </select>
          </Field>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50 transition">Annuler</button>
          <button onClick={submit} disabled={saving || !name.trim()} className="flex-1 h-10 rounded-xl bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-[13px] font-bold transition">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   OFFER COURSE CONFIG  —  /admin/offers/:id/course
   ═══════════════════════════════════════════════════════════════════════════════ */

export function AdminOfferCourseConfig() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // Fetch the offer
  const offerQ = useQuery({
    queryKey: ["admin-offer", id],
    enabled: !!id,
    queryFn: async (): Promise<Offer> => {
      const snap = await getDoc(doc(db, "offers", id!));
      if (!snap.exists()) throw new Error("Offre introuvable");
      return { id: snap.id, ...snap.data() } as Offer;
    },
  });

  // Fetch all published courses (for picker)
  const allCoursesQ = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async (): Promise<Course[]> => {
      const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt", "desc")));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
    },
  });

  // Local editable state (mirrors offer.courses)
  const [offerCourses, setOfferCourses] = useState<OfferCourse[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (offerQ.data && !initialized) {
    setOfferCourses(offerQ.data.courses ?? []);
    setInitialized(true);
  }

  // Fetch modules for an expanded course
  const modulesQ = useQuery({
    queryKey: ["admin-modules", expandedCourseId],
    enabled: !!expandedCourseId,
    queryFn: async (): Promise<Module[]> => {
      if (!expandedCourseId) return [];
      const snap = await getDocs(
        query(collection(db, "courses", expandedCourseId, "modules"), orderBy("order", "asc"))
      );
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Module));
    },
  });

  const saveOfferCourses = useMutation({
    mutationFn: async () => {
      await updateDoc(doc(db, "offers", id!), { courses: offerCourses, updatedAt: serverTimestamp() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-offer", id] });
      toast.success("Configuration sauvegardée");
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const offer = offerQ.data;
  const allCourses = allCoursesQ.data ?? [];
  const addedCourseIds = new Set(offerCourses.map(c => c.courseId));
  const availableCourses = allCourses.filter(c => !addedCourseIds.has(c.id));

  function addCourse(courseId: string) {
    setOfferCourses(prev => [...prev, { courseId, accessType: "full", chapterIds: [] }]);
    setShowCoursePicker(false);
  }

  function removeCourse(courseId: string) {
    setOfferCourses(prev => prev.filter(c => c.courseId !== courseId));
    if (expandedCourseId === courseId) setExpandedCourseId(null);
  }

  function setAccessType(courseId: string, accessType: "full" | "chapters") {
    setOfferCourses(prev =>
      prev.map(c => c.courseId === courseId ? { ...c, accessType, chapterIds: accessType === "full" ? [] : c.chapterIds } : c)
    );
    if (accessType === "chapters") setExpandedCourseId(courseId);
    else if (expandedCourseId === courseId) setExpandedCourseId(null);
  }

  function toggleChapter(courseId: string, chapterId: string) {
    setOfferCourses(prev =>
      prev.map(c => {
        if (c.courseId !== courseId) return c;
        const has = c.chapterIds.includes(chapterId);
        return { ...c, chapterIds: has ? c.chapterIds.filter(id => id !== chapterId) : [...c.chapterIds, chapterId] };
      })
    );
  }

  function toggleAllChapters(courseId: string, moduleIds: string[], selectAll: boolean) {
    setOfferCourses(prev =>
      prev.map(c => c.courseId !== courseId ? c : { ...c, chapterIds: selectAll ? moduleIds : [] })
    );
  }

  if (offerQ.isLoading) {
    return <div className="p-8 text-center text-gray-400">Chargement…</div>;
  }
  if (offerQ.isError || !offer) {
    return <div className="p-8 text-center text-red-500">Offre introuvable.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-[13px] font-semibold text-white ${toast.msg.ok ? "bg-green-700" : "bg-red-600"}`}>
          {toast.msg.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/admin/offers")}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 hover:text-gray-700 mb-2 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Retour aux offres
          </button>
          <h1 className="text-[22px] font-bold text-gray-900">{offer.name}</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Configuration des cours · accès complet ou par chapitre
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowCoursePicker(true)}
            className="flex items-center gap-1.5 h-9 px-4 border border-gray-200 text-gray-700 rounded-lg font-bold text-[13px] hover:bg-gray-50 transition"
          >
            <Plus className="w-4 h-4" /> Ajouter un cours
          </button>
          <button
            onClick={() => saveOfferCourses.mutate()}
            disabled={saveOfferCourses.isPending}
            className="flex items-center gap-1.5 h-9 px-4 bg-green-700 text-white rounded-lg font-bold text-[13px] hover:bg-green-800 disabled:opacity-50 transition"
          >
            <Check className="w-4 h-4" />
            {saveOfferCourses.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Offer summary chip */}
      <div className="flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px]">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[offer.status] ?? STATUS_CHIP.draft}`}>
          {offer.status === "active" ? "Active" : "Brouillon"}
        </span>
        <span className="font-semibold text-gray-700">
          {offer.price === 0 ? "Gratuit" : `${offer.price} ${offer.currency}`}
        </span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500">
          {offer.durationDays === 0 ? "Accès illimité" : `${offer.durationDays} jours`}
        </span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500">{offerCourses.length} cours configuré{offerCourses.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Empty state */}
      {offerCourses.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400">
          <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-[14px] font-semibold text-gray-500 mb-1">Aucun cours dans cette offre</p>
          <p className="text-[13px]">Cliquez sur "Ajouter un cours" pour commencer.</p>
        </div>
      )}

      {/* Course cards */}
      <div className="space-y-3">
        {offerCourses.map(oc => {
          const course = allCourses.find(c => c.id === oc.courseId);
          const isExpanded = expandedCourseId === oc.courseId;
          const modules = isExpanded ? (modulesQ.data ?? []) : [];
          const selectedCount = oc.chapterIds.length;

          return (
            <div key={oc.courseId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Course header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <BookOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] text-gray-900 truncate">
                    {course?.title ?? oc.courseId}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 capitalize">
                    {course?.category ?? "—"} · {course?.level ?? "—"} · {course?.moduleCount ?? "?"} chapitres
                  </p>
                </div>

                {/* Access type toggle */}
                <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg flex-shrink-0">
                  <button
                    onClick={() => setAccessType(oc.courseId, "full")}
                    className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-bold transition ${
                      oc.accessType === "full"
                        ? "bg-white text-green-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Cours complet
                  </button>
                  <button
                    onClick={() => setAccessType(oc.courseId, "chapters")}
                    className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-bold transition ${
                      oc.accessType === "chapters"
                        ? "bg-white text-green-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    Par chapitre
                    {oc.accessType === "chapters" && selectedCount > 0 && (
                      <span className="ml-1 bg-green-100 text-green-700 text-[10px] font-extrabold rounded-full px-1.5 py-0.5">
                        {selectedCount}
                      </span>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => removeCourse(oc.courseId)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 transition flex-shrink-0"
                  title="Retirer ce cours"
                >
                  <X className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>

              {/* Per-chapter panel */}
              {oc.accessType === "chapters" && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  {modulesQ.isLoading && expandedCourseId === oc.courseId ? (
                    <p className="text-[13px] text-gray-400 text-center py-4">Chargement des chapitres…</p>
                  ) : modules.length === 0 && expandedCourseId !== oc.courseId ? (
                    <p className="text-[13px] text-gray-400">
                      Chapitres non chargés.{" "}
                      <button className="text-green-700 font-bold hover:underline" onClick={() => setExpandedCourseId(oc.courseId)}>
                        Charger
                      </button>
                    </p>
                  ) : (
                    <>
                      {/* Select all / none */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Chapitres accessibles ({selectedCount}/{modules.length})
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleAllChapters(oc.courseId, modules.map(m => m.id), true)}
                            className="text-[11px] font-bold text-green-700 hover:underline"
                          >
                            Tout sélectionner
                          </button>
                          <span className="text-gray-300">·</span>
                          <button
                            onClick={() => toggleAllChapters(oc.courseId, modules.map(m => m.id), false)}
                            className="text-[11px] font-bold text-gray-400 hover:underline"
                          >
                            Tout effacer
                          </button>
                        </div>
                      </div>

                      {/* Chapter list */}
                      <div className="grid grid-cols-1 gap-1.5">
                        {modules.map(module => {
                          const checked = oc.chapterIds.includes(module.id);
                          return (
                            <label
                              key={module.id}
                              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg cursor-pointer border transition select-none ${
                                checked
                                  ? "bg-green-50 border-green-200"
                                  : "bg-white border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleChapter(oc.courseId, module.id)}
                                className="accent-green-700 w-4 h-4 rounded flex-shrink-0"
                              />
                              <span className="text-[13px] flex-shrink-0">{MODULE_TYPE_ICON[module.type] ?? "📚"}</span>
                              <span className={`flex-1 text-[13px] font-medium ${checked ? "text-green-900" : "text-gray-700"}`}>
                                {module.order}. {module.title}
                              </span>
                              <span className="text-[11px] text-gray-400 flex-shrink-0">
                                {module.durationMinutes}min
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Course picker modal */}
      {showCoursePicker && (
        <CoursePicker
          courses={availableCourses}
          onSelect={addCourse}
          onClose={() => setShowCoursePicker(false)}
        />
      )}
    </div>
  );
}

/* ─── Course picker modal ─────────────────────────────────────────────────────── */

function CoursePicker({
  courses, onSelect, onClose,
}: {
  courses: Course[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-[15px] text-gray-900">Ajouter un cours</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un cours…"
            className={INPUT}
            autoFocus
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400 py-8">Aucun cours disponible.</p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition text-left border-b border-gray-50 last:border-0"
              >
                <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{c.title}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{c.category} · {c.moduleCount} chapitres</p>
                </div>
                <Plus className="w-4 h-4 text-green-600 flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared atoms ────────────────────────────────────────────────────────────── */

const INPUT = "w-full h-10 px-3.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}
