import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import type { Cycle } from '../types'

interface CheckinRow {
  id: string
  checkin_date: string
  achievements: string | null
  blockers: string | null
  support_needed: string | null
  fb_continue: string | null
  fb_adjust: string | null
  fb_start: string | null
  objective_updates: string | null
  status: 'draft' | 'submitted' | 'reviewed'
}

const EMPTY = {
  achievements: '', blockers: '', support_needed: '',
  fb_continue: '', fb_adjust: '', fb_start: '', objective_updates: '',
}

const FIELDS: { key: keyof typeof EMPTY; label: string; hint: string; required?: boolean }[] = [
  { key: 'achievements', label: '¿Qué lograste este mes?', hint: 'Hechos concretos, no intenciones', required: true },
  { key: 'blockers', label: '¿Qué obstáculos tuviste?', hint: 'Bloqueos técnicos, de proceso o de personas' },
  { key: 'support_needed', label: '¿En qué necesitas apoyo?', hint: 'Sé específico: de quién y para qué' },
]

const CAI: { key: keyof typeof EMPTY; label: string; placeholder: string }[] = [
  { key: 'fb_continue', label: 'Continúa', placeholder: 'Algo que funciona bien y deberías seguir haciendo' },
  { key: 'fb_adjust', label: 'Ajusta', placeholder: 'Algo que puede mejorar' },
  { key: 'fb_start', label: 'Inicia', placeholder: 'Algo nuevo que deberías empezar' },
]

export default function Checkin() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [history, setHistory] = useState<CheckinRow[]>([])
  const [draftId, setDraftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile || !cycle) return
    supabase
      .from('checkins').select('*')
      .eq('user_id', profile.id).eq('cycle_id', cycle.id)
      .order('checkin_date', { ascending: false })
      .then(({ data }) => {
        const rows = (data as CheckinRow[]) ?? []
        const draft = rows.find((r) => r.status === 'draft')
        if (draft) {
          setDraftId(draft.id)
          setForm({
            achievements: draft.achievements ?? '', blockers: draft.blockers ?? '',
            support_needed: draft.support_needed ?? '', fb_continue: draft.fb_continue ?? '',
            fb_adjust: draft.fb_adjust ?? '', fb_start: draft.fb_start ?? '',
            objective_updates: draft.objective_updates ?? '',
          })
        }
        setHistory(rows.filter((r) => r.status !== 'draft'))
        setLoading(false)
      })
  }, [profile, cycle])

  if (!profile || !cycle) return null

  async function save(submit: boolean) {
    if (submit && form.achievements.trim().length < 20) {
      toast('Cuéntanos qué lograste este mes (mínimo 20 caracteres)', 'error')
      return
    }
    setSaving(true)
    const payload = {
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null])),
      cycle_id: cycle!.id,
      user_id: profile!.id,
      status: submit ? 'submitted' : 'draft',
    }
    const query = draftId
      ? supabase.from('checkins').update(payload).eq('id', draftId).select().single()
      : supabase.from('checkins').insert(payload).select().single()
    const { data, error } = await query
    setSaving(false)
    if (error) {
      toast(`No se pudo guardar: ${error.message}`, 'error')
      return
    }
    if (submit) {
      setHistory((prev) => [data as CheckinRow, ...prev])
      setForm(EMPTY)
      setDraftId(null)
      toast('✓ Check-in enviado — tu facilitador lo verá en su panel')
    } else {
      setDraftId((data as CheckinRow).id)
      toast('Borrador guardado')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Check-in Mensual</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Conversación rápida de 20–30 min · alimenta tu evaluación de {cycle.name}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-5">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`ci-${f.key}`} className="mb-1 block text-xs font-bold text-slate-600">
                {f.label} {f.required && '*'}
              </label>
              <p className="mb-1.5 text-[11px] text-slate-400">{f.hint}</p>
              <textarea
                id={`ci-${f.key}`} rows={2} value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
              />
            </div>
          ))}

          <div>
            <p className="mb-2 text-xs font-bold text-slate-600">Feedback rápido</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {CAI.map((c) => (
                <div key={c.key} className="rounded-xl bg-slate-50 p-3">
                  <label htmlFor={`ci-${c.key}`} className="mb-1.5 block text-[11px] font-extrabold tracking-wider text-primary uppercase">
                    {c.label}
                  </label>
                  <textarea
                    id={`ci-${c.key}`} rows={3} value={form[c.key]}
                    onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    placeholder={c.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="ci-obj" className="mb-1 block text-xs font-bold text-slate-600">
              Actualización de objetivos
            </label>
            <p className="mb-1.5 text-[11px] text-slate-400">
              ¿Cambió el avance o el alcance de algún objetivo? (también puedes actualizarlos en Mis Objetivos)
            </p>
            <textarea
              id="ci-obj" rows={2} value={form.objective_updates}
              onChange={(e) => setForm({ ...form, objective_updates: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
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
            {saving ? 'Enviando…' : 'Enviar check-in'}
          </button>
        </div>
      </div>

      {/* Historial */}
      <div>
        <h3 className="mb-3 text-sm font-extrabold tracking-wider text-slate-400 uppercase">
          Historial del ciclo ({history.length})
        </h3>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Cargando…</p>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-bold text-slate-600">Aún no hay check-ins enviados</p>
            <p className="mt-1 text-xs text-slate-400">Tu historial alimentará la evaluación final con hechos, no recuerdos.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {history.map((ci) => (
              <li key={ci.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-extrabold tracking-wider text-primary uppercase">
                    {new Date(ci.checkin_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                    {ci.status === 'reviewed' ? 'Revisado' : 'Enviado'}
                  </span>
                </div>
                {ci.achievements && <p className="text-sm text-slate-700">{ci.achievements}</p>}
                {ci.blockers && (
                  <p className="mt-2 text-xs text-slate-500">
                    <strong className="text-highlight">Bloqueos:</strong> {ci.blockers}
                  </p>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {ci.fb_continue && <p className="rounded-lg bg-primary/5 px-3 py-2 text-[11px]"><strong className="text-primary">Continúa:</strong> {ci.fb_continue}</p>}
                  {ci.fb_adjust && <p className="rounded-lg bg-accent/10 px-3 py-2 text-[11px]"><strong className="text-yellow-700">Ajusta:</strong> {ci.fb_adjust}</p>}
                  {ci.fb_start && <p className="rounded-lg bg-highlight/5 px-3 py-2 text-[11px]"><strong className="text-highlight">Inicia:</strong> {ci.fb_start}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
