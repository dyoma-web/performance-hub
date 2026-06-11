export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Borrador',
    open: 'Abierto',
    'self-review': 'Autoevaluación',
    'peer-feedback': 'Feedback de Pares',
    'manager-review': 'Revisión Facilitador',
    meeting: 'Reunión 1:1',
    calibration: 'Calibración',
    finalized: 'Finalizado',
    archived: 'Archivado',
    pending: 'Pendiente',
    'in-progress': 'En progreso',
    completed: 'Completado',
    'at-risk': 'En riesgo',
    requested: 'Solicitado',
    submitted: 'Enviado',
    scheduled: 'Programada',
  }
  return map[status] ?? status
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: 'People Ops',
    facilitador: 'Facilitador',
    colaborador: 'Colaborador',
    invitado: 'Evaluador invitado',
  }
  return map[role] ?? role
}
