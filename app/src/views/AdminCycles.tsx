import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { statusLabel } from '../lib/labels'
import type { Cycle, CycleStatus } from '../types'

const WORKFLOW: CycleStatus[] = ['draft', 'open', 'self-review', 'peer-feedback', 'manager-review', 'meeting', 'calibration', 'finalized', 'archived']
const WEIGHT_KEYS = [
  { key: 'results', label: 'Resultados' },
  { key: 'behaviors', label: 'Comportamientos' },
  { key: 'skills', label: 'Habilidades' },
  { key: 'contribution', label: 'Contribución' },
] as const

export default function AdminCycles() {
  const { profile } = useAuth()
  const toast = useToast()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Cycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('cycles').select('*').order('start_date', { ascending: false }).then(({ data }) => {
      setCycles((data as Cycle[]) ?? [])
      setLoading(false)
    })
  }, [])

  if (!profile || profile.role !== 'admin') return <p className="py-12 text-center text-sm text-slate-400">Solo People Ops puede gestionar ciclos.</p>

  function startEdit(c: Cycle) {
    setEditing(c.id)
    setDraft(JSON.parse(JSON.stringify(c)))
  }

  async function createCycle() {
    const year = new Date().getFullYear()
    const { data, error } = await supabase
      .from('cycles')
      .insert({
        name: `Nuevo ciclo ${year}`,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
        status: 'draft',
      })
      .select().single()
    if (error) {
      toast(error.message, 'error')
      return
    }
    setCycles((prev) => [data as Cycle, ...prev])
    startEdit(data as Cycle)
    toast('Ciclo creado en borrador — configúralo y ábrelo')
  }

  async function saveDraft() {
    if (!draft) return
    const sum = WEIGHT_KEYS.reduce((s, w) => s + (draft.config.weights[w.key] ?? 0), 0)
    if (sum !== 100) {
      toast(`Los pesos suman ${sum}% — deben sumar exactamente 100%`, 'error')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('cycles')
      .update({ name: draft.name, start_date: draft.start_date, end_date: draft.end_date, status: draft.status, config: draft.config })
      .eq('id', draft.id).select().single()
    setSaving(false)
    if (error) {
      toast(error.message, 'error')
      return
    }
    setCycles((prev) => prev.map((c) => (c.id === draft.id ? (data as Cycle) : c)))
    setEditing(null)
    toast('✓ Ciclo actualizado (queda en el log de auditoría)')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Gestión de Ciclos</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">{cycles.length} ciclo(s) · cada cambio queda auditado</p>
        </div>
        <button onClick={createCycle} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>
          Nuevo ciclo
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
      ) : (
        cycles.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {editing === c.id && draft ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600" htmlFor={`n-${c.id}`}>Nombre</label>
                    <input id={`n-${c.id}`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600" htmlFor={`s-${c.id}`}>Inicio</label>
                    <input id={`s-${c.id}`} type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600" htmlFor={`e-${c.id}`}>Fin</label>
                    <input id={`e-${c.id}`} type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold text-slate-600">
                    Pesos por bloque (suma: {WEIGHT_KEYS.reduce((s, w) => s + (draft.config.weights[w.key] ?? 0), 0)}%)
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {WEIGHT_KEYS.map((w) => (
                      <div key={w.key}>
                        <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase" htmlFor={`w-${w.key}`}>{w.label}</label>
                        <input
                          id={`w-${w.key}`} type="number" min={0} max={100}
                          value={draft.config.weights[w.key]}
                          onChange={(e) => setDraft({ ...draft, config: { ...draft.config, weights: { ...draft.config.weights, [w.key]: Number(e.target.value) } } })}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
                    <input
                      type="checkbox" checked={draft.config.peer_anonymous}
                      onChange={(e) => setDraft({ ...draft, config: { ...draft.config, peer_anonymous: e.target.checked } })}
                      className="rounded accent-[#16b79c]"
                    />
                    Feedback de pares anónimo
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    Mín. acciones feedforward
                    <input
                      type="number" min={1} max={5} value={draft.config.min_feedforward_actions}
                      onChange={(e) => setDraft({ ...draft, config: { ...draft.config, min_feedforward_actions: Number(e.target.value) } })}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    Estado
                    <select
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value as CycleStatus })}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 focus:border-primary focus:outline-none"
                    >
                      {WORKFLOW.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button onClick={saveDraft} disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60">
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button onClick={() => setEditing(null)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900">{c.name}</h3>
                    <p className="text-xs text-slate-500">
                      {new Date(c.start_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} —{' '}
                      {new Date(c.end_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}pares {c.config.peer_anonymous ? 'anónimos' : 'nominales'} · mín. {c.config.min_feedforward_actions} feedforward
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold tracking-wider text-primary uppercase">{statusLabel(c.status)}</span>
                    <button onClick={() => startEdit(c)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary" aria-label={`Configurar ${c.name}`}>
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">settings</span>
                    </button>
                  </div>
                </div>

                {/* Workflow */}
                <div className="scrollbar-hide mt-4 flex items-center gap-1 overflow-x-auto pb-1" role="img" aria-label={`Fase actual: ${statusLabel(c.status)}`}>
                  {WORKFLOW.map((s, i) => {
                    const idx = WORKFLOW.indexOf(c.status)
                    const state = i < idx ? 'past' : i === idx ? 'current' : 'future'
                    return (
                      <div key={s} className="flex shrink-0 items-center gap-1">
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold whitespace-nowrap uppercase ${
                          state === 'current' ? 'bg-primary text-white' : state === 'past' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {statusLabel(s)}
                        </span>
                        {i < WORKFLOW.length - 1 && <span className="text-slate-300">›</span>}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full" role="img" aria-label="Pesos por bloque">
                  {WEIGHT_KEYS.map((w, i) => (
                    <div key={w.key} title={`${w.label}: ${c.config.weights[w.key]}%`}
                      className={['bg-primary', 'bg-highlight', 'bg-accent', 'bg-slate-400'][i]}
                      style={{ width: `${c.config.weights[w.key]}%` }} />
                  ))}
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  )
}
