import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection, getDocs, query, orderBy, addDoc, updateDoc,
  doc, serverTimestamp, deleteDoc, writeBatch, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronUp, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };
  return { msg, success: (t: string) => show(t, true), error: (t: string) => show(t, false) };
}

interface Course {
  id: string;
  title: string;
  category: string;
  level: string;
  instructor: string;
  moduleCount: number;
  enrollmentCount: number;
  status: "published" | "draft";
}

interface Module {
  id: string;
  order: number;
  title: string;
  type: "video" | "pdf" | "quiz";
  durationMinutes: number;
  isFree: boolean;
}

const CATEGORY_OPTIONS = ["agriculture", "finance", "commerce", "technology"];
const LEVEL_OPTIONS = ["beginner", "intermediate", "advanced"];
const STATUS_CHIP: Record<string, string> = {
  published: "bg-green-50 text-green-700",
  draft: "bg-gray-100 text-gray-500",
};

export function AdminAcademia() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"courses" | "modules">("courses");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const coursesQ = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async (): Promise<Course[]> => {
      const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt", "desc")));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
    },
  });

  const modulesQ = useQuery({
    queryKey: ["admin-modules", selectedCourseId],
    enabled: !!selectedCourseId,
    queryFn: async (): Promise<Module[]> => {
      if (!selectedCourseId) return [];
      const snap = await getDocs(
        query(collection(db, "courses", selectedCourseId, "modules"), orderBy("order", "asc"))
      );
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Module));
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveCourse = useMutation({
    mutationFn: async (data: Omit<Course, "id" | "enrollmentCount">) => {
      if (editCourse) {
        await updateDoc(doc(db, "courses", editCourse.id), { ...data, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "courses"), { ...data, enrollmentCount: 0, createdAt: serverTimestamp() });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-courses"] }); setShowForm(false); setEditCourse(null); toast.success("Cours sauvegardé"); },
    onError: () => toast.error("Erreur lors de la sauvegarde"),

  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await updateDoc(doc(db, "courses", id), { status: status === "published" ? "draft" : "published" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-courses"] }),
  });

  const deleteCourse = useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, "courses", id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-courses"] }); toast.success("Cours supprimé"); },
  });

  const saveModule = useMutation({
    mutationFn: async (data: Omit<Module, "id">) => {
      await addDoc(collection(db, "courses", selectedCourseId!, "modules"), data);
      await updateDoc(doc(db, "courses", selectedCourseId!), { moduleCount: increment(1) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-modules", selectedCourseId] }); qc.invalidateQueries({ queryKey: ["admin-courses"] }); setShowModuleForm(false); toast.success("Module ajouté"); },
  });

  const deleteModule = useMutation({
    mutationFn: async (moduleId: string) => {
      await deleteDoc(doc(db, "courses", selectedCourseId!, "modules", moduleId));
      await updateDoc(doc(db, "courses", selectedCourseId!), { moduleCount: increment(-1) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-modules", selectedCourseId] }); qc.invalidateQueries({ queryKey: ["admin-courses"] }); },
  });

  async function reorderModule(idx: number, direction: "up" | "down") {
    const a = modules[idx];
    const b = direction === "up" ? modules[idx - 1] : modules[idx + 1];
    if (!a || !b || !selectedCourseId) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "courses", selectedCourseId, "modules", a.id), { order: b.order });
    batch.update(doc(db, "courses", selectedCourseId, "modules", b.id), { order: a.order });
    await batch.commit();
    qc.invalidateQueries({ queryKey: ["admin-modules", selectedCourseId] });
  }

  const courses = coursesQ.data ?? [];
  const modules = modulesQ.data ?? [];

  return (
    <div className="space-y-5">
      {/* Toast banner */}
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-[13px] font-semibold text-white ${toast.msg.ok ? "bg-green-700" : "bg-red-600"}`}>
          {toast.msg.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg.text}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Academia</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{courses.length} cours · gestion des contenus pédagogiques</p>
        </div>
        <button
          onClick={() => { setEditCourse(null); setShowForm(true); }}
          className="flex items-center gap-1.5 h-9 px-4 bg-green-700 text-white rounded-lg font-bold text-[13px] hover:bg-green-800 transition"
        >
          <Plus className="w-4 h-4" /> Nouveau cours
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {(["courses", "modules"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`h-8 px-4 rounded-lg text-[12px] font-bold transition ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "courses" ? "Cours" : "Modules"}
          </button>
        ))}
      </div>

      {/* Courses tab */}
      {tab === "courses" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {coursesQ.isLoading ? (
            <div className="p-8 text-center text-gray-400">Chargement…</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Titre", "Catégorie", "Niveau", "Formateur", "Modules", "Inscrits", "Statut", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {courses.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900 max-w-[220px] truncate">{c.title}</td>
                    <td className="px-4 py-3 text-gray-600">{c.category}</td>
                    <td className="px-4 py-3 text-gray-600">{c.level}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{c.instructor}</td>
                    <td className="px-4 py-3 text-gray-600">{c.moduleCount}</td>
                    <td className="px-4 py-3 text-gray-600">{c.enrollmentCount}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {c.status === "published" ? "Publié" : "Brouillon"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setSelectedCourseId(c.id); setTab("modules"); }} title="Modules"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleStatus.mutate({ id: c.id, status: c.status })} title="Publier/Dépublier"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                          {c.status === "published" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button onClick={() => { setEditCourse(c); setShowForm(true); }} title="Modifier"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm("Supprimer ce cours ?")) deleteCourse.mutate(c.id); }} title="Supprimer"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modules tab */}
      {tab === "modules" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <select
              value={selectedCourseId ?? ""}
              onChange={e => setSelectedCourseId(e.target.value || null)}
              className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-[13px] font-semibold"
            >
              <option value="">— Sélectionner un cours —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {selectedCourseId && (
              <button onClick={() => setShowModuleForm(true)}
                className="flex items-center gap-1.5 h-9 px-4 bg-green-700 text-white rounded-lg font-bold text-[13px] hover:bg-green-800 transition">
                <Plus className="w-4 h-4" /> Ajouter module
              </button>
            )}
          </div>

          {selectedCourseId && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {modulesQ.isLoading ? (
                <div className="p-8 text-center text-gray-400">Chargement…</div>
              ) : modules.length === 0 ? (
                <div className="p-8 text-center text-gray-400">Aucun module — ajoutez-en un</div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["#", "Titre", "Type", "Durée", "Gratuit", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {modules.map((m, idx) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 font-bold">{m.order}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{m.title}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{m.type}</td>
                        <td className="px-4 py-3 text-gray-600">{m.durationMinutes} min</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.isFree ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {m.isFree ? "Gratuit" : "Payant"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => reorderModule(idx, "up")} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" disabled={idx === 0}>
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            </button>
                            <button onClick={() => reorderModule(idx, "down")} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" disabled={idx === modules.length - 1}>
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>
                            <button onClick={() => { if (confirm("Supprimer ce module ?")) deleteModule.mutate(m.id); }}
                              className="p-1 rounded hover:bg-red-50 text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Course form modal */}
      {showForm && (
        <CourseForm
          initial={editCourse ?? undefined}
          onSave={data => saveCourse.mutate(data)}
          onClose={() => { setShowForm(false); setEditCourse(null); }}
          isPending={saveCourse.isPending}
        />
      )}

      {/* Module form modal */}
      {showModuleForm && selectedCourseId && (
        <ModuleForm
          nextOrder={(modulesQ.data?.length ?? 0) + 1}
          onSave={data => saveModule.mutate(data)}
          onClose={() => setShowModuleForm(false)}
          isPending={saveModule.isPending}
        />
      )}
    </div>
  );
}

/* ── Course form ────────────────────────────────────────────────────────────── */

function CourseForm({ initial, onSave, onClose, isPending }: {
  initial?: Course;
  onSave: (data: Omit<Course, "id" | "enrollmentCount">) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "agriculture");
  const [level, setLevel] = useState(initial?.level ?? "beginner");
  const [instructor, setInstructor] = useState(initial?.instructor ?? "");
  const [status, setStatus] = useState<"published" | "draft">(initial?.status ?? "draft");

  const submit = () => {
    if (!title || !instructor) return;
    onSave({ title, category, level, instructor, status, moduleCount: initial?.moduleCount ?? 0 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-bold text-[16px]">{initial ? "Modifier le cours" : "Nouveau cours"}</h2>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Titre</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-green-600" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Catégorie</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px]">
              {CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Niveau</label>
            <select value={level} onChange={e => setLevel(e.target.value)} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px]">
              {LEVEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Formateur</label>
          <input value={instructor} onChange={e => setInstructor(e.target.value)} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-green-600" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[13px] font-semibold text-gray-700">Statut</label>
          <button onClick={() => setStatus(s => s === "published" ? "draft" : "published")}
            className={`h-8 px-3 rounded-lg text-[12px] font-bold transition ${status === "published" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {status === "published" ? "Publié" : "Brouillon"}
          </button>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 h-10 bg-gray-100 text-gray-700 rounded-xl font-bold text-[13px]">Annuler</button>
          <button onClick={submit} disabled={isPending || !title || !instructor}
            className="flex-1 h-10 bg-green-700 text-white rounded-xl font-bold text-[13px] disabled:opacity-50">
            {isPending ? "…" : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Module form ────────────────────────────────────────────────────────────── */

function ModuleForm({ nextOrder, onSave, onClose, isPending }: {
  nextOrder: number;
  onSave: (data: Omit<Module, "id">) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"video" | "pdf" | "quiz">("video");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [isFree, setIsFree] = useState(false);

  const submit = () => {
    if (!title) return;
    onSave({ title, type, durationMinutes, isFree, order: nextOrder });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-bold text-[16px]">Nouveau module</h2>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Titre</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-green-600" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as typeof type)} className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px]">
              <option value="video">Vidéo</option>
              <option value="pdf">PDF</option>
              <option value="quiz">Quiz</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Durée (min)</label>
            <input type="number" min={1} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-green-600" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer">
          <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} className="w-4 h-4 accent-green-700" />
          Module gratuit (visible sans inscription)
        </label>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 h-10 bg-gray-100 text-gray-700 rounded-xl font-bold text-[13px]">Annuler</button>
          <button onClick={submit} disabled={isPending || !title}
            className="flex-1 h-10 bg-green-700 text-white rounded-xl font-bold text-[13px] disabled:opacity-50">
            {isPending ? "…" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
