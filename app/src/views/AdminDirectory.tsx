import { useEffect, useState } from 'react'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('teams').select('*').order('name'),
    ]).then(([p, t]) => {
      setProfiles((p.data as Profile[]) ?? [])
      setTeams((t.data as Team[]) ?? [])
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
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                <th className="px-5 py-3">Persona</th>
                <th className="px-3 py-3">Rol</th>
                <th className="px-3 py-3">Equipo</th>
                <th className="px-3 py-3">Tipo de rol</th>
                <th className="px-3 py-3">Activo</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar profile={p} size="h-9 w-9" />
                      <div>
                        <p className="font-bold text-slate-800">{p.name}</p>
                        <p className="text-[11px] text-slate-400">{p.email} · {p.position ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={p.role}
                      onChange={(e) => update(p.id, { role: e.target.value as Role })}
                      disabled={p.id === profile.id}
                      aria-label={`Rol de ${p.name}`}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none disabled:opacity-50"
                    >
                      {(['colaborador', 'facilitador', 'admin', 'invitado'] as Role[]).map((r) => (
                        <option key={r} value={r}>{roleLabel(r)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={p.team_id ?? ''}
                      onChange={(e) => update(p.id, { team_id: e.target.value || null })}
                      aria-label={`Equipo de ${p.name}`}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
                    >
                      <option value="">Sin equipo</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={p.role_type}
                      onChange={(e) => update(p.id, { role_type: e.target.value })}
                      aria-label={`Tipo de rol de ${p.name}`}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
                    >
                      {['default', 'designer', 'engineer', 'marketing'].map((rt) => (
                        <option key={rt} value={rt}>{rt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
