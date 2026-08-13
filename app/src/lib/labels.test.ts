import { describe, expect, it } from 'vitest'
import { roleLabel, statusLabel } from './labels'

describe('statusLabel', () => {
  it('traduce los 9 estados del workflow del ciclo', () => {
    const states = ['draft', 'open', 'self-review', 'peer-feedback', 'manager-review', 'meeting', 'calibration', 'finalized', 'archived']
    for (const s of states) {
      expect(statusLabel(s)).not.toBe(s) // todos tienen traducción
    }
  })

  it('devuelve el valor original si no hay traducción', () => {
    expect(statusLabel('desconocido')).toBe('desconocido')
  })
})

describe('roleLabel', () => {
  it('traduce los 5 roles RBAC', () => {
    expect(roleLabel('admin')).toBe('Administración')
    expect(roleLabel('talento')).toBe('Talento Humano')
    expect(roleLabel('facilitador')).toBe('Facilitador')
    expect(roleLabel('colaborador')).toBe('Colaborador')
    expect(roleLabel('invitado')).toBe('Evaluador invitado')
  })
})
