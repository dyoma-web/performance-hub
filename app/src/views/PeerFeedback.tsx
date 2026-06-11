import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import ScaleSelector from '../components/ScaleSelector'
import Avatar from '../components/Avatar'
import { MIN_COMMENT, itemError } from '../lib/scale'
import type { CatalogItem, Cycle, Profile, Review } from '../types'

interface ItemState {
  score: number | null
  comment: string
  links: string
}

const parseLinks = (s: string) => s.split(/[,\n]/).map((l) => l.trim()).filter(Boolean)

export default function PeerFeedback() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()
  const [requests, setRequests] = useState<(Review & { evaluatee: Profile })[]>([])
  const [behaviors, setBehaviors] = useState<CatalogItem[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, ItemState>>({})
  const [recognition, setRecognition] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!profile || !cycle) return
    Promise.all([
      supabase
        .from('reviews')
        .select('*, evaluatee:profiles!reviews_evaluatee_id_fkey(*)')
        .eq('cycle_id', cycle.id)
        .eq('reviewer_id', profile.id)
        .in('type', ['peer', 'stakeholder'])
        .order('created_at'),
      supabase.from('catalog_items').select('*').eq('kind', 'behavior').eq('is_active', true).order('sort_order'),
    ]).then(([r, b]) => {
      setRequests((r.data as (Review & { evaluatee: Profile })[]) ?? [])
      setBehaviors((b.data as CatalogItem[]) ?? [])
      setLoading(false)
    })
  }, [profile, cycle])

  const activeReq = useMemo(() => requests.find((r) => r.id === active) ?? null, [requests, active])

  async function open(req: Review & { evaluatee: Profile }) {
    setActive(req.id)
    setErrors({})
    const [{ data: rItems }] = await Promise.all([
      supabase.from('review_items').select('*').eq('review_id', req.id),
    ])
    const map: Record<string, ItemState> = {}
    for (const it of rItems ?? []) {
      map[it.item_ref] = { score: it.score, comment: it.comment ?? '', links: (it.evidence_links ?? []).join(', ') }
    }
    setItems(map)
    setRecognition(req.recognition ?? '')
    if (req.status === 'requested') {
      await supabase.from('reviews').update({ status: 'draft' }).eq('id', req.id)
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: 'draft' } : r)))
    }
  }

  function setItem(ref: string, patch: Partial<ItemState>) {
    setItems((prev) => {
      const base: ItemState = prev[ref] ?? { score: null, comment: '', links: '' }
      return { ...prev, [ref]: { ...base, ...patch } }
    })
    setErrors((prev) => {
      if (!prev[ref]) return prev
      const next = { ...prev }
      delete next[ref]
      return next
    })
  }

  async function save(submit: boolean) {
    if (!activeReq) return
    const errs: Record<string, string> = {}
    for (const b of behaviors) {
      const st = items[b.key]
      if (st?.score != null) {
        const e = itemError(st.score, st.comment, parseLinks(st.links))
        if (e) errs[b.key] = e
      } else if (submit) {
        errs[b.key] = 'Falta calificar este comportamiento'
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast('Revisa los ítems marcados en rojo', 'error')
      return
    }
    if (submit && recognition.trim().length < MIN_COMMENT) {
      toast(`El reconocimiento es obligatorio (mínimo ${MIN_COMMENT} caracteres)`, 'error')
      return
    }
    setSaving(true)
    try {
      const rows = behaviors
        .filter((b) => items[b.key] && (items[b.key].score != null || items[b.key].comment.trim()))
        .map((b) => ({
          review_id: activeReq.id,
          block: 'behaviors' as const,
          item_ref: b.key,
          score: items[b.key].score,
          comment: items[b.key].comment.trim() || null,
          evidence_links: parseLinks(items[b.key].links),
        }))
      if (rows.length > 0) {
        const { error } = await supabase.from('review_items').upsert(rows, { onConflict: 'review_id,block,item_ref' })
        if (error) throw new Error(error.message)
      }
      const patch: Record<string, unknown> = { recognition: recognition.trim() || null }
      if (submit) {
        patch.status = 'submitted'
        patch.submitted_at = new Date().toISOString()
      }
      const { error } = await supabase.from('reviews').update(patch).eq('id', activeReq.id)
      if (error) throw new Error(error.message)
      setRequests((prev) =>
        prev.map((r) => (r.id === activeReq.id ? { ...r, status: submit ? 'submitted' : 'draft', recognition } : r))
      )
      if (submit) {
        setActive(null)
        toast(`✓ Feedback para ${activeReq.evaluatee.name.split(' ')[0]} enviado`)
      } else {
        toast('Borrador guardado')
      }
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!profile || !cycle) return null

  const pending = requests.filter((r) => r.status === 'requested' || r.status === 'draft')
  const done = requests.filter((r) => r.status === 'submitted')
  const anonymous = cycle.config.peer_anonymous

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Feedback a Pares</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {pending.length} solicitud{pending.length === 1 ? '' : 'es'} pendiente{pending.length === 1 ? '' : 's'} · ciclo {cycle.name}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <span className="material-symbols-outlined text-accent" aria-hidden="true">
          {anonymous ? 'visibility_off' : 'visibility'}
        </span>
        <p className="text-xs leading-relaxed text-slate-600">
          En este ciclo tu feedback es <strong>{anonymous ? 'anónimo' : 'nominal'}</strong>:{' '}
          {anonymous
            ? 'la persona verá tus comentarios sin tu nombre.'
            : 'la persona evaluada verá tu nombre junto a tus comentarios. Sé directo y amable.'}
        </p>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando solicitudes…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden="true">reviews</span>
          <p className="mt-3 text-sm font-bold text-slate-600">No tienes solicitudes de feedback</p>
          <p className="mt-1 text-xs text-slate-400">Cuando un compañero o facilitador te solicite feedback, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((req) => (
            <div key={req.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => (active === req.id ? setActive(null) : open(req))}
                aria-expanded={active === req.id}
                className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Avatar profile={req.evaluatee} />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{req.evaluatee.name}</p>
                    <p className="text-[11px] text-slate-500">{req.evaluatee.position}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${req.status === 'draft' ? 'bg-accent/15 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                    {req.status === 'draft' ? 'En borrador' : 'Pendiente'}
                  </span>
                  <span className="material-symbols-outlined text-slate-400" aria-hidden="true">
                    {active === req.id ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </button>

              {active === req.id && (
                <div className="view-enter border-t border-slate-100 p-5">
                  <div className="space-y-4">
                    {behaviors.map((b) => {
                      const st = items[b.key] ?? { score: null, comment: '', links: '' }
                      const err = errors[b.key]
                      const len = st.comment.trim().length
                      return (
                        <div key={b.key} className={`rounded-xl border p-4 ${err ? 'border-highlight ring-2 ring-highlight/20' : 'border-slate-200'}`}>
                          <p className="text-sm font-bold text-slate-900">{b.name}</p>
                          <p className="mt-0.5 mb-3 text-[11px] text-slate-500">{b.description}</p>
                          <ScaleSelector label={b.name} value={st.score} onChange={(v) => setItem(b.key, { score: v })} />
                          <textarea
                            rows={2} value={st.comment}
                            onChange={(e) => setItem(b.key, { comment: e.target.value })}
                            aria-label={`Ejemplo observado: ${b.name}`}
                            className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            placeholder="Situación concreta que observaste: qué hizo, cuándo y qué impacto tuvo…"
                          />
                          <p className={`mt-1 text-[11px] ${len >= MIN_COMMENT ? 'text-primary' : 'text-slate-400'}`}>
                            {len} caracteres{len < MIN_COMMENT ? ` (mínimo ${MIN_COMMENT})` : ' ✓'}
                          </p>
                          {st.score === 4 && (
                            <input
                              value={st.links}
                              onChange={(e) => setItem(b.key, { links: e.target.value })}
                              aria-label={`Evidencia: ${b.name}`}
                              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-xs focus:border-primary focus:outline-none"
                              placeholder="Un 4 exige evidencia: link o referencia (https://…, JIRA-123)"
                            />
                          )}
                          {err && <p role="alert" className="mt-2 text-xs font-bold text-highlight">{err}</p>}
                        </div>
                      )
                    })}

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-sm font-bold text-slate-900">Reconocimiento *</p>
                      <p className="mt-0.5 mb-2 text-[11px] text-slate-500">
                        Lo más valioso que {req.evaluatee.name.split(' ')[0]} aportó este ciclo
                      </p>
                      <textarea
                        rows={2} value={recognition}
                        onChange={(e) => setRecognition(e.target.value)}
                        aria-label="Reconocimiento"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => save(false)} disabled={saving}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:border-primary/50 disabled:opacity-60"
                    >
                      Guardar borrador
                    </button>
                    <button
                      onClick={() => save(true)} disabled={saving}
                      className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60"
                    >
                      {saving ? 'Enviando…' : 'Enviar feedback'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {done.length > 0 && (
            <div className="pt-2">
              <h3 className="mb-2 text-xs font-extrabold tracking-wider text-slate-400 uppercase">Completados ({done.length})</h3>
              {done.map((req) => (
                <div key={req.id} className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 p-4">
                  <Avatar profile={req.evaluatee} size="h-8 w-8" />
                  <p className="flex-1 text-sm font-semibold text-slate-600">{req.evaluatee.name}</p>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
                    <span className="material-symbols-outlined text-base" aria-hidden="true">check_circle</span>
                    Enviado
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
