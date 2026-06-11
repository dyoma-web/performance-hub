import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import { roleLabel } from '../lib/labels'
import type { Profile, Team } from '../types'

interface Area {
  id: string
  name: string
  parent_area_id: string | null
  lead_id: string | null
}
interface PosAssign {
  user_id: string
  is_primary: boolean
  positions: { name: string; level: number } | null
}
interface OrgSettings {
  chart_visibility: 'branch' | 'team' | 'area' | 'company'
  role_overrides: Record<string, string>
}

const SCOPES: [string, string][] = [
  ['branch', 'Solo su rama (hacia abajo)'],
  ['team', 'Solo su equipo'],
  ['area', 'Solo su área'],
  ['company', 'Toda la compañía'],
]

export default function OrgChart() {
  const { profile } = useAuth()
  const toast = useToast()
  const [people, setPeople] = useState<Profile[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [assigns, setAssigns] = useState<PosAssign[]>([])
  const [settings, setSettings] = useState<OrgSettings>({ chart_visibility: 'company', role_overrides: {} })
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true),
      supabase.from('areas').select('*').order('sort_order'),
      supabase.from('teams').select('*'),
      supabase.from('position_assignments').select('user_id,is_primary,positions(name,level)'),
      supabase.from('org_settings').select('*').maybeSingle(),
    ]).then(([p, a, t, pa, os]) => {
      setPeople((p.data as Profile[]) ?? [])
      setAreas((a.data as Area[]) ?? [])
      setTeams((t.data as Team[]) ?? [])
      setAssigns((pa.data as unknown as PosAssign[]) ?? [])
      if (os.data) setSettings(os.data as OrgSettings)
      setLoading(false)
    })
  }, [])

  const scope = useMemo(() => {
    if (!profile) return 'company'
    if (profile.role === 'admin') return 'company'
    return (settings.role_overrides[profile.role] as OrgSettings['chart_visibility']) ?? settings.chart_visibility
  }, [profile, settings])

  const visible = useMemo(() => {
    if (!profile) return []
    if (scope === 'company') return people
    if (scope === 'area') return people.filter((p) => p.area_id === profile.area_id || p.id === profile.id)
    if (scope === 'team') return people.filter((p) => p.team_id === profile.team_id || p.id === profile.id)
    // branch: yo + todos mis descendientes
    const ids = new Set<string>([profile.id])
    let grew = true
    while (grew) {
      grew = false
      for (const p of people) {
        if (p.manager_id && ids.has(p.manager_id) && !ids.has(p.id)) {
          ids.add(p.id)
          grew = true
        }
      }
    }
    return people.filter((p) => ids.has(p.id))
  }, [people, profile, scope])

  const roots = useMemo(() => {
    const ids = new Set(visible.map((p) => p.id))
    return visible
      .filter((p) => !p.manager_id || !ids.has(p.manager_id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [visible])

  const childrenOf = (id: string) => visible.filter((p) => p.manager_id === id).sort((a, b) => a.name.localeCompare(b.name))

  if (!profile) return null
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando organigrama…</p>

  const positionsOf = (id: string) => {
    const of = assigns.filter((a) => a.user_id === id && a.positions)
    of.sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    return of.map((a) => a.positions!.name)
  }
  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name
  const matches = (p: Profile) => search.trim().length > 1 && p.name.toLowerCase().includes(search.trim().toLowerCase())

  async function capture(): Promise<{ dataUrl: string; width: number; height: number } | null> {
    const node = chartRef.current
    if (!node) return null
    setSelected(null) // cerrar popups antes de capturar
    await new Promise((r) => setTimeout(r, 50))
    const dataUrl = await toPng(node, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      style: { padding: '24px' },
    })
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    return { dataUrl, width: img.width, height: img.height }
  }

  async function exportPng() {
    setExporting(true)
    try {
      const cap = await capture()
      if (!cap) return
      const a = document.createElement('a')
      a.href = cap.dataUrl
      a.download = `organigrama-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
      toast('✓ Organigrama descargado como imagen')
    } catch {
      toast('No se pudo generar la imagen', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function exportPdf() {
    setExporting(true)
    try {
      const cap = await capture()
      if (!cap) return
      const w = cap.width / 2
      const h = cap.height / 2
      const pdf = new jsPDF({
        orientation: w > h ? 'landscape' : 'portrait',
        unit: 'px',
        format: [w, h],
      })
      pdf.addImage(cap.dataUrl, 'PNG', 0, 0, w, h)
      pdf.save(`organigrama-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast('✓ Organigrama descargado como PDF')
    } catch {
      toast('No se pudo generar el PDF', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function updateSettings(patch: Partial<OrgSettings>) {
    const next = { ...settings, ...patch }
    const { error } = await supabase.from('org_settings').update({ chart_visibility: next.chart_visibility, role_overrides: next.role_overrides }).eq('id', 1)
    if (error) return void toast(error.message, 'error')
    setSettings(next)
    toast('✓ Visibilidad del organigrama actualizada')
  }

  function Node({ person, depth }: { person: Profile; depth: number }) {
    const kids = childrenOf(person.id)
    const isCollapsed = collapsed.has(person.id)
    const isMe = person.id === profile!.id
    const isSelected = selected === person.id
    const positions = positionsOf(person.id)
    const lead = areas.find((a) => a.lead_id === person.id)
    return (
      <div className="flex flex-col items-center">
        <button
          onClick={() => setSelected(isSelected ? null : person.id)}
          aria-expanded={isSelected}
          className={`w-44 rounded-2xl border bg-white p-3 text-center shadow-sm transition-all hover:shadow-md ${
            isMe ? 'border-primary ring-2 ring-primary/30' : matches(person) ? 'border-accent ring-2 ring-accent/40' : 'border-slate-200'
          }`}
        >
          <div className="flex justify-center"><Avatar profile={person} size="h-10 w-10" /></div>
          <p className="mt-1.5 truncate text-xs font-extrabold text-slate-900">{person.name}</p>
          <p className="truncate text-[10px] font-semibold text-slate-500">{positions[0] ?? person.position ?? '—'}</p>
          {positions.length > 1 && (
            <p className="truncate text-[9px] font-bold text-indigo-500">+ {positions.slice(1).join(', ')}</p>
          )}
          <p className="mt-0.5 truncate text-[9px] font-bold tracking-wider text-primary uppercase">
            {lead ? `Líder · ${lead.name}` : areaName(person.area_id) ?? ''}
          </p>
          {isMe && <p className="mt-1 rounded-full bg-primary/10 text-[9px] font-bold text-primary uppercase">Tú</p>}
        </button>

        {isSelected && (
          <div className="view-enter z-10 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] shadow-lg">
            <p className="font-bold text-slate-700">{person.email}</p>
            <p className="mt-1 text-slate-500">Rol: {roleLabel(person.role)}</p>
            {person.team_id && <p className="text-slate-500">Equipo: {teams.find((t) => t.id === person.team_id)?.name}</p>}
            {person.hire_date && (
              <p className="text-slate-500">
                Desde {new Date(person.hire_date + 'T00:00:00').toLocaleDateString('es', { month: 'short', year: 'numeric' })}
              </p>
            )}
            {kids.length > 0 && <p className="mt-1 font-bold text-primary">{kids.length} reporte(s) directo(s)</p>}
            <Link
              to={`/persona/${person.id}`}
              className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-white hover:brightness-105"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">person_search</span>
              Ver perfil completo
            </Link>
          </div>
        )}

        {kids.length > 0 && (
          <>
            <button
              onClick={() => {
                const next = new Set(collapsed)
                if (isCollapsed) next.delete(person.id)
                else next.add(person.id)
                setCollapsed(next)
              }}
              aria-label={`${isCollapsed ? 'Expandir' : 'Colapsar'} equipo de ${person.name}`}
              className="z-10 -mb-1 mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-500 hover:border-primary hover:text-primary"
            >
              {isCollapsed ? `+${kids.length}` : '−'}
            </button>
            {!isCollapsed && (
              <>
                <div className="h-4 w-px bg-slate-300" aria-hidden="true" />
                <div className="flex items-start gap-4 border-t border-slate-300 pt-4">
                  {kids.map((k) => <Node key={k.id} person={k} depth={depth + 1} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Organigrama</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {visible.length} persona(s) visibles · alcance: {SCOPES.find(([v]) => v === scope)?.[1].toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar persona"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            placeholder="🔍 Buscar persona…"
          />
          <button
            onClick={exportPng} disabled={exporting}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary/50 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">image</span>
            {exporting ? 'Generando…' : 'PNG'}
          </button>
          <button
            onClick={exportPdf} disabled={exporting}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 hover:brightness-105 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">picture_as_pdf</span>
            PDF
          </button>
        </div>
      </div>

      {profile.role === 'admin' && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <span className="text-xs font-bold text-slate-600">Visibilidad por defecto:</span>
          <select
            value={settings.chart_visibility}
            onChange={(e) => updateSettings({ chart_visibility: e.target.value as OrgSettings['chart_visibility'] })}
            aria-label="Visibilidad global del organigrama"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
          >
            {SCOPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="text-xs font-bold text-slate-600">Excepción facilitadores:</span>
          <select
            value={settings.role_overrides['facilitador'] ?? ''}
            onChange={(e) => updateSettings({ role_overrides: { ...settings.role_overrides, ...(e.target.value ? { facilitador: e.target.value } : (() => { const o = { ...settings.role_overrides }; delete o.facilitador; return o })()) } })}
            aria-label="Visibilidad para facilitadores"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
          >
            <option value="">Igual que el resto</option>
            {SCOPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="text-[10px] text-slate-400">People Ops siempre ve toda la compañía</span>
        </div>
      )}

      <div className="scrollbar-hide overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/50 p-8">
        <div ref={chartRef} className="flex min-w-max items-start justify-center gap-10">
          {roots.map((r) => <Node key={r.id} person={r} depth={0} />)}
        </div>
      </div>

      <p className="text-center text-[11px] text-slate-400">
        Haz clic en una persona para ver su detalle · usa − / + para colapsar ramas · tu tarjeta está resaltada
      </p>
    </div>
  )
}
