import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuditRow {
  id: number
  actor_id: string | null
  entity: string
  entity_id: string | null
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABEL: Record<string, string> = { insert: 'Creación', update: 'Modificación', delete: 'Eliminación' }
const ACTION_BADGE: Record<string, string> = {
  insert: 'bg-primary/10 text-primary',
  update: 'bg-amber-50 text-amber-600',
  delete: 'bg-highlight/10 text-highlight',
}

const ENTITY_LABEL: Record<string, string> = {
  profiles: 'Perfiles',
  cycles: 'Ciclos',
  reviews: 'Evaluaciones',
  review_items: 'Respuestas de evaluación',
  evaluation_assignments: 'Asignaciones 360',
  calibrations: 'Calibraciones',
  objectives: 'Objetivos',
  plan_actions: 'Plan de desarrollo',
  cycle_eval_policies: 'Política de evaluación',
  eval_policy_overrides: 'Metas individuales',
  notification_rules: 'Reglas de notificación',
  personal_info: 'Datos personales',
  dependents: 'Dependientes',
  emergency_contacts: 'Contactos de emergencia',
  position_assignments: 'Cargos asignados',
  user_roles: 'Roles',
  areas: 'Áreas',
  org_settings: 'Configuración organizacional',
}

/** Campos que cambiaron entre before y after (para updates). */
function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return []
  return Object.keys(after).filter(
    (k) => k !== 'updated_at' && JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  )
}

/** Log de auditoría (solo admin/TH): quién cambió qué y cuándo, con el
 *  antes/después para poder revertir a mano si hace falta. */
export default function AdminAudit() {
  const { profile, roles } = useAuth()
  const canManage = roles.includes('admin') || roles.includes('talento')
  const [rows, setRows] = useState<AuditRow[]>([])
  const [people, setPeople] = useState<Profile[]>([])
  const [entity, setEntity] = useState<string>('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canManage) return
    let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200)
    if (entity) query = query.eq('entity', entity)
    Promise.all([query, supabase.from('profiles').select('*')]).then(([a, p]) => {
      setRows((a.data as AuditRow[]) ?? [])
      setPeople((p.data as Profile[]) ?? [])
      setLoading(false)
    })
  }, [canManage, entity])

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  if (!profile || !canManage) {
    return <p className="py-12 text-center text-sm text-slate-400">Solo administración o Talento Humano puede ver la auditoría.</p>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Auditoría</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Últimos {rows.length} movimientos · el antes/después permite revertir cambios a mano
          </p>
        </div>
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          aria-label="Filtrar por entidad"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-primary focus:outline-none"
        >
          <option value="">Todas las entidades</option>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-50">
            {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">Sin movimientos registrados.</p>}
            {rows.map((r) => {
              const actor = r.actor_id ? byId.get(r.actor_id) : null
              const changes = r.action === 'update' ? changedFields(r.before, r.after) : []
              return (
                <div key={r.id}>
                  <button
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="flex w-full flex-wrap items-center gap-2 px-5 py-3 text-left hover:bg-slate-50/60"
                    aria-expanded={expanded === r.id}
                  >
                    <span className="w-36 shrink-0 text-[11px] text-slate-400">
                      {new Date(r.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-bold ${ACTION_BADGE[r.action] ?? 'bg-slate-100 text-slate-500'}`}>
                      {ACTION_LABEL[r.action] ?? r.action}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <strong className="text-slate-800">{ENTITY_LABEL[r.entity] ?? r.entity}</strong>
                      <span className="text-slate-500">
                        {' — '}{actor?.name ?? 'Sistema'}
                        {changes.length > 0 ? ` · cambió: ${changes.slice(0, 4).join(', ')}${changes.length > 4 ? '…' : ''}` : ''}
                      </span>
                    </span>
                    <span className="material-symbols-outlined text-base text-slate-300" aria-hidden="true">
                      {expanded === r.id ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {expanded === r.id && (
                    <div className="grid gap-3 bg-slate-50/50 px-5 py-4 lg:grid-cols-2">
                      {r.before && (
                        <div>
                          <p className="mb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Antes</p>
                          <pre className="max-h-64 overflow-auto rounded-xl bg-white p-3 text-[10px] leading-relaxed text-slate-600">{JSON.stringify(r.before, null, 2)}</pre>
                        </div>
                      )}
                      {r.after && (
                        <div>
                          <p className="mb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Después</p>
                          <pre className="max-h-64 overflow-auto rounded-xl bg-white p-3 text-[10px] leading-relaxed text-slate-600">{JSON.stringify(r.after, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
