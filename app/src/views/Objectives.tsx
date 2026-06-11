import { useEffect, useState, type FormEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { statusLabel } from '../lib/labels'
import type { Cycle, Objective } from '../types'

const EMPTY_FORM = { title: '', metric: '', weight: 25, progress: 0, status: 'in-progress' as Objective['status'], links: '' }

const STATUS_STYLE: Record<Objective['status'], string> = {
  'in-progress': 'bg-accent/15 text-yellow-700',
  completed: 'bg-primary/10 text-primary',
  'at-risk': 'bg-highlight/10 text-highlight',
  dropped: 'bg-slate-100 text-slate-500',
}

export default function Objectives() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile || !cycle) return
    supabase
      .from('objectives')
      .select('*')
      .eq('cycle_id', cycle.id)
      .eq('user_id', profile.id)
      .order('weight', { ascending: false })
      .then(({ data }) => {
        setObjectives((data as Objective[]) ?? [])
        setLoading(false)
      })
  }, [profile, cycle])

  if (!profile || !cycle) return null

  const totalWeight = objectives.reduce((s, o) => s + o.weight, 0)
  const weighted = objectives.reduce((s, o) => s + (o.progress * o.weight) / 100, 0)

  function startEdit(obj: Objective | null) {
    if (obj) {
      setForm({
        title: obj.title,
        metric: obj.metric,
        weight: obj.weight,
        progress: obj.progress,
        status: obj.status,
        links: obj.evidence_links.join('\n'),
      })
      setEditing(obj.id)
    } else {
      setForm(EMPTY_FORM)
      setEditing('new')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile || !cycle) return
    setSaving(true)
    const payload = {
      cycle_id: cycle.id,
      user_id: profile.id,
      title: form.title.trim(),
      metric: form.metric.trim(),
      weight: form.weight,
      progress: form.progress,
      status: form.status,
      evidence_links: form.links.split('\n').map((l) => l.trim()).filter(Boolean),
    }
    const query =
      editing === 'new'
        ? supabase.from('objectives').insert(payload).select().single()
        : supabase.from('objectives').update(payload).eq('id', editing!).select().single()
    const { data, error } = await query
    setSaving(false)
    if (error) {
      toast(`No se pudo guardar: ${error.message}`, 'error')
      return
    }
    const saved = data as Objective
    setObjectives((prev) =>
      editing === 'new' ? [...prev, saved] : prev.map((o) => (o.id === saved.id ? saved : o))
    )
    setEditing(null)
    toast(editing === 'new' ? 'Objetivo creado' : 'Objetivo actualizado')
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este objetivo? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('objectives').delete().eq('id', id)
    if (error) {
      toast(`No se pudo eliminar: ${error.message}`, 'error')
      return
    }
    setObjectives((prev) => prev.filter((o) => o.id !== id))
    toast('Objetivo eliminado')
  }

  const formView = (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-primary/30 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-extrabold text-slate-900">
        {editing === 'new' ? 'Nuevo objetivo' : 'Editar objetivo'}
      </h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="obj-title" className="mb-1 block text-xs font-bold text-slate-600">Objetivo *</label>
          <input
            id="obj-title" required value={form.title} maxLength={200}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            placeholder="Ej: Rediseñar el Design System Core"
          />
        </div>
        <div>
          <label htmlFor="obj-metric" className="mb-1 block text-xs font-bold text-slate-600">Métrica / resultado esperado *</label>
          <input
            id="obj-metric" required value={form.metric} maxLength={300}
            onChange={(e) => setForm({ ...form, metric: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            placeholder="Ej: 45 tokens documentados en Storybook"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="obj-weight" className="mb-1 block text-xs font-bold text-slate-600">Peso (%) *</label>
            <input
              id="obj-weight" type="number" min={5} max={100} required value={form.weight}
              onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="obj-progress" className="mb-1 block text-xs font-bold text-slate-600">
              Avance: {form.progress}%
            </label>
            <input
              id="obj-progress" type="range" min={0} max={100} step={5} value={form.progress}
              onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
              className="mt-2 w-full accent-[#16b79c]"
            />
          </div>
          <div>
            <label htmlFor="obj-status" className="mb-1 block text-xs font-bold text-slate-600">Estado</label>
            <select
              id="obj-status" value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Objective['status'] })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            >
              <option value="in-progress">En progreso</option>
              <option value="completed">Completado</option>
              <option value="at-risk">En riesgo</option>
              <option value="dropped">Descartado</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="obj-links" className="mb-1 block text-xs font-bold text-slate-600">
            Links de evidencia <span className="font-normal text-slate-400">(uno por línea: Drive, Jira, Notion…)</span>
          </label>
          <textarea
            id="obj-links" rows={2} value={form.links}
            onChange={(e) => setForm({ ...form, links: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            placeholder={'https://...\nJIRA-123'}
          />
        </div>
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="submit" disabled={saving}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-105 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar objetivo'}
        </button>
        <button
          type="button" onClick={() => setEditing(null)}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Mis Objetivos</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Ciclo {cycle.name} · {objectives.length} objetivo{objectives.length === 1 ? '' : 's'} · avance ponderado{' '}
            <strong className="text-primary">{Math.round(weighted)}%</strong>
          </p>
        </div>
        {editing === null && (
          <button
            onClick={() => startEdit(null)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-105"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>
            Nuevo objetivo
          </button>
        )}
      </div>

      {totalWeight !== 100 && objectives.length > 0 && (
        <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-xs font-semibold text-yellow-700" role="alert">
          ⚠ Los pesos suman {totalWeight}% — deben sumar 100% antes de la autoevaluación.
        </p>
      )}

      {editing !== null && formView}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando objetivos…</p>
      ) : objectives.length === 0 && editing === null ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden="true">flag</span>
          <p className="mt-3 text-sm font-bold text-slate-600">Aún no tienes objetivos en este ciclo</p>
          <p className="mt-1 text-xs text-slate-400">
            Define 3–5 objetivos con tu facilitador. Cada uno con métrica clara y peso (suman 100%).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {objectives.map((o) => (
            <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900">{o.title}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[o.status]}`}>
                      {statusLabel(o.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="material-symbols-outlined align-middle text-sm" aria-hidden="true">straighten</span>{' '}
                    {o.metric}
                  </p>
                  {o.evidence_links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {o.evidence_links.map((l, i) => (
                        <a
                          key={i}
                          href={l.startsWith('http') ? l : undefined}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-primary/10 hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-xs" aria-hidden="true">link</span>
                          {l.replace(/^https?:\/\//, '').slice(0, 40)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="mr-2 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">
                    {o.weight}%
                  </span>
                  <button
                    onClick={() => startEdit(o)} aria-label={`Editar ${o.title}`}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(o.id)} aria-label={`Eliminar ${o.title}`}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-highlight"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar" aria-valuenow={o.progress} aria-valuemin={0} aria-valuemax={100}
                  aria-label={`Avance de ${o.title}`}
                >
                  <div
                    className={`h-full rounded-full ${o.progress >= 75 ? 'bg-primary' : o.progress >= 50 ? 'bg-accent' : 'bg-highlight'}`}
                    style={{ width: `${o.progress}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-bold text-slate-600">{o.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
