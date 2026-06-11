import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { statusLabel } from '../lib/labels'
import type { CatalogItem, Cycle, Objective, Review, ReviewItem } from '../types'

interface PlanAction {
  id: string
  action: string
  indicator: string
  due_date: string | null
  status: 'pending' | 'in-progress' | 'completed' | 'dropped'
}

interface Note {
  id: string
  action_id: string
  note: string
  created_at: string
}

const NEXT_STATUS: Record<PlanAction['status'], PlanAction['status']> = {
  pending: 'in-progress',
  'in-progress': 'completed',
  completed: 'pending',
  dropped: 'pending',
}

const STATUS_STYLE: Record<PlanAction['status'], string> = {
  pending: 'bg-slate-100 text-slate-500',
  'in-progress': 'bg-accent/15 text-yellow-700',
  completed: 'bg-primary/10 text-primary',
  dropped: 'bg-slate-100 text-slate-400 line-through',
}

export default function Development() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [actions, setActions] = useState<PlanAction[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile || !cycle) return
    async function load() {
      const { data: revs } = await supabase
        .from('reviews').select('*')
        .eq('cycle_id', cycle!.id).eq('evaluatee_id', profile!.id)
        .neq('type', 'self').eq('status', 'submitted')
      const reviewIds = ((revs as Review[]) ?? []).map((r) => r.id)
      const [{ data: ri }, { data: cat }, { data: objs }, { data: acts }] = await Promise.all([
        reviewIds.length > 0
          ? supabase.from('review_items').select('*').in('review_id', reviewIds)
          : Promise.resolve({ data: [] }),
        supabase.from('catalog_items').select('*'),
        supabase.from('objectives').select('*').eq('cycle_id', cycle!.id).eq('user_id', profile!.id),
        supabase.from('plan_actions').select('*').eq('user_id', profile!.id).order('due_date', { ascending: true, nullsFirst: false }),
      ])
      const actionIds = ((acts as PlanAction[]) ?? []).map((a) => a.id)
      const { data: nts } = actionIds.length > 0
        ? await supabase.from('action_notes').select('*').in('action_id', actionIds).order('created_at', { ascending: false })
        : { data: [] }
      setReviews((revs as Review[]) ?? [])
      setItems((ri as ReviewItem[]) ?? [])
      setCatalog((cat as CatalogItem[]) ?? [])
      setObjectives((objs as Objective[]) ?? [])
      setActions((acts as PlanAction[]) ?? [])
      setNotes((nts as Note[]) ?? [])
      setLoading(false)
    }
    load()
  }, [profile, cycle])

  const itemName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of catalog) map[c.key] = c.name
    for (const o of objectives) map[o.id] = o.title
    return map
  }, [catalog, objectives])

  const strengths = useMemo(() => {
    const groups: Record<string, { name: string; count: number; quotes: string[] }> = {}
    for (const it of items) {
      if ((it.score ?? 0) < 3) continue
      const name = itemName[it.item_ref] ?? it.item_ref
      groups[name] ??= { name, count: 0, quotes: [] }
      groups[name].count++
      if (it.comment) groups[name].quotes.push(it.comment)
    }
    return Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [items, itemName])

  const growth = useMemo(
    () =>
      items
        .filter((it) => it.score != null && it.score <= 2)
        .map((it) => ({ name: itemName[it.item_ref] ?? it.item_ref, comment: it.comment })),
    [items, itemName]
  )

  const recognitions = useMemo(
    () => reviews.map((r) => r.recognition).filter(Boolean) as string[],
    [reviews]
  )

  async function toggleStatus(a: PlanAction) {
    const next = NEXT_STATUS[a.status]
    const { error } = await supabase.from('plan_actions').update({ status: next }).eq('id', a.id)
    if (error) {
      toast(error.message, 'error')
      return
    }
    setActions((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)))
  }

  async function addNote(a: PlanAction) {
    const text = (noteDrafts[a.id] ?? '').trim()
    if (text.length < 5) {
      toast('Escribe una nota de avance', 'warning')
      return
    }
    const { data, error } = await supabase
      .from('action_notes')
      .insert({ action_id: a.id, author_id: profile!.id, note: text })
      .select().single()
    if (error) {
      toast(error.message, 'error')
      return
    }
    setNotes((prev) => [data as Note, ...prev])
    setNoteDrafts((prev) => ({ ...prev, [a.id]: '' }))
    toast('Nota de avance registrada')
  }

  if (!profile || !cycle) return null
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando tu desarrollo…</p>

  const completed = actions.filter((a) => a.status === 'completed').length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Mi Desarrollo</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Basado en {reviews.length} evaluación(es) recibida(s) · plan {completed}/{actions.length} completado
        </p>
      </div>

      {/* Fortalezas */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 font-extrabold text-slate-900">
          <span className="material-symbols-outlined text-primary" aria-hidden="true">workspace_premium</span>
          Fortalezas reconocidas
        </h3>
        <p className="mb-4 text-xs text-slate-500">Lo que pares y facilitador destacan de ti (puntajes 3–4)</p>
        {strengths.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Aparecerán cuando recibas feedback enviado en este ciclo.
          </p>
        ) : (
          <div className="space-y-3">
            {strengths.map((s) => (
              <div key={s.name} className="rounded-xl bg-primary/5 p-4">
                <p className="text-sm font-bold text-slate-800">
                  {s.name} <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{s.count} mención{s.count === 1 ? '' : 'es'}</span>
                </p>
                {s.quotes.slice(0, 2).map((q, i) => (
                  <p key={i} className="mt-1.5 text-[11px] leading-relaxed text-slate-600">"{q}"</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Áreas de crecimiento */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 font-extrabold text-slate-900">
          <span className="material-symbols-outlined text-highlight" aria-hidden="true">trending_up</span>
          Focos de mejora
        </h3>
        <p className="mb-4 text-xs text-slate-500">Donde el feedback señala oportunidad (puntajes 1–2)</p>
        {growth.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Sin focos señalados por ahora — el plan de acción de abajo es tu guía.
          </p>
        ) : (
          <div className="space-y-2">
            {growth.map((g, i) => (
              <div key={i} className="rounded-xl bg-highlight/5 p-4">
                <p className="text-sm font-bold text-slate-800">{g.name}</p>
                {g.comment && <p className="mt-1 text-[11px] text-slate-600">"{g.comment}"</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Plan de acción vivo */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 font-extrabold text-slate-900">
          <span className="material-symbols-outlined text-accent" aria-hidden="true">checklist</span>
          Plan de acción
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          Documento vivo: marca el estado (clic en el círculo) y registra notas de avance
        </p>
        {actions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Tus acuerdos del 1:1 y feedforward aparecerán aquí como plan accionable.
          </p>
        ) : (
          <ul className="space-y-3">
            {actions.map((a) => {
              const aNotes = notes.filter((n) => n.action_id === a.id)
              return (
                <li key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleStatus(a)}
                      aria-label={`Cambiar estado de "${a.action}" (actual: ${statusLabel(a.status)})`}
                      title="Clic para cambiar estado"
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all hover:scale-110 ${
                        a.status === 'completed' ? 'border-primary bg-primary text-white' : a.status === 'in-progress' ? 'border-accent bg-accent/20' : 'border-slate-300'
                      }`}
                    >
                      {a.status === 'completed' && <span className="material-symbols-outlined text-sm" aria-hidden="true">check</span>}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${a.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {a.action}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                        <span className={`rounded-full px-2 py-0.5 uppercase ${STATUS_STYLE[a.status]}`}>{statusLabel(a.status)}</span>
                        <span className="text-slate-400">{a.indicator}</span>
                        {a.due_date && (
                          <span className={new Date(a.due_date) < new Date() && a.status !== 'completed' ? 'text-highlight' : 'text-slate-400'}>
                            📅 {new Date(a.due_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {aNotes.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {aNotes.slice(0, 3).map((n) => (
                            <li key={n.id} className="text-[11px] text-slate-500">
                              <span className="font-bold text-slate-400">{new Date(n.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}:</span>{' '}
                              {n.note}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2 flex gap-2">
                        <input
                          value={noteDrafts[a.id] ?? ''}
                          onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          aria-label={`Nota de avance para "${a.action}"`}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                          placeholder="Agregar nota de avance…"
                        />
                        <button onClick={() => addNote(a)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-primary/50">
                          Guardar
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Reconocimientos */}
      {recognitions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-extrabold text-slate-900">
            <span className="material-symbols-outlined text-gold" aria-hidden="true">favorite</span>
            Reconocimientos recibidos
          </h3>
          <div className="space-y-2">
            {recognitions.map((r, i) => (
              <p key={i} className="rounded-xl bg-accent/5 px-4 py-3 text-xs leading-relaxed text-slate-600">"{r}"</p>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
