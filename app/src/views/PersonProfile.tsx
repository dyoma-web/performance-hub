import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import { roleLabel } from '../lib/labels'
import type { Profile, Team } from '../types'

// Vista de solo lectura del perfil de otra persona.
// RLS decide qué llega: TH ve todo; un líder solo lo profesional;
// el resto solo lo público. Las secciones vacías no se muestran.

interface Row {
  [k: string]: unknown
}

const DIET_LABEL: Record<string, string> = {
  omnivoro: 'Omnívoro', vegetariano: 'Vegetariano', vegano: 'Vegano', pescetariano: 'Pescetariano',
  'sin-gluten': 'Sin gluten', kosher: 'Kosher', halal: 'Halal', otro: 'Otro',
}

const fmt = (d: unknown) =>
  d ? new Date(String(d) + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const age = (birth: unknown) =>
  birth ? `${Math.floor((Date.now() - new Date(String(birth) + 'T00:00:00').getTime()) / (365.25 * 86400000))} años` : ''

export default function PersonProfile() {
  const { userId } = useParams()
  const { profile } = useAuth()
  const toast = useToast()
  const [person, setPerson] = useState<Profile | null>(null)
  const [manager, setManager] = useState<Profile | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [areaName, setAreaName] = useState<string | null>(null)
  const [positions, setPositions] = useState<string[]>([])
  const [personal, setPersonal] = useState<Row | null>(null)
  const [dependents, setDependents] = useState<Row[]>([])
  const [emergency, setEmergency] = useState<Row[]>([])
  const [prefs, setPrefs] = useState<Row | null>(null)
  const [education, setEducation] = useState<Row[]>([])
  const [experience, setExperience] = useState<Row[]>([])
  const [recognitions, setRecognitions] = useState<Row[]>([])
  const [references, setReferences] = useState<Row[]>([])
  const [docs, setDocs] = useState<Row[]>([])
  const [skills, setSkills] = useState<{ name: string; self: number | null; peer: number | null; leader: number | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !profile) return
    let cancelled = false
    async function load() {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle()
      if (!p || cancelled) {
        setLoading(false)
        return
      }
      const target = p as Profile
      const [mgr, tm, ar, pa, pi, dep, ec, pf, edu, exp, rec, refs, dc, sk, sr] = await Promise.all([
        target.manager_id ? supabase.from('profiles').select('*').eq('id', target.manager_id).maybeSingle() : Promise.resolve({ data: null }),
        target.team_id ? supabase.from('teams').select('*').eq('id', target.team_id).maybeSingle() : Promise.resolve({ data: null }),
        target.area_id ? supabase.from('areas').select('name').eq('id', target.area_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('position_assignments').select('is_primary,positions(name)').eq('user_id', userId!),
        supabase.from('personal_info').select('*').eq('user_id', userId!).maybeSingle(),
        supabase.from('dependents').select('*').eq('user_id', userId!),
        supabase.from('emergency_contacts').select('*').eq('user_id', userId!),
        supabase.from('personal_preferences').select('*').eq('user_id', userId!).maybeSingle(),
        supabase.from('education').select('*').eq('user_id', userId!).order('end_date', { ascending: false, nullsFirst: true }),
        supabase.from('work_experience').select('*').eq('user_id', userId!).order('end_date', { ascending: false, nullsFirst: true }),
        supabase.from('recognitions').select('*').eq('user_id', userId!).order('date_granted', { ascending: false }),
        supabase.from('professional_references').select('*').eq('user_id', userId!),
        supabase.from('profile_documents').select('*').eq('user_id', userId!).order('uploaded_at', { ascending: false }),
        supabase.from('skills').select('id,name').eq('is_active', true),
        supabase.from('skill_ratings').select('skill_id,relation,score').eq('user_id', userId!),
      ])
      if (cancelled) return
      setPerson(target)
      setManager(mgr.data as Profile | null)
      setTeam(tm.data as Team | null)
      setAreaName((ar.data as { name: string } | null)?.name ?? null)
      const pas = (pa.data ?? []) as unknown as { is_primary: boolean; positions: { name: string } | null }[]
      pas.sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      setPositions(pas.filter((x) => x.positions).map((x) => x.positions!.name))
      setPersonal(pi.data)
      setDependents(dep.data ?? [])
      setEmergency(ec.data ?? [])
      setPrefs(pf.data)
      setEducation(edu.data ?? [])
      setExperience(exp.data ?? [])
      setRecognitions(rec.data ?? [])
      setReferences(refs.data ?? [])
      setDocs(dc.data ?? [])
      const ratings = (sr.data ?? []) as { skill_id: string; relation: string; score: number }[]
      const skillRows = ((sk.data ?? []) as { id: string; name: string }[])
        .map((s) => {
          const of = ratings.filter((r) => r.skill_id === s.id)
          const avg = (rel: string) => {
            const rs = of.filter((r) => r.relation === rel)
            return rs.length > 0 ? rs.reduce((x, r) => x + r.score, 0) / rs.length : null
          }
          return { name: s.name, self: avg('self'), peer: avg('peer'), leader: avg('leader') }
        })
        .filter((s) => s.self != null || s.peer != null || s.leader != null)
      setSkills(skillRows)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId, profile])

  if (!profile) return null
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando perfil…</p>
  if (!person) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-bold text-slate-600">Persona no encontrada</p>
        <Link to="/organigrama" className="mt-2 inline-block text-xs font-bold text-primary hover:underline">← Volver al organigrama</Link>
      </div>
    )
  }

  const isAdmin = profile.role === 'admin'
  const tenure = person.hire_date
    ? `${(Math.floor((Date.now() - new Date(person.hire_date + 'T00:00:00').getTime()) / (365.25 * 8640000)) / 10).toFixed(1)} años en la empresa`
    : null

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from('profile-docs').createSignedUrl(path, 60)
    if (error || !data) return void toast('No tienes acceso a este documento', 'error')
    window.open(data.signedUrl, '_blank')
  }

  const card = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
  const h3 = 'mb-3 flex items-center gap-2 font-extrabold text-slate-900'
  const icon = (n: string) => <span className="material-symbols-outlined text-primary" aria-hidden="true">{n}</span>
  const datum = (label: string, value: unknown) =>
    value ? (
      <div>
        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</p>
        <p className="text-sm font-semibold text-slate-700">{String(value)}</p>
      </div>
    ) : null

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to={isAdmin ? '/directorio' : '/organigrama'} className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-primary">
        <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
        Volver
      </Link>

      {/* Encabezado público */}
      <div className={card}>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar profile={person} size="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{person.name}</h2>
            <p className="text-sm font-semibold text-slate-500">{positions.join(' · ') || person.position || '—'}</p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-400">
              {[areaName, team?.name, roleLabel(person.role)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right text-[11px] font-semibold text-slate-500">
            <p>{person.email}</p>
            {manager && <p>Reporta a <span className="font-bold text-slate-700">{manager.name}</span></p>}
            {tenure && <p className="font-bold text-primary">{tenure}</p>}
          </div>
        </div>
      </div>

      {isAdmin && (
        <p className="flex items-start gap-2 rounded-2xl border border-highlight/20 bg-highlight/5 px-5 py-3 text-[11px] leading-relaxed text-slate-600">
          <span className="material-symbols-outlined text-base text-highlight" aria-hidden="true">admin_panel_settings</span>
          Estás viendo datos personales protegidos como People Ops. Este acceso queda registrado y su uso se
          limita a gestión humana, bienestar y emergencias.
        </p>
      )}

      {/* Identificación (solo llega si RLS lo permite: TH o dueño) */}
      {personal && (
        <div className={card}>
          <h3 className={h3}>{icon('badge')} Identificación</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {datum('Documento', personal.document_number ? `${personal.document_type ?? ''} ${personal.document_number}` : null)}
            {datum('Nacimiento', personal.birth_date ? `${fmt(personal.birth_date)} (${age(personal.birth_date)})` : null)}
            {datum('Teléfono', personal.phone)}
            {datum('Ciudad', personal.city)}
            {datum('Dirección', personal.address)}
            {datum('Estado civil', personal.marital_status)}
            {datum('Sangre', personal.blood_type)}
            {datum('Vinculación', personal.contract_type)}
            {datum('EPS', personal.eps)}
            {datum('Pensiones', personal.pension_fund)}
            {datum('Consentimiento', personal.consent_given_at ? `Otorgado ${fmt(personal.consent_given_at)}` : 'Pendiente')}
          </div>
        </div>
      )}

      {(dependents.length > 0 || emergency.length > 0) && (
        <div className={card}>
          <h3 className={h3}>{icon('family_restroom')} Familia y emergencia</h3>
          {dependents.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {dependents.map((d, i) => (
                <p key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <strong>{String(d.full_name)}</strong> · {String(d.relationship)}
                  {d.birth_date ? ` · ${age(d.birth_date)}` : ''}{d.lives_together ? ' · convive' : ''}
                </p>
              ))}
            </div>
          )}
          {emergency.map((c, i) => (
            <p key={i} className="rounded-lg bg-highlight/5 px-3 py-2 text-xs text-slate-600">
              🆘 <strong>{String(c.full_name)}</strong> ({String(c.relationship)}) — <span className="font-bold text-highlight">{String(c.phone)}</span>
            </p>
          ))}
        </div>
      )}

      {prefs && (
        <div className={card}>
          <h3 className={h3}>{icon('favorite')} Preferencias</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {datum('Alimentación', prefs.diet ? DIET_LABEL[String(prefs.diet)] ?? prefs.diet : null)}
            {datum('Alergias', prefs.allergies)}
            {datum('Talla', prefs.shirt_size)}
            {datum('Cumpleaños', prefs.celebrate_birthday ? 'Le gusta celebrarlo' : 'Prefiere no celebrarlo')}
            {datum('Hobbies', prefs.hobbies)}
          </div>
        </div>
      )}

      {education.length > 0 && (
        <div className={card}>
          <h3 className={h3}>{icon('school')} Formación</h3>
          <div className="space-y-2">
            {education.map((e, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-800">{String(e.title)}</p>
                <p className="text-[11px] text-slate-500">
                  {String(e.institution)}{e.location ? ` · ${e.location}` : ''} · {fmt(e.start_date)} → {e.end_date ? fmt(e.end_date) : 'En curso'}
                </p>
                {Boolean(e.description) && <p className="mt-1 text-[11px] text-slate-600">{String(e.description)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {experience.length > 0 && (
        <div className={card}>
          <h3 className={h3}>{icon('work_history')} Experiencia</h3>
          <div className="space-y-2">
            {experience.map((e, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-800">{String(e.position)} · <span className="text-primary">{String(e.company)}</span></p>
                <p className="text-[11px] text-slate-500">{fmt(e.start_date)} → {e.end_date ? fmt(e.end_date) : 'Actual'}</p>
                {Boolean(e.description) && <p className="mt-1 text-[11px] text-slate-600">{String(e.description)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div className={card}>
          <h3 className={h3}>{icon('radar')} Competencias (auto · pares · líder)</h3>
          <div className="space-y-2">
            {skills.map((s) => (
              <div key={s.name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5">
                <p className="text-xs font-bold text-slate-700">{s.name}</p>
                <div className="flex gap-3 text-[11px] font-bold">
                  <span className="text-yellow-600">Auto: {s.self?.toFixed(1) ?? '—'}</span>
                  <span className="text-primary">Pares: {s.peer?.toFixed(1) ?? '—'}</span>
                  <span className="text-indigo-500">Líder: {s.leader?.toFixed(1) ?? '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recognitions.length > 0 && (
        <div className={card}>
          <h3 className={h3}>{icon('workspace_premium')} Reconocimientos</h3>
          {recognitions.map((r, i) => (
            <p key={i} className="mb-1.5 rounded-xl bg-accent/5 px-4 py-2.5 text-xs text-slate-600">
              🏆 <strong>{String(r.title)}</strong>{r.granted_by ? ` — ${r.granted_by}` : ''}{r.date_granted ? ` · ${fmt(r.date_granted)}` : ''}
            </p>
          ))}
        </div>
      )}

      {references.length > 0 && (
        <div className={card}>
          <h3 className={h3}>{icon('contact_phone')} Referencias</h3>
          {references.map((r, i) => (
            <p key={i} className="mb-1.5 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
              <strong>{String(r.full_name)}</strong> · {[r.relationship, r.company, r.phone, r.email].filter(Boolean).join(' · ')}
            </p>
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <div className={card}>
          <h3 className={h3}>{icon('folder_shared')} Documentos</h3>
          {docs.map((d, i) => (
            <button key={i} onClick={() => openDoc(String(d.storage_path))}
              className="mb-1.5 flex w-full items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-primary/5 hover:text-primary">
              <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">description</span>
              {String(d.name)}
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase">{String(d.kind)}</span>
            </button>
          ))}
        </div>
      )}

      {!personal && education.length === 0 && experience.length === 0 && skills.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-400">
          Esta persona aún no ha diligenciado su perfil, o tu rol no tiene acceso a sus datos
          (lo personal es visible solo para Talento Humano; lo profesional, para su línea de liderazgo).
        </p>
      )}
    </div>
  )
}
