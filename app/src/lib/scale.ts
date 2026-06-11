export interface ScaleLevel {
  value: number
  label: string
  description: string
}

export const SCALE: ScaleLevel[] = [
  { value: 1, label: 'En desarrollo', description: 'Requiere apoyo frecuente; resultados inconsistentes' },
  { value: 2, label: 'Cumple lo esperado', description: 'Entrega lo acordado con autonomía básica' },
  { value: 3, label: 'Sólido / Consistente', description: 'Supera expectativas de forma repetida y sostenida' },
  { value: 4, label: 'Sobresaliente', description: 'Impacto excepcional; eleva al equipo y al sistema' },
]

export const MIN_COMMENT = 30
export const MIN_COMMENT_FOR_4 = 80

/** Valida un ítem calificado según las reglas §5/§14 (espejo de los CHECK de la BD). */
export function itemError(score: number | null, comment: string, evidenceLinks: string[]): string | null {
  if (score == null) return null
  if (comment.trim().length < MIN_COMMENT) {
    return `El puntaje requiere un ejemplo concreto (mínimo ${MIN_COMMENT} caracteres)`
  }
  if (score === 4 && evidenceLinks.length === 0 && comment.trim().length < MIN_COMMENT_FOR_4) {
    return `Un "4 — Sobresaliente" exige evidencia: agrega un link o amplía el ejemplo a ${MIN_COMMENT_FOR_4}+ caracteres`
  }
  return null
}
