import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from './Toast'
import Avatar from './Avatar'
import { assignmentStatusLabel, kindLabel } from '../lib/eval360'
import type { EvaluationAssignment, Profile } from '../types'

interface AreaRow {
  id: string
  name: string
}

type Filter = 'pendientes' | 'dos-o-mas' | 'sin-autoevaluacion'

const FILTER_LABEL: Record<Filter, string> = {
  pendientes: 'Con evaluaciones pendientes',
  'dos-o-mas': 'Con 2 o más pendientes',
  'sin-autoevaluacion': 'Sin autoevaluación enviada',
}

function fmtDate(d: string | null): string {
  if (!d) return 'sin definir'
  return new Date(d + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Seguimiento del diligenciamiento (solo admin/TH): avance global,
 * por área y por persona, con acceso a las respuestas enviadas y
 * herramientas de notificación in-app / correo (manual).
 */
export default function EvalTracking({
  cycleName,
  people,
  assignments,
  deadline,
}: {
  cycleName: string
  people: Profile[]
  assignments: EvaluationAssignment[]
  deadline: string | null
}) {
  const toast = useToast()
  const [areas, setAreas] = useState<AreaRow[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pendientes')

  useEffect(() => {
    supabase.from('areas').select('id, name').order('sort_order').then(({ data }) => {
      setAreas((data as AreaRow[]) ?? [])
    })
  }, [])

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const active = useMemo(() => assignments.filter((a) => a.status !== 'anulada'), [assignments])

  interface PersonStats {
    p: Profile
    mine: EvaluationAssignment[]
    sent: number
    pending: number
    autoPending: boolean
  }

  const perPerson: PersonStats[] = useMemo(() => {
    return people.map((p) => {
      const mine = active.filter((a) => a.evaluator_id === p.id)
      const sent = mine.filter((a) => a.status === 'enviada').length
      return {
        p,
        mine,
        sent,
        pending: mine.length - sent,
        autoPending: mine.some((a) => a.kind === 'auto' && a.status !== 'enviada'),
      }
    })
  }, [people, active])

  const global = useMemo(() => {
    const total = active.length
    const sent = active.filter((a) => a.status === 'enviada').length
    return { total, sent, pct: total > 0 ? Math.round((sent / total) * 100) : 0 }
  }, [active])

  const perArea = useMemo(() => {
    return areas
      .map((area) => {
        const ids = new Set(people.filter((p) => p.area_id === area.id).map((p) => p.id))
        const list = active.filter((a) => ids.has(a.evaluator_id))
        const sent = list.filter((a) => a.status === 'enviada').length
        return { area, total: list.length, sent, pct: list.length > 0 ? Math.round((sent / list.length) * 100) : 0 }
      })
      .filter((r) => r.total > 0)
  }, [areas, people, active])

  const filtered = useMemo(() => {
    if (filter === 'dos-o-mas') return perPerson.filter((s) => s.pending >= 2)
    if (filter === 'sin-autoevaluacion') return perPerson.filter((s) => s.autoPending)
    return perPerson.filter((s) => s.pending > 0)
  }, [perPerson, filter])

  function standardMessage(pending: number): string {
    return `Tienes ${pending} evaluación(es) de desempeño pendiente(s) del ciclo ${cycleName}. La fecha límite es el ${fmtDate(deadline)}.`
  }

  async function notifyInApp(targets: PersonStats[], custom?: string) {
    if (targets.length === 0) return toast('No hay personas que cumplan la condición', 'error')
    const rows = targets.map((s) => ({
      user_id: s.p.id,
      type: 'eval360',
      title: 'Evaluaciones 360 pendientes',
      body: custom?.trim() || standardMessage(s.pending),
      link: '/mis-evaluaciones',
    }))
    const { error } = await supabase.from('notifications').insert(rows)
    if (error) return toast(error.message, 'error')
    toast(`✓ Notificación enviada a ${rows.length} persona(s)`)
  }

  function notifyCustom(target: PersonStats) {
    const msg = window.prompt(`Mensaje personalizado para ${target.p.name}:`, standardMessage(target.pending))
    if (msg == null) return
    notifyInApp([target], msg)
  }

  function mailtoFor(targets: PersonStats[]): string {
    const subject = encodeURIComponent(`Evaluación de desempeño ${cycleName} — pendientes`)
    const body = encodeURIComponent(
      `Hola,\n\nTienes evaluaciones de desempeño pendientes en el ciclo ${cycleName}.\n` +
      `La fecha límite para diligenciarlas es el ${fmtDate(deadline)}.\n\n` +
      `Ingresa a la plataforma: https://dyoma-web.github.io/performance-hub/#/mis-evaluaciones\n\nGracias.`,
    )
    if (targets.length === 1) return `mailto:${targets[0].p.email}?subject=${subject}&body=${body}`
    const bcc = targets.map((s) => s.p.email).join(',')
    return `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`
  }

  return (
    <div className="space-y-6">
      {/* Avance global */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold tracking-tight text-slate-900">Avance global del ciclo</h3>
            <p className="mt-1 text-xs text-slate-500">
              {global.sent} de {global.total} evaluaciones enviadas · fecha límite: <strong>{fmtDate(deadline)}</strong>
            </p>
          </div>
          <p className={`text-3xl font-extrabold ${global.pct === 100 ? 'text-primary' : 'text-slate-900'}`}>{global.pct}%</p>
        </div>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Avance global: ${global.pct}%`}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${global.pct}%` }} />
        </div>
      </div>

      {/* Por área */}
      {perArea.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-extrabold tracking-tight text-slate-900">Avance por área</h3>
          <div className="space-y-3">
            {perArea.map(({ area, total, sent, pct }) => (
              <div key={area.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{area.name}</span>
                  <span className="font-semibold text-slate-500">{sent}/{total} · {pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-primary' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notificaciones globales con condicional */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-extrabold tracking-tight text-slate-900">Notificación global</h3>
        <p className="mb-3 text-xs text-slate-500">
          Elige la condición y el medio. El correo abre tu cliente con los destinatarios en copia oculta
          (el envío automático de correos requiere configurar SMTP).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            aria-label="Condición"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-primary focus:outline-none"
          >
            {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
              <option key={f} value={f}>{FILTER_LABEL[f]} ({
                f === 'dos-o-mas' ? perPerson.filter((s) => s.pending >= 2).length
                : f === 'sin-autoevaluacion' ? perPerson.filter((s) => s.autoPending).length
                : perPerson.filter((s) => s.pending > 0).length
              })</option>
            ))}
          </select>
          <button
            onClick={() => notifyInApp(filtered)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">notifications</span>
            Notificar en la app
          </button>
          <a
            href={mailtoFor(filtered)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">mail</span>
            Correo (abre tu cliente)
          </a>
        </div>
      </div>

      {/* Por persona */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-sm font-extrabold tracking-tight text-slate-900">Detalle por persona</h3>
          <p className="mt-1 text-xs text-slate-500">
            Haz clic en una persona para ver sus asignaciones y abrir las respuestas ya enviadas.
            Esta información es visible solo para administración y Talento Humano.
          </p>
        </div>
        <div className="divide-y divide-slate-50">
          {perPerson
            .slice()
            .sort((a, b) => b.pending - a.pending || a.p.name.localeCompare(b.p.name))
            .map((s) => (
              <div key={s.p.id}>
                <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <button
                    onClick={() => setExpanded(expanded === s.p.id ? null : s.p.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={expanded === s.p.id}
                  >
                    <Avatar profile={s.p} size="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{s.p.name}</p>
                      <p className="text-[10px] text-slate-400">{areas.find((a) => a.id === s.p.area_id)?.name ?? ''}</p>
                    </div>
                    <span className="material-symbols-outlined text-base text-slate-300" aria-hidden="true">
                      {expanded === s.p.id ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                    s.pending === 0 ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {s.pending === 0 ? '✓ Al día' : `${s.pending} pendiente(s)`}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{s.sent}/{s.mine.length}</span>
                  {s.pending > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => notifyInApp([s])}
                        title="Notificación estándar en la app"
                        aria-label={`Notificar a ${s.p.name}`}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden="true">notifications</span>
                      </button>
                      <button
                        onClick={() => notifyCustom(s)}
                        title="Notificación personalizada"
                        aria-label={`Notificación personalizada a ${s.p.name}`}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden="true">edit_notifications</span>
                      </button>
                      <a
                        href={mailtoFor([s])}
                        title="Correo (abre tu cliente)"
                        aria-label={`Correo a ${s.p.name}`}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden="true">mail</span>
                      </a>
                    </div>
                  )}
                </div>
                {expanded === s.p.id && (
                  <div className="space-y-1 bg-slate-50/50 px-5 py-3">
                    {s.mine.length === 0 && <p className="text-xs text-slate-400">Sin asignaciones.</p>}
                    {s.mine.map((a) => {
                      const ev = byId.get(a.evaluatee_id)
                      const done = a.status === 'enviada'
                      return (
                        <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2">
                          <p className="min-w-32 flex-1 text-xs font-semibold text-slate-700">
                            {a.kind === 'auto' ? 'Autoevaluación' : ev?.name ?? '—'}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{kindLabel(a.kind)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            done ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-600'
                          }`}>{assignmentStatusLabel(a.status)}</span>
                          {done && (
                            <Link
                              to={`/evaluar360/${a.id}`}
                              className="text-[10px] font-bold text-primary hover:underline"
                            >
                              Ver respuestas →
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
