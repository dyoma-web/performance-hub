export interface ScaleLevel {
  value: number
  label: string
  description: string
}

// Escala de madurez (Estrategia 2026-1): cada número está atado a un
// nivel de autonomía y dominio, no a una nota genérica.
export const SCALE: ScaleLevel[] = [
  { value: 1, label: 'Inicial', description: 'Requiere acompañamiento constante y supervisión directa para ejecutar la competencia' },
  { value: 2, label: 'En desarrollo', description: 'Demuestra el comportamiento de forma parcial o intermitente; necesita apoyo en situaciones complejas' },
  { value: 3, label: 'Competente', description: 'Ejecuta la competencia de forma autónoma y consistente (estándar esperado para el rol)' },
  { value: 4, label: 'Sobresaliente', description: 'Supera las expectativas, genera impacto excepcional y actúa como referente o mentor' },
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
