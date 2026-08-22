import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  collection, getDocs, query, orderBy,
  doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import {
  getStorage, ref as storageRef, uploadBytesResumable,
  deleteObject,
} from 'firebase/storage'
import { db, app } from '@/lib/firebase'
import { Film, Plus, Pencil, Trash2, Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const storage = getStorage(app)

interface VideoDoc {
  id: string
  storagePath: string
  title: string
  durationSec: number
  updatedAt?: { seconds: number }
}

const PRESET_SLUGS = ['onboarding', 'exploitation', 'bourse', 'financement']

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const show = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }
  return { msg, success: (t: string) => show(t, true), error: (t: string) => show(t, false) }
}

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/* ─── Upload progress bar ─────────────────────────────────────────────────── */

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2">
      <div
        className="h-full bg-green-600 rounded-full transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

/* ─── Video form (create / edit) ──────────────────────────────────────────── */

interface FormProps {
  initial?: VideoDoc | null
  existingSlugs: string[]
  onClose: () => void
  onSaved: () => void
}

function VideoForm({ initial, existingSlugs, onClose, onSaved }: FormProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [slug, setSlug] = useState(initial?.id ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [durationSec, setDurationSec] = useState(initial?.durationSec ?? 0)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const isEdit = !!initial
  const storagePath = `videos/${slug}${file ? `.${file.name.split('.').pop()}` : initial?.storagePath.slice(initial.storagePath.lastIndexOf('.')) ?? '.mp4'}`

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    // auto-populate title from filename if blank
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    // try to read duration from the video element
    const url = URL.createObjectURL(f)
    const vid = document.createElement('video')
    vid.src = url
    vid.onloadedmetadata = () => {
      setDurationSec(Math.round(vid.duration))
      URL.revokeObjectURL(url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slug.trim()) return toast.error('Slug requis')
    if (!title.trim()) return toast.error('Titre requis')
    if (!isEdit && !file) return toast.error('Sélectionnez un fichier vidéo')
    if (!isEdit && existingSlugs.includes(slug)) return toast.error(`Le slug "${slug}" existe déjà`)

    setSaving(true)
    try {
      let finalPath = initial?.storagePath ?? storagePath
      if (file) {
        const path = `videos/${slug}.${file.name.split('.').pop()}`
        finalPath = path
        const uploadRef = storageRef(storage, path)
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(uploadRef, file, { contentType: file.type })
          task.on('state_changed',
            snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            resolve,
          )
        })
        setProgress(100)
      }

      const docData = {
        storagePath: finalPath,
        title: title.trim(),
        durationSec,
        updatedAt: serverTimestamp(),
      }

      if (isEdit) {
        await updateDoc(doc(db, 'videos', slug), docData)
      } else {
        await setDoc(doc(db, 'videos', slug), { ...docData, createdAt: serverTimestamp() })
      }

      onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium ${toast.msg.ok ? 'bg-green-700 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg.text}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-[18px]">
            {isEdit ? 'Modifier la vidéo' : 'Nouvelle vidéo'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slug */}
        <div>
          <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Slug (identifiant)
          </label>
          {isEdit ? (
            <p className="h-10 px-3 bg-gray-100 rounded-lg text-[14px] flex items-center text-gray-600 font-mono">{slug}</p>
          ) : (
            <div className="flex gap-2">
              <select
                value={PRESET_SLUGS.includes(slug) ? slug : ''}
                onChange={e => { if (e.target.value) setSlug(e.target.value) }}
                className="flex-1 h-10 border border-gray-200 rounded-lg px-3 text-[13px]"
              >
                <option value="">— Choisir un slug prédéfini —</option>
                {PRESET_SLUGS.map(s => (
                  <option key={s} value={s} disabled={existingSlugs.includes(s)}>{s}</option>
                ))}
              </select>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                placeholder="ou slug personnalisé"
                className="flex-1 h-10 border border-gray-200 rounded-lg px-3 text-[13px] font-mono"
              />
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Titre</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Comment vendre ma récolte"
            className="w-full h-10 border border-gray-200 rounded-lg px-3 text-[14px]"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Durée (secondes) — auto-détectée à l'upload
          </label>
          <input
            type="number"
            min={0}
            value={durationSec}
            onChange={e => setDurationSec(Number(e.target.value))}
            className="w-full h-10 border border-gray-200 rounded-lg px-3 text-[14px]"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Fichier vidéo {isEdit ? '(optionnel — remplace le fichier existant)' : ''}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-10 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-lg flex items-center justify-center gap-2 text-[13px] text-gray-500 hover:text-green-700 transition"
          >
            <Upload className="w-4 h-4" />
            {file ? file.name : 'Sélectionner un fichier…'}
          </button>
          {progress !== null && <ProgressBar value={progress} />}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 border border-gray-200 rounded-xl text-[14px] font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 h-10 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isEdit ? 'Enregistrer' : 'Créer & uploader'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ─── Main page ───────────────────────────────────────────────────────────── */

export function AdminVideos() {
  const qc = useQueryClient()
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editVideo, setEditVideo] = useState<VideoDoc | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const videosQ = useQuery({
    queryKey: ['admin-videos'],
    queryFn: async (): Promise<VideoDoc[]> => {
      const snap = await getDocs(query(collection(db, 'videos'), orderBy('updatedAt', 'desc')))
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as VideoDoc))
    },
    staleTime: 30_000,
  })

  const existingSlugs = (videosQ.data ?? []).map(v => v.id)

  const handleDelete = async (video: VideoDoc) => {
    if (!confirm(`Supprimer la vidéo "${video.title}" ? Cette action supprime aussi le fichier Storage.`)) return
    setDeleting(video.id)
    try {
      await deleteDoc(doc(db, 'videos', video.id))
      try {
        await deleteObject(storageRef(storage, video.storagePath))
      } catch {
        // file may not exist in Storage yet — not fatal
      }
      qc.invalidateQueries({ queryKey: ['admin-videos'] })
      toast.success('Vidéo supprimée')
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(null)
    }
  }

  const missingSlug = PRESET_SLUGS.find(s => !existingSlugs.includes(s))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium ${toast.msg.ok ? 'bg-green-700 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[11px] font-bold text-green-700 uppercase tracking-[0.18em] mb-1">Contenu</p>
          <h1 className="font-display font-black text-[26px] text-gray-900 flex items-center gap-3">
            <Film className="w-7 h-7 text-green-700" />
            Vidéos explicatives
          </h1>
        </div>
        <button
          onClick={() => { setEditVideo(null); setShowForm(true) }}
          className="h-10 px-4 bg-green-700 hover:bg-green-800 text-white rounded-xl font-display font-bold text-[13px] flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Nouvelle vidéo
        </button>
      </div>

      {/* Missing slugs alert */}
      {videosQ.data && missingSlug && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-[13px] text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Slugs manquants : {PRESET_SLUGS.filter(s => !existingSlugs.includes(s)).join(', ')}.
            {' '}Les vidéos correspondantes ne s'afficheront pas dans l'app.
          </span>
        </div>
      )}

      {/* Coverage chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PRESET_SLUGS.map(s => {
          const exists = existingSlugs.includes(s)
          return (
            <span
              key={s}
              className={`px-3 py-1 rounded-full text-[12px] font-bold flex items-center gap-1 ${exists ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
            >
              {exists ? '✓' : '○'} {s}
            </span>
          )
        })}
      </div>

      {/* Table */}
      {videosQ.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
        </div>
      ) : videosQ.data?.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Film className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucune vidéo configurée.</p>
          <p className="text-[12px] mt-1">Créez d'abord les 4 slugs prédéfinis.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Slug</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Titre</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Durée</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Storage path</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mis à jour</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {videosQ.data?.map(video => (
                <tr key={video.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                  <td className="px-5 py-3 font-mono text-green-700 font-bold">{video.id}</td>
                  <td className="px-5 py-3 text-gray-800 font-medium max-w-[200px] truncate">{video.title}</td>
                  <td className="px-5 py-3 text-gray-500 font-variant-numeric tabular-nums">
                    {video.durationSec ? fmtDuration(video.durationSec) : '—'}
                  </td>
                  <td className="px-5 py-3 font-mono text-gray-400 text-[11px] max-w-[180px] truncate">{video.storagePath}</td>
                  <td className="px-5 py-3 text-gray-400">{fmtDate(video.updatedAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setEditVideo(video); setShowForm(true) }}
                        className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(video)}
                        disabled={deleting === video.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-40"
                        title="Supprimer"
                      >
                        {deleting === video.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <VideoForm
          initial={editVideo}
          existingSlugs={existingSlugs}
          onClose={() => { setShowForm(false); setEditVideo(null) }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-videos'] })}
        />
      )}
    </div>
  )
}
