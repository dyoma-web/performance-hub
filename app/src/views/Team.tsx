import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import type { Cycle, Profile, Review } from '../types'

interface MemberStatus {
  member: Profile
  self: Review | null
  peers: Review[]
  facilitator: Review | null
  checkins: number
}

export default function Team() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()
  const [rows, setRows] = useState<MemberStatus[]>([])
  const [everyone, setEveryone] = useState<Profile[]>([])
  const [requesting, setRequesting] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile || !cycle) return
    async function load() {
      const [{ data: members }, { data: all }, { data: reviews }, { data: checkins }] = await Promise.all([
        supabase.from('profiles').select('*').eq('team_id', profile!.team_id!).neq('id', profile!.id).eq('is_active', true).order('name'),
        supabase.from('profiles').select('*').eq('is_active', true).order('name'),
        supabase.from('reviews').select('*').eq('cycle_id', cycle!.id),
        supabase.from('checkins').select('id,user_id,status').eq('cycle_id', cycle!.id).neq('status', 'draft'),
      ])
      const revs = (reviews as Review[]) ?? []
      setRows(
        ((members as Profile[]) ?? []).map((m) => ({
          member: m,
          self: revs.find((r) => r.evaluatee_id === m.id && r.type === 'self') ?? null,
          peers: revs.filter((r) => r.evaluatee_id === m.id && (r.type === 'peer' || r.type === 'stakeholder')),
          facilitator: revs.find((r) => r.evaluatee_id === m.id && r.type === 'facilitator') ?? null,
          checkins: (checkins ?? []).filter((c) => c.user_id === m.id).length,
        }))
      )
      setEveryone((all as Profile[]) ?? [])
      setLoading(false)
    }
    load()
  }, [profile, cycle])

  if (!profile || !cycle) return null

  function statusChip(label: string, state: 'done' | 'partial' | 'pending') {
    const style =
      state === 'done' ? 'bg-primary/10 text-primary' : state === 'partial' ? 'bg-accent/15 text-yellow-700' : 'bg-slate-100 text-slate-400'
    return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${style}`}>{label}</span>
  }

  async function sendRequests(evaluatee: Profile) {
    if (selected.size === 0) {
      toast('Selecciona al menos un evaluador', 'warning')
      return
    }
    const rows = [...selected].map((reviewerId) => ({
      cycle_id: cycle!.id,
      evaluatee_id: evaluatee.id,
      reviewer_id: reviewerId,
      type: 'peer',
      status: 'requested',
      anonymous: cycle!.config.peer_anonymous,
    }))
    const { data, error } = await supabase.from('reviews').upsert(rows, {
      onConflict: 'cycle_id,evaluatee_id,reviewer_id,type',
      ignoreDuplicates: true,
    }).select()
    if (error) {
      toast(`No se pudo solicitar: ${error.message}`, 'error')
      return
    }
    // Notificación in-app para cada evaluador
    const created = (data as Review[]) ?? []
    if (created.length > 0) {
      await supabase.from('notifications').insert(
        created.map((r) => ({
          user_id: r.reviewer_id,
          type: 'peer-request',
          title: 'Te solicitaron feedback',
          body: `${profile!.name} te pidió feedback sobre ${evaluatee.name} (ciclo ${cycle!.name})`,
          link: '/feedback',
        }))
      )
    }
    setRows((prev) =>
      prev.map((row) =>
        row.member.id === evaluatee.id ? { ...row, peers: [...row.peers, ...created] } : row
      )
    )
    setRequesting(null)
    setSelected(new Set())
    toast(`✓ Feedback solicitado a ${created.length} persona(s)`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Mi Equipo</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {rows.length} colaborador{rows.length === 1 ? '' : 'es'} · ciclo {cycle.name}
        </p>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando equipo…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-bold text-slate-600">No hay colaboradores en tu equipo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ member, self, peers, facilitator, checkins }) => {
            const peersDone = peers.filter((p) => p.status === 'submitted').length
            return (
              <div key={member.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar profile={member} />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{member.name}</p>
                      <p className="text-[11px] text-slate-500">{member.position}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statusChip(
                      self?.status === 'submitted' ? 'Autoevaluación ✓' : self?.status === 'draft' ? 'Auto en borrador' : 'Sin autoevaluación',
                      self?.status === 'submitted' ? 'done' : self?.status === 'draft' ? 'partial' : 'pending'
                    )}
                    {statusChip(
                      `Pares ${peersDone}/${peers.length}`,
                      peers.length > 0 && peersDone === peers.length ? 'done' : peersDone > 0 ? 'partial' : 'pending'
                    )}
                    {statusChip(`${checkins} check-in${checkins === 1 ? '' : 's'}`, checkins > 0 ? 'done' : 'pending')}
                    {statusChip(
                      facilitator?.status === 'submitted' ? 'Mi evaluación ✓' : 'Mi evaluación pendiente',
                      facilitator?.status === 'submitted' ? 'done' : facilitator?.status === 'draft' ? 'partial' : 'pending'
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/evaluar/${member.id}`}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 hover:brightness-105"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">rate_review</span>
                    {facilitator?.status === 'submitted' ? 'Ver mi evaluación' : 'Evaluar'}
                  </Link>
                  <button
                    onClick={() => {
                      setRequesting(requesting === member.id ? null : member.id)
                      setSelected(new Set())
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:border-primary/50"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">group_add</span>
                    Solicitar feedback de pares
                  </button>
                </div>

                {requesting === member.id && (
                  <div className="view-enter mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="mb-2 text-xs font-bold text-slate-700">
                      ¿Quiénes deben dar feedback sobre {member.name.split(' ')[0]}?
                    </p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {everyone
                        .filter((p) => p.id !== member.id && !peers.some((pr) => pr.reviewer_id === p.id))
                        .map((p) => (
                          <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white">
                            <input
                              type="checkbox"
                              checked={selected.has(p.id)}
                              onChange={(e) => {
                                const next = new Set(selected)
                                if (e.target.checked) next.add(p.id)
                                else next.delete(p.id)
                                setSelected(next)
                              }}
                              className="rounded accent-[#16b79c]"
                            />
                            <span className="font-semibold text-slate-700">{p.name}</span>
                            <span className="text-slate-400">· {p.position}</span>
                          </label>
                        ))}
                    </div>
                    <button
                      onClick={() => sendRequests(member)}
                      className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:brightness-105"
                    >
                      Enviar solicitudes ({selected.size})
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
