import { useEffect, useState, type ChangeEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

interface Education {
  id: string
  title: string
  institution: string
  location: string | null
  level: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
}
interface Experience {
  id: string
  company: string
  position: string
  start_date: string | null
  end_date: string | null
  description: string | null
  achievements: string | null
}
interface Reference {
  id: string
  full_name: string
  relationship: string | null
  company: string | null
  phone: string | null
  email: string | null
}
interface Recognition {
  id: string
  title: string
  granted_by: string | null
  date_granted: string | null
  description: string | null
  is_internal: boolean
}
interface Doc {
  id: string
  kind: string
  name: string
  storage_path: string
  uploaded_at: string
}

const LEVELS: [string, string][] = [
  ['bachillerato', 'Bachillerato'], ['tecnico', 'Técnico'], ['tecnologo', 'Tecnólogo'],
  ['pregrado', 'Pregrado'], ['especializacion', 'Especialización'], ['maestria', 'Maestría'],
  ['doctorado', 'Doctorado'], ['diplomado', 'Diplomado'], ['curso', 'Curso'], ['certificacion', 'Certificación'],
]

const fmtPeriod = (s: string | null, e: string | null) => {
  const f = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('es', { month: 'short', year: 'numeric' }) : null)
  return `${f(s) ?? '—'} → ${f(e) ?? 'Actual'}`
}

export default function CareerProfile() {
  const { profile } = useAuth()
  const toast = useToast()
  const [education, setEducation] = useState<Education[]>([])
  const [experience, setExperience] = useState<Experience[]>([])
  const [references, setReferences] = useState<Reference[]>([])
  const [recognitions, setRecognitions] = useState<Recognition[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [open, setOpen] = useState<string | null>('edu')
  const [editingItem, setEditingItem] = useState<{ table: string; id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [eduForm, setEduForm] = useState({ title: '', institution: '', location: '', level: 'pregrado', start_date: '', end_date: '', description: '' })
  const [expForm, setExpForm] = useState({ company: '', position: '', start_date: '', end_date: '', description: '' })
  const [refForm, setRefForm] = useState({ full_name: '', relationship: '', company: '', phone: '', email: '' })
  const [recForm, setRecForm] = useState({ title: '', granted_by: '', date_granted: '', description: '' })

  useEffect(() => {
    if (!profile) return
    const uid = profile.id
    Promise.all([
      supabase.from('education').select('*').eq('user_id', uid).order('end_date', { ascending: false, nullsFirst: true }),
      supabase.from('work_experience').select('*').eq('user_id', uid).order('end_date', { ascending: false, nullsFirst: true }),
      supabase.from('professional_references').select('*').eq('user_id', uid),
      supabase.from('recognitions').select('*').eq('user_id', uid).order('date_granted', { ascending: false }),
      supabase.from('profile_documents').select('*').eq('user_id', uid).order('uploaded_at', { ascending: false }),
    ]).then(([a, b, c, d, e]) => {
      setEducation((a.data as Education[]) ?? [])
      setExperience((b.data as Experience[]) ?? [])
      setReferences((c.data as Reference[]) ?? [])
      setRecognitions((d.data as Recognition[]) ?? [])
      setDocs((e.data as Doc[]) ?? [])
      setLoading(false)
    })
  }, [profile])

  if (!profile) return null
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando trayectoria…</p>

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none'

  async function add<T extends { id: string }>(table: string, payload: Record<string, unknown>, setter: (fn: (prev: T[]) => T[]) => void, reset: () => void) {
    if (editingItem && editingItem.table === table) {
      const { data, error } = await supabase.from(table).update(payload).eq('id', editingItem.id).select().single()
      if (error) return void toast(error.message, 'error')
      setter((prev) => prev.map((x) => (x.id === editingItem.id ? (data as T) : x)))
      setEditingItem(null)
      reset()
      toast('✓ Actualizado')
      return
    }
    const { data, error } = await supabase.from(table).insert({ ...payload, user_id: profile!.id }).select().single()
    if (error) return void toast(error.message, 'error')
    setter((prev) => [data as T, ...prev])
    reset()
    toast('✓ Guardado')
  }

  const editBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} className="rounded-lg p-1.5 text-slate-400 hover:text-primary" aria-label={`Editar ${label}`}>
      <span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
    </button>
  )

  const saveLabel = (table: string, normal: string) =>
    editingItem?.table === table ? 'Guardar cambios' : normal

  const cancelEdit = (table: string, reset: () => void) =>
    editingItem?.table === table ? (
      <button onClick={() => { setEditingItem(null); reset() }} className="mt-3 ml-2 rounded-xl px-4 py-2 text-sm font-bold text-slate-400 hover:text-highlight">
        Cancelar edición
      </button>
    ) : null

  async function remove<T extends { id: string }>(table: string, id: string, setter: (fn: (prev: T[]) => T[]) => void) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return void toast(error.message, 'error')
    setter((prev) => prev.filter((x) => x.id !== id))
  }

  async function uploadDoc(e: ChangeEvent<HTMLInputElement>, kind: string) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return void toast('Máximo 10 MB', 'warning')
    setUploading(true)
    const path = `${profile!.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('profile-docs').upload(path, file)
    if (upErr) {
      setUploading(false)
      return void toast(`No se pudo subir: ${upErr.message}`, 'error')
    }
    const { data, error } = await supabase
      .from('profile_documents')
      .insert({ user_id: profile!.id, kind, name: file.name, storage_path: path })
      .select().single()
    setUploading(false)
    if (error) return void toast(error.message, 'error')
    setDocs((prev) => [data as Doc, ...prev])
    toast('✓ Documento subido')
    e.target.value = ''
  }

  async function downloadDoc(d: Doc) {
    const { data, error } = await supabase.storage.from('profile-docs').createSignedUrl(d.storage_path, 60)
    if (error || !data) return void toast('No se pudo generar el enlace', 'error')
    window.open(data.signedUrl, '_blank')
  }

  async function removeDoc(d: Doc) {
    await supabase.storage.from('profile-docs').remove([d.storage_path])
    await supabase.from('profile_documents').delete().eq('id', d.id)
    setDocs((prev) => prev.filter((x) => x.id !== d.id))
  }

  function Section({ id, icon, title, count, children }: { id: string; icon: string; title: string; count: number; children: React.ReactNode }) {
    const isOpen = open === id
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen}
          className="flex w-full items-center justify-between p-5 text-left hover:bg-slate-50">
          <span className="flex items-center gap-2 font-extrabold text-slate-900">
            <span className="material-symbols-outlined text-primary" aria-hidden="true">{icon}</span>
            {title}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{count}</span>
          </span>
          <span className="material-symbols-outlined text-slate-400" aria-hidden="true">{isOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        {isOpen && <div className="view-enter border-t border-slate-100 p-5">{children}</div>}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Mi Trayectoria</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Tu perfil profesional — visible para ti, tu línea de liderazgo y Talento Humano
        </p>
      </div>

      <Section id="edu" icon="school" title="Formación académica" count={education.length}>
        <div className="space-y-2">
          {education.map((ed) => (
            <div key={ed.id} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-sm font-bold text-slate-800">{ed.title}</p>
                <p className="text-[11px] text-slate-500">
                  {ed.institution}{ed.location ? ` · ${ed.location}` : ''} · {LEVELS.find(([v]) => v === ed.level)?.[1] ?? ed.level} · {fmtPeriod(ed.start_date, ed.end_date)}
                </p>
                {ed.description && <p className="mt-1 text-[11px] text-slate-600">{ed.description}</p>}
              </div>
              <div className="flex items-center">
                {editBtn(ed.title, () => {
                  setEduForm({ title: ed.title, institution: ed.institution, location: ed.location ?? '', level: ed.level ?? 'pregrado', start_date: ed.start_date ?? '', end_date: ed.end_date ?? '', description: ed.description ?? '' })
                  setEditingItem({ table: 'education', id: ed.id })
                })}
                <button onClick={() => remove('education', ed.id, setEducation)} className="rounded-lg p-1.5 text-slate-400 hover:text-highlight" aria-label={`Eliminar ${ed.title}`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input value={eduForm.title} onChange={(e) => setEduForm({ ...eduForm, title: e.target.value })} className={input} placeholder="Título obtenido *" aria-label="Título" />
          <input value={eduForm.institution} onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })} className={input} placeholder="Institución *" aria-label="Institución" />
          <input value={eduForm.location} onChange={(e) => setEduForm({ ...eduForm, location: e.target.value })} className={input} placeholder="Ciudad / país" aria-label="Lugar" />
          <select value={eduForm.level} onChange={(e) => setEduForm({ ...eduForm, level: e.target.value })} className={input} aria-label="Nivel">
            {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="date" value={eduForm.start_date} onChange={(e) => setEduForm({ ...eduForm, start_date: e.target.value })} className={input} aria-label="Inicio" />
          <input type="date" value={eduForm.end_date} onChange={(e) => setEduForm({ ...eduForm, end_date: e.target.value })} className={input} aria-label="Fin (vacío = en curso)" />
          <textarea rows={2} value={eduForm.description} onChange={(e) => setEduForm({ ...eduForm, description: e.target.value })} className={`${input} sm:col-span-2`} placeholder="Descripción: énfasis, conocimientos adquiridos…" aria-label="Descripción" />
        </div>
        <button
          onClick={() => {
            if (eduForm.title.trim().length < 3 || eduForm.institution.trim().length < 2) return void toast('Título e institución son obligatorios', 'warning')
            add<Education>('education', { ...eduForm, location: eduForm.location || null, start_date: eduForm.start_date || null, end_date: eduForm.end_date || null, description: eduForm.description || null }, setEducation,
              () => setEduForm({ title: '', institution: '', location: '', level: 'pregrado', start_date: '', end_date: '', description: '' }))
          }}
          className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">
          {saveLabel('education', 'Agregar formación')}
        </button>
        {cancelEdit('education', () => setEduForm({ title: '', institution: '', location: '', level: 'pregrado', start_date: '', end_date: '', description: '' }))}
      </Section>

      <Section id="exp" icon="work_history" title="Experiencia laboral" count={experience.length}>
        <div className="space-y-2">
          {experience.map((ex) => (
            <div key={ex.id} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-sm font-bold text-slate-800">{ex.position} · <span className="text-primary">{ex.company}</span></p>
                <p className="text-[11px] text-slate-500">{fmtPeriod(ex.start_date, ex.end_date)}</p>
                {ex.description && <p className="mt-1 text-[11px] text-slate-600">{ex.description}</p>}
              </div>
              <div className="flex items-center">
                {editBtn(`experiencia en ${ex.company}`, () => {
                  setExpForm({ company: ex.company, position: ex.position, start_date: ex.start_date ?? '', end_date: ex.end_date ?? '', description: ex.description ?? '' })
                  setEditingItem({ table: 'work_experience', id: ex.id })
                })}
                <button onClick={() => remove('work_experience', ex.id, setExperience)} className="rounded-lg p-1.5 text-slate-400 hover:text-highlight" aria-label={`Eliminar experiencia en ${ex.company}`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input value={expForm.company} onChange={(e) => setExpForm({ ...expForm, company: e.target.value })} className={input} placeholder="Empresa *" aria-label="Empresa" />
          <input value={expForm.position} onChange={(e) => setExpForm({ ...expForm, position: e.target.value })} className={input} placeholder="Cargo *" aria-label="Cargo" />
          <input type="date" value={expForm.start_date} onChange={(e) => setExpForm({ ...expForm, start_date: e.target.value })} className={input} aria-label="Inicio" />
          <input type="date" value={expForm.end_date} onChange={(e) => setExpForm({ ...expForm, end_date: e.target.value })} className={input} aria-label="Fin (vacío = actual)" />
          <textarea rows={2} value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className={`${input} sm:col-span-2`} placeholder="Responsabilidades y logros…" aria-label="Descripción" />
        </div>
        <button
          onClick={() => {
            if (expForm.company.trim().length < 2 || expForm.position.trim().length < 2) return void toast('Empresa y cargo son obligatorios', 'warning')
            add<Experience>('work_experience', { ...expForm, start_date: expForm.start_date || null, end_date: expForm.end_date || null, description: expForm.description || null }, setExperience,
              () => setExpForm({ company: '', position: '', start_date: '', end_date: '', description: '' }))
          }}
          className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">
          {saveLabel('work_experience', 'Agregar experiencia')}
        </button>
        {cancelEdit('work_experience', () => setExpForm({ company: '', position: '', start_date: '', end_date: '', description: '' }))}
      </Section>

      <Section id="rec" icon="workspace_premium" title="Reconocimientos" count={recognitions.length}>
        <div className="space-y-2">
          {recognitions.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 rounded-xl bg-accent/5 p-4">
              <div>
                <p className="text-sm font-bold text-slate-800">🏆 {r.title}</p>
                <p className="text-[11px] text-slate-500">
                  {r.granted_by ?? ''}{r.date_granted ? ` · ${new Date(r.date_granted + 'T00:00:00').toLocaleDateString('es', { month: 'long', year: 'numeric' })}` : ''}{r.is_internal ? ' · interno' : ''}
                </p>
                {r.description && <p className="mt-1 text-[11px] text-slate-600">{r.description}</p>}
              </div>
              {!r.is_internal && (
                <div className="flex items-center">
                  {editBtn(r.title, () => {
                    setRecForm({ title: r.title, granted_by: r.granted_by ?? '', date_granted: r.date_granted ?? '', description: r.description ?? '' })
                    setEditingItem({ table: 'recognitions', id: r.id })
                  })}
                  <button onClick={() => remove('recognitions', r.id, setRecognitions)} className="rounded-lg p-1.5 text-slate-400 hover:text-highlight" aria-label={`Eliminar ${r.title}`}>
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <input value={recForm.title} onChange={(e) => setRecForm({ ...recForm, title: e.target.value })} className={input} placeholder="Reconocimiento *" aria-label="Título del reconocimiento" />
          <input value={recForm.granted_by} onChange={(e) => setRecForm({ ...recForm, granted_by: e.target.value })} className={input} placeholder="Otorgado por" aria-label="Otorgado por" />
          <input type="date" value={recForm.date_granted} onChange={(e) => setRecForm({ ...recForm, date_granted: e.target.value })} className={input} aria-label="Fecha" />
          <textarea rows={2} value={recForm.description} onChange={(e) => setRecForm({ ...recForm, description: e.target.value })} className={`${input} sm:col-span-3`} placeholder="Descripción…" aria-label="Descripción del reconocimiento" />
        </div>
        <button
          onClick={() => {
            if (recForm.title.trim().length < 3) return void toast('Título requerido', 'warning')
            add<Recognition>('recognitions', { ...recForm, granted_by: recForm.granted_by || null, date_granted: recForm.date_granted || null, description: recForm.description || null, is_internal: false }, setRecognitions,
              () => setRecForm({ title: '', granted_by: '', date_granted: '', description: '' }))
          }}
          className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">
          {saveLabel('recognitions', 'Agregar reconocimiento')}
        </button>
        {cancelEdit('recognitions', () => setRecForm({ title: '', granted_by: '', date_granted: '', description: '' }))}
      </Section>

      <Section id="refs" icon="contact_phone" title="Referencias (solo TH las ve)" count={references.length}>
        <div className="space-y-2">
          {references.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-sm font-bold text-slate-800">{r.full_name}</p>
                <p className="text-[11px] text-slate-500">{[r.relationship, r.company, r.phone, r.email].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex items-center">
                {editBtn(`referencia ${r.full_name}`, () => {
                  setRefForm({ full_name: r.full_name, relationship: r.relationship ?? '', company: r.company ?? '', phone: r.phone ?? '', email: r.email ?? '' })
                  setEditingItem({ table: 'professional_references', id: r.id })
                })}
                <button onClick={() => remove('professional_references', r.id, setReferences)} className="rounded-lg p-1.5 text-slate-400 hover:text-highlight" aria-label={`Eliminar referencia ${r.full_name}`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input value={refForm.full_name} onChange={(e) => setRefForm({ ...refForm, full_name: e.target.value })} className={input} placeholder="Nombre completo *" aria-label="Nombre de la referencia" />
          <input value={refForm.relationship} onChange={(e) => setRefForm({ ...refForm, relationship: e.target.value })} className={input} placeholder="Relación (ej: ex jefe)" aria-label="Relación" />
          <input value={refForm.company} onChange={(e) => setRefForm({ ...refForm, company: e.target.value })} className={input} placeholder="Empresa" aria-label="Empresa de la referencia" />
          <input value={refForm.phone} onChange={(e) => setRefForm({ ...refForm, phone: e.target.value })} className={input} placeholder="Teléfono" aria-label="Teléfono de la referencia" />
        </div>
        <button
          onClick={() => {
            if (refForm.full_name.trim().length < 3) return void toast('Nombre requerido', 'warning')
            add<Reference>('professional_references', { ...refForm, relationship: refForm.relationship || null, company: refForm.company || null, phone: refForm.phone || null, email: refForm.email || null }, setReferences,
              () => setRefForm({ full_name: '', relationship: '', company: '', phone: '', email: '' }))
          }}
          className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">
          {saveLabel('professional_references', 'Agregar referencia')}
        </button>
        {cancelEdit('professional_references', () => setRefForm({ full_name: '', relationship: '', company: '', phone: '', email: '' }))}
      </Section>

      <Section id="docs" icon="folder_shared" title="Hoja de vida y documentos" count={docs.length}>
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
              <button onClick={() => downloadDoc(d)} className="flex min-w-0 items-center gap-2 text-left hover:text-primary">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">
                  {d.kind === 'cv' ? 'description' : 'verified'}
                </span>
                <span className="truncate text-sm font-semibold text-slate-700">{d.name}</span>
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase">{d.kind}</span>
              </button>
              <button onClick={() => removeDoc(d)} className="rounded-lg p-1.5 text-slate-400 hover:text-highlight" aria-label={`Eliminar ${d.name}`}>
                <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className={`flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105 ${uploading ? 'opacity-60' : ''}`}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">upload_file</span>
            {uploading ? 'Subiendo…' : 'Subir HV (PDF)'}
            <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={uploading} onChange={(e) => uploadDoc(e, 'cv')} />
          </label>
          <label className={`flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:border-primary/50 ${uploading ? 'opacity-60' : ''}`}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">verified</span>
            Subir certificado
            <input type="file" accept=".pdf,.jpg,.png" className="hidden" disabled={uploading} onChange={(e) => uploadDoc(e, 'certificado')} />
          </label>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Máx. 10 MB · almacenamiento privado, accesible solo para ti y TH</p>
      </Section>
    </div>
  )
}
