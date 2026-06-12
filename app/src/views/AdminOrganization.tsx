import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { roleLabel } from '../lib/labels'
import type { Profile, Team } from '../types'

interface Area {
  id: string
  name: string
  description: string | null
  parent_area_id: string | null
  lead_id: string | null
  sort_order: number
}
interface Position {
  id: string
  name: string
  level: number
  description: string | null
  is_active: boolean
}
interface Invitation {
  id: string
  email: string
  name: string | null
  role: string
  accepted_at: string | null
  created_at: string
}

interface WorkType {
  key: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}

type Tab = 'areas' | 'cargos' | 'equipos' | 'labores' | 'invitaciones'

/** Genera la clave técnica a partir del nombre (sin tildes ni espacios) */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 30)
}

const EMPTY_INV = { email: '', name: '', role: 'colaborador', area_id: '', team_id: '', manager_id: '', position_id: '', position_title: '', role_type: 'default' }
const LEVEL_LABELS = ['Nivel 0 — Dirección', 'Nivel 1 — Liderazgo', 'Nivel 2 — Equipo', 'Nivel 3 — Apoyo']

export default function AdminOrganization() {
  const { profile } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('areas')
  const [areas, setAreas] = useState<Area[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [posUsage, setPosUsage] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [areaForm, setAreaForm] = useState({ name: '', description: '', parent_area_id: '', lead_id: '' })
  const [posForm, setPosForm] = useState({ name: '', level: 2, description: '' })
  const [teamForm, setTeamForm] = useState({ name: '', description: '', area_id: '' })
  const [invForm, setInvForm] = useState(EMPTY_INV)
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [wtForm, setWtForm] = useState({ name: '', description: '' })
  const [editingWt, setEditingWt] = useState<string | null>(null)
  const [wtEditForm, setWtEditForm] = useState({ name: '', description: '' })

  const [editing, setEditing] = useState<{ kind: 'area' | 'pos' | 'team'; id: string } | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string | number>>({})

  const [deletingArea, setDeletingArea] = useState<string | null>(null)
  const [reassign, setReassign] = useState<Record<string, string>>({})
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      supabase.from('areas').select('*').order('sort_order'),
      supabase.from('positions').select('*').order('level'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('name'),
      supabase.from('position_assignments').select('position_id'),
      supabase.from('work_types').select('*').order('sort_order'),
    ]).then(([a, p, t, i, pr, pa, wt]) => {
      setWorkTypes((wt.data as WorkType[]) ?? [])
      setAreas((a.data as Area[]) ?? [])
      setPositions((p.data as Position[]) ?? [])
      setTeams((t.data as Team[]) ?? [])
      setInvitations((i.data as Invitation[]) ?? [])
      setProfiles((pr.data as Profile[]) ?? [])
      const usage: Record<string, number> = {}
      for (const row of pa.data ?? []) usage[row.position_id] = (usage[row.position_id] ?? 0) + 1
      setPosUsage(usage)
      setLoading(false)
    })
  }, [])

  if (!profile || profile.role !== 'admin') {
    return <p className="py-12 text-center text-sm text-slate-400">Solo People Ops puede gestionar la organización.</p>
  }

  const personName = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? '—'
  const areaMembers = (id: string) => profiles.filter((p) => p.area_id === id)
  const teamMembers = (id: string) => profiles.filter((p) => p.team_id === id)

  // ---------- árbol de áreas ----------
  const childAreas = (pid: string | null) =>
    areas
      .filter((a) => (a.parent_area_id ?? null) === pid)
      .sort((x, y) => x.sort_order - y.sort_order || x.name.localeCompare(y.name))

  function isDescendant(candidate: string, areaId: string): boolean {
    let cur: string | null = candidate
    let i = 0
    while (cur && i < 20) {
      if (cur === areaId) return true
      cur = areas.find((a) => a.id === cur)?.parent_area_id ?? null
      i++
    }
    return false
  }

  async function applyAreaUpdates(updates: { id: string; sort_order?: number; parent_area_id?: string | null }[]) {
    for (const u of updates) {
      const patch: Record<string, unknown> = {}
      if (u.sort_order !== undefined) patch.sort_order = u.sort_order
      if ('parent_area_id' in u) patch.parent_area_id = u.parent_area_id
      const { error } = await supabase.from('areas').update(patch).eq('id', u.id)
      if (error) return void toast(error.message, 'error')
    }
    setAreas((prev) =>
      prev.map((a) => {
        const u = updates.find((x) => x.id === a.id)
        if (!u) return a
        return {
          ...a,
          sort_order: u.sort_order ?? a.sort_order,
          parent_area_id: 'parent_area_id' in u ? (u.parent_area_id ?? null) : a.parent_area_id,
        }
      })
    )
  }

  function moveSibling(a: Area, dir: -1 | 1) {
    const siblings = childAreas(a.parent_area_id ?? null)
    const idx = siblings.findIndex((x) => x.id === a.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const order = [...siblings]
    ;[order[idx], order[swapIdx]] = [order[swapIdx], order[idx]]
    void applyAreaUpdates(order.map((x, i) => ({ id: x.id, sort_order: i })))
  }

  function promoteArea(a: Area) {
    if (!a.parent_area_id) return
    const parent = areas.find((x) => x.id === a.parent_area_id)!
    const newSiblings = childAreas(parent.parent_area_id ?? null).filter((x) => x.id !== a.id)
    const parentIdx = newSiblings.findIndex((x) => x.id === parent.id)
    const order = [...newSiblings.slice(0, parentIdx + 1), a, ...newSiblings.slice(parentIdx + 1)]
    void applyAreaUpdates(
      order.map((x, i) =>
        x.id === a.id ? { id: x.id, sort_order: i, parent_area_id: parent.parent_area_id ?? null } : { id: x.id, sort_order: i }
      )
    )
  }

  function demoteArea(a: Area) {
    const siblings = childAreas(a.parent_area_id ?? null)
    const idx = siblings.findIndex((x) => x.id === a.id)
    if (idx <= 0) {
      toast('Para bajar de nivel necesita un área hermana encima (de la que dependerá)', 'warning')
      return
    }
    const newParent = siblings[idx - 1]
    void applyAreaUpdates([{ id: a.id, parent_area_id: newParent.id, sort_order: childAreas(newParent.id).length }])
    setCollapsedAreas((prev) => {
      const next = new Set(prev)
      next.delete(newParent.id)
      return next
    })
  }

  // ---------- edición genérica ----------
  function startEdit(kind: 'area' | 'pos' | 'team', id: string) {
    setDeletingArea(null)
    if (kind === 'area') {
      const a = areas.find((x) => x.id === id)!
      setEditForm({ name: a.name, description: a.description ?? '', parent_area_id: a.parent_area_id ?? '', lead_id: a.lead_id ?? '' })
    } else if (kind === 'pos') {
      const p = positions.find((x) => x.id === id)!
      setEditForm({ name: p.name, level: p.level, description: p.description ?? '' })
    } else {
      const t = teams.find((x) => x.id === id)!
      setEditForm({ name: t.name, description: t.description ?? '', area_id: t.area_id ?? '' })
    }
    setEditing({ kind, id })
  }

  async function saveEdit() {
    if (!editing) return
    const f = editForm
    if (String(f.name).trim().length < 2) return void toast('El nombre es obligatorio', 'warning')
    if (editing.kind === 'area') {
      const patch = {
        name: String(f.name).trim(),
        description: String(f.description).trim() || null,
        parent_area_id: f.parent_area_id || null,
        lead_id: f.lead_id || null,
      }
      const { data, error } = await supabase.from('areas').update(patch).eq('id', editing.id).select().single()
      if (error) return void toast(error.message, 'error')
      setAreas((prev) => prev.map((a) => (a.id === editing.id ? (data as Area) : a)))
    } else if (editing.kind === 'pos') {
      const patch = { name: String(f.name).trim(), level: Number(f.level), description: String(f.description).trim() || null }
      const { data, error } = await supabase.from('positions').update(patch).eq('id', editing.id).select().single()
      if (error) return void toast(error.message, 'error')
      setPositions((prev) => prev.map((p) => (p.id === editing.id ? (data as Position) : p)))
    } else {
      const patch = { name: String(f.name).trim(), description: String(f.description).trim() || null, area_id: f.area_id || null }
      const { data, error } = await supabase.from('teams').update(patch).eq('id', editing.id).select().single()
      if (error) return void toast(error.message, 'error')
      setTeams((prev) => prev.map((t) => (t.id === editing.id ? (data as Team) : t)))
    }
    setEditing(null)
    toast('✓ Cambios guardados (auditados)')
  }

  // ---------- áreas CRUD ----------
  async function addArea() {
    if (areaForm.name.trim().length < 2) return void toast('Nombre del área requerido', 'warning')
    const { data, error } = await supabase
      .from('areas')
      .insert({
        name: areaForm.name.trim(),
        description: areaForm.description.trim() || null,
        parent_area_id: areaForm.parent_area_id || null,
        lead_id: areaForm.lead_id || null,
        sort_order: childAreas(areaForm.parent_area_id || null).length,
      })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setAreas((prev) => [...prev, data as Area])
    setAreaForm({ name: '', description: '', parent_area_id: '', lead_id: '' })
    toast('✓ Área creada')
  }

  function requestDeleteArea(id: string) {
    setEditing(null)
    const members = areaMembers(id)
    if (members.length === 0) {
      if (!window.confirm('¿Eliminar esta área? No tiene personas asignadas. Las subáreas pasarán a la raíz.')) return
      void performDeleteArea(id)
      return
    }
    setDeletingArea(deletingArea === id ? null : id)
    setReassign({})
  }

  async function performDeleteArea(id: string) {
    const members = areaMembers(id)
    const byTarget = new Map<string, string[]>()
    for (const m of members) {
      const target = reassign[m.id] ?? ''
      byTarget.set(target, [...(byTarget.get(target) ?? []), m.id])
    }
    for (const [target, ids] of byTarget) {
      const { error } = await supabase.from('profiles').update({ area_id: target || null }).in('id', ids)
      if (error) return void toast(`No se pudo reasignar: ${error.message}`, 'error')
    }
    const { error } = await supabase.from('areas').delete().eq('id', id)
    if (error) return void toast(`No se pudo eliminar: ${error.message}`, 'error')
    setProfiles((prev) => prev.map((p) => (p.area_id === id ? { ...p, area_id: reassign[p.id] || null } : p)))
    setAreas((prev) => prev.filter((a) => a.id !== id).map((a) => (a.parent_area_id === id ? { ...a, parent_area_id: null } : a)))
    setTeams((prev) => prev.map((t) => (t.area_id === id ? { ...t, area_id: null } : t)))
    setDeletingArea(null)
    setReassign({})
    toast('✓ Área eliminada y personas reasignadas')
  }

  // ---------- cargos CRUD ----------
  async function addPosition() {
    if (posForm.name.trim().length < 2) return void toast('Nombre del cargo requerido', 'warning')
    const { data, error } = await supabase
      .from('positions')
      .insert({ name: posForm.name.trim(), level: posForm.level, description: posForm.description.trim() || null })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setPositions((prev) => [...prev, data as Position].sort((a, b) => a.level - b.level))
    setPosForm({ name: '', level: 2, description: '' })
    toast('✓ Cargo creado')
  }

  async function togglePosition(p: Position) {
    const { error } = await supabase.from('positions').update({ is_active: !p.is_active }).eq('id', p.id)
    if (error) return void toast(error.message, 'error')
    setPositions((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)))
    toast(p.is_active ? 'Cargo ocultado — puedes reactivarlo cuando quieras' : '✓ Cargo reactivado')
  }

  async function deletePosition(p: Position) {
    const uses = posUsage[p.id] ?? 0
    const msg = uses > 0
      ? `"${p.name}" está asignado a ${uses} persona(s). Al eliminarlo, esas asignaciones se borran (las personas conservan su cargo en texto). ¿Eliminar definitivamente?`
      : `¿Eliminar el cargo "${p.name}" definitivamente? Si solo quieres sacarlo de las listas, usa Ocultar.`
    if (!window.confirm(msg)) return
    const { error } = await supabase.from('positions').delete().eq('id', p.id)
    if (error) return void toast(error.message, 'error')
    setPositions((prev) => prev.filter((x) => x.id !== p.id))
    toast('Cargo eliminado')
  }

  // ---------- equipos CRUD ----------
  async function addTeam() {
    if (teamForm.name.trim().length < 2) return void toast('Nombre del equipo requerido', 'warning')
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: teamForm.name.trim(), description: teamForm.description.trim() || null, area_id: teamForm.area_id || null })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setTeams((prev) => [...prev, data as Team])
    setTeamForm({ name: '', description: '', area_id: '' })
    toast('✓ Equipo creado')
  }

  async function deleteTeam(t: Team) {
    const members = teamMembers(t.id)
    const msg = members.length > 0
      ? `"${t.name}" tiene ${members.length} integrante(s): ${members.map((m) => m.name.split(' ')[0]).join(', ')}. Quedarán sin equipo (puedes reasignarlos en el Directorio). ¿Eliminar?`
      : `¿Eliminar el equipo "${t.name}"?`
    if (!window.confirm(msg)) return
    const { error } = await supabase.from('teams').delete().eq('id', t.id)
    if (error) return void toast(error.message, 'error')
    setTeams((prev) => prev.filter((x) => x.id !== t.id))
    setProfiles((prev) => prev.map((p) => (p.team_id === t.id ? { ...p, team_id: null } : p)))
    toast('✓ Equipo eliminado — integrantes sin equipo')
  }

  // ---------- tipos de labor ----------
  const wtUsage = (key: string) => profiles.filter((p) => p.role_type === key).length

  async function addWorkType() {
    if (wtForm.name.trim().length < 3) return void toast('Nombre del tipo de labor requerido', 'warning')
    const key = slugify(wtForm.name)
    if (!key) return void toast('Nombre inválido', 'warning')
    if (workTypes.some((w) => w.key === key)) return void toast('Ya existe un tipo con ese nombre', 'warning')
    const { data, error } = await supabase
      .from('work_types')
      .insert({ key, name: wtForm.name.trim(), description: wtForm.description.trim() || null, sort_order: workTypes.length })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setWorkTypes((prev) => [...prev, data as WorkType])
    setWtForm({ name: '', description: '' })
    toast('✓ Tipo de labor creado')
  }

  async function saveWorkType(key: string) {
    if (wtEditForm.name.trim().length < 3) return void toast('Nombre requerido', 'warning')
    const { data, error } = await supabase
      .from('work_types')
      .update({ name: wtEditForm.name.trim(), description: wtEditForm.description.trim() || null })
      .eq('key', key).select().single()
    if (error) return void toast(error.message, 'error')
    setWorkTypes((prev) => prev.map((w) => (w.key === key ? (data as WorkType) : w)))
    setEditingWt(null)
    toast('✓ Tipo de labor actualizado')
  }

  async function toggleWorkType(w: WorkType) {
    if (w.key === 'default') return void toast('El tipo General no se puede ocultar', 'warning')
    const { error } = await supabase.from('work_types').update({ is_active: !w.is_active }).eq('key', w.key)
    if (error) return void toast(error.message, 'error')
    setWorkTypes((prev) => prev.map((x) => (x.key === w.key ? { ...x, is_active: !w.is_active } : x)))
  }

  async function deleteWorkType(w: WorkType) {
    if (w.key === 'default') return void toast('El tipo General no se puede eliminar', 'warning')
    const uses = wtUsage(w.key)
    const msg = uses > 0
      ? `"${w.name}" está asignado a ${uses} persona(s); pasarán al tipo General. Las competencias y habilidades de este tipo quedarán como transversales. ¿Eliminar?`
      : `¿Eliminar el tipo de labor "${w.name}"?`
    if (!window.confirm(msg)) return
    // reasignar referencias antes de borrar
    await supabase.from('profiles').update({ role_type: 'default' }).eq('role_type', w.key)
    await supabase.from('skills').update({ role_type: null }).eq('role_type', w.key)
    await supabase.from('catalog_items').update({ role_type: null }).eq('role_type', w.key)
    const { error } = await supabase.from('work_types').delete().eq('key', w.key)
    if (error) return void toast(error.message, 'error')
    setWorkTypes((prev) => prev.filter((x) => x.key !== w.key))
    setProfiles((prev) => prev.map((p) => (p.role_type === w.key ? { ...p, role_type: 'default' } : p)))
    toast('✓ Tipo eliminado — personas reasignadas a General')
  }

  // ---------- invitaciones ----------
  async function invite() {
    if (!/^\S+@\S+\.\S+$/.test(invForm.email.trim())) return void toast('Email inválido', 'warning')
    const emailLower = invForm.email.trim().toLowerCase()
    if (profiles.some((p) => p.email.toLowerCase() === emailLower)) {
      return void toast('Ya existe un usuario con ese correo — búscalo en el Directorio', 'error')
    }
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email: invForm.email.trim().toLowerCase(),
        name: invForm.name.trim() || null,
        role: invForm.role,
        area_id: invForm.area_id || null,
        team_id: invForm.team_id || null,
        manager_id: invForm.manager_id || null,
        position_id: invForm.position_id || null,
        position_title: invForm.position_title.trim() || positions.find((p) => p.id === invForm.position_id)?.name || null,
        role_type: invForm.role_type,
        invited_by: profile!.id,
      })
      .select().single()
    if (error) {
      toast(error.message.includes('duplicate') ? 'Ya hay una invitación pendiente para ese email' : error.message, 'error')
      return
    }
    setInvitations((prev) => [data as Invitation, ...prev])
    setInvForm(EMPTY_INV)
    toast('✓ Invitación creada — pídele que se registre con ese email en la página de ingreso')
  }

  async function deleteInvitation(id: string) {
    const { error } = await supabase.from('invitations').delete().eq('id', id)
    if (error) return void toast(error.message, 'error')
    setInvitations((prev) => prev.filter((i) => i.id !== id))
  }

  const input = 'rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none'
  const iconBtn = 'rounded-lg p-1.5 text-slate-400 hover:bg-slate-100'

  const editButtons = (
    <div className="mt-3 flex gap-2">
      <button onClick={saveEdit} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:brightness-105">Guardar</button>
      <button onClick={() => setEditing(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancelar</button>
    </div>
  )

  // ---------- árbol de áreas: render recursivo con numeración ----------
  function renderAreaTree(parentId: string | null, prefix: string): ReactNode[] {
    return childAreas(parentId).flatMap((a, i) => {
      const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`
      const depth = prefix ? prefix.split('.').length : 0
      const kids = childAreas(a.id)
      const isCollapsed = collapsedAreas.has(a.id)
      const members = areaMembers(a.id)
      const isDeleting = deletingArea === a.id
      const isEditing = editing?.kind === 'area' && editing.id === a.id

      const node = (
        <div
          key={a.id}
          style={{ marginLeft: depth * 24 }}
          className={`rounded-2xl border bg-white p-3.5 shadow-sm ${isDeleting ? 'border-highlight ring-2 ring-highlight/20' : isEditing ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'}`}
        >
          {isEditing ? (
            <div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={String(editForm.name)} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={input} aria-label="Nombre" placeholder="Nombre *" />
                <input value={String(editForm.description)} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={input} aria-label="Descripción" placeholder="Descripción" />
                <select value={String(editForm.parent_area_id)} onChange={(e) => setEditForm({ ...editForm, parent_area_id: e.target.value })} className={input} aria-label="Depende de (área superior)">
                  <option value="">Sin área superior (raíz)</option>
                  {areas.filter((x) => x.id !== a.id && !isDescendant(x.id, a.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select value={String(editForm.lead_id)} onChange={(e) => setEditForm({ ...editForm, lead_id: e.target.value })} className={input} aria-label="Líder">
                  <option value="">Sin líder</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {editButtons}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-start gap-1.5">
                {kids.length > 0 ? (
                  <button
                    onClick={() =>
                      setCollapsedAreas((prev) => {
                        const next = new Set(prev)
                        if (next.has(a.id)) next.delete(a.id)
                        else next.add(a.id)
                        return next
                      })
                    }
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? 'Desplegar' : 'Colapsar'} subáreas de ${a.name}`}
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">{isCollapsed ? 'chevron_right' : 'expand_more'}</span>
                  </button>
                ) : (
                  <span className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    <span className="mr-1.5 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-primary">{num}</span>
                    {a.name}
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{members.length}</span>
                    {isCollapsed && kids.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                        +{kids.length} subárea{kids.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">Líder: {personName(a.lead_id)}</p>
                  {a.description && <p className="mt-0.5 text-[11px] text-slate-400 italic">{a.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => moveSibling(a, -1)} className={`${iconBtn} hover:text-primary`} title="Subir en el orden" aria-label={`Subir ${a.name} en el orden`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_upward</span>
                </button>
                <button onClick={() => moveSibling(a, 1)} className={`${iconBtn} hover:text-primary`} title="Bajar en el orden" aria-label={`Bajar ${a.name} en el orden`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_downward</span>
                </button>
                <button onClick={() => promoteArea(a)} disabled={!a.parent_area_id} className={`${iconBtn} hover:text-primary disabled:opacity-25`} title="Subir de nivel (sale de su dependencia)" aria-label={`Subir ${a.name} de nivel`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">format_indent_decrease</span>
                </button>
                <button onClick={() => demoteArea(a)} className={`${iconBtn} hover:text-primary`} title="Bajar de nivel (pasa a depender del área anterior)" aria-label={`Bajar ${a.name} de nivel`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">format_indent_increase</span>
                </button>
                <button onClick={() => startEdit('area', a.id)} className={`${iconBtn} hover:text-primary`} title="Editar (incluye mover a cualquier dependencia)" aria-label={`Editar ${a.name}`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
                </button>
                <button onClick={() => requestDeleteArea(a.id)} className={`${iconBtn} hover:text-highlight`} title="Eliminar" aria-label={`Eliminar ${a.name}`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                </button>
              </div>
            </div>
          )}

          {isDeleting && (
            <div className="view-enter mt-4 rounded-xl border border-highlight/30 bg-highlight/5 p-4">
              <p className="flex items-start gap-2 text-xs font-bold text-slate-700">
                <span className="material-symbols-outlined text-base text-highlight" aria-hidden="true">warning</span>
                Esta área tiene {members.length} persona{members.length === 1 ? '' : 's'} asignada{members.length === 1 ? '' : 's'}. Decide a dónde van antes de eliminar:
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">Mover a todos a:</span>
                <select
                  onChange={(e) => setReassign(Object.fromEntries(members.map((m) => [m.id, e.target.value])))}
                  defaultValue=""
                  aria-label="Mover a todos a un área"
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
                >
                  <option value="">Sin área</option>
                  {areas.filter((x) => x.id !== a.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <span className="text-[10px] text-slate-400">o ajusta persona por persona:</span>
              </div>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                    <span className="truncate text-xs font-semibold text-slate-700">{m.name}</span>
                    <select
                      value={reassign[m.id] ?? ''}
                      onChange={(e) => setReassign((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      aria-label={`Nueva área para ${m.name}`}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold focus:border-primary focus:outline-none"
                    >
                      <option value="">Sin área</option>
                      {areas.filter((x) => x.id !== a.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => performDeleteArea(a.id)} className="rounded-xl bg-highlight px-4 py-2 text-xs font-bold text-white hover:brightness-105">
                  Confirmar eliminación
                </button>
                <button onClick={() => { setDeletingArea(null); setReassign({}) }} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-white">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )

      const rows: ReactNode[] = [node]
      if (!isCollapsed && kids.length > 0) rows.push(...renderAreaTree(a.id, num))
      return rows
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Organización</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">Áreas, cargos, equipos e invitaciones — todo queda auditado</p>
      </div>

      <div role="tablist" className="scrollbar-hide flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
        {([['areas', 'Áreas', 'account_tree'], ['cargos', 'Cargos', 'badge'], ['equipos', 'Equipos', 'groups'], ['labores', 'Tipos de labor', 'work'], ['invitaciones', 'Invitaciones', 'person_add']] as [Tab, string, string][]).map(([k, label, icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setEditing(null); setDeletingArea(null) }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${tab === k ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
      ) : tab === 'areas' ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Nueva área</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })} className={input} placeholder="Nombre (ej: Operaciones) *" aria-label="Nombre del área" />
              <input value={areaForm.description} onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })} className={input} placeholder="Descripción (propósito del área)" aria-label="Descripción del área" />
              <select value={areaForm.parent_area_id} onChange={(e) => setAreaForm({ ...areaForm, parent_area_id: e.target.value })} className={input} aria-label="Área superior">
                <option value="">Sin área superior (raíz)</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={areaForm.lead_id} onChange={(e) => setAreaForm({ ...areaForm, lead_id: e.target.value })} className={input} aria-label="Líder del área">
                <option value="">Sin líder asignado</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button onClick={addArea} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">Crear área</button>
          </div>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_upward</span>/<span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_downward</span> cambiar orden</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm" aria-hidden="true">format_indent_decrease</span> subir de nivel</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm" aria-hidden="true">format_indent_increase</span> volver subárea de la anterior</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm" aria-hidden="true">edit</span> editar y mover a cualquier dependencia</span>
          </p>

          <div className="space-y-1.5">
            {renderAreaTree(null, '')}
            {areas.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">Sin áreas aún.</p>
            )}
          </div>
        </>
      ) : tab === 'cargos' ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Nuevo cargo</h3>
            <div className="grid gap-2 sm:grid-cols-[1fr_180px_1fr]">
              <input value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} className={input} placeholder="Nombre (ej: Gestora de Proyecto) *" aria-label="Nombre del cargo" />
              <select value={posForm.level} onChange={(e) => setPosForm({ ...posForm, level: Number(e.target.value) })} className={input} aria-label="Nivel jerárquico">
                {LEVEL_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
              <input value={posForm.description} onChange={(e) => setPosForm({ ...posForm, description: e.target.value })} className={input} placeholder="Descripción (responsabilidades)" aria-label="Descripción del cargo" />
            </div>
            <button onClick={addPosition} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">Crear cargo</button>
          </div>
          <div className="space-y-2">
            {positions.map((p) => {
              const isEditing = editing?.kind === 'pos' && editing.id === p.id
              const uses = posUsage[p.id] ?? 0
              return (
                <div key={p.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${isEditing ? 'border-primary ring-2 ring-primary/20' : p.is_active ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60'}`}>
                  {isEditing ? (
                    <div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_180px_1fr]">
                        <input value={String(editForm.name)} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={input} aria-label="Nombre" placeholder="Nombre *" />
                        <select value={Number(editForm.level)} onChange={(e) => setEditForm({ ...editForm, level: Number(e.target.value) })} className={input} aria-label="Nivel">
                          {LEVEL_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                        </select>
                        <input value={String(editForm.description)} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={input} aria-label="Descripción" placeholder="Descripción" />
                      </div>
                      {editButtons}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {p.name}
                          {!p.is_active && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-400 uppercase">Oculto</span>}
                          {uses > 0 && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{uses} asignado{uses === 1 ? '' : 's'}</span>}
                        </p>
                        <p className="text-[11px] text-slate-500">{LEVEL_LABELS[p.level] ?? `Nivel ${p.level}`}</p>
                        {p.description && <p className="mt-1 text-[11px] text-slate-400 italic">{p.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit('pos', p.id)} className={`${iconBtn} hover:text-primary`} aria-label={`Editar ${p.name}`}>
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
                        </button>
                        <button
                          onClick={() => togglePosition(p)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${p.is_active ? 'text-slate-400 hover:bg-slate-100 hover:text-highlight' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                          aria-label={`${p.is_active ? 'Ocultar' : 'Reactivar'} ${p.name}`}
                        >
                          <span className="material-symbols-outlined text-base" aria-hidden="true">{p.is_active ? 'visibility_off' : 'visibility'}</span>
                          {p.is_active ? 'Ocultar' : 'Reactivar'}
                        </button>
                        <button onClick={() => deletePosition(p)} className={`${iconBtn} hover:text-highlight`} aria-label={`Eliminar ${p.name}`}>
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : tab === 'equipos' ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Nuevo equipo</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} className={input} placeholder="Nombre (ej: Proyecto Andes) *" aria-label="Nombre del equipo" />
              <select value={teamForm.area_id} onChange={(e) => setTeamForm({ ...teamForm, area_id: e.target.value })} className={input} aria-label="Área del equipo">
                <option value="">Sin área</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} className={input} placeholder="Descripción (alcance del equipo)" aria-label="Descripción del equipo" />
            </div>
            <button onClick={addTeam} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">Crear equipo</button>
          </div>
          <div className="space-y-2">
            {teams.map((t) => {
              const isEditing = editing?.kind === 'team' && editing.id === t.id
              const members = teamMembers(t.id)
              return (
                <div key={t.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${isEditing ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'}`}>
                  {isEditing ? (
                    <div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input value={String(editForm.name)} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={input} aria-label="Nombre" placeholder="Nombre *" />
                        <select value={String(editForm.area_id)} onChange={(e) => setEditForm({ ...editForm, area_id: e.target.value })} className={input} aria-label="Área">
                          <option value="">Sin área</option>
                          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <input value={String(editForm.description)} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={input} aria-label="Descripción" placeholder="Descripción" />
                      </div>
                      {editButtons}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {t.name}
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            {members.length} integrante{members.length === 1 ? '' : 's'}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Área: {areas.find((a) => a.id === t.area_id)?.name ?? 'Sin área'}
                          {members.length > 0 && ` · ${members.map((m) => m.name.split(' ')[0]).join(', ')}`}
                        </p>
                        {t.description && <p className="mt-1 text-[11px] text-slate-400 italic">{t.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit('team', t.id)} className={`${iconBtn} hover:text-primary`} aria-label={`Editar ${t.name}`}>
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
                        </button>
                        <button onClick={() => deleteTeam(t)} className={`${iconBtn} hover:text-highlight`} aria-label={`Eliminar ${t.name}`}>
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : tab === 'labores' ? (
        <>
          <p className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[11px] leading-relaxed text-slate-500">
            Los <strong>tipos de labor</strong> determinan qué habilidades específicas se evalúan a cada persona
            (en la autoevaluación y en Competencias 360). Se asignan por persona en el Directorio o al invitar.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Nuevo tipo de labor</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={wtForm.name} onChange={(e) => setWtForm({ ...wtForm, name: e.target.value })} className={input} placeholder="Nombre (ej: Pedagogía) *" aria-label="Nombre del tipo de labor" />
              <input value={wtForm.description} onChange={(e) => setWtForm({ ...wtForm, description: e.target.value })} className={input} placeholder="Descripción (qué roles agrupa)" aria-label="Descripción del tipo" />
            </div>
            <button onClick={addWorkType} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">Crear tipo</button>
          </div>
          <div className="space-y-2">
            {workTypes.map((w) => {
              const uses = wtUsage(w.key)
              const isEditingThis = editingWt === w.key
              return (
                <div key={w.key} className={`rounded-2xl border bg-white p-4 shadow-sm ${isEditingThis ? 'border-primary ring-2 ring-primary/20' : w.is_active ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60'}`}>
                  {isEditingThis ? (
                    <div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input value={wtEditForm.name} onChange={(e) => setWtEditForm({ ...wtEditForm, name: e.target.value })} className={input} aria-label="Nombre" placeholder="Nombre *" />
                        <input value={wtEditForm.description} onChange={(e) => setWtEditForm({ ...wtEditForm, description: e.target.value })} className={input} aria-label="Descripción" placeholder="Descripción" />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => saveWorkType(w.key)} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:brightness-105">Guardar</button>
                        <button onClick={() => setEditingWt(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {w.name}
                          <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-400">{w.key}</span>
                          {!w.is_active && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-400 uppercase">Oculto</span>}
                          {uses > 0 && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{uses} persona{uses === 1 ? '' : 's'}</span>}
                        </p>
                        {w.description && <p className="mt-0.5 text-[11px] text-slate-400 italic">{w.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingWt(w.key); setWtEditForm({ name: w.name, description: w.description ?? '' }) }} className={`${iconBtn} hover:text-primary`} aria-label={`Editar ${w.name}`}>
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
                        </button>
                        {w.key !== 'default' && (
                          <>
                            <button
                              onClick={() => toggleWorkType(w)}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${w.is_active ? 'text-slate-400 hover:bg-slate-100 hover:text-highlight' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                              aria-label={`${w.is_active ? 'Ocultar' : 'Reactivar'} ${w.name}`}
                            >
                              <span className="material-symbols-outlined text-base" aria-hidden="true">{w.is_active ? 'visibility_off' : 'visibility'}</span>
                              {w.is_active ? 'Ocultar' : 'Reactivar'}
                            </button>
                            <button onClick={() => deleteWorkType(w)} className={`${iconBtn} hover:text-highlight`} aria-label={`Eliminar ${w.name}`}>
                              <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-bold text-slate-900">Invitar persona</h3>
            <p className="mb-4 text-[11px] text-slate-500">
              Crea la invitación y pídele a la persona registrarse en la página de ingreso con este email —
              su perfil nacerá con rol, área, jefe y cargo ya asignados.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={invForm.email} onChange={(e) => setInvForm({ ...invForm, email: e.target.value })} className={input} placeholder="email@empresa.com *" aria-label="Email" type="email" />
              <input value={invForm.name} onChange={(e) => setInvForm({ ...invForm, name: e.target.value })} className={input} placeholder="Nombre completo" aria-label="Nombre" />
              <select value={invForm.role} onChange={(e) => setInvForm({ ...invForm, role: e.target.value })} className={input} aria-label="Rol de plataforma">
                {['colaborador', 'facilitador', 'admin', 'invitado'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              <select value={invForm.position_id} onChange={(e) => setInvForm({ ...invForm, position_id: e.target.value })} className={input} aria-label="Cargo">
                <option value="">Cargo…</option>
                {positions.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={invForm.area_id} onChange={(e) => setInvForm({ ...invForm, area_id: e.target.value })} className={input} aria-label="Área">
                <option value="">Área…</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={invForm.team_id} onChange={(e) => setInvForm({ ...invForm, team_id: e.target.value })} className={input} aria-label="Equipo">
                <option value="">Equipo…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={invForm.manager_id} onChange={(e) => setInvForm({ ...invForm, manager_id: e.target.value })} className={input} aria-label="Reporta a">
                <option value="">Reporta a…</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={invForm.role_type} onChange={(e) => setInvForm({ ...invForm, role_type: e.target.value })} className={input} aria-label="Tipo de labor">
                {workTypes.filter((w) => w.is_active).map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
              </select>
            </div>
            <button onClick={invite} className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105">
              Crear invitación
            </button>
          </div>
          <div className="space-y-2">
            {invitations.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">Sin invitaciones aún.</p>}
            {invitations.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-sm font-bold text-slate-900">{i.name ?? i.email}</p>
                  <p className="text-[11px] text-slate-500">{i.email} · {roleLabel(i.role)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${i.accepted_at ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-yellow-700'}`}>
                    {i.accepted_at ? 'Aceptada' : 'Pendiente'}
                  </span>
                  {!i.accepted_at && (
                    <button onClick={() => deleteInvitation(i.id)} className={`${iconBtn} hover:text-highlight`} aria-label={`Eliminar invitación de ${i.email}`}>
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
