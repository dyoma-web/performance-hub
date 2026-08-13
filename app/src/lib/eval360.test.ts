import { describe, expect, it } from 'vitest'
import { competenciesForAssignment, isLeader, reviewTypeFor } from './eval360'
import type { Competency } from '../types'

const comp = (code: string, comp_type: Competency['comp_type'], family_id: string | null = null, sort = 0): Competency => ({
  id: code,
  code,
  comp_type,
  family_id,
  name: code,
  definition: '',
  indicators: [],
  star_question: null,
  sort_order: sort,
  is_active: true,
})

const FAM_TEC = 'fam-tec'
const CATALOG: Competency[] = [
  comp('org-1', 'organizacional', null, 1),
  comp('org-2', 'organizacional', null, 2),
  comp('tec-1', 'familia', FAM_TEC, 10),
  comp('cre-1', 'familia', 'fam-cre', 20),
  comp('lid-1', 'liderazgo', null, 50),
  { ...comp('org-off', 'organizacional', null, 3), is_active: false },
]

// ana lidera a beto; carla no lidera a nadie
const PROFILES = [
  { id: 'ana', manager_id: null, is_active: true },
  { id: 'beto', manager_id: 'ana', is_active: true },
  { id: 'carla', manager_id: 'ana', is_active: true },
]

describe('isLeader', () => {
  it('detecta a quien tiene subordinados activos', () => {
    expect(isLeader('ana', PROFILES)).toBe(true)
    expect(isLeader('beto', PROFILES)).toBe(false)
  })

  it('ignora subordinados inactivos', () => {
    const profs = [{ id: 'x', manager_id: 'ana', is_active: false }]
    expect(isLeader('ana', profs)).toBe(false)
  })
})

describe('competenciesForAssignment — alcance según Estrategia 2026-1', () => {
  it('par → solo transversales activas', () => {
    const result = competenciesForAssignment(
      { kind: 'par', evaluatee_id: 'beto' },
      { id: 'beto', family_id: FAM_TEC },
      CATALOG,
      PROFILES,
    )
    expect(result.map((c) => c.code)).toEqual(['org-1', 'org-2'])
  })

  it('líder → transversales + familia del evaluado (sin liderazgo si no lidera)', () => {
    const result = competenciesForAssignment(
      { kind: 'lider', evaluatee_id: 'beto' },
      { id: 'beto', family_id: FAM_TEC },
      CATALOG,
      PROFILES,
    )
    expect(result.map((c) => c.code)).toEqual(['org-1', 'org-2', 'tec-1'])
  })

  it('líder evaluando a un líder → agrega competencias de liderazgo', () => {
    const result = competenciesForAssignment(
      { kind: 'lider', evaluatee_id: 'ana' },
      { id: 'ana', family_id: FAM_TEC },
      CATALOG,
      PROFILES,
    )
    expect(result.map((c) => c.code)).toEqual(['org-1', 'org-2', 'tec-1', 'lid-1'])
  })

  it('autoevaluación → mismo alcance que la evaluación del líder', () => {
    const result = competenciesForAssignment(
      { kind: 'auto', evaluatee_id: 'ana' },
      { id: 'ana', family_id: FAM_TEC },
      CATALOG,
      PROFILES,
    )
    expect(result.map((c) => c.code)).toContain('lid-1')
  })

  it('sin familia asignada → no incluye funcionales', () => {
    const result = competenciesForAssignment(
      { kind: 'lider', evaluatee_id: 'carla' },
      { id: 'carla', family_id: null },
      CATALOG,
      PROFILES,
    )
    expect(result.map((c) => c.code)).toEqual(['org-1', 'org-2'])
  })
})

describe('reviewTypeFor', () => {
  it('mapea asignación → tipo de review', () => {
    expect(reviewTypeFor('auto')).toBe('self')
    expect(reviewTypeFor('lider')).toBe('facilitator')
    expect(reviewTypeFor('par')).toBe('peer')
  })
})
