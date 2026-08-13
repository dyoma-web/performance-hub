import type {
  AssignmentKind,
  AssignmentOrigin,
  AssignmentStatus,
  Competency,
  EvaluationAssignment,
  Profile,
} from '../types'

export function kindLabel(kind: AssignmentKind): string {
  const map: Record<AssignmentKind, string> = {
    auto: 'Autoevaluación',
    lider: 'Líder → equipo',
    par: 'Par (transversales)',
  }
  return map[kind]
}

export function originLabel(origin: AssignmentOrigin): string {
  const map: Record<AssignmentOrigin, string> = {
    auto: 'Automática',
    aleatoria: 'Aleatoria',
    manual: 'Dirigida',
  }
  return map[origin]
}

export function assignmentStatusLabel(status: AssignmentStatus): string {
  const map: Record<AssignmentStatus, string> = {
    pendiente: 'Pendiente',
    'en-curso': 'En curso',
    enviada: 'Enviada',
    anulada: 'Anulada',
  }
  return map[status]
}

/** ¿La persona lidera a alguien activo? (define si se le miden competencias de liderazgo) */
export function isLeader(userId: string, profiles: Pick<Profile, 'id' | 'manager_id' | 'is_active'>[]): boolean {
  return profiles.some((p) => p.manager_id === userId && p.is_active)
}

/**
 * Competencias que aplican a una asignación (Estrategia 2026-1):
 *  · par   → solo las 5 organizacionales (transversales)
 *  · lider → organizacionales + familia del evaluado (+ liderazgo si el evaluado lidera)
 *  · auto  → mismo alcance que la evaluación del líder (se autoevalúa en todo su perfil)
 */
export function competenciesForAssignment(
  assignment: Pick<EvaluationAssignment, 'kind' | 'evaluatee_id'>,
  evaluatee: Pick<Profile, 'id' | 'family_id'>,
  allCompetencies: Competency[],
  profiles: Pick<Profile, 'id' | 'manager_id' | 'is_active'>[],
): Competency[] {
  const active = allCompetencies.filter((c) => c.is_active)
  const org = active.filter((c) => c.comp_type === 'organizacional')
  if (assignment.kind === 'par') return sortComps(org)

  const familia = evaluatee.family_id
    ? active.filter((c) => c.comp_type === 'familia' && c.family_id === evaluatee.family_id)
    : []
  const liderazgo = isLeader(evaluatee.id, profiles)
    ? active.filter((c) => c.comp_type === 'liderazgo')
    : []
  return sortComps([...org, ...familia, ...liderazgo])
}

function sortComps(list: Competency[]): Competency[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order)
}

/** Mapeo asignación → tipo de review de la tabla `reviews` */
export function reviewTypeFor(kind: AssignmentKind): 'self' | 'facilitator' | 'peer' {
  if (kind === 'auto') return 'self'
  if (kind === 'lider') return 'facilitator'
  return 'peer'
}

/** Días (enteros, techo) que faltan hasta el fin del día de la fecha dada. */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const target = new Date(dateStr + 'T23:59:59')
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

export type DeadlineUrgency = 'ok' | 'warn' | 'critical' | 'expired'

/** Urgencia visual de la fecha límite: >7 días ok, 4-7 alerta, ≤3 crítico. */
export function deadlineUrgency(days: number): DeadlineUrgency {
  if (days < 0) return 'expired'
  if (days <= 3) return 'critical'
  if (days <= 7) return 'warn'
  return 'ok'
}

export function deadlineLabel(dateStr: string, now: Date = new Date()): string {
  const days = daysUntil(dateStr, now)
  const fecha = new Date(dateStr + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })
  if (days < 0) return `El plazo venció el ${fecha}`
  if (days === 0) return `¡La fecha límite es HOY (${fecha})!`
  if (days === 1) return `La fecha límite es mañana (${fecha})`
  return `Fecha límite: ${fecha} — quedan ${days} días`
}
