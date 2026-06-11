import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import ScaleSelector from '../components/ScaleSelector'
import Avatar from '../components/Avatar'
import { MIN_COMMENT, itemError } from '../lib/scale'
import type { Block, CatalogItem, Cycle, Objective, Profile, Review, ReviewItem } from '../types'

interface ItemState {
  score: number | null
  comment: string
  links: string
}
interface FFRow {
  action: string
  indicator: string
  due_date: string
}

const BLOCKS: { key: Block; label: string; icon: string }[] = [
  { key: 'results', label: 'Resultados', icon: 'flag' },
  { key: 'behaviors', label: 'Comportamientos', icon: 'diversity_3' },
  { key: 'skills', label: 'Habilidades', icon: 'construction' },
  { key: 'contribution', label: 'Contribución', icon: 'hub' },
]

const key = (b: Block, r: string) => `${b}|${r}`
const parseLinks = (s: string) => s.split(/[,\n]/).map((l) => l.trim()).filter(Boolean)

export default function FacilitatorReview() {
  const { userId } = useParams()
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()

  const [evaluatee, setEvaluatee] = useState<Profile | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [selfItems, setSelfItems] = useState<ReviewItem[]>([])
  const [peerItems, setPeerItems] = useState<ReviewItem[]>([])
  const [peerRecognitions, setPeerRecognitions] = useState<string[]>([])
  const [selfStatus, setSelfStatus] = useState<string>('none')
  const [items, setItems] = useState<Record<string, ItemState>>({})
  const [recognition, setRecognition] = useState('')
  const [feedforward, setFeedforward] = useState<FFRow[]>([
    { action: '', indicator: '', due_date: '' },
    { action: '', indicator: '', due_date: '' },
  ])
  const [tab, setTab] = useState<Block>('results')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submitted = review?.status === 'submitted'
  const minFF = cycle?.config.min_feedforward_actions ?? 2

  useEffect(() => {
    if (!profile || !cycle || !userId) return
    let cancelled = false
    async function load() {
      const { data: target } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      if (!target) {
        setLoading(false)
        return
      }
      let { data: rev } = await supabase
        .from('reviews').select('*')
        .eq('cycle_id', cycle!.id).eq('evaluatee_id', userId!).eq('type', 'facilitator')
        .maybeSingle()
      if (!rev) {
        const { data: created, error } = await supabase
          .from('reviews')
          .insert({ cycle_id: cycle!.id, evaluatee_id: userId!, reviewer_id: profile!.id, type: 'facilitator', status: 'draft' })
          .select().single()
        if (error) {
          toast(`No se pudo iniciar la evaluación: ${error.message}`, 'error')
          setLoading(false)
          return
        }
        rev = created
      }
      const { data: allReviews } = await supabase
        .from('reviews').select('*')
        .eq('cycle_id', cycle!.id).eq('evaluatee_id', userId!)
      const selfRev = (allReviews as Review[])?.find((r) => r.type === 'self')
      const submittedPeers = (allReviews as Review[])?.filter(
        (r) => (r.type === 'peer' || r.type === 'stakeholder') && r.status === 'submitted'
      ) ?? []
      const [{ data: objs }, { data: cat }, { data: myItems }, { data: ff }, selfItemsRes, peerItemsRes] = await Promise.all([
        supabase.from('objectives').select('*').eq('cycle_id', cycle!.id).eq('user_id', userId!).order('weight', { ascending: false }),
        supabase.from('catalog_items').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('review_items').select('*').eq('review_id', rev.id),
        supabase.from('feedforward_items').select('*').eq('review_id', rev.id).order('created_at'),
        selfRev && selfRev.status === 'submitted'
          ? supabase.from('review_items').select('*').eq('review_id', selfRev.id)
          : Promise.resolve({ data: [] }),
        submittedPeers.length > 0
          ? supabase.from('review_items').select('*').in('review_id', submittedPeers.map((p) => p.id))
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      setEvaluatee(target as Profile)
      setReview(rev as Review)
      setRecognition((rev as Review).recognition ?? '')
      setObjectives((objs as Objective[]) ?? [])
      setCatalog((cat as CatalogItem[]) ?? [])
      setSelfItems((selfItemsRes.data as ReviewItem[]) ?? [])
      setPeerItems((peerItemsRes.data as ReviewItem[]) ?? [])
      setPeerRecognitions(submittedPeers.map((p) => p.recognition).filter(Boolean) as string[])
      setSelfStatus(selfRev?.status ?? 'none')
      const map: Record<string, ItemState> = {}
      for (const it of myItems ?? []) {
        map[key(it.block, it.item_ref)] = { score: it.score, comment: it.comment ?? '', links: (it.evidence_links ?? []).join(', ') }
      }
      setItems(map)
      if (ff && ff.length > 0) {
        setFeedforward(ff.map((f) => ({ action: f.action, indicator: f.indicator, due_date: f.due_date ?? '' })))
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, cycle?.id, userId])

  const blockItems = useMemo(() => {
    const behaviors = catalog.filter((c) => c.kind === 'behavior')
    let skills = catalog.filter((c) => c.kind === 'skill' && c.role_type === evaluatee?.role_type)
    if (skills.length === 0) skills = catalog.filter((c) => c.kind === 'skill' && c.role_type === 'default')
    return {
      results: objectives.map((o) => ({ ref: o.id, name: o.title, description: `Métrica: ${o.metric} · Peso ${o.weight}% · Avance ${o.progress}%` })),
      behaviors: behaviors.map((c) => ({ ref: c.key, name: c.name, description: c.description })),
      skills: skills.map((c) => ({ ref: c.key, name: c.name, description: c.description })),
      contribution: catalog.filter((c) => c.kind === 'contribution').map((c) => ({ ref: c.key, name: c.name, description: c.description })),
    }
  }, [catalog, objectives, evaluatee?.role_type])

  function context(block: Block, ref: string) {
    const self = selfItems.find((i) => i.block === block && i.item_ref === ref)
    const peers = peerItems.filter((i) => i.block === block && i.item_ref === ref && i.score != null)
    const avg = peers.length > 0 ? peers.reduce((s, p) => s + (p.score ?? 0), 0) / peers.length : null
    return { selfScore: self?.score ?? null, peerAvg: avg, peerComments: peers.filter((p) => p.comment) }
  }

  function setItem(block: Block, ref: string, patch: Partial<ItemState>) {
    const k = key(block, ref)
    setItems((prev) => {
      const base: ItemState = prev[k] ?? { score: null, comment: '', links: '' }
      return { ...prev, [k]: { ...base, ...patch } }
    })
    setErrors((prev) => {
      if (!prev[k]) return prev
      const next = { ...prev }
      delete next[k]
      return next
    })
  }

  async function save(submit: boolean) {
    if (!review || !profile) return
    const errs: Record<string, string> = {}
    for (const b of BLOCKS) {
      for (const it of blockItems[b.key]) {
        const k = key(b.key, it.ref)
        const st = items[k]
        if (st?.score != null) {
          const e = itemError(st.score, st.comment, parseLinks(st.links))
          if (e) errs[k] = e
        } else if (submit) {
          errs[k] = 'Falta calificar este ítem'
        }
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast(`Hay ${Object.keys(errs).length} ítem(s) pendientes — revisa los marcados`, 'error')
      return
    }
    if (submit) {
      if (recognition.trim().length < MIN_COMMENT) {
        toast(`El reconocimiento es obligatorio (mínimo ${MIN_COMMENT} caracteres)`, 'error')
        return
      }
      const validFF = feedforward.filter((f) => f.action.trim().length >= 10 && f.indicator.trim())
      if (validFF.length < minFF) {
        toast(`Se requieren al menos ${minFF} acciones feedforward con indicador`, 'error')
        return
      }
    }
    setSaving(true)
    try {
      const rows = []
      for (const b of BLOCKS) {
        for (const it of blockItems[b.key]) {
          const st = items[key(b.key, it.ref)]
          if (!st || (st.score == null && !st.comment.trim())) continue
          rows.push({
            review_id: review.id, block: b.key, item_ref: it.ref,
            score: st.score, comment: st.comment.trim() || null,
            evidence_links: parseLinks(st.links),
          })
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase.from('review_items').upsert(rows, { onConflict: 'review_id,block,item_ref' })
        if (error) throw new Error(error.message)
      }
      await supabase.from('feedforward_items').delete().eq('review_id', review.id)
      const ffRows = feedforward.filter((f) => f.action.trim()).map((f) => ({
        review_id: review.id, action: f.action.trim(), indicator: f.indicator.trim(),
        due_date: f.due_date || null, responsible_id: evaluatee!.id,
      }))
      if (ffRows.length > 0) {
        const { error } = await supabase.from('feedforward_items').insert(ffRows)
        if (error) throw new Error(error.message)
      }
      const patch: Record<string, unknown> = { recognition: recognition.trim() || null }
      if (submit) {
        patch.status = 'submitted'
        patch.submitted_at = new Date().toISOString()
      }
      const { data: updated, error } = await supabase.from('reviews').update(patch).eq('id', review.id).select().single()
      if (error) throw new Error(error.message)
      setReview(updated as Review)
      if (submit && evaluatee) {
        await supabase.from('notifications').insert({
          user_id: evaluatee.id,
          type: 'review-submitted',
          title: 'Tu evaluación está lista',
          body: `${profile.name} completó tu evaluación del ciclo. El siguiente paso es la reunión 1:1.`,
          link: '/mi-desarrollo',
        })
      }
      toast(submit ? `✓ Evaluación de ${evaluatee?.name.split(' ')[0]} enviada` : 'Borrador guardado')
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!profile || !cycle) return null
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando evaluación…</p>
  if (!evaluatee) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-bold text-slate-600">No se encontró a la persona a evaluar</p>
        <Link to="/equipo" className="mt-2 inline-block text-xs font-bold text-primary hover:underline">← Volver a Mi Equipo</Link>
      </div>
    )
  }

  const scoreBadge = (label: string, value: number | null, color: string) =>
    value != null && (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${color}`}>
        {label}: {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
    )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/equipo" className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-primary">
        <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
        Mi Equipo
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar profile={evaluatee} size="h-12 w-12" />
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Evaluar a {evaluatee.name}</h2>
            <p className="text-xs font-medium text-slate-500">{evaluatee.position} · ciclo {cycle.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${selfStatus === 'submitted' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
            Autoevaluación: {selfStatus === 'submitted' ? 'enviada ✓' : selfStatus === 'draft' ? 'en borrador' : 'sin iniciar'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">
            {peerRecognitions.length} feedback de pares
          </span>
        </div>
      </div>

      {submitted && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5" role="status">
          <span className="material-symbols-outlined text-primary" aria-hidden="true">verified</span>
          <p className="text-sm font-bold text-slate-800">Evaluación enviada — solo lectura</p>
        </div>
      )}

      <div role="tablist" aria-label="Bloques" className="scrollbar-hide flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
        {BLOCKS.map((b) => (
          <button
            key={b.key} role="tab" aria-selected={tab === b.key}
            onClick={() => setTab(b.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
              tab === b.key ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">{b.icon}</span>
            <span className="hidden sm:inline">{b.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {blockItems[tab].length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {tab === 'results' ? `${evaluatee.name.split(' ')[0]} no tiene objetivos definidos en este ciclo.` : 'Sin ítems.'}
          </p>
        )}
        {blockItems[tab].map((it) => {
          const k = key(tab, it.ref)
          const st = items[k] ?? { score: null, comment: '', links: '' }
          const err = errors[k]
          const ctx = context(tab, it.ref)
          const divergence = ctx.selfScore != null && st.score != null && Math.abs(ctx.selfScore - st.score) > 1
          const len = st.comment.trim().length
          return (
            <div key={k} className={`rounded-2xl border bg-white p-5 shadow-sm ${err ? 'border-highlight ring-2 ring-highlight/20' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900">{it.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{it.description}</p>
                </div>
                <div className="flex gap-1.5">
                  {scoreBadge('Auto', ctx.selfScore, 'bg-accent/15 text-yellow-700')}
                  {scoreBadge('Pares', ctx.peerAvg, 'bg-primary/10 text-primary')}
                </div>
              </div>

              {ctx.peerComments.length > 0 && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Lo que dicen los pares</p>
                  {ctx.peerComments.slice(0, 3).map((p, i) => (
                    <p key={i} className="text-[11px] leading-relaxed text-slate-600">"{p.comment}"</p>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <ScaleSelector label={it.name} value={st.score} disabled={submitted} onChange={(v) => setItem(tab, it.ref, { score: v })} />
              </div>
              {divergence && (
                <p className="mt-2 rounded-lg bg-accent/10 px-3 py-2 text-[11px] font-semibold text-yellow-700" role="note">
                  Tu puntaje difiere en más de 1 punto de la autoevaluación — vale la pena conversarlo en el 1:1.
                </p>
              )}
              <textarea
                rows={2} disabled={submitted} value={st.comment}
                onChange={(e) => setItem(tab, it.ref, { comment: e.target.value })}
                aria-label={`Evidencia: ${it.name}`}
                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:bg-slate-50"
                placeholder="Tu valoración basada en evidencia: hechos observados, no impresiones…"
              />
              <p className={`mt-1 text-[11px] ${len >= MIN_COMMENT ? 'text-primary' : 'text-slate-400'}`}>
                {len} caracteres{len < MIN_COMMENT ? ` (mínimo ${MIN_COMMENT})` : ' ✓'}
              </p>
              <input
                disabled={submitted} value={st.links}
                onChange={(e) => setItem(tab, it.ref, { links: e.target.value })}
                aria-label={`Links de evidencia: ${it.name}`}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-xs focus:border-primary focus:outline-none disabled:bg-slate-50"
                placeholder={st.score === 4 ? 'Un 4 exige evidencia: link o referencia' : 'Evidencia (opcional): https://…, JIRA-123'}
              />
              {err && <p role="alert" className="mt-2 text-xs font-bold text-highlight">{err}</p>}
            </div>
          )
        })}
      </div>

      {peerRecognitions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-slate-900">Reconocimientos de los pares</h3>
          {peerRecognitions.map((r, i) => (
            <p key={i} className="mt-1.5 rounded-xl bg-primary/5 px-4 py-2.5 text-xs leading-relaxed text-slate-600">"{r}"</p>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-900">Reconocimiento *</h3>
        <p className="mt-0.5 mb-3 text-xs text-slate-500">Lo más valioso que {evaluatee.name.split(' ')[0]} aportó este ciclo</p>
        <textarea
          rows={2} disabled={submitted} value={recognition}
          onChange={(e) => setRecognition(e.target.value)}
          aria-label="Reconocimiento"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:bg-slate-50"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-900">Feedforward — próximo ciclo</h3>
        <p className="mt-0.5 mb-4 text-xs text-slate-500">Mínimo {minFF} acciones con indicador de éxito; se convertirán en el plan de desarrollo</p>
        <div className="space-y-3">
          {feedforward.map((f, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input
                value={f.action} disabled={submitted}
                onChange={(e) => setFeedforward((prev) => prev.map((x, j) => (j === i ? { ...x, action: e.target.value } : x)))}
                aria-label={`Acción ${i + 1}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none disabled:bg-slate-100"
                placeholder={`Acción ${i + 1}`}
              />
              <input
                value={f.indicator} disabled={submitted}
                onChange={(e) => setFeedforward((prev) => prev.map((x, j) => (j === i ? { ...x, indicator: e.target.value } : x)))}
                aria-label={`Indicador ${i + 1}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none disabled:bg-slate-100"
                placeholder="Indicador de éxito"
              />
              <input
                type="date" value={f.due_date} disabled={submitted}
                onChange={(e) => setFeedforward((prev) => prev.map((x, j) => (j === i ? { ...x, due_date: e.target.value } : x)))}
                aria-label={`Fecha ${i + 1}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none disabled:bg-slate-100"
              />
              <button
                type="button" disabled={submitted || feedforward.length <= minFF}
                onClick={() => setFeedforward((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Eliminar acción ${i + 1}`}
                className="rounded-lg p-2 text-slate-400 hover:text-highlight disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
              </button>
            </div>
          ))}
        </div>
        {!submitted && (
          <button
            type="button"
            onClick={() => setFeedforward((prev) => [...prev, { action: '', indicator: '', due_date: '' }])}
            className="mt-3 flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>
            Agregar otra acción
          </button>
        )}
      </div>

      {!submitted && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/90 px-4 py-4 backdrop-blur-md sm:-mx-8 sm:px-8">
          <button
            onClick={() => save(false)} disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:border-primary/50 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button
            onClick={() => save(true)} disabled={saving}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60"
          >
            Enviar evaluación
          </button>
        </div>
      )}
    </div>
  )
}
