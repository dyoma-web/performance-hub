import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import { assignmentStatusLabel, daysUntil, deadlineLabel, deadlineUrgency, kindLabel, originLabel } from '../lib/eval360'
import type { Cycle, EvaluationAssignment, Profile } from '../types'

/** Bandeja del evaluador: todas las evaluaciones 360 que le fueron asignadas. */
export default function MyEvaluations() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const [assignments, setAssignments] = useState<EvaluationAssignment[]>([])
  const [people, setPeople] = useState<Profile[]>([])
  const [deadline, setDeadline] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile || !cycle) return
    Promise.all([
      supabase
        .from('evaluation_assignments')
        .select('*')
        .eq('cycle_id', cycle.id)
        .eq('evaluator_id', profile.id)
        .neq('status', 'anulada')
        .order('kind'),
      supabase.from('profiles').select('*'),
      supabase.from('cycle_eval_policies').select('eval_deadline').eq('cycle_id', cycle.id).maybeSingle(),
    ]).then(([a, p, pol]) => {
      setAssignments((a.data as EvaluationAssignment[]) ?? [])
      setPeople((p.data as Profile[]) ?? [])
      setDeadline((pol.data?.eval_deadline as string | null) ?? cycle.end_date)
      setLoading(false)
    })
  }, [profile, cycle])

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  if (!profile) return null
  if (!cycle) return <p className="py-12 text-center text-sm text-slate-400">No hay un ciclo de evaluación activo.</p>
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>

  const pending = assignments.filter((a) => a.status !== 'enviada')
  const done = assignments.filter((a) => a.status === 'enviada')

  const card = (a: EvaluationAssignment) => {
    const evaluatee = byId.get(a.evaluatee_id)
    const isSelf = a.kind === 'auto'
    return (
      <Link
        key={a.id}
        to={`/evaluar360/${a.id}`}
        className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
      >
        {evaluatee && <Avatar profile={evaluatee} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-slate-900">
            {isSelf ? 'Mi autoevaluación' : evaluatee?.name ?? '—'}
          </p>
          <p className="text-xs text-slate-500">
            {isSelf ? 'Incluye tu mapa de energía y bienestar' : evaluatee?.position ?? ''}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{kindLabel(a.kind)}</span>
            {a.kind === 'par' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{originLabel(a.origin)}</span>
            )}
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold ${
            a.status === 'enviada' ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {assignmentStatusLabel(a.status)}
        </span>
        <span className="material-symbols-outlined text-slate-300" aria-hidden="true">chevron_right</span>
      </Link>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Mis Evaluaciones 360</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {pending.length} pendiente(s) · {done.length} enviada(s) — ciclo {cycle.name}
        </p>
      </div>

      {pending.length > 0 && deadline && (() => {
        const urgency = deadlineUrgency(daysUntil(deadline))
        const styles = {
          ok: 'border-slate-200 bg-white text-slate-600',
          warn: 'border-amber-200 bg-amber-50 text-amber-700',
          critical: 'border-highlight/30 bg-highlight/10 text-highlight',
          expired: 'border-highlight/30 bg-highlight/10 text-highlight',
        }[urgency]
        return (
          <p className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${styles}`}>
            <span className="material-symbols-outlined" aria-hidden="true">{urgency === 'ok' ? 'event' : 'alarm'}</span>
            {deadlineLabel(deadline)}
          </p>
        )
      })()}

      {assignments.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">
          Aún no tienes evaluaciones asignadas en este ciclo. Talento Humano las genera y aparecerán aquí.
        </p>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Pendientes</p>
          {pending.map(card)}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Enviadas</p>
          {done.map(card)}
        </div>
      )}
    </div>
  )
}
