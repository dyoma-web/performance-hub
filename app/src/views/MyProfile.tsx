import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'

interface PersonalInfo {
  document_type: string | null
  document_number: string | null
  birth_date: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  marital_status: string | null
  gender: string | null
  blood_type: string | null
  contract_type: string | null
  eps: string | null
  pension_fund: string | null
  household: string | null
  consent_given_at: string | null
}
interface Dependent {
  id: string
  full_name: string
  relationship: string
  birth_date: string | null
  lives_together: boolean
  is_core_family: boolean
}
interface Pet {
  id: string
  name: string
  species: string
  breed: string | null
  birth_date: string | null
}
interface Celebration {
  id: string
  name: string
  description: string | null
  date_hint: string | null
}
interface CelebPref {
  celebration_id: string
  participates: boolean
  notes: string | null
}
interface EmergencyContact {
  id: string
  full_name: string
  relationship: string
  phone: string
  phone_alt: string | null
}
interface Preferences {
  diet: string | null
  allergies: string | null
  shirt_size: string | null
  hobbies: string | null
  celebrate_birthday: boolean
  notes: string | null
}

const EMPTY_PI: PersonalInfo = {
  document_type: null, document_number: null, birth_date: null, phone: null,
  address: null, city: null, country: 'Colombia', marital_status: null, gender: null,
  blood_type: null, contract_type: null, eps: null, pension_fund: null, household: null,
  consent_given_at: null,
}

const SPECIES: [string, string][] = [
  ['perro', '🐶 Perro'], ['gato', '🐱 Gato'], ['ave', '🐦 Ave'], ['pez', '🐠 Pez'],
  ['roedor', '🐹 Roedor'], ['reptil', '🦎 Reptil'], ['otro', '🐾 Otro'],
]
const EMPTY_PREF: Preferences = { diet: null, allergies: null, shirt_size: null, hobbies: null, celebrate_birthday: true, notes: null }

type Tab = 'datos' | 'familia' | 'preferencias'

function age(birth: string | null): string {
  if (!birth) return ''
  const years = Math.floor((Date.now() - new Date(birth + 'T00:00:00').getTime()) / (365.25 * 86400000))
  return `${years} años`
}

export default function MyProfile() {
  const { profile } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('datos')
  const [pi, setPi] = useState<PersonalInfo>(EMPTY_PI)
  const [deps, setDeps] = useState<Dependent[]>([])
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [pref, setPref] = useState<Preferences>(EMPTY_PREF)
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [depForm, setDepForm] = useState({ full_name: '', relationship: 'hijo', birth_date: '', lives_together: true, is_core_family: true })
  const [ecForm, setEcForm] = useState({ full_name: '', relationship: '', phone: '' })
  const [pets, setPets] = useState<Pet[]>([])
  const [petForm, setPetForm] = useState({ name: '', species: 'perro', breed: '', birth_date: '' })
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const [celebPrefs, setCelebPrefs] = useState<Record<string, CelebPref>>({})
  const [celebNotes, setCelebNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('personal_info').select('*').eq('user_id', profile.id).maybeSingle(),
      supabase.from('dependents').select('*').eq('user_id', profile.id).order('birth_date'),
      supabase.from('emergency_contacts').select('*').eq('user_id', profile.id),
      supabase.from('personal_preferences').select('*').eq('user_id', profile.id).maybeSingle(),
      supabase.from('pets').select('*').eq('user_id', profile.id),
      supabase.from('celebrations').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('celebration_preferences').select('*').eq('user_id', profile.id),
    ]).then(([a, b, c, d, e, f, g]) => {
      if (a.data) {
        setPi(a.data as PersonalInfo)
        setConsent(!!(a.data as PersonalInfo).consent_given_at)
      }
      setDeps((b.data as Dependent[]) ?? [])
      setContacts((c.data as EmergencyContact[]) ?? [])
      if (d.data) setPref(d.data as Preferences)
      setPets((e.data as Pet[]) ?? [])
      setCelebrations((f.data as Celebration[]) ?? [])
      const map: Record<string, CelebPref> = {}
      for (const cp of (g.data as CelebPref[]) ?? []) map[cp.celebration_id] = cp
      setCelebPrefs(map)
      setLoading(false)
    })
  }, [profile])

  const completeness = useMemo(() => {
    const fields = [pi.document_number, pi.birth_date, pi.phone, pi.city, pi.blood_type, pi.contract_type]
    const extra = [contacts.length > 0, pref.diet != null]
    const done = fields.filter(Boolean).length + extra.filter(Boolean).length
    return Math.round((done / (fields.length + extra.length)) * 100)
  }, [pi, contacts, pref])

  if (!profile) return null
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando tu perfil…</p>

  const tenure = profile.hire_date
    ? `${Math.floor((Date.now() - new Date(profile.hire_date + 'T00:00:00').getTime()) / (365.25 * 86400000) * 10) / 10} años en la empresa`
    : null

  async function savePersonal() {
    if (!consent) {
      toast('Debes autorizar el tratamiento de tus datos personales para guardar', 'warning')
      return
    }
    if (pi.document_number?.trim() && !pi.document_type) {
      toast('Selecciona el tipo de documento', 'warning')
      return
    }
    setSaving(true)
    const payload = {
      ...pi,
      user_id: profile!.id,
      consent_given_at: pi.consent_given_at ?? new Date().toISOString(),
    }
    const { data, error } = await supabase.from('personal_info').upsert(payload).select().single()
    setSaving(false)
    if (error) {
      if (error.code === '23505' || error.message.includes('personal_info_document_unique')) {
        toast('Ese número de documento ya está registrado por otra persona — verifica el número o contacta a Talento Humano', 'error')
      } else {
        toast(error.message, 'error')
      }
      return
    }
    setPi(data as PersonalInfo)
    toast('✓ Datos personales guardados — solo tú y Talento Humano pueden verlos')
  }

  async function savePreferences() {
    setSaving(true)
    const { data, error } = await supabase
      .from('personal_preferences')
      .upsert({ ...pref, user_id: profile!.id })
      .select().single()
    setSaving(false)
    if (error) return void toast(error.message, 'error')
    setPref(data as Preferences)
    toast('✓ Preferencias guardadas')
  }

  async function addDependent() {
    if (depForm.full_name.trim().length < 3) return void toast('Nombre requerido', 'warning')
    const { data, error } = await supabase
      .from('dependents')
      .insert({ ...depForm, birth_date: depForm.birth_date || null, user_id: profile!.id })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setDeps((prev) => [...prev, data as Dependent])
    setDepForm({ full_name: '', relationship: 'hijo', birth_date: '', lives_together: true, is_core_family: true })
  }

  async function removeDependent(id: string) {
    await supabase.from('dependents').delete().eq('id', id)
    setDeps((prev) => prev.filter((d) => d.id !== id))
  }

  async function addContact() {
    if (ecForm.full_name.trim().length < 3 || ecForm.phone.trim().length < 7) {
      return void toast('Nombre y teléfono requeridos', 'warning')
    }
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({ ...ecForm, user_id: profile!.id })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setContacts((prev) => [...prev, data as EmergencyContact])
    setEcForm({ full_name: '', relationship: '', phone: '' })
  }

  async function removeContact(id: string) {
    await supabase.from('emergency_contacts').delete().eq('id', id)
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  async function addPet() {
    if (petForm.name.trim().length < 2) return void toast('Nombre de la mascota requerido', 'warning')
    const { data, error } = await supabase
      .from('pets')
      .insert({ ...petForm, breed: petForm.breed.trim() || null, birth_date: petForm.birth_date || null, user_id: profile!.id })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setPets((prev) => [...prev, data as Pet])
    setPetForm({ name: '', species: 'perro', breed: '', birth_date: '' })
  }

  async function removePet(id: string) {
    await supabase.from('pets').delete().eq('id', id)
    setPets((prev) => prev.filter((p) => p.id !== id))
  }

  async function setCelebration(celebrationId: string, participates: boolean) {
    const notes = celebNotes[celebrationId]?.trim() || celebPrefs[celebrationId]?.notes || null
    const { data, error } = await supabase
      .from('celebration_preferences')
      .upsert({ user_id: profile!.id, celebration_id: celebrationId, participates, notes }, { onConflict: 'user_id,celebration_id' })
      .select().single()
    if (error) return void toast(error.message, 'error')
    setCelebPrefs((prev) => ({ ...prev, [celebrationId]: data as CelebPref }))
  }

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none'
  const lbl = 'mb-1 block text-xs font-bold text-slate-600'
  const field = (label: string, el: React.ReactNode) => (
    <div>
      <span className={lbl}>{label}</span>
      {el}
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar profile={profile} size="h-16 w-16" />
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{profile.name}</h2>
            <p className="text-sm text-slate-500">{profile.position ?? '—'}</p>
            {tenure && <p className="text-[11px] font-bold text-primary">{tenure}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-extrabold text-primary">{completeness}%</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">perfil completo</p>
          </div>
          <Link
            to="/cambiar-contrasena"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary/50"
            title="Cambiar mi contraseña"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">key</span>
            Contraseña
          </Link>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[11px] leading-relaxed text-slate-500">
        <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">lock</span>
        Estos datos son <strong>privados</strong>: solo tú y Talento Humano pueden verlos. Ni tu líder ni tus
        compañeros tienen acceso. Su uso se limita a gestión humana, bienestar y emergencias (Ley 1581 de 2012).
      </p>

      <div role="tablist" className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5">
        {([['datos', 'Identificación', 'badge'], ['familia', 'Familia y emergencia', 'family_restroom'], ['preferencias', 'Preferencias', 'favorite']] as [Tab, string, string][]).map(([k, label, icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${tab === k ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'datos' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field('Tipo de documento', (
              <select value={pi.document_type ?? ''} onChange={(e) => setPi({ ...pi, document_type: e.target.value || null })} className={input} aria-label="Tipo de documento">
                <option value="">Seleccionar…</option>
                {['CC', 'CE', 'TI', 'PAS', 'PEP', 'NIT', 'OTRO'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ))}
            {field('Número de documento', <input value={pi.document_number ?? ''} onChange={(e) => setPi({ ...pi, document_number: e.target.value || null })} className={input} aria-label="Número de documento" />)}
            {field(`Fecha de nacimiento ${pi.birth_date ? `(${age(pi.birth_date)})` : ''}`, <input type="date" value={pi.birth_date ?? ''} onChange={(e) => setPi({ ...pi, birth_date: e.target.value || null })} className={input} aria-label="Fecha de nacimiento" />)}
            {field('Teléfono', <input value={pi.phone ?? ''} onChange={(e) => setPi({ ...pi, phone: e.target.value || null })} className={input} aria-label="Teléfono" placeholder="+57 …" />)}
            {field('Ciudad', <input value={pi.city ?? ''} onChange={(e) => setPi({ ...pi, city: e.target.value || null })} className={input} aria-label="Ciudad" />)}
            {field('Dirección', <input value={pi.address ?? ''} onChange={(e) => setPi({ ...pi, address: e.target.value || null })} className={input} aria-label="Dirección" />)}
            {field('Estado civil', (
              <select value={pi.marital_status ?? ''} onChange={(e) => setPi({ ...pi, marital_status: e.target.value || null })} className={input} aria-label="Estado civil">
                <option value="">Seleccionar…</option>
                {[['soltero', 'Soltero/a'], ['casado', 'Casado/a'], ['union-libre', 'Unión libre'], ['separado', 'Separado/a'], ['viudo', 'Viudo/a'], ['otro', 'Otro']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            {field('¿Con quién vives?', (
              <select value={pi.household ?? ''} onChange={(e) => setPi({ ...pi, household: e.target.value || null })} className={input} aria-label="Con quién vives">
                <option value="">Seleccionar…</option>
                {[['solo', 'Vivo solo/a'], ['pareja', 'Con mi pareja'], ['familia', 'Con mi familia'], ['compartido', 'Vivienda compartida'], ['otro', 'Otro']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            {field('Tipo de sangre', (
              <select value={pi.blood_type ?? ''} onChange={(e) => setPi({ ...pi, blood_type: e.target.value || null })} className={input} aria-label="Tipo de sangre">
                <option value="">Seleccionar…</option>
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ))}
            {field('Tipo de vinculación', (
              <select value={pi.contract_type ?? ''} onChange={(e) => setPi({ ...pi, contract_type: e.target.value || null })} className={input} aria-label="Tipo de vinculación">
                <option value="">Seleccionar…</option>
                {[['indefinido', 'Término indefinido'], ['fijo', 'Término fijo'], ['prestacion-servicios', 'Prestación de servicios'], ['aprendizaje', 'Aprendizaje'], ['practicas', 'Prácticas'], ['otro', 'Otro']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            {field('EPS', <input value={pi.eps ?? ''} onChange={(e) => setPi({ ...pi, eps: e.target.value || null })} className={input} aria-label="EPS" />)}
            {field('Fondo de pensiones', <input value={pi.pension_fund ?? ''} onChange={(e) => setPi({ ...pi, pension_fund: e.target.value || null })} className={input} aria-label="Fondo de pensiones" />)}
            {field('Género (opcional)', <input value={pi.gender ?? ''} onChange={(e) => setPi({ ...pi, gender: e.target.value || null })} className={input} aria-label="Género" />)}
          </div>

          {!pi.consent_given_at && (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-slate-600">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 rounded accent-[#16b79c]" />
              <span>
                <strong>Autorizo el tratamiento de mis datos personales</strong> conforme a la política de
                tratamiento de datos de la organización y la Ley 1581 de 2012. Puedo solicitar su corrección o
                eliminación en cualquier momento ante Talento Humano.
              </span>
            </label>
          )}

          <button onClick={savePersonal} disabled={saving}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar datos personales'}
          </button>
        </div>
      )}

      {tab === 'familia' && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 font-extrabold text-slate-900">Mi familia</h3>
            <p className="mb-4 text-xs text-slate-500">
              Tu <strong>núcleo cercano</strong> no tiene que convivir contigo: puedes registrar a tus padres aunque
              vivas solo/a. Marca quién convive y quién pertenece a tu núcleo — así ninguna decisión se toma por suposición.
            </p>
            {deps.map((d) => (
              <div key={d.id} className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{d.full_name}</p>
                  <p className="text-[11px] text-slate-500">
                    {d.relationship}{d.birth_date ? ` · ${age(d.birth_date)}` : ''}
                    {d.is_core_family && <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">núcleo cercano</span>}
                    {d.lives_together && <span className="ml-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-yellow-700 uppercase">convive</span>}
                  </p>
                </div>
                <button onClick={() => removeDependent(d.id)} className="rounded-lg p-2 text-slate-400 hover:text-highlight" aria-label={`Eliminar ${d.full_name}`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                </button>
              </div>
            ))}
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_145px_auto_auto_auto]">
              <input value={depForm.full_name} onChange={(e) => setDepForm({ ...depForm, full_name: e.target.value })} className={input} placeholder="Nombre completo" aria-label="Nombre del familiar" />
              <select value={depForm.relationship} onChange={(e) => setDepForm({ ...depForm, relationship: e.target.value })} className={input} aria-label="Parentesco">
                {['hijo', 'hija', 'pareja', 'padre', 'madre', 'hermano', 'otro'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="date" value={depForm.birth_date} onChange={(e) => setDepForm({ ...depForm, birth_date: e.target.value })} className={input} aria-label="Fecha de nacimiento del familiar" />
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <input type="checkbox" checked={depForm.is_core_family} onChange={(e) => setDepForm({ ...depForm, is_core_family: e.target.checked })} className="rounded accent-[#16b79c]" />
                Núcleo
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <input type="checkbox" checked={depForm.lives_together} onChange={(e) => setDepForm({ ...depForm, lives_together: e.target.checked })} className="rounded accent-[#16b79c]" />
                Convive
              </label>
              <button onClick={addDependent} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">Agregar</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 font-extrabold text-slate-900">Mascotas 🐾</h3>
            <p className="mb-4 text-xs text-slate-500">También son familia — cuentan para bienestar y celebraciones</p>
            {pets.map((p) => (
              <div key={p.id} className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {SPECIES.find(([v]) => v === p.species)?.[1].split(' ')[0]} {p.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {SPECIES.find(([v]) => v === p.species)?.[1].split(' ')[1]}
                    {p.breed ? ` · ${p.breed}` : ''}{p.birth_date ? ` · ${age(p.birth_date)}` : ''}
                  </p>
                </div>
                <button onClick={() => removePet(p.id)} className="rounded-lg p-2 text-slate-400 hover:text-highlight" aria-label={`Eliminar ${p.name}`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                </button>
              </div>
            ))}
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_1fr_145px_auto]">
              <input value={petForm.name} onChange={(e) => setPetForm({ ...petForm, name: e.target.value })} className={input} placeholder="Nombre" aria-label="Nombre de la mascota" />
              <select value={petForm.species} onChange={(e) => setPetForm({ ...petForm, species: e.target.value })} className={input} aria-label="Especie">
                {SPECIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input value={petForm.breed} onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })} className={input} placeholder="Raza (opcional)" aria-label="Raza" />
              <input type="date" value={petForm.birth_date} onChange={(e) => setPetForm({ ...petForm, birth_date: e.target.value })} className={input} aria-label="Fecha de nacimiento de la mascota" />
              <button onClick={addPet} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">Agregar</button>
            </div>
          </div>

          <div className="rounded-2xl border border-highlight/20 bg-white p-6 shadow-sm">
            <h3 className="mb-1 font-extrabold text-slate-900">Contactos de emergencia</h3>
            <p className="mb-4 text-xs text-slate-500">A quién llamamos si te pasa algo — mantenlo actualizado</p>
            {contacts.map((c) => (
              <div key={c.id} className="mb-2 flex items-center justify-between rounded-xl bg-highlight/5 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{c.full_name} <span className="font-normal text-slate-500">({c.relationship})</span></p>
                  <p className="text-[11px] font-bold text-highlight">{c.phone}{c.phone_alt ? ` · ${c.phone_alt}` : ''}</p>
                </div>
                <button onClick={() => removeContact(c.id)} className="rounded-lg p-2 text-slate-400 hover:text-highlight" aria-label={`Eliminar ${c.full_name}`}>
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                </button>
              </div>
            ))}
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_160px_auto]">
              <input value={ecForm.full_name} onChange={(e) => setEcForm({ ...ecForm, full_name: e.target.value })} className={input} placeholder="Nombre completo" aria-label="Nombre del contacto" />
              <input value={ecForm.relationship} onChange={(e) => setEcForm({ ...ecForm, relationship: e.target.value })} className={input} placeholder="Parentesco" aria-label="Parentesco del contacto" />
              <input value={ecForm.phone} onChange={(e) => setEcForm({ ...ecForm, phone: e.target.value })} className={input} placeholder="Teléfono" aria-label="Teléfono del contacto" />
              <button onClick={addContact} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-105">Agregar</button>
            </div>
          </div>
        </>
      )}

      {tab === 'preferencias' && (
        <>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 font-extrabold text-slate-900">Celebraciones</h3>
          <p className="mb-4 text-xs text-slate-500">
            Cada quien celebra lo que quiere — tu respuesta evita suposiciones (no participar nunca te excluye
            de otras actividades). Esta información es visible solo para ti y Talento Humano.
          </p>
          <div className="space-y-2">
            {celebrations.map((c) => {
              const cp = celebPrefs[c.id]
              return (
                <div key={c.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">{c.name} {c.date_hint && <span className="text-[10px] font-semibold text-slate-400">({c.date_hint})</span>}</p>
                      {c.description && <p className="text-[11px] text-slate-500">{c.description}</p>}
                    </div>
                    <div className="flex gap-1.5" role="radiogroup" aria-label={`¿Celebras ${c.name}?`}>
                      <button
                        role="radio" aria-checked={cp?.participates === true}
                        onClick={() => setCelebration(c.id, true)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${cp?.participates === true ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-primary/50'}`}
                      >
                        Lo celebro
                      </button>
                      <button
                        role="radio" aria-checked={cp?.participates === false}
                        onClick={() => setCelebration(c.id, false)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${cp?.participates === false ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-slate-400'}`}
                      >
                        No lo celebro
                      </button>
                      {!cp && <span className="self-center text-[10px] font-bold text-slate-300 uppercase">sin responder</span>}
                    </div>
                  </div>
                  <input
                    value={celebNotes[c.id] ?? cp?.notes ?? ''}
                    onChange={(e) => setCelebNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    onBlur={() => { if (cp) setCelebration(c.id, cp.participates) }}
                    aria-label={`Nota sobre ${c.name}`}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] focus:border-primary focus:outline-none"
                    placeholder="Nota opcional (ej: mis hijos tampoco lo celebran / solo participo en lo no religioso)…"
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 font-extrabold text-slate-900">Preferencias personales</h3>
          <p className="mb-4 text-xs text-slate-500">Para eventos, celebraciones y bienestar</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('Alimentación', (
              <select value={pref.diet ?? ''} onChange={(e) => setPref({ ...pref, diet: e.target.value || null })} className={input} aria-label="Tipo de alimentación">
                <option value="">Seleccionar…</option>
                {[['omnivoro', 'Omnívoro'], ['vegetariano', 'Vegetariano'], ['vegano', 'Vegano'], ['pescetariano', 'Pescetariano'], ['sin-gluten', 'Sin gluten'], ['kosher', 'Kosher'], ['halal', 'Halal'], ['otro', 'Otro']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            {field('Talla de camiseta', (
              <select value={pref.shirt_size ?? ''} onChange={(e) => setPref({ ...pref, shirt_size: e.target.value || null })} className={input} aria-label="Talla">
                <option value="">Seleccionar…</option>
                {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ))}
            {field('Alergias o restricciones', <input value={pref.allergies ?? ''} onChange={(e) => setPref({ ...pref, allergies: e.target.value || null })} className={input} aria-label="Alergias" placeholder="Ej: maní, lactosa…" />)}
            {field('Hobbies e intereses', <input value={pref.hobbies ?? ''} onChange={(e) => setPref({ ...pref, hobbies: e.target.value || null })} className={input} aria-label="Hobbies" placeholder="Ej: ilustración, senderismo…" />)}
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={pref.celebrate_birthday} onChange={(e) => setPref({ ...pref, celebrate_birthday: e.target.checked })} className="rounded accent-[#16b79c]" />
            Me gusta que celebren mi cumpleaños
          </label>
          <div className="mt-4">
            {field('Notas adicionales', <textarea rows={2} value={pref.notes ?? ''} onChange={(e) => setPref({ ...pref, notes: e.target.value || null })} className={input} aria-label="Notas" />)}
          </div>
          <button onClick={savePreferences} disabled={saving}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar preferencias'}
          </button>
        </div>
        </>
      )}
    </div>
  )
}
