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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('areas').select('id,name').order('sort_order'),
    ]).then(([p, t, a]) => {
      setProfiles((p.data as Profile[]) ?? [])
      setTeams((t.data as Team[]) ?? [])
      setAreas(a.data ?? [])
      setLoading(false)
    })
  }, [])

  if (!profile || profile.role !== 'admin') return <p className="py-12 text-center text-sm text-slate-400">Solo People Ops puede gestionar el directorio.</p>

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
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Directorio</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {profiles.length} persona(s) · cambios de rol y equipo quedan protegidos por RLS
        </p>
      </div>

      <p className="rounded-2xl border border-accent/30 bg-accent/5 px-5 py-3 text-xs text-slate-600">
        Para <strong>agregar usuarios nuevos</strong>: invítalos desde el dashboard de Supabase (Authentication → Invite user)
        o pídeles registrarse; su perfil se crea automáticamente y aquí les asignas rol y equipo.
      </p>

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
                  <button
                    onClick={() => update(p.id, { is_active: !p.is_active })}
                    disabled={p.id === profile.id}
                    aria-label={`${p.is_active ? 'Desactivar' : 'Activar'} a ${p.name}`}
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase transition-colors disabled:opacity-50 ${
                      p.is_active ? 'bg-primary/10 text-primary hover:bg-highlight/10 hover:text-highlight' : 'bg-slate-100 text-slate-400 hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>

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
                      {['default', 'designer', 'engineer', 'marketing'].map((rt) => (
                        <option key={rt} value={rt}>{rt === 'default' ? 'general' : rt}</option>
                      ))}
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
