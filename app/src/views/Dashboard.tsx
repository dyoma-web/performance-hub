import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { statusLabel } from '../lib/labels'
import { daysUntil, deadlineLabel, deadlineUrgency, kindLabel } from '../lib/eval360'
import Avatar from '../components/Avatar'
import type { Cycle, EvaluationAssignment, Profile, Team } from '../types'

const WEIGHT_LABELS: Record<string, { name: string; color: string }> = {
  results: { name: 'Resultados', color: 'bg-primary' },
  behaviors: { name: 'Comportamientos', color: 'bg-highlight' },
  skills: { name: 'Habilidades del rol', color: 'bg-accent' },
  contribution: { name: 'Contribución al sistema', color: 'bg-slate-400' },
}

type AssignmentWithEvaluatee = EvaluationAssignment & { evaluatee: Profile | null }

export default function Dashboard() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const [team, setTeam] = useState<Team | null>(null)
  const [myProgress, setMyProgress] = useState<{ total: number; enviadas: number } | null>(null)
  const [toEvaluate, setToEvaluate] = useState<AssignmentWithEvaluatee[]>([])
  const [deadline, setDeadline] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.team_id) return
    supabase
      .from('teams')
      .select('*')
      .eq('id', profile.team_id)
      .maybeSingle()
      .then(({ data }) => setTeam(data as Team | null))
  }, [profile?.team_id])

  useEffect(() => {
    if (!profile || !cycle) return
    // Progreso ANÓNIMO de mi evaluación (solo conteos, nunca quién evalúa)
    supabase.rpc('my_evaluation_progress', { p_cycle: cycle.id }).then(({ data }) => {
      if (data) setMyProgress(data as { total: number; enviadas: number })
    })
    // Personas que me asignaron evaluar
    supabase
      .from('evaluation_assignments')
      .select('*, evaluatee:profiles!evaluation_assignments_evaluatee_id_fkey(*)')
      .eq('cycle_id', cycle.id)
      .eq('evaluator_id', profile.id)
      .neq('status', 'anulada')
      .order('kind')
      .then(({ data }) => setToEvaluate((data as AssignmentWithEvaluatee[]) ?? []))
    // Fecha límite de diligenciamiento (política del ciclo o fin del ciclo)
    supabase
      .from('cycle_eval_policies')
      .select('eval_deadline')
      .eq('cycle_id', cycle.id)
      .maybeSingle()
      .then(({ data }) => setDeadline((data?.eval_deadline as string | null) ?? cycle.end_date))
  }, [profile, cycle])

  if (!profile) return null
  const firstName = profile.name.split(' ')[0]
  const pendingCount = toEvaluate.filter((a) => a.status !== 'enviada').length
  const pct = myProgress && myProgress.total > 0
    ? Math.round((myProgress.enviadas / myProgress.total) * 100)
    : 0

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Hola, {firstName} 👋
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {profile.position}
          {team ? ` · ${team.name}` : ''}
        </p>
      </div>

      {cycle && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-extrabold text-slate-900">Ciclo {cycle.name}</h3>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold tracking-wider text-primary uppercase">
              {statusLabel(cycle.status)}
            </span>
          </div>
          <p className="mb-5 text-xs font-medium text-slate-500">
            Del {new Date(cycle.start_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })} al{' '}
            {new Date(cycle.end_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="mb-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Modelo de evaluación
          </p>
          <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label="Pesos por bloque">
            {Object.entries(cycle.config.weights).map(([key, weight]) => (
              <div
                key={key}
                className={WEIGHT_LABELS[key]?.color ?? 'bg-slate-300'}
                style={{ width: `${weight}%` }}
                title={`${WEIGHT_LABELS[key]?.name}: ${weight}%`}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(cycle.config.weights).map(([key, weight]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className={`h-2.5 w-2.5 rounded-full ${WEIGHT_LABELS[key]?.color}`} aria-hidden="true" />
                <span className="font-semibold text-slate-600">
                  {WEIGHT_LABELS[key]?.name} <span className="text-slate-400">{weight}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cycle && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Mi evaluación de desempeño (anónima) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold tracking-tight text-slate-900">Mi evaluación de desempeño</h3>
              {myProgress && myProgress.total > 0 && (
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                  pct === 100 ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-600'
                }`}>
                  {pct === 100 ? 'Completa' : `${pct}% de completitud`}
                </span>
              )}
            </div>
            {myProgress == null || myProgress.total === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Aún no hay evaluaciones asignadas sobre ti en este ciclo.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-500">
                  {myProgress.enviadas} de {myProgress.total} evaluaciones sobre ti han sido enviadas.
                  Recibirás el resultado consolidado de forma <strong>anónima</strong>.
                </p>
                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Avance de mi evaluación: ${pct}%`}>
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </>
            )}
          </div>

          {/* Personas que debo evaluar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold tracking-tight text-slate-900">Debes evaluar</h3>
              {toEvaluate.length > 0 && (
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                  pendingCount === 0 ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-600'
                }`}>
                  {pendingCount === 0 ? '✓ Todo al día' : `${pendingCount} pendiente(s)`}
                </span>
              )}
            </div>
            {pendingCount > 0 && deadline && (() => {
              const urgency = deadlineUrgency(daysUntil(deadline))
              const styles = {
                ok: 'bg-slate-50 text-slate-600',
                warn: 'bg-amber-50 text-amber-700',
                critical: 'bg-highlight/10 text-highlight',
                expired: 'bg-highlight/10 text-highlight',
              }[urgency]
              return (
                <p className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${styles}`}>
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {urgency === 'ok' ? 'event' : 'alarm'}
                  </span>
                  {deadlineLabel(deadline)}
                </p>
              )
            })()}
            {toEvaluate.length === 0 ? (
              <p className="text-xs text-slate-500">Aún no tienes evaluaciones asignadas en este ciclo.</p>
            ) : (
              <div className="space-y-2">
                {toEvaluate.map((a) => {
                  const isSelf = a.kind === 'auto'
                  const done = a.status === 'enviada'
                  return (
                    <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                      {a.evaluatee && <Avatar profile={a.evaluatee} size="h-8 w-8" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-800">
                          {isSelf ? 'Mi autoevaluación' : a.evaluatee?.name ?? '—'}
                        </p>
                        <p className="text-[10px] text-slate-400">{kindLabel(a.kind)}</p>
                      </div>
                      {done ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
                          Enviada
                        </span>
                      ) : (
                        <Link
                          to={`/evaluar360/${a.id}`}
                          className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:brightness-105"
                        >
                          Evaluar
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-primary" aria-hidden="true">
            rocket_launch
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">Beta funcional — usa el menú lateral</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {profile.role === 'colaborador' &&
                'Define tus objetivos, completa tu autoevaluación, envía check-ins mensuales, responde feedback de pares y sigue tu plan de desarrollo.'}
              {profile.role === 'facilitador' &&
                'Revisa el estado de tu equipo, solicita feedback de pares, evalúa con contexto comparativo y cierra el ciclo en la reunión 1:1.'}
              {profile.role === 'admin' &&
                'Configura los ciclos y sus pesos, calibra con racional auditado, exporta reportes CSV y gestiona el directorio.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
