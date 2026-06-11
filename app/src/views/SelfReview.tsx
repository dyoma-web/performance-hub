import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import ScaleSelector from '../components/ScaleSelector'
import { SCALE, MIN_COMMENT, itemError } from '../lib/scale'
import type { Block, CatalogItem, Cycle, Objective, Review } from '../types'

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

const BLOCKS: { key: Block; label: string; icon: string; hint: string }[] = [
  { key: 'results', label: 'Resultados', icon: 'flag', hint: 'Qué lograste — evalúa cada objetivo del ciclo' },
  { key: 'behaviors', label: 'Comportamientos', icon: 'diversity_3', hint: 'Cómo lo lograste — con un ejemplo observado por ítem' },
  { key: 'skills', label: 'Habilidades', icon: 'construction', hint: 'Qué te habilita — habilidades de tu rol' },
  { key: 'contribution', label: 'Contribución', icon: 'hub', hint: 'Más allá del rol — tu aporte al sistema' },
]

const key = (block: Block, ref: string) => `${block}|${ref}`
const parseLinks = (s: string) => s.split(/[,\n]/).map((l) => l.trim()).filter(Boolean)

export default function SelfReview() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()

  const [review, setReview] = useState<Review | null>(null)
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
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
  const [showScale, setShowScale] = useState(false)

  const submitted = review?.status === 'submitted'
  const minFF = cycle?.config.min_feedforward_actions ?? 2

  useEffect(() => {
    if (!profile || !cycle) return
    let cancelled = false
    async function load() {
      const p = profile!
      const c = cycle!
      // Review self: obtener o crear
      let { data: rev } = await supabase
        .from('reviews').select('*')
        .eq('cycle_id', c.id).eq('reviewer_id', p.id).eq('type', 'self')
        .maybeSingle()
      if (!rev) {
        const { data: created, error } = await supabase
          .from('reviews')
          .insert({ cycle_id: c.id, evaluatee_id: p.id, reviewer_id: p.id, type: 'self', status: 'draft' })
          .select().single()
        if (error) {
          toast(`No se pudo iniciar la autoevaluación: ${error.message}`, 'error')
          return
        }
        rev = created
      }
      const [{ data: objs }, { data: cat }, { data: rItems }, { data: ff }] = await Promise.all([
        supabase.from('objectives').select('*').eq('cycle_id', c.id).eq('user_id', p.id).order('weight', { ascending: false }),
        supabase.from('catalog_items').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('review_items').select('*').eq('review_id', rev.id),
        supabase.from('feedforward_items').select('*').eq('review_id', rev.id).order('created_at'),
      ])
      if (cancelled) return
      setReview(rev as Review)
      setRecognition((rev as Review).recognition ?? '')
      setObjectives((objs as Objective[]) ?? [])
      setCatalog((cat as CatalogItem[]) ?? [])
      const map: Record<string, ItemState> = {}
      for (const it of rItems ?? []) {
        map[key(it.block, it.item_ref)] = {
          score: it.score,
          comment: it.comment ?? '',
          links: (it.evidence_links ?? []).join(', '),
        }
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
  }, [profile?.id, cycle?.id])

  // Ítems por bloque (habilidades del role_type del usuario, con fallback a default)
  const blockItems = useMemo(() => {
    const behaviors = catalog.filter((c) => c.kind === 'behavior')
    let skills = catalog.filter((c) => c.kind === 'skill' && c.role_type === profile?.role_type)
    if (skills.length === 0) skills = catalog.filter((c) => c.kind === 'skill' && c.role_type === 'default')
    const contribution = catalog.filter((c) => c.kind === 'contribution')
    return {
      results: objectives.map((o) => ({ ref: o.id, name: o.title, description: `Métrica: ${o.metric} · Peso ${o.weight}% · Avance ${o.progress}%` })),
      behaviors: behaviors.map((c) => ({ ref: c.key, name: c.name, description: c.description })),
      skills: skills.map((c) => ({ ref: c.key, name: c.name, description: c.description })),
      contribution: contribution.map((c) => ({ ref: c.key, name: c.name, description: c.description })),
    }
  }, [catalog, objectives, profile?.role_type])

  const completion = useMemo(() => {
    return BLOCKS.map((b) => {
      const list = blockItems[b.key]
      const done = list.filter((it) => {
        const st = items[key(b.key, it.ref)]
        return st && st.score != null && st.comment.trim().length >= MIN_COMMENT
      }).length
      return { block: b.key, done, total: list.length, complete: list.length > 0 && done === list.length }
    })
  }, [blockItems, items])

  const sectionsComplete = completion.filter((c) => c.complete).length

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

  function validate(forSubmit: boolean): string | null {
    const errs: Record<string, string> = {}
    for (const b of BLOCKS) {
      for (const it of blockItems[b.key]) {
        const k = key(b.key, it.ref)
        const st = items[k]
        if (st?.score != null) {
          const err = itemError(st.score, st.comment, parseLinks(st.links))
          if (err) errs[k] = err
        } else if (forSubmit) {
          errs[k] = 'Falta calificar este ítem'
        }
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      return `Hay ${Object.keys(errs).length} ítem(s) con pendientes — revisa los marcados en rojo`
    }
    if (forSubmit) {
      if (recognition.trim().length < MIN_COMMENT) {
        return `El reconocimiento es obligatorio (mínimo ${MIN_COMMENT} caracteres)`
      }
      const validFF = feedforward.filter((f) => f.action.trim().length >= 10 && f.indicator.trim().length > 0)
      if (validFF.length < minFF) {
        return `Se requieren al menos ${minFF} acciones feedforward con indicador de éxito`
      }
    }
    return null
  }

  async function save(submit: boolean) {
    if (!review) return
    const err = validate(submit)
    if (err) {
      toast(err, 'error')
      return
    }
    setSaving(true)
    try {
      // Ítems con contenido
      const rows = []
      for (const b of BLOCKS) {
        for (const it of blockItems[b.key]) {
          const st = items[key(b.key, it.ref)]
          if (!st || (st.score == null && !st.comment.trim())) continue
          rows.push({
            review_id: review.id,
            block: b.key,
            item_ref: it.ref,
            score: st.score,
            comment: st.comment.trim() || null,
            evidence_links: parseLinks(st.links),
          })
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase.from('review_items').upsert(rows, { onConflict: 'review_id,block,item_ref' })
        if (error) throw new Error(error.message)
      }
      // Feedforward: reemplazo completo
      await supabase.from('feedforward_items').delete().eq('review_id', review.id)
      const ffRows = feedforward
        .filter((f) => f.action.trim())
        .map((f) => ({
          review_id: review.id,
          action: f.action.trim(),
          indicator: f.indicator.trim(),
          due_date: f.due_date || null,
          responsible_id: profile!.id,
        }))
      if (ffRows.length > 0) {
        const { error } = await supabase.from('feedforward_items').insert(ffRows)
        if (error) throw new Error(error.message)
      }
      // Review: reconocimiento + estado
      const patch: Record<string, unknown> = { recognition: recognition.trim() || null }
      if (submit) {
        patch.status = 'submitted'
        patch.submitted_at = new Date().toISOString()
      }
      const { data: updated, error } = await supabase
        .from('reviews').update(patch).eq('id', review.id).select().single()
      if (error) throw new Error(error.message)
      setReview(updated as Review)
      toast(submit ? '✓ Autoevaluación enviada — gracias por tu honestidad' : 'Borrador guardado')
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!profile || !cycle) return null
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando tu autoevaluación…</p>

  const activeBlock = BLOCKS.find((b) => b.key === tab)!

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Mi Autoevaluación</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Ciclo {cycle.name} · {sectionsComplete} de {BLOCKS.length} secciones completas
          </p>
        </div>
        <button
          onClick={() => setShowScale(!showScale)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary/50"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">info</span>
          Ver escala
        </button>
      </div>

      {showScale && (
        <div className="view-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {SCALE.map((s) => (
              <div key={s.value} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{s.value}</span>
                <div>
                  <p className="text-xs font-bold">{s.label}</p>
                  <p className="text-[11px] text-slate-500">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-highlight/5 px-4 py-2.5 text-[11px] text-slate-600">
            <strong className="text-highlight">Regla:</strong> todo puntaje requiere un ejemplo concreto (≥{MIN_COMMENT} caracteres).
            Un 4 exige además un link de evidencia.
          </p>
        </div>
      )}

      {submitted && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5" role="status">
          <span className="material-symbols-outlined text-primary" aria-hidden="true">verified</span>
          <div>
            <p className="text-sm font-bold text-slate-800">Autoevaluación enviada</p>
            <p className="text-xs text-slate-600">
              {review?.submitted_at && `El ${new Date(review.submitted_at).toLocaleDateString('es', { day: 'numeric', month: 'long' })}. `}
              Tu facilitador la verá en su revisión. Solo un admin puede desbloquearla.
            </p>
          </div>
        </div>
      )}

      {/* Tabs de bloques */}
      <div role="tablist" aria-label="Bloques de evaluación" className="scrollbar-hide flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
        {BLOCKS.map((b) => {
          const comp = completion.find((c) => c.block === b.key)!
          return (
            <button
              key={b.key} role="tab" aria-selected={tab === b.key}
              onClick={() => setTab(b.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
                tab === b.key ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {comp.complete ? 'check_circle' : b.icon}
              </span>
              <span className="hidden sm:inline">{b.label}</span>
              <span className={`text-[10px] ${tab === b.key ? 'text-white/80' : 'text-slate-400'}`}>
                {comp.done}/{comp.total}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-xs font-medium text-slate-500">{activeBlock.hint}</p>

      {/* Ítems del bloque activo */}
      {tab === 'results' && objectives.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-bold text-slate-600">No tienes objetivos definidos en este ciclo</p>
          <Link to="/objetivos" className="mt-2 inline-block text-xs font-bold text-primary hover:underline">
            Definir mis objetivos →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {blockItems[tab].map((it) => {
            const k = key(tab, it.ref)
            const st = items[k] ?? { score: null, comment: '', links: '' }
            const err = errors[k]
            const commentLen = st.comment.trim().length
            return (
              <div key={k} className={`rounded-2xl border bg-white p-5 shadow-sm ${err ? 'border-highlight ring-2 ring-highlight/20' : 'border-slate-200'}`}>
                <h3 className="font-bold text-slate-900">{it.name}</h3>
                <p className="mt-0.5 mb-4 text-xs text-slate-500">{it.description}</p>
                <ScaleSelector
                  label={it.name}
                  value={st.score}
                  disabled={submitted}
                  onChange={(v) => setItem(tab, it.ref, { score: v })}
                />
                <div className="mt-4">
                  <label htmlFor={`c-${k}`} className="mb-1 block text-xs font-bold text-slate-600">
                    Ejemplo concreto y observable *
                  </label>
                  <textarea
                    id={`c-${k}`} rows={2} disabled={submitted} value={st.comment}
                    onChange={(e) => setItem(tab, it.ref, { comment: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:bg-slate-50"
                    placeholder="Describe una situación específica: qué hiciste, cuándo y qué impacto tuvo…"
                  />
                  <p className={`mt-1 text-[11px] ${commentLen >= MIN_COMMENT ? 'text-primary' : 'text-slate-400'}`}>
                    {commentLen} caracteres{commentLen < MIN_COMMENT ? ` (mínimo ${MIN_COMMENT})` : ' ✓'}
                  </p>
                </div>
                <div className="mt-2">
                  <label htmlFor={`l-${k}`} className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Evidencia (links separados por coma){st.score === 4 ? ' — obligatoria para un 4' : ''}
                  </label>
                  <input
                    id={`l-${k}`} disabled={submitted} value={st.links}
                    onChange={(e) => setItem(tab, it.ref, { links: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-xs focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:bg-slate-50"
                    placeholder="https://…, JIRA-123"
                  />
                </div>
                {err && <p role="alert" className="mt-2 text-xs font-bold text-highlight">{err}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Reconocimiento */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-900">Reconocimiento</h3>
        <p className="mt-0.5 mb-3 text-xs text-slate-500">Lo más valioso que aportaste este ciclo (obligatorio al enviar)</p>
        <textarea
          rows={2} disabled={submitted} value={recognition}
          onChange={(e) => setRecognition(e.target.value)}
          aria-label="Reconocimiento"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:bg-slate-50"
          placeholder="Ej: Elevé la calidad visual del equipo con el nuevo sistema de tokens…"
        />
      </div>

      {/* Feedforward */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-900">Feedforward — próximo ciclo</h3>
        <p className="mt-0.5 mb-4 text-xs text-slate-500">
          Mínimo {minFF} acciones concretas con indicador de éxito y fecha objetivo
        </p>
        <div className="space-y-3">
          {feedforward.map((f, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input
                value={f.action} disabled={submitted}
                onChange={(e) => setFeedforward((prev) => prev.map((x, j) => (j === i ? { ...x, action: e.target.value } : x)))}
                aria-label={`Acción ${i + 1}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none disabled:bg-slate-100"
                placeholder={`Acción ${i + 1} (ej: compartir WIPs al 50% del sprint)`}
              />
              <input
                value={f.indicator} disabled={submitted}
                onChange={(e) => setFeedforward((prev) => prev.map((x, j) => (j === i ? { ...x, indicator: e.target.value } : x)))}
                aria-label={`Indicador de éxito ${i + 1}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none disabled:bg-slate-100"
                placeholder="Indicador de éxito"
              />
              <input
                type="date" value={f.due_date} disabled={submitted}
                onChange={(e) => setFeedforward((prev) => prev.map((x, j) => (j === i ? { ...x, due_date: e.target.value } : x)))}
                aria-label={`Fecha objetivo ${i + 1}`}
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

      {/* Barra de acciones */}
      {!submitted && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/90 px-4 py-4 backdrop-blur-md sm:-mx-8 sm:px-8">
          <p className="hidden text-xs text-slate-400 sm:block">
            {sectionsComplete}/{BLOCKS.length} secciones · tu borrador se guarda con el botón
          </p>
          <div className="flex gap-3">
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
              Enviar autoevaluación
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
