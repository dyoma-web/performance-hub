import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import type { Profile } from '../types'

interface Skill {
  id: string
  name: string
  category: string | null
  role_type: string | null
  description: string | null
}
interface Rating {
  id: string
  skill_id: string
  user_id: string
  rater_id: string
  relation: 'self' | 'peer' | 'leader'
  score: number
  comment: string | null
}
interface WorkRating {
  id: string
  user_id: string
  evaluator_id: string
  project: string
  quality: number
  timeliness: number
  cost_value: number | null
  comment: string | null
  created_at: string
}

type Tab = 'mias' | 'valorar' | 'trabajo'

const REL_LABEL = { self: 'Yo', peer: 'Pares', leader: 'Líder' } as const
const REL_COLOR = { self: 'bg-accent', peer: 'bg-primary', leader: 'bg-indigo-500' } as const

function Stars({ value, onChange, label }: { value: number | null; onChange?: (v: number) => void; label: string }) {
  return (
    <div role={onChange ? 'radiogroup' : 'img'} aria-label={`${label}: ${value ?? 'sin calificar'} de 5`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(s)}
          aria-label={`${s} de 5`}
          className={`material-symbols-outlined text-xl transition-transform ${onChange ? 'cursor-pointer hover:scale-125' : 'cursor-default'} ${
            value != null && s <= value ? 'text-accent' : 'text-slate-200'
          }`}
          style={{ fontVariationSettings: value != null && s <= value ? "'FILL' 1" : "'FILL' 0" }}
        >
          star
        </button>
      ))}
    </div>
  )
}

export default function Skills360() {
  const { profile } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('mias')
  const [skills, setSkills] = useState<Skill[]>([])
  const [myRatings, setMyRatings] = useState<Rating[]>([])
  const [people, setPeople] = useState<Profile[]>([])
  const [target, setTarget] = useState<Profile | null>(null)
  const [targetRatings, setTargetRatings] = useState<Rating[]>([])
  const [comments, setComments] = useState<Record<string, string>>({})
  const [workRatings, setWorkRatings] = useState<WorkRating[]>([])
  const [wrForm, setWrForm] = useState({ user_id: '', project: '', quality: 0, timeliness: 0, cost_value: 0, comment: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('skills').select('*').eq('is_active', true).or(`role_type.is.null,role_type.eq.${profile.role_type}`).order('category'),
      supabase.from('skill_ratings').select('*').eq('user_id', profile.id),
      supabase.from('profiles').select('*').eq('is_active', true).neq('id', profile.id).order('name'),
      supabase.from('work_ratings').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
    ]).then(([s, r, p, w]) => {
      setSkills((s.data as Skill[]) ?? [])
      setMyRatings((r.data as Rating[]) ?? [])
      setPeople((p.data as Profile[]) ?? [])
      setWorkRatings((w.data as WorkRating[]) ?? [])
      setLoading(false)
    })
  }, [profile])

  const summary = useMemo(() => {
    return skills.map((sk) => {
      const of = myRatings.filter((r) => r.skill_id === sk.id)
      const by = (rel: Rating['relation']) => {
        const rs = of.filter((r) => r.relation === rel)
        return rs.length > 0 ? rs.reduce((s, r) => s + r.score, 0) / rs.length : null
      }
      return { skill: sk, self: by('self'), peer: by('peer'), leader: by('leader'), comments: of.filter((r) => r.comment) }
    })
  }, [skills, myRatings])

  if (!profile) return null
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando competencias…</p>

  const myReports = people.filter((p) => p.manager_id === profile.id)

  async function rateSelf(skill: Skill, score: number) {
    const { data, error } = await supabase
      .from('skill_ratings')
      .upsert(
        { skill_id: skill.id, user_id: profile!.id, rater_id: profile!.id, relation: 'self', score },
        { onConflict: 'skill_id,user_id,rater_id' }
      )
      .select().single()
    if (error) return void toast(error.message, 'error')
    setMyRatings((prev) => [...prev.filter((r) => r.id !== (data as Rating).id), data as Rating])
  }

  async function openTarget(p: Profile) {
    setTarget(p)
    const { data } = await supabase.from('skill_ratings').select('*').eq('user_id', p.id).eq('rater_id', profile!.id)
    setTargetRatings((data as Rating[]) ?? [])
    setComments({})
  }

  async function ratePerson(skill: Skill, score: number) {
    if (!target) return
    const relation = target.manager_id === profile!.id ? 'leader' : 'peer'
    const comment = comments[skill.id]?.trim() || targetRatings.find((r) => r.skill_id === skill.id)?.comment || null
    const { data, error } = await supabase
      .from('skill_ratings')
      .upsert(
        { skill_id: skill.id, user_id: target.id, rater_id: profile!.id, relation, score, comment },
        { onConflict: 'skill_id,user_id,rater_id' }
      )
      .select().single()
    if (error) return void toast(error.message, 'error')
    setTargetRatings((prev) => [...prev.filter((r) => r.skill_id !== skill.id), data as Rating])
    toast(`✓ ${skill.name}: ${score}/5 (como ${relation === 'leader' ? 'líder' : 'par'})`)
  }

  async function saveWorkRating() {
    if (!wrForm.user_id || wrForm.project.trim().length < 3 || !wrForm.quality || !wrForm.timeliness) {
      return void toast('Persona, proyecto, calidad y oportunidad son obligatorios', 'warning')
    }
    const { error } = await supabase.from('work_ratings').insert({
      user_id: wrForm.user_id,
      evaluator_id: profile!.id,
      project: wrForm.project.trim(),
      quality: wrForm.quality,
      timeliness: wrForm.timeliness,
      cost_value: wrForm.cost_value || null,
      comment: wrForm.comment.trim() || null,
    })
    if (error) return void toast(`Rechazado: ${error.message}`, 'error')
    setWrForm({ user_id: '', project: '', quality: 0, timeliness: 0, cost_value: 0, comment: '' })
    toast('✓ Valoración de trabajo registrada')
  }

  const bar = (v: number | null, color: string) => (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        {v != null && <div className={`h-full rounded-full ${color}`} style={{ width: `${(v / 5) * 100}%` }} />}
      </div>
      <span className="w-7 text-[11px] font-bold text-slate-500">{v != null ? v.toFixed(1) : '—'}</span>
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Competencias 360</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Tres miradas sobre cada competencia: la tuya, la de tus pares y la de tu líder
        </p>
      </div>

      <div role="tablist" className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5">
        {([['mias', 'Mis competencias', 'radar'], ['valorar', 'Valorar a un colega', 'group'], ['trabajo', 'Valoración de trabajo', 'fact_check']] as [Tab, string, string][]).map(([k, label, icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${tab === k ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'mias' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[11px] font-bold">
            {(['self', 'peer', 'leader'] as const).map((rel) => (
              <span key={rel} className="flex items-center gap-1.5 text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${REL_COLOR[rel]}`} aria-hidden="true" />
                {REL_LABEL[rel]}
              </span>
            ))}
          </div>
          {summary.map(({ skill, self, peer, leader, comments: cms }) => (
            <div key={skill.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{skill.name}</p>
                  <p className="text-[11px] text-slate-500">{skill.description}</p>
                </div>
                <div className="space-y-1">
                  {bar(self, REL_COLOR.self)}
                  {bar(peer, REL_COLOR.peer)}
                  {bar(leader, REL_COLOR.leader)}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 border-t border-slate-50 pt-3">
                <span className="text-[11px] font-bold text-slate-400">Mi autovaloración:</span>
                <Stars value={self} onChange={(v) => rateSelf(skill, v)} label={skill.name} />
              </div>
              {cms.length > 0 && (
                <div className="mt-2 space-y-1">
                  {cms.slice(0, 2).map((c) => (
                    <p key={c.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
                      "{c.comment}" <span className="font-bold text-slate-400">— {REL_LABEL[c.relation]}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'valorar' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <button key={p.id} onClick={() => openTarget(p)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${target?.id === p.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-slate-200 bg-white hover:border-primary/50'}`}>
                <Avatar profile={p} size="h-6 w-6" />
                {p.name.split(' ')[0]}
                {p.manager_id === profile.id && <span className="rounded-full bg-indigo-100 px-1.5 text-[9px] text-indigo-600">tu reporte</span>}
              </button>
            ))}
          </div>
          {target && (
            <div className="view-enter space-y-3">
              <p className="rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-xs text-slate-600">
                Valoras a <strong>{target.name}</strong> como{' '}
                <strong>{target.manager_id === profile.id ? 'líder' : 'par'}</strong>. Acompaña con un ejemplo
                cuando puedas — el puntaje sin contexto vale poco.
              </p>
              {skills
                .filter((sk) => sk.role_type == null || sk.role_type === target.role_type)
                .map((sk) => {
                  const mine = targetRatings.find((r) => r.skill_id === sk.id)
                  return (
                    <div key={sk.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{sk.name}</p>
                          <p className="text-[11px] text-slate-500">{sk.description}</p>
                        </div>
                        <Stars value={mine?.score ?? null} onChange={(v) => ratePerson(sk, v)} label={`${sk.name} de ${target.name}`} />
                      </div>
                      <input
                        value={comments[sk.id] ?? mine?.comment ?? ''}
                        onChange={(e) => setComments((prev) => ({ ...prev, [sk.id]: e.target.value }))}
                        onBlur={() => { if (mine) ratePerson(sk, mine.score) }}
                        aria-label={`Comentario sobre ${sk.name}`}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                        placeholder="Ejemplo observado (se guarda al calificar o al salir del campo)…"
                      />
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {tab === 'trabajo' && (
        <div className="space-y-4">
          {myReports.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-1 text-sm font-bold text-slate-900">Valorar un entregable de tu equipo</h3>
              <p className="mb-3 text-[11px] text-slate-500">Calidad y oportunidad siempre; costo-valor solo para servicios contratados</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={wrForm.user_id} onChange={(e) => setWrForm({ ...wrForm, user_id: e.target.value })}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" aria-label="Persona valorada">
                  <option value="">Persona…</option>
                  {myReports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={wrForm.project} onChange={(e) => setWrForm({ ...wrForm, project: e.target.value })}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Proyecto / entregable *" aria-label="Proyecto" />
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs font-bold text-slate-600">Calidad *</span>
                  <Stars value={wrForm.quality || null} onChange={(v) => setWrForm({ ...wrForm, quality: v })} label="Calidad" />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs font-bold text-slate-600">Oportunidad *</span>
                  <Stars value={wrForm.timeliness || null} onChange={(v) => setWrForm({ ...wrForm, timeliness: v })} label="Oportunidad" />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs font-bold text-slate-600">Costo-valor (opcional)</span>
                  <Stars value={wrForm.cost_value || null} onChange={(v) => setWrForm({ ...wrForm, cost_value: v })} label="Costo-valor" />
                </div>
                <input value={wrForm.comment} onChange={(e) => setWrForm({ ...wrForm, comment: e.target.value })}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Comentario" aria-label="Comentario" />
              </div>
              <button onClick={saveWorkRating} className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105">
                Registrar valoración
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Valoraciones recibidas ({workRatings.length})</h3>
            {workRatings.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                Cuando tu líder valore tus entregables, aparecerán aquí.
              </p>
            ) : (
              <div className="space-y-2">
                {workRatings.map((w) => (
                  <div key={w.id} className="rounded-xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800">{w.project}</p>
                      <p className="text-[10px] text-slate-400">{new Date(w.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-[11px] font-bold text-slate-600">
                      <span>Calidad: {'★'.repeat(w.quality)}{'☆'.repeat(5 - w.quality)}</span>
                      <span>Oportunidad: {'★'.repeat(w.timeliness)}{'☆'.repeat(5 - w.timeliness)}</span>
                      {w.cost_value && <span>Costo-valor: {'★'.repeat(w.cost_value)}{'☆'.repeat(5 - w.cost_value)}</span>}
                    </div>
                    {w.comment && <p className="mt-1.5 text-[11px] text-slate-600">"{w.comment}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
