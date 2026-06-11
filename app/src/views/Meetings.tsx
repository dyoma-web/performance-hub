import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import type { Cycle, Profile } from '../types'

interface Meeting {
  id: string
  cycle_id: string
  evaluatee_id: string
  facilitator_id: string
  scheduled_at: string | null
  duration_min: number
  status: 'scheduled' | 'done' | 'cancelled'
  notes: string | null
}

interface Agreement {
  id: string
  meeting_id: string
  description: string
  due_date: string | null
  signed_by_collaborator_at: string | null
  signed_by_facilitator_at: string | null
}

const PHASES = [
  { min: '0–5 min', title: 'Apertura', tip: 'Agradece la preparación. Pregunta cómo se siente con el ciclo.' },
  { min: '5–20 min', title: 'Conversación', tip: 'Revisen juntos las divergencias y los patrones del feedback. Escucha más de lo que hablas.' },
  { min: '20–35 min', title: 'Acuerdos', tip: 'Conviertan el feedback en 2–3 acciones concretas con fecha.' },
  { min: '35–45 min', title: 'Cierre', tip: 'Ambos confirman los acuerdos. Termina con el reconocimiento.' },
]

export default function Meetings() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()
  const isFacilitator = profile?.role === 'facilitador'

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [people, setPeople] = useState<Profile[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [notes, setNotes] = useState('')
  const [newAgreement, setNewAgreement] = useState({ description: '', due_date: '' })
  const [scheduling, setScheduling] = useState<string | null>(null)
  const [when, setWhen] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile || !cycle) return
    async function load() {
      const meetQ = isFacilitator
        ? supabase.from('meetings').select('*').eq('cycle_id', cycle!.id).eq('facilitator_id', profile!.id)
        : supabase.from('meetings').select('*').eq('cycle_id', cycle!.id).eq('evaluatee_id', profile!.id)
      const [{ data: meets }, { data: ppl }] = await Promise.all([
        meetQ.order('scheduled_at'),
        isFacilitator
          ? supabase.from('profiles').select('*').eq('team_id', profile!.team_id!).neq('id', profile!.id).eq('is_active', true).order('name')
          : supabase.from('profiles').select('*').eq('role', 'facilitador').eq('team_id', profile!.team_id!),
      ])
      setMeetings((meets as Meeting[]) ?? [])
      setPeople((ppl as Profile[]) ?? [])
      setLoading(false)
    }
    load()
  }, [profile, cycle, isFacilitator])

  if (!profile || !cycle) return null

  const person = (id: string) => people.find((p) => p.id === id)

  async function openMeeting(m: Meeting) {
    setOpen(m.id)
    setNotes(m.notes ?? '')
    const { data } = await supabase.from('agreements').select('*').eq('meeting_id', m.id).order('created_at')
    setAgreements((data as Agreement[]) ?? [])
  }

  async function schedule(evaluateeId: string) {
    if (!when) {
      toast('Selecciona fecha y hora', 'warning')
      return
    }
    const { data, error } = await supabase
      .from('meetings')
      .insert({ cycle_id: cycle!.id, evaluatee_id: evaluateeId, facilitator_id: profile!.id, scheduled_at: new Date(when).toISOString(), status: 'scheduled' })
      .select().single()
    if (error) {
      toast(`No se pudo programar: ${error.message}`, 'error')
      return
    }
    await supabase.from('notifications').insert({
      user_id: evaluateeId, type: 'meeting',
      title: 'Reunión 1:1 programada',
      body: `${profile!.name} programó tu conversación de cierre del ciclo ${cycle!.name}.`,
      link: '/reuniones',
    })
    setMeetings((prev) => [...prev, data as Meeting])
    setScheduling(null)
    setWhen('')
    toast('✓ Reunión programada y notificada')
  }

  async function importFeedforward(m: Meeting) {
    const { data: rev } = await supabase
      .from('reviews').select('id')
      .eq('cycle_id', cycle!.id).eq('evaluatee_id', m.evaluatee_id).eq('type', 'facilitator')
      .maybeSingle()
    if (!rev) {
      toast('Aún no hay evaluación del facilitador con feedforward', 'warning')
      return
    }
    const { data: ff } = await supabase.from('feedforward_items').select('*').eq('review_id', rev.id)
    if (!ff || ff.length === 0) {
      toast('La evaluación no tiene acciones feedforward', 'warning')
      return
    }
    const rows = ff
      .filter((f) => !agreements.some((a) => a.description === f.action))
      .map((f) => ({ meeting_id: m.id, description: f.action, due_date: f.due_date }))
    if (rows.length === 0) {
      toast('Ya están importadas', 'warning')
      return
    }
    const { data: created, error } = await supabase.from('agreements').insert(rows).select()
    if (error) {
      toast(error.message, 'error')
      return
    }
    setAgreements((prev) => [...prev, ...(created as Agreement[])])
    toast(`${rows.length} acuerdo(s) importados del feedforward`)
  }

  async function addAgreement(m: Meeting) {
    if (newAgreement.description.trim().length < 10) {
      toast('Describe el acuerdo (mínimo 10 caracteres)', 'warning')
      return
    }
    const { data, error } = await supabase
      .from('agreements')
      .insert({ meeting_id: m.id, description: newAgreement.description.trim(), due_date: newAgreement.due_date || null })
      .select().single()
    if (error) {
      toast(error.message, 'error')
      return
    }
    setAgreements((prev) => [...prev, data as Agreement])
    setNewAgreement({ description: '', due_date: '' })
  }

  async function saveNotes(m: Meeting) {
    setSaving(true)
    const { error } = await supabase.from('meetings').update({ notes: notes.trim() || null }).eq('id', m.id)
    setSaving(false)
    if (error) toast(error.message, 'error')
    else {
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, notes } : x)))
      toast('Notas guardadas')
    }
  }

  async function sign(m: Meeting) {
    const col = isFacilitator ? 'signed_by_facilitator_at' : 'signed_by_collaborator_at'
    const now = new Date().toISOString()
    const { error } = await supabase.from('agreements').update({ [col]: now }).eq('meeting_id', m.id).is(col, null)
    if (error) {
      toast(error.message, 'error')
      return
    }
    setAgreements((prev) => prev.map((a) => ({ ...a, [col]: a[col as keyof Agreement] ?? now })))
    toast('✓ Acuerdos firmados')
  }

  async function finalize(m: Meeting) {
    const unsigned = agreements.some((a) => !a.signed_by_collaborator_at || !a.signed_by_facilitator_at)
    if (agreements.length > 0 && unsigned) {
      toast('Ambas partes deben firmar los acuerdos antes de finalizar', 'warning')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('meetings').update({ status: 'done', notes: notes.trim() || null }).eq('id', m.id)
      if (error) throw new Error(error.message)
      if (agreements.length > 0) {
        const { error: pErr } = await supabase.from('plan_actions').insert(
          agreements.map((a) => ({
            cycle_id: cycle!.id, user_id: m.evaluatee_id,
            action: a.description, indicator: 'Acordado en la reunión 1:1',
            due_date: a.due_date, responsible_id: m.evaluatee_id, status: 'pending',
          }))
        )
        if (pErr) throw new Error(pErr.message)
      }
      await supabase.from('notifications').insert({
        user_id: m.evaluatee_id, type: 'meeting-done',
        title: 'Ciclo conversado — plan actualizado',
        body: `Los acuerdos de tu 1:1 ya están en tu plan de desarrollo.`,
        link: '/mi-desarrollo',
      })
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: 'done' } : x)))
      toast('✓ Reunión finalizada — acuerdos convertidos en plan de desarrollo')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const withoutMeeting = isFacilitator
    ? people.filter((p) => !meetings.some((m) => m.evaluatee_id === p.id && m.status !== 'cancelled'))
    : []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Reuniones 1:1</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          La conversación es el corazón del ciclo — el formulario es solo el insumo
        </p>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
      ) : (
        <>
          {/* Programar (facilitador) */}
          {withoutMeeting.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Sin reunión programada</h3>
              <div className="space-y-2">
                {withoutMeeting.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      <Avatar profile={p} size="h-8 w-8" />
                      <span className="text-sm font-semibold">{p.name}</span>
                    </div>
                    {scheduling === p.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                          aria-label={`Fecha y hora para ${p.name}`}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                        />
                        <button onClick={() => schedule(p.id)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">
                          Confirmar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setScheduling(p.id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-primary/50"
                      >
                        Programar 1:1
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {meetings.length === 0 && withoutMeeting.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden="true">handshake</span>
              <p className="mt-3 text-sm font-bold text-slate-600">No hay reuniones programadas</p>
              <p className="mt-1 text-xs text-slate-400">
                {isFacilitator ? 'Programa el 1:1 cuando la evaluación esté lista.' : 'Tu facilitador programará la conversación de cierre del ciclo.'}
              </p>
            </div>
          )}

          {/* Lista de reuniones */}
          {meetings.map((m) => {
            const other = isFacilitator ? person(m.evaluatee_id) : person(m.facilitator_id)
            const isOpen = open === m.id
            const allSignedByMe = agreements.length > 0 && agreements.every((a) => (isFacilitator ? a.signed_by_facilitator_at : a.signed_by_collaborator_at))
            return (
              <div key={m.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  onClick={() => (isOpen ? setOpen(null) : openMeeting(m))}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    {other && <Avatar profile={other} />}
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        1:1 {isFacilitator ? `con ${other?.name ?? '…'}` : `con ${other?.name ?? 'tu facilitador'}`}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {m.scheduled_at
                          ? new Date(m.scheduled_at).toLocaleString('es', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                          : 'Sin fecha'}{' '}
                        · {m.duration_min} min
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${m.status === 'done' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-yellow-700'}`}>
                    {m.status === 'done' ? 'Finalizada' : 'Programada'}
                  </span>
                </button>

                {isOpen && (
                  <div className="view-enter space-y-5 border-t border-slate-100 p-5">
                    {/* Guía de conversación */}
                    {m.status !== 'done' && (
                      <div className="grid gap-2 sm:grid-cols-4">
                        {PHASES.map((ph) => (
                          <div key={ph.title} className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[10px] font-extrabold tracking-wider text-primary uppercase">{ph.min}</p>
                            <p className="mt-0.5 text-xs font-bold">{ph.title}</p>
                            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{ph.tip}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Acuerdos */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900">Acuerdos ({agreements.length})</h4>
                        {isFacilitator && m.status !== 'done' && (
                          <button onClick={() => importFeedforward(m)} className="text-xs font-bold text-primary hover:underline">
                            Importar feedforward de la evaluación
                          </button>
                        )}
                      </div>
                      {agreements.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                          Sin acuerdos aún
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {agreements.map((a) => (
                            <li key={a.id} className="rounded-xl bg-slate-50 p-3">
                              <p className="text-sm font-semibold text-slate-700">{a.description}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                                {a.due_date && (
                                  <span className="text-slate-400">
                                    📅 {new Date(a.due_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                                <span className={a.signed_by_collaborator_at ? 'text-primary' : 'text-slate-300'}>
                                  {a.signed_by_collaborator_at ? '✓' : '○'} Colaborador
                                </span>
                                <span className={a.signed_by_facilitator_at ? 'text-primary' : 'text-slate-300'}>
                                  {a.signed_by_facilitator_at ? '✓' : '○'} Facilitador
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {isFacilitator && m.status !== 'done' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <input
                            value={newAgreement.description}
                            onChange={(e) => setNewAgreement({ ...newAgreement, description: e.target.value })}
                            aria-label="Nuevo acuerdo"
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                            placeholder="Nuevo acuerdo (acción concreta)…"
                          />
                          <input
                            type="date" value={newAgreement.due_date}
                            onChange={(e) => setNewAgreement({ ...newAgreement, due_date: e.target.value })}
                            aria-label="Fecha del acuerdo"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                          />
                          <button onClick={() => addAgreement(m)} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white">
                            Agregar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Notas */}
                    <div>
                      <h4 className="mb-2 text-sm font-bold text-slate-900">Notas de la conversación</h4>
                      <textarea
                        rows={3} value={notes} disabled={m.status === 'done'}
                        onChange={(e) => setNotes(e.target.value)}
                        aria-label="Notas de la reunión"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:bg-slate-50"
                        placeholder="Visibles solo para ambos participantes…"
                      />
                      {m.status !== 'done' && (
                        <button
                          onClick={() => saveNotes(m)} disabled={saving}
                          className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-primary/50"
                        >
                          Guardar notas
                        </button>
                      )}
                    </div>

                    {/* Firma y cierre */}
                    {m.status !== 'done' && agreements.length > 0 && (
                      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <button
                          onClick={() => sign(m)} disabled={allSignedByMe}
                          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 hover:brightness-105 disabled:opacity-50"
                        >
                          {allSignedByMe ? '✓ Ya firmaste' : 'Acepto estos acuerdos'}
                        </button>
                        <p className="text-[11px] text-slate-500">
                          Tu firma confirma que los acuerdos se construyeron en conversación.
                        </p>
                      </div>
                    )}
                    {isFacilitator && m.status !== 'done' && (
                      <button
                        onClick={() => finalize(m)} disabled={saving}
                        className="w-full rounded-xl border-2 border-primary py-2.5 text-sm font-bold text-primary hover:bg-primary hover:text-white disabled:opacity-60"
                      >
                        Finalizar reunión y crear plan de desarrollo
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
