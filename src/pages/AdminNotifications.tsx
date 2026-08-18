import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db, functions } from '@/lib/firebase'
import { Bell, Send, Zap } from 'lucide-react'

const adminSendPushFn = httpsCallable(functions, 'adminSendPush')
const adminTriggerMorningPricePushFn = httpsCallable(functions, 'adminTriggerMorningPricePush')

interface PushLog {
  id: string
  title: string
  body: string
  targetUid: string | null
  targetRole: string | null
  results: { sent: number; failed: number }
  sentBy: string
  createdAt?: { seconds: number }
  screen?: string | null
}

function usePushLog() {
  return useQuery<PushLog[]>({
    queryKey: ['admin-push-log'],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, 'admin_push_log'),
        orderBy('createdAt', 'desc'),
        limit(20),
      ))
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PushLog))
    },
    staleTime: 30_000,
  })
}

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminNotifications() {
  return (
    <section className="page">
      <div>
        <div className="section-kicker">Notifications</div>
        <h1 className="page-title">Centre de notifications</h1>
        <p className="page-copy">
          Envoyez des push FCM de test ou déclenchez le push prix du matin manuellement.
        </p>
      </div>

      <TestPushSection />
      <MorningPricePushSection />
      <PushLogSection />
    </section>
  )
}

const SCREENS = ['market', 'financement', 'bourse', 'exploitation', 'academia']
const ROLES = ['farmer', 'agent', 'investor', 'merchant']

function TestPushSection() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'uid' | 'role'>('uid')
  const [target, setTarget] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [screen, setScreen] = useState('')
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!title || !body || !target) return
    const label = mode === 'uid' ? target : `tous les ${target}s`
    if (!window.confirm(`Envoyer "${title}" → ${label} ?`)) return

    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload: Record<string, string> = { title, body }
      if (screen) payload.screen = screen
      if (mode === 'uid') payload.targetUid = target
      else payload.targetRole = target

      const res = await adminSendPushFn(payload)
      setResult(res.data as { sent: number; failed: number })
      void qc.invalidateQueries({ queryKey: ['admin-push-log'] })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const btnGhost = 'px-4 py-2 text-[13px] font-bold border border-gray-200 rounded-[10px] bg-white text-gray-600 hover:bg-gray-50 cursor-pointer'

  return (
    <article className="panel">
      <div className="section-header">
        <div>
          <div className="section-kicker">Envoi manuel</div>
          <h2 className="card-title">Envoyer un push de test</h2>
        </div>
        <Send size={18} className="text-gray-300" />
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="form-label">Cible</label>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              className={mode === 'uid' ? 'btn-primary' : btnGhost}
              style={{ height: 36 }}
              onClick={() => { setMode('uid'); setTarget('') }}
            >
              Par UID
            </button>
            <button
              type="button"
              className={mode === 'role' ? 'btn-primary' : btnGhost}
              style={{ height: 36 }}
              onClick={() => { setMode('role'); setTarget('') }}
            >
              Par rôle
            </button>
          </div>
        </div>

        {mode === 'uid' ? (
          <div>
            <label className="form-label">UID utilisateur</label>
            <input
              className="form-input"
              placeholder="abc123def456…"
              value={target}
              onChange={e => setTarget(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label className="form-label">Rôle cible</label>
            <select className="form-select" value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">Choisir un rôle…</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="form-label">Titre</label>
          <input
            className="form-input"
            placeholder="Ex: Mise à jour des prix"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">Corps du message</label>
          <textarea
            className="form-textarea"
            placeholder="Ex: Consultez les nouveaux prix du marché."
            value={body}
            rows={2}
            onChange={e => setBody(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">Écran cible (optionnel)</label>
          <select className="form-select" value={screen} onChange={e => setScreen(e.target.value)}>
            <option value="">Aucun deeplink</option>
            {SCREENS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button
          type="button"
          className="btn-primary w-full"
          style={{ height: 40 }}
          onClick={send}
          disabled={loading || !title || !body || !target}
        >
          {loading ? 'Envoi en cours…' : 'Envoyer le push'}
        </button>

        {result && (
          <p className="text-sm text-green-700 font-semibold">
            ✓ Envoyé: {result.sent} · Échec: {result.failed}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </article>
  )
}

function MorningPricePushSection() {
  const [loading, setLoading] = useState(false)
  const [triggeredAt, setTriggeredAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trigger = async () => {
    if (!window.confirm('Déclencher le push prix du matin pour tous les agriculteurs éligibles ?')) return
    setLoading(true)
    setError(null)
    setTriggeredAt(null)
    try {
      const res = await adminTriggerMorningPricePushFn({})
      setTriggeredAt((res.data as { triggeredAt: string }).triggeredAt)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className="panel">
      <div className="section-header">
        <div>
          <div className="section-kicker">Envoi planifié</div>
          <h2 className="card-title">Push prix du matin</h2>
        </div>
        <Zap size={18} className="text-gray-300" />
      </div>
      <div className="p-5 space-y-3">
        <p className="page-copy">
          Déclenche manuellement le push prix du marché (normalement envoyé à 06h30 WAT).
          Utile pour tester après avoir mis à jour les prix dans{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">province_prices</code>.
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ height: 40 }}
          onClick={trigger}
          disabled={loading}
        >
          {loading ? 'En cours…' : '▶ Déclencher maintenant'}
        </button>
        {triggeredAt && (
          <p className="text-sm text-green-700 font-semibold">
            ✓ Déclenché à {new Date(triggeredAt).toLocaleString('fr-FR')}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </article>
  )
}

function PushLogSection() {
  const { data: logs = [], isLoading } = usePushLog()

  return (
    <article className="panel">
      <div className="section-header">
        <div>
          <div className="section-kicker">Historique</div>
          <h2 className="card-title">Journal des envois ({logs.length})</h2>
        </div>
        <Bell size={18} className="text-gray-300" />
      </div>

      {isLoading ? (
        <div className="p-5 space-y-2">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-5 text-center">
          <p className="page-copy">Aucun envoi manuel enregistré.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Titre</th>
                <th>Cible</th>
                <th>Résultats</th>
                <th>Écran</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="muted">{fmtDate(log.createdAt)}</td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{log.title}</td>
                  <td>
                    {log.targetUid ? (
                      <span className="pill" style={{ background: 'hsl(217 91% 93%)', color: 'hsl(217 63% 35%)' }}>
                        {log.targetUid.slice(0, 10)}…
                      </span>
                    ) : log.targetRole ? (
                      <span className="pill" style={{ background: 'hsl(140 39% 88%)', color: 'hsl(142 56% 27%)' }}>
                        {log.targetRole}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="muted">
                    {log.results?.sent ?? 0} ✓ · {log.results?.failed ?? 0} ✗
                  </td>
                  <td className="muted">{log.screen || '—'}</td>
                  <td className="muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {log.sentBy?.slice(0, 8)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}
