import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import { roleLabel } from '../lib/labels'
import type { Profile, Role, Team } from '../types'

export default function AdminDirectory() {
  const { profile } = useAuth()
  const toast = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [workTypes, setWorkTypes] = useState<{ key: string; name: string; is_active: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  // crear usuario
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ first: '', last: '', email: '' })
  const [created, setCreated] = useState<{ email: string; temp: string } | null>(null)
  const [saving, setSaving] = useState(false)
  // eliminar usuario
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

  if (!profile || profile.role !== 'admin') return <p className="py-12 text-center text-sm text-slate-400">Solo People Ops puede gestionar el directorio.</p>

  function genTempPassword(): string {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    const chunk = (b: number) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]
    const raw = Array.from(bytes, chunk).join('')
    return `Hub-${raw.slice(0, 3)}${Math.floor(Math.random() * 9) + 1}-${raw.slice(3)}`
  }

  async function createUser() {
    const name = `${newUser.first.trim()} ${newUser.last.trim()}`.trim()
    if (newUser.first.trim().length < 2 || newUser.last.trim().length < 2) {
      return void toast('Nombres y apellidos son obligatorios', 'warning')
    }
    if (!/^\S+@\S+\.\S+$/.test(newUser.email.trim())) {
      return void toast('Correo inválido', 'warning')
    }
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
    const { data } = await supabase.from('profiles').select('*').order('name')
    setProfiles((data as Profile[]) ?? [])
    setCreated({ email: newUser.email.trim().toLowerCase(), temp })
    setNewUser({ first: '', last: '', email: '' })
    setSaving(false)
    toast('✓ Usuario creado — comparte la contraseña temporal de forma segura')
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

  async function update(id: string, patch: Partial<Profile>) {
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single()
    if (error) {
      toast(`No se pudo actualizar: ${error.message}`, 'error')
      return
    }
    setProfiles((prev) => prev.map((p) => (p.id === id ? (data as Profile) : p)))
    toast('✓ Perfil actualizado')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Directorio</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {profiles.length} persona(s) · cambios de rol y equipo quedan protegidos por RLS
          </p>
        </div>
        <button
          onClick={() => { setCreating(!creating); setCreated(null) }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105"
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">person_add</span>
          Crear usuario
        </button>
      </div>

      {creating && (
        <div className="view-enter rounded-2xl border border-primary/30 bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Nuevo usuario</h3>
          <p className="mb-4 text-[11px] text-slate-500">
            Se crea con una <strong>contraseña temporal</strong> que deberá cambiar en su primer ingreso.
            Los datos del perfil los completará la persona dentro de la plataforma.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={newUser.first} onChange={(e) => setNewUser({ ...newUser, first: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
              placeholder="Nombres *" aria-label="Nombres"
            />
            <input
              value={newUser.last} onChange={(e) => setNewUser({ ...newUser, last: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
              placeholder="Apellidos *" aria-label="Apellidos"
            />
            <input
              value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              type="email"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
              placeholder="correo@empresa.com *" aria-label="Correo"
            />
          </div>
          <button
            onClick={createUser} disabled={saving}
            className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60"
          >
            {saving ? 'Creando…' : 'Crear usuario'}
          </button>

          {created && (
            <div className="view-enter mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-bold text-slate-800">✓ Usuario creado. Credenciales de primer ingreso:</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-700 ring-1 ring-slate-200">{created.email}</code>
                <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-xs font-bold text-primary ring-1 ring-primary/30">{created.temp}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(`Usuario: ${created.email}\nContraseña temporal: ${created.temp}\nIngreso: ${window.location.origin}${window.location.pathname}`); toast('✓ Credenciales copiadas') }}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-primary/50"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">content_copy</span>
                  Copiar
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                ⚠ Esta contraseña solo se muestra una vez — compártela por un canal seguro. Al primer ingreso el sistema le exigirá cambiarla.
              </p>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {profiles.map((p) => {
            const selectCls =
              'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none disabled:opacity-50'
            const fieldLbl = 'mb-0.5 block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase'
            return (
              <div
                key={p.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${p.is_active ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'}`}
              >
                {/* Cabecera: persona + estado */}
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/persona/${p.id}`} className="group flex min-w-0 items-center gap-3" title={`Ver perfil completo de ${p.name}`}>
                    <Avatar profile={p} size="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800 group-hover:text-primary">
                        {p.name}
                        <span className="material-symbols-outlined ml-1 align-middle text-sm text-slate-300 group-hover:text-primary" aria-hidden="true">open_in_new</span>
                      </p>
                      <p className="truncate text-[11px] text-slate-400">{p.position ?? '—'} · {p.email}</p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => update(p.id, { is_active: !p.is_active })}
                      disabled={p.id === profile.id}
                      aria-label={`${p.is_active ? 'Desactivar' : 'Activar'} a ${p.name}`}
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase transition-colors disabled:opacity-50 ${
                        p.is_active ? 'bg-primary/10 text-primary hover:bg-highlight/10 hover:text-highlight' : 'bg-slate-100 text-slate-400 hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </button>
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
                      Se borrarán su acceso, perfil, datos personales, evaluaciones, check-ins y documentos.
                      El último estado del perfil queda en el log de auditoría. Si solo quieres suspender el acceso,
                      usa <strong>Inactivo</strong>.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        aria-label="Escribe DELETE para confirmar"
                        className="rounded-lg border border-highlight/40 bg-white px-3 py-2 font-mono text-xs font-bold focus:border-highlight focus:ring-2 focus:ring-highlight/30 focus:outline-none"
                        placeholder='Escribe "DELETE" para confirmar'
                      />
                      <button
                        onClick={() => deleteUser(p)}
                        disabled={confirmText !== 'DELETE' || saving}
                        className="rounded-xl bg-highlight px-4 py-2 text-xs font-bold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving ? 'Eliminando…' : 'Eliminar definitivamente'}
                      </button>
                      <button onClick={() => { setDeleting(null); setConfirmText('') }} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-white">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Asignaciones en grilla compacta */}
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-50 pt-3 sm:grid-cols-3">
                  <div>
                    <span className={fieldLbl}>Rol</span>
                    <select
                      value={p.role}
                      onChange={(e) => update(p.id, { role: e.target.value as Role })}
                      disabled={p.id === profile.id}
                      aria-label={`Rol de ${p.name}`}
                      className={selectCls}
                    >
                      {(['colaborador', 'facilitador', 'admin', 'invitado'] as Role[]).map((r) => (
                        <option key={r} value={r}>{roleLabel(r)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className={fieldLbl}>Área</span>
                    <select
                      value={p.area_id ?? ''}
                      onChange={(e) => update(p.id, { area_id: e.target.value || null })}
                      aria-label={`Área de ${p.name}`}
                      className={selectCls}
                    >
                      <option value="">Sin área</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className={fieldLbl}>Reporta a</span>
                    <select
                      value={p.manager_id ?? ''}
                      onChange={(e) => update(p.id, { manager_id: e.target.value || null })}
                      aria-label={`Jefe directo de ${p.name}`}
                      className={selectCls}
                    >
                      <option value="">Nadie (raíz)</option>
                      {profiles.filter((m) => m.id !== p.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className={fieldLbl}>Equipo</span>
                    <select
                      value={p.team_id ?? ''}
                      onChange={(e) => update(p.id, { team_id: e.target.value || null })}
                      aria-label={`Equipo de ${p.name}`}
                      className={selectCls}
                    >
                      <option value="">Sin equipo</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className={fieldLbl}>Tipo de labor</span>
                    <select
                      value={p.role_type}
                      onChange={(e) => update(p.id, { role_type: e.target.value })}
                      aria-label={`Tipo de labor de ${p.name}`}
                      className={selectCls}
                    >
                      {workTypes
                        .filter((w) => w.is_active || w.key === p.role_type)
                        .map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
                    </select>
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
