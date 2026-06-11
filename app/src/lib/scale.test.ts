import { describe, expect, it } from 'vitest'
import { itemError, MIN_COMMENT, MIN_COMMENT_FOR_4, SCALE } from './scale'

const shortComment = 'Buen trabajo'
const validComment = 'Dedicó 3 horas extra a ayudar con los edge cases responsive del checkout.'
const longComment = validComment + ' Además creó una guía de migración paso a paso que ahorró dos sprints completos al equipo.'

describe('escala 1-4', () => {
  it('tiene 4 niveles con definiciones visibles', () => {
    expect(SCALE).toHaveLength(4)
    for (const s of SCALE) {
      expect(s.label).toBeTruthy()
      expect(s.description).toBeTruthy()
    }
  })
})

describe('itemError — reglas §5/§14 (espejo de los CHECK de BD)', () => {
  it('sin puntaje no exige nada', () => {
    expect(itemError(null, '', [])).toBeNull()
  })

  it('todo puntaje exige comentario de al menos 30 caracteres', () => {
    expect(itemError(2, shortComment, [])).toContain(`${MIN_COMMENT}`)
    expect(itemError(2, validComment, [])).toBeNull()
  })

  it('un 4 sin evidencia ni comentario extenso es rechazado', () => {
    expect(itemError(4, validComment, [])).toContain(`${MIN_COMMENT_FOR_4}`)
  })

  it('un 4 con link de evidencia es válido', () => {
    expect(itemError(4, validComment, ['https://evidencia.com'])).toBeNull()
  })

  it('un 4 con comentario extenso (≥80) es válido sin link', () => {
    expect(longComment.length).toBeGreaterThanOrEqual(MIN_COMMENT_FOR_4)
    expect(itemError(4, longComment, [])).toBeNull()
  })

  it('los puntajes 1-3 no exigen link de evidencia', () => {
    for (const score of [1, 2, 3]) {
      expect(itemError(score, validComment, [])).toBeNull()
    }
  })
})
