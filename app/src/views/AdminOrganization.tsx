import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { roleLabel } from '../lib/labels'
import type { Profile, Team } from '../types'

interface Area {
  id: string
  name: string
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

type Tab = 'areas' | 'cargos' | 'invitaciones'

const EMPTY_INV = { email: '', name: '', role: 'colaborador', area_id: '', team_id: '', manager_id: '', position_id: '', position_title: '', role_type: 'default' }

export default function AdminOrganization() {
  const { profile } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('areas')
  const [areas, setAreas] = useState<Area[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [areaForm, setAreaForm] = useState({ name: '', parent_area_id: '', lead_id: '' })
  const [posForm, setPosForm] = useState({ name: '', level: 2, description: '' })
  const [invForm, setInvForm] = useState(EMPTY_INV)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('areas').select('*').order('sort_order'),
      supabase.from('positions').select('*').eq('is_active', true).order('level'),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('name'),
      supabase.from('teams').select('*').order('name'),
    ]).then(([a, p, i, pr, t]) => {
      setAreas((a.data as Area[]) ?? [])
      setPositions((p.data as Position[]) ?? [])
      setInvitations((i.data as Invitation[]) ?? [])
      setProfiles((pr.data as Profile[]) ?? [])
      setTeams((t.data as Team[]) ?? [])
      setLoading(false)
    })
  }, [])

  if (!profile || profile.role !== 'admin') {
    return <p className="py-12 text-center text-sm text-slate-400">Solo People Ops puede gestionar la organización.</p>
  }

  const personName = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? '—'

  async function addArea() {
    if (areaForm.name.trim().length < 2) {
      toast('Nombre del área requerido', 'warning')
      return
    }
    const { data, error } = await supabase
      .from('areas')
      .insert({
        name: areaForm.name.trim(),
        parent_area_id: areaForm.parent_area_id || null,
        lead_id: areaForm.lead_id || null,
        sort_order: areas.length,
      })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setAreas((prev) => [...prev, data as Area])
    setAreaForm({ name: '', parent_area_id: '', lead_id: '' })
    toast('✓ Área creada')
  }

  async function updateArea(id: string, patch: Partial<Area>) {
    const { data, error } = await supabase.from('areas').update(patch).eq('id', id).select().single()
    if (error) return void toast(error.message, 'error')
    setAreas((prev) => prev.map((a) => (a.id === id ? (data as Area) : a)))
    toast('✓ Área actualizada')
  }

  async function deleteArea(id: string) {
    if (!window.confirm('¿Eliminar esta área? Las personas asignadas quedarán sin área.')) return
    const { error } = await supabase.from('areas').delete().eq('id', id)
    if (error) return void toast(`No se pudo eliminar: ${error.message}`, 'error')
    setAreas((prev) => prev.filter((a) => a.id !== id))
    toast('Área eliminada')
  }

  async function addPosition() {
    if (posForm.name.trim().length < 2) {
      toast('Nombre del cargo requerido', 'warning')
      return
    }
    const { data, error } = await supabase
      .from('positions')
      .insert({ name: posForm.name.trim(), level: posForm.level, description: posForm.description.trim() || null })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setPositions((prev) => [...prev, data as Position].sort((a, b) => a.level - b.level))
    setPosForm({ name: '', level: 2, description: '' })
    toast('✓ Cargo creado')
  }

  async function deactivatePosition(id: string) {
    const { error } = await supabase.from('positions').update({ is_active: false }).eq('id', id)
    if (error) return void toast(error.message, 'error')
    setPositions((prev) => prev.filter((p) => p.id !== id))
    toast('Cargo desactivado')
  }

  async function invite() {
    if (!/^\S+@\S+\.\S+$/.test(invForm.email.trim())) {
      toast('Email inválido', 'warning')
      return
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

  const inputCls = 'rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Organización</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">Áreas, cargos e invitaciones de usuarios — todo queda auditado</p>
      </div>

      <div role="tablist" className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5">
        {([['areas', 'Áreas', 'account_tree'], ['cargos', 'Cargos', 'badge'], ['invitaciones', 'Invitaciones', 'person_add']] as [Tab, string, string][]).map(([k, label, icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${tab === k ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}>
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
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })} className={inputCls} placeholder="Nombre (ej: Operaciones)" aria-label="Nombre del área" />
              <select value={areaForm.parent_area_id} onChange={(e) => setAreaForm({ ...areaForm, parent_area_id: e.target.value })} className={inputCls} aria-label="Área superior">
                <option value="">Sin área superior (raíz)</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={areaForm.lead_id} onChange={(e) => setAreaForm({ ...areaForm, lead_id: e.target.value })} className={inputCls} aria-label="Líder del área">
                <option value="">Sin líder asignado</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={addArea} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">Crear</button>
            </div>
          </div>
          <div className="space-y-2">
            {areas.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {a.parent_area_id && <span className="text-slate-300">└ </span>}{a.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {a.parent_area_id ? `Depende de ${areas.find((x) => x.id === a.parent_area_id)?.name ?? '—'} · ` : 'Raíz · '}
                    Líder: {personName(a.lead_id)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={a.lead_id ?? ''} onChange={(e) => updateArea(a.id, { lead_id: e.target.value || null })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none" aria-label={`Líder de ${a.name}`}>
                    <option value="">Sin líder</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={() => deleteArea(a.id)} className="rounded-lg p-2 text-slate-400 hover:text-highlight" aria-label={`Eliminar ${a.name}`}>
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : tab === 'cargos' ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Nuevo cargo</h3>
            <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
              <input value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} className={inputCls} placeholder="Nombre (ej: Gestora de Proyecto)" aria-label="Nombre del cargo" />
              <select value={posForm.level} onChange={(e) => setPosForm({ ...posForm, level: Number(e.target.value) })} className={inputCls} aria-label="Nivel jerárquico">
                <option value={0}>Nivel 0 — Dirección</option>
                <option value={1}>Nivel 1 — Liderazgo</option>
                <option value={2}>Nivel 2 — Equipo</option>
                <option value={3}>Nivel 3 — Apoyo</option>
              </select>
              <input value={posForm.description} onChange={(e) => setPosForm({ ...posForm, description: e.target.value })} className={inputCls} placeholder="Descripción (opcional)" aria-label="Descripción del cargo" />
              <button onClick={addPosition} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">Crear</button>
            </div>
          </div>
          <div className="space-y-2">
            {positions.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-sm font-bold text-slate-900">{p.name}</p>
                  <p className="text-[11px] text-slate-500">Nivel {p.level}{p.description ? ` · ${p.description}` : ''}</p>
                </div>
                <button onClick={() => deactivatePosition(p.id)} className="rounded-lg p-2 text-slate-400 hover:text-highlight" aria-label={`Desactivar ${p.name}`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">visibility_off</span>
                </button>
              </div>
            ))}
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
              <input value={invForm.email} onChange={(e) => setInvForm({ ...invForm, email: e.target.value })} className={inputCls} placeholder="email@empresa.com *" aria-label="Email" type="email" />
              <input value={invForm.name} onChange={(e) => setInvForm({ ...invForm, name: e.target.value })} className={inputCls} placeholder="Nombre completo" aria-label="Nombre" />
              <select value={invForm.role} onChange={(e) => setInvForm({ ...invForm, role: e.target.value })} className={inputCls} aria-label="Rol de plataforma">
                {['colaborador', 'facilitador', 'admin', 'invitado'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              <select value={invForm.position_id} onChange={(e) => setInvForm({ ...invForm, position_id: e.target.value })} className={inputCls} aria-label="Cargo">
                <option value="">Cargo…</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={invForm.area_id} onChange={(e) => setInvForm({ ...invForm, area_id: e.target.value })} className={inputCls} aria-label="Área">
                <option value="">Área…</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={invForm.team_id} onChange={(e) => setInvForm({ ...invForm, team_id: e.target.value })} className={inputCls} aria-label="Equipo">
                <option value="">Equipo…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={invForm.manager_id} onChange={(e) => setInvForm({ ...invForm, manager_id: e.target.value })} className={inputCls} aria-label="Reporta a">
                <option value="">Reporta a…</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={invForm.role_type} onChange={(e) => setInvForm({ ...invForm, role_type: e.target.value })} className={inputCls} aria-label="Tipo de labor">
                {['default', 'designer', 'engineer', 'marketing'].map((rt) => <option key={rt} value={rt}>{rt === 'default' ? 'general' : rt}</option>)}
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
                    <button onClick={() => deleteInvitation(i.id)} className="rounded-lg p-2 text-slate-400 hover:text-highlight" aria-label={`Eliminar invitación de ${i.email}`}>
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
