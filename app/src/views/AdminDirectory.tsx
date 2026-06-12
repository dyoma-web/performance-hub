import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import { roleLabel } from '../lib/labels'
import type { Profile, Role, Team } from '../types'

type Estado = 'activo' | 'suspendido' | 'retirado'
type SortBy = 'name-asc' | 'name-desc' | 'area' | 'team' | 'role' | 'hire-asc' | 'hire-desc'

const ESTADO_STYLE: Record<Estado, string> = {
  activo: 'bg-primary/10 text-primary',
  suspendido: 'bg-accent/15 text-yellow-700',
  retirado: 'bg-slate-200 text-slate-500',
}

function estadoDe(p: Profile): Estado {
  if (p.archived_at) return 'retirado'
  return p.is_active ? 'activo' : 'suspendido'
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = String(v ?? '')
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function AdminDirectory() {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [workTypes, setWorkTypes] = useState<{ key: string; name: string; is_active: boolean }[]>([])
  const [loading, setLoading] = useState(true)

  // filtros y orden
  const [q, setQ] = useState('')
  const [fArea, setFArea] = useState('')
  const [fTeam, setFTeam] = useState('')
  const [fRole, setFRole] = useState('')
  const [fWorkType, setFWorkType] = useState('')
  const [fEstado, setFEstado] = useState<'operativos' | Estado | 'todos'>('operativos')
  const [sortBy, setSortBy] = useState<SortBy>('name-asc')

  // crear usuario individual
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ first: '', last: '', email: '' })
  const [created, setCreated] = useState<{ email: string; temp: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // carga masiva
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResults, setBulkResults] = useState<{ name: string; email: string; temp: string; status: string }[]>([])

  // selección múltiple
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [bulkTarget, setBulkTarget] = useState('')

  // eliminar
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('areas').select('id,name').order('sort_order'),
      supabase.from('work_types').select('key,name,is_active').order('sort_order'),
    ]).then(([p, t, a, wt]) => {
      setProfiles((p.data as Profile[]) ?? [])
      setTeams((t.data as Team[]) ?? [])
      setAreas(a.data ?? [])
      setWorkTypes(wt.data ?? [])
      setLoading(false)
    })
  }, [])

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name ?? 'Sin área'
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? 'Sin equipo'

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    let list = profiles.filter((p) => {
      const est = estadoDe(p)
      if (fEstado === 'operativos' && est === 'retirado') return false
      if (fEstado !== 'operativos' && fEstado !== 'todos' && est !== fEstado) return false
      if (fArea && p.area_id !== fArea) return false
      if (fTeam && p.team_id !== fTeam) return false
      if (fRole && p.role !== fRole) return false
      if (fWorkType && p.role_type !== fWorkType) return false
      if (term && !`${p.name} ${p.email} ${p.position ?? ''}`.toLowerCase().includes(term)) return false
      return true
    })
    const byName = (a: Profile, b: Profile) => a.name.localeCompare(b.name)
    if (sortBy === 'name-asc') list = [...list].sort(byName)
    if (sortBy === 'name-desc') list = [...list].sort((a, b) => byName(b, a))
    if (sortBy === 'hire-asc') list = [...list].sort((a, b) => (a.hire_date ?? '9999').localeCompare(b.hire_date ?? '9999'))
    if (sortBy === 'hire-desc') list = [...list].sort((a, b) => (b.hire_date ?? '0000').localeCompare(a.hire_date ?? '0000'))
    if (sortBy === 'area') list = [...list].sort((a, b) => areaName(a.area_id).localeCompare(areaName(b.area_id)) || byName(a, b))
    if (sortBy === 'team') list = [...list].sort((a, b) => teamName(a.team_id).localeCompare(teamName(b.team_id)) || byName(a, b))
    if (sortBy === 'role') list = [...list].sort((a, b) => roleLabel(a.role).localeCompare(roleLabel(b.role)) || byName(a, b))
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, q, fArea, fTeam, fRole, fWorkType, fEstado, sortBy, areas, teams])

  // agrupación visual cuando se ordena por área/equipo/rol
  const groupOf = (p: Profile): string | null =>
    sortBy === 'area' ? areaName(p.area_id) : sortBy === 'team' ? teamName(p.team_id) : sortBy === 'role' ? roleLabel(p.role) : null

  if (!profile || !isAdmin) return <p className="py-12 text-center text-sm text-slate-400">Solo People Ops puede gestionar el directorio.</p>

  function genTempPassword(): string {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    const chunk = (b: number) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]
    const raw = Array.from(bytes, chunk).join('')
    return `Hub-${raw.slice(0, 3)}${Math.floor(Math.random() * 9) + 1}-${raw.slice(3)}`
  }

  async function reloadProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('name')
    setProfiles((data as Profile[]) ?? [])
  }

  async function createUser() {
    const name = `${newUser.first.trim()} ${newUser.last.trim()}`.trim()
    if (newUser.first.trim().length < 2 || newUser.last.trim().length < 2) return void toast('Nombres y apellidos son obligatorios', 'warning')
    if (!/^\S+@\S+\.\S+$/.test(newUser.email.trim())) return void toast('Correo inválido', 'warning')
    setSaving(true)
    const temp = genTempPassword()
    const { error } = await supabase.rpc('admin_create_user', {
      p_email: newUser.email.trim().toLowerCase(),
      p_name: name,
      p_temp_password: temp,
    })
    if (error) {
      setSaving(false)
      return void toast(error.message, 'error')
    }
    await reloadProfiles()
    setCreated({ email: newUser.email.trim().toLowerCase(), temp })
    setNewUser({ first: '', last: '', email: '' })
    setSaving(false)
    toast('✓ Usuario creado — comparte la contraseña temporal de forma segura')
  }

  // ---------- carga masiva CSV ----------
  function downloadTemplate() {
    downloadCsv('plantilla-usuarios.csv', [
      ['Nombres', 'Apellidos', 'Correo'],
      ['María Fernanda', 'López Pérez', 'maria.lopez@empresa.com'],
      ['Andrés', 'García Ruiz', 'andres.garcia@empresa.com'],
    ])
  }

  async function handleBulkFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const text = await file.text()
    const sep = text.includes(';') ? ';' : ','
    const rows = text
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')))
      .filter((cols) => cols.length >= 3 && !/correo|email/i.test(cols[2]))
    if (rows.length === 0) return void toast('No se encontraron filas válidas (Nombres;Apellidos;Correo)', 'error')
    if (rows.length > 100) return void toast('Máximo 100 usuarios por carga', 'warning')

    setBulkBusy(true)
    const results: typeof bulkResults = []
    for (const [first, last, email] of rows) {
      const name = `${first} ${last}`.trim()
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        results.push({ name, email, temp: '', status: 'Correo inválido' })
        continue
      }
      const temp = genTempPassword()
      const { error } = await supabase.rpc('admin_create_user', { p_email: email.toLowerCase(), p_name: name, p_temp_password: temp })
      results.push({ name, email: email.toLowerCase(), temp: error ? '' : temp, status: error ? error.message : 'Creado ✓' })
    }
    setBulkResults(results)
    setBulkBusy(false)
    await reloadProfiles()
    const ok = results.filter((r) => r.status === 'Creado ✓').length
    toast(`Carga masiva: ${ok} creado(s), ${results.length - ok} con error`, ok === results.length ? 'success' : 'warning')
  }

  function downloadCredentials() {
    downloadCsv('credenciales-usuarios.csv', [
      ['Nombre', 'Correo (usuario)', 'Contraseña temporal', 'Estado', 'Nota'],
      ...bulkResults.map((r) => [r.name, r.email, r.temp, r.status, 'Debe cambiar la contraseña en el primer ingreso']),
    ])
  }

  // ---------- selección múltiple ----------
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function applyBulkAction() {
    if (selected.size === 0 || !bulkAction) return
    const ids = [...selected].filter((id) => id !== profile!.id) // nunca sobre uno mismo
    let patch: Record<string, unknown> | null = null
    let label = ''
    if (bulkAction === 'suspender') { patch = { is_active: false }; label = 'suspendido(s)' }
    if (bulkAction === 'activar') { patch = { is_active: true, archived_at: null }; label = 'activado(s)' }
    if (bulkAction === 'retirar') {
      if (!window.confirm(`¿Marcar como RETIRADAS a ${ids.length} persona(s)? Saldrán del organigrama y las vistas operativas, pero toda su información queda archivada y es reversible.`)) return
      patch = { is_active: false, archived_at: new Date().toISOString() }
      label = 'retirado(s) y archivado(s)'
    }
    if (bulkAction === 'desarchivar') { patch = { is_active: true, archived_at: null }; label = 'desarchivado(s) y activado(s)' }
    if (bulkAction === 'rol' && bulkTarget) { patch = { role: bulkTarget }; label = `con rol ${roleLabel(bulkTarget)}` }
    if (bulkAction === 'area') { patch = { area_id: bulkTarget || null }; label = 'reasignado(s) de área' }
    if (bulkAction === 'equipo') { patch = { team_id: bulkTarget || null }; label = 'reasignado(s) de equipo' }
    if (bulkAction === 'labor' && bulkTarget) { patch = { role_type: bulkTarget }; label = 'con nuevo tipo de labor' }
    if (!patch) return void toast('Selecciona la acción (y su valor si aplica)', 'warning')

    const { error } = await supabase.from('profiles').update(patch).in('id', ids)
    if (error) return void toast(error.message, 'error')
    await reloadProfiles()
    setSelected(new Set())
    setBulkAction('')
    setBulkTarget('')
    toast(`✓ ${ids.length} usuario(s) ${label}`)
  }

  async function update(id: string, patch: Partial<Profile>) {
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single()
    if (error) return void toast(`No se pudo actualizar: ${error.message}`, 'error')
    setProfiles((prev) => prev.map((p) => (p.id === id ? (data as Profile) : p)))
    toast('✓ Perfil actualizado')
  }

  async function deleteUser(p: Profile) {
    if (confirmText !== 'DELETE') return
    setSaving(true)
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: p.id })
    setSaving(false)
    if (error) return void toast(error.message, 'error')
    setProfiles((prev) => prev.filter((x) => x.id !== p.id))
    setDeleting(null)
    setConfirmText('')
    toast(`Usuario ${p.name} eliminado — el último estado quedó en auditoría`)
  }

  const inputCls = 'rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none'
  const filterCls = 'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none'
  let lastGroup: string | null = null

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Directorio</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {filtered.length} de {profiles.length} persona(s)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulkUpload(!showBulkUpload); setCreating(false) }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-primary/50"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">upload_file</span>
            Carga masiva
          </button>
          <button
            onClick={() => { setCreating(!creating); setCreated(null); setShowBulkUpload(false) }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">person_add</span>
            Crear usuario
          </button>
        </div>
      </div>

      {/* Crear individual */}
      {creating && (
        <div className="view-enter rounded-2xl border border-primary/30 bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Nuevo usuario</h3>
          <p className="mb-4 text-[11px] text-slate-500">
            Se crea con una <strong>contraseña temporal</strong> que deberá cambiar en su primer ingreso.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={newUser.first} onChange={(e) => setNewUser({ ...newUser, first: e.target.value })} className={inputCls} placeholder="Nombres *" aria-label="Nombres" />
            <input value={newUser.last} onChange={(e) => setNewUser({ ...newUser, last: e.target.value })} className={inputCls} placeholder="Apellidos *" aria-label="Apellidos" />
            <input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} type="email" className={inputCls} placeholder="correo@empresa.com *" aria-label="Correo" />
          </div>
          <button onClick={createUser} disabled={saving} className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60">
            {saving ? 'Creando…' : 'Crear usuario'}
          </button>
          {created && (
            <div className="view-enter mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-bold text-slate-800">✓ Usuario creado. Credenciales de primer ingreso:</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-700 ring-1 ring-slate-200">{created.email}</code>
                <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-xs font-bold text-primary ring-1 ring-primary/30">{created.temp}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(`Usuario: ${created.email}\nContraseña temporal: ${created.temp}`); toast('✓ Credenciales copiadas') }}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-primary/50"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">content_copy</span>
                  Copiar
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">⚠ Esta contraseña solo se muestra una vez.</p>
            </div>
          )}
        </div>
      )}

      {/* Carga masiva */}
      {showBulkUpload && (
        <div className="view-enter rounded-2xl border border-primary/30 bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Carga masiva de usuarios</h3>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
            Sube un archivo <strong>CSV</strong> (se crea y se abre con Excel) con columnas <code>Nombres;Apellidos;Correo</code>.
            Cada usuario se crea con contraseña temporal y al final descargas el archivo de credenciales.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:border-primary/50">
              <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
              Descargar plantilla
            </button>
            <label className={`flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:brightness-105 ${bulkBusy ? 'opacity-50' : ''}`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">upload</span>
              {bulkBusy ? 'Creando usuarios…' : 'Subir CSV'}
              <input type="file" accept=".csv,text/csv" className="hidden" disabled={bulkBusy} onChange={handleBulkFile} aria-label="Subir archivo CSV" />
            </label>
            {bulkResults.length > 0 && (
              <button onClick={downloadCredentials} className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-slate-800 hover:brightness-105">
                <span className="material-symbols-outlined text-base" aria-hidden="true">key</span>
                Descargar credenciales (CSV)
              </button>
            )}
          </div>
          {bulkResults.length > 0 && (
            <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                  <tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Correo</th><th className="px-3 py-2">Contraseña temporal</th><th className="px-3 py-2">Estado</th></tr>
                </thead>
                <tbody>
                  {bulkResults.map((r, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="px-3 py-1.5 font-semibold">{r.name}</td>
                      <td className="px-3 py-1.5">{r.email}</td>
                      <td className="px-3 py-1.5 font-mono font-bold text-primary">{r.temp || '—'}</td>
                      <td className={`px-3 py-1.5 font-bold ${r.status === 'Creado ✓' ? 'text-primary' : 'text-highlight'}`}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[10px] text-slate-400">⚠ Las contraseñas solo están disponibles en esta sesión — descarga el CSV antes de salir.</p>
        </div>
      )}

      {/* Filtros y orden */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar por nombre, correo o cargo"
          className="min-w-40 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-primary focus:outline-none" placeholder="🔍 Nombre, correo o cargo…" />
        <select value={fArea} onChange={(e) => setFArea(e.target.value)} className={filterCls} aria-label="Filtrar por área">
          <option value="">Área: todas</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={fTeam} onChange={(e) => setFTeam(e.target.value)} className={filterCls} aria-label="Filtrar por equipo">
          <option value="">Equipo: todos</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={fRole} onChange={(e) => setFRole(e.target.value)} className={filterCls} aria-label="Filtrar por rol">
          <option value="">Rol: todos</option>
          {(['colaborador', 'facilitador', 'admin', 'invitado'] as Role[]).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <select value={fWorkType} onChange={(e) => setFWorkType(e.target.value)} className={filterCls} aria-label="Filtrar por tipo de labor">
          <option value="">Labor: todas</option>
          {workTypes.map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value as typeof fEstado)} className={filterCls} aria-label="Filtrar por estado">
          <option value="operativos">Estado: operativos</option>
          <option value="activo">Solo activos</option>
          <option value="suspendido">Solo suspendidos</option>
          <option value="retirado">Retirados (archivo)</option>
          <option value="todos">Todos</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className={filterCls} aria-label="Ordenar y agrupar">
          <option value="name-asc">Orden: A → Z</option>
          <option value="name-desc">Orden: Z → A</option>
          <option value="area">Agrupar por área</option>
          <option value="team">Agrupar por equipo</option>
          <option value="role">Agrupar por rol</option>
          <option value="hire-asc">Antigüedad: mayor primero</option>
          <option value="hire-desc">Antigüedad: menor primero</option>
        </select>
        {(q || fArea || fTeam || fRole || fWorkType || fEstado !== 'operativos' || sortBy !== 'name-asc') && (
          <button onClick={() => { setQ(''); setFArea(''); setFTeam(''); setFRole(''); setFWorkType(''); setFEstado('operativos'); setSortBy('name-asc') }}
            className="text-xs font-bold text-slate-400 hover:text-highlight">
            Limpiar
          </button>
        )}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-500">
          <input
            type="checkbox"
            checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
            onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())}
            className="rounded accent-[#16b79c]"
          />
          Seleccionar filtrados
        </label>
      </div>

      {/* Barra de acciones múltiples */}
      {selected.size > 0 && (
        <div className="view-enter flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-xs font-extrabold text-primary">{selected.size} seleccionado(s)</span>
          <select value={bulkAction} onChange={(e) => { setBulkAction(e.target.value); setBulkTarget('') }} className={filterCls} aria-label="Acción múltiple">
            <option value="">Acción…</option>
            <option value="suspender">Suspender</option>
            <option value="activar">Activar</option>
            <option value="retirar">Retirar (archivar)</option>
            <option value="desarchivar">Desarchivar</option>
            <option value="rol">Cambiar rol</option>
            <option value="area">Cambiar área</option>
            <option value="equipo">Cambiar equipo</option>
            <option value="labor">Cambiar tipo de labor</option>
          </select>
          {bulkAction === 'rol' && (
            <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} className={filterCls} aria-label="Nuevo rol">
              <option value="">Rol…</option>
              {(['colaborador', 'facilitador', 'admin', 'invitado'] as Role[]).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          )}
          {bulkAction === 'area' && (
            <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} className={filterCls} aria-label="Nueva área">
              <option value="">Sin área</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {bulkAction === 'equipo' && (
            <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} className={filterCls} aria-label="Nuevo equipo">
              <option value="">Sin equipo</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {bulkAction === 'labor' && (
            <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} className={filterCls} aria-label="Nuevo tipo de labor">
              <option value="">Tipo…</option>
              {workTypes.filter((w) => w.is_active).map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
            </select>
          )}
          <button onClick={applyBulkAction} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:brightness-105">Aplicar</button>
          <button onClick={() => setSelected(new Set())} className="text-xs font-bold text-slate-400 hover:text-highlight">Limpiar selección</button>
          {selected.has(profile.id) && <span className="text-[10px] text-slate-400">(tu propia cuenta se excluye automáticamente)</span>}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-400">
          Nadie coincide con los filtros actuales.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((p) => {
            const est = estadoDe(p)
            const group = groupOf(p)
            const showHeader = group !== null && group !== lastGroup
            if (group !== null) lastGroup = group
            const selectCls = 'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none disabled:opacity-50'
            const fieldLbl = 'mb-0.5 block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase'
            return (
              <div key={p.id} className={showHeader ? 'contents' : undefined}>
                {showHeader && (
                  <h3 className="mt-2 flex items-center gap-2 text-xs font-extrabold tracking-wider text-slate-400 uppercase lg:col-span-2">
                    <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">
                      {sortBy === 'area' ? 'account_tree' : sortBy === 'team' ? 'groups' : 'badge'}
                    </span>
                    {group}
                  </h3>
                )}
                <div className={`rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${est === 'retirado' ? 'border-dashed border-slate-300 opacity-75' : est === 'suspendido' ? 'border-accent/40' : 'border-slate-200'} ${selected.has(p.id) ? 'ring-2 ring-primary/40' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <input
                        type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                        disabled={p.id === profile.id}
                        aria-label={`Seleccionar a ${p.name}`}
                        className="rounded accent-[#16b79c] disabled:opacity-30"
                      />
                      <Link to={`/persona/${p.id}`} className="group flex min-w-0 items-center gap-3" title={`Ver perfil completo de ${p.name}`}>
                        <Avatar profile={p} size="h-10 w-10" />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-800 group-hover:text-primary">{p.name}</p>
                          <p className="truncate text-[11px] text-slate-400">{p.position ?? '—'} · {p.email}</p>
                        </div>
                      </Link>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {est === 'retirado' ? (
                        <>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${ESTADO_STYLE.retirado}`}>
                            <span className="material-symbols-outlined mr-0.5 align-middle text-xs" aria-hidden="true">inventory_2</span>
                            Retirado
                          </span>
                          <button
                            onClick={() => update(p.id, { archived_at: null, is_active: true })}
                            className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary uppercase hover:bg-primary/20"
                          >
                            Desarchivar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => update(p.id, { is_active: !p.is_active })}
                          disabled={p.id === profile.id}
                          aria-label={`${p.is_active ? 'Suspender' : 'Activar'} a ${p.name}`}
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase transition-colors disabled:opacity-50 ${ESTADO_STYLE[est]} hover:brightness-95`}
                        >
                          {est === 'activo' ? 'Activo' : 'Suspendido'}
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleting(deleting === p.id ? null : p.id); setConfirmText('') }}
                        disabled={p.id === profile.id}
                        aria-label={`Eliminar cuenta de ${p.name}`}
                        title="Eliminar cuenta definitivamente"
                        className="rounded-lg p-1.5 text-slate-300 hover:bg-highlight/10 hover:text-highlight disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-lg" aria-hidden="true">person_remove</span>
                      </button>
                    </div>
                  </div>

                  {deleting === p.id && (
                    <div className="view-enter mt-3 rounded-xl border border-highlight/40 bg-highlight/5 p-4">
                      <p className="flex items-start gap-2 text-xs font-bold text-highlight">
                        <span className="material-symbols-outlined text-base" aria-hidden="true">warning</span>
                        Eliminar la cuenta de {p.name} es irreversible
                      </p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                        Se borran acceso, perfil, datos personales, evaluaciones y documentos. Si la persona se
                        retiró de la empresa, usa mejor <strong>Retirar (archivar)</strong> — conserva todo y es reversible.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                          aria-label="Escribe DELETE para confirmar"
                          className="rounded-lg border border-highlight/40 bg-white px-3 py-2 font-mono text-xs font-bold focus:border-highlight focus:outline-none"
                          placeholder='Escribe "DELETE"' />
                        <button onClick={() => deleteUser(p)} disabled={confirmText !== 'DELETE' || saving}
                          className="rounded-xl bg-highlight px-4 py-2 text-xs font-bold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40">
                          {saving ? 'Eliminando…' : 'Eliminar definitivamente'}
                        </button>
                        <button onClick={() => { setDeleting(null); setConfirmText('') }} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-white">Cancelar</button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-50 pt-3 sm:grid-cols-3">
                    <div>
                      <span className={fieldLbl}>Rol</span>
                      <select value={p.role} onChange={(e) => update(p.id, { role: e.target.value as Role })} disabled={p.id === profile.id}
                        aria-label={`Rol de ${p.name}`} className={selectCls}>
                        {(['colaborador', 'facilitador', 'admin', 'invitado'] as Role[]).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className={fieldLbl}>Área</span>
                      <select value={p.area_id ?? ''} onChange={(e) => update(p.id, { area_id: e.target.value || null })} aria-label={`Área de ${p.name}`} className={selectCls}>
                        <option value="">Sin área</option>
                        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className={fieldLbl}>Reporta a</span>
                      <select value={p.manager_id ?? ''} onChange={(e) => update(p.id, { manager_id: e.target.value || null })} aria-label={`Jefe directo de ${p.name}`} className={selectCls}>
                        <option value="">Nadie (raíz)</option>
                        {profiles.filter((m) => m.id !== p.id && !m.archived_at).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className={fieldLbl}>Equipo</span>
                      <select value={p.team_id ?? ''} onChange={(e) => update(p.id, { team_id: e.target.value || null })} aria-label={`Equipo de ${p.name}`} className={selectCls}>
                        <option value="">Sin equipo</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className={fieldLbl}>Cargo (título)</span>
                      <input defaultValue={p.position ?? ''} onBlur={(e) => { if (e.target.value.trim() !== (p.position ?? '')) update(p.id, { position: e.target.value.trim() || null }) }}
                        aria-label={`Cargo de ${p.name}`} className={selectCls} placeholder="Ej: Líder de Operaciones" />
                    </div>
                    <div>
                      <span className={fieldLbl}>Fecha de ingreso</span>
                      <input type="date" value={p.hire_date ?? ''} onChange={(e) => update(p.id, { hire_date: e.target.value || null })}
                        aria-label={`Fecha de ingreso de ${p.name}`} className={selectCls} />
                    </div>
                    <div>
                      <span className={fieldLbl}>Tipo de labor</span>
                      <select value={p.role_type} onChange={(e) => update(p.id, { role_type: e.target.value })} aria-label={`Tipo de labor de ${p.name}`} className={selectCls}>
                        {workTypes.filter((w) => w.is_active || w.key === p.role_type).map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
