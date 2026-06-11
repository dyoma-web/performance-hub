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
  manager_id: string | null
  area_id: string | null
  photo_url: string | null
  hire_date: string | null
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

export interface Objective {
  id: string
  cycle_id: string
  user_id: string
  title: string
  metric: string
  weight: number
  progress: number
  status: 'in-progress' | 'completed' | 'at-risk' | 'dropped'
  evidence_links: string[]
}

export type ReviewType = 'self' | 'facilitator' | 'peer' | 'stakeholder'
export type ReviewStatus = 'requested' | 'draft' | 'submitted' | 'declined'
export type Block = 'results' | 'behaviors' | 'skills' | 'contribution'

export interface Review {
  id: string
  cycle_id: string
  evaluatee_id: string
  reviewer_id: string
  type: ReviewType
  status: ReviewStatus
  anonymous: boolean
  recognition: string | null
  submitted_at: string | null
}

export interface ReviewItem {
  id?: string
  review_id: string
  block: Block
  item_ref: string
  score: number | null
  comment: string | null
  evidence_links: string[]
}

export interface FeedforwardItem {
  id?: string
  review_id: string
  action: string
  indicator: string
  due_date: string | null
  responsible_id: string | null
}

export interface CatalogItem {
  id: string
  kind: 'behavior' | 'skill' | 'contribution'
  key: string
  role_type: string | null
  name: string
  description: string
  sort_order: number
  is_active: boolean
}
