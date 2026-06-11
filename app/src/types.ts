export type Role = 'admin' | 'facilitador' | 'colaborador' | 'invitado'

export interface Profile {
  id: string
  email: string
  name: string
  role: Role
  team_id: string | null
  position: string | null
  role_type: string
  avatar: string | null
  is_active: boolean
}

export interface CycleConfig {
  weights: { results: number; behaviors: number; skills: number; contribution: number }
  peer_anonymous: boolean
  require_evidence_for_all: boolean
  min_feedforward_actions: number
}

export type CycleStatus =
  | 'draft'
  | 'open'
  | 'self-review'
  | 'peer-feedback'
  | 'manager-review'
  | 'meeting'
  | 'calibration'
  | 'finalized'
  | 'archived'

export interface Cycle {
  id: string
  name: string
  start_date: string
  end_date: string
  status: CycleStatus
  config: CycleConfig
}

export interface Team {
  id: string
  name: string
  parent_team_id: string | null
}
