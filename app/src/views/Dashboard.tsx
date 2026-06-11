import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { statusLabel } from '../lib/labels'
import type { Cycle, Team } from '../types'

const WEIGHT_LABELS: Record<string, { name: string; color: string }> = {
  results: { name: 'Resultados', color: 'bg-primary' },
  behaviors: { name: 'Comportamientos', color: 'bg-highlight' },
  skills: { name: 'Habilidades del rol', color: 'bg-accent' },
  contribution: { name: 'Contribución al sistema', color: 'bg-slate-400' },
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const [team, setTeam] = useState<Team | null>(null)

  useEffect(() => {
    if (!profile?.team_id) return
    supabase
      .from('teams')
      .select('*')
      .eq('id', profile.team_id)
      .maybeSingle()
      .then(({ data }) => setTeam(data as Team | null))
  }, [profile?.team_id])

  if (!profile) return null
  const firstName = profile.name.split(' ')[0]

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

      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-accent" aria-hidden="true">
            construction
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">Beta en construcción — Fase 3 de 8 completada</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Ya funciona: autenticación, roles y permisos (RLS), y este dashboard conectado a datos
              reales. Próximamente: objetivos y autoevaluación (Fase 4), feedback de pares y
              check-ins (Fase 5), reuniones 1:1 (Fase 6) y administración (Fase 7).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
