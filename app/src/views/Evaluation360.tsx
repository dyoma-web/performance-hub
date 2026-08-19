import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import ScaleSelector from '../components/ScaleSelector'
import Avatar from '../components/Avatar'
import { competenciesForAssignment, kindLabel, reviewTypeFor } from '../lib/eval360'
import type {
  Competency,
  CompetencyType,
  EvaluationAssignment,
  Profile,
  Review,
  RoleFamily,
  WellbeingQuestion,
} from '../types'

interface ItemState {
  score: number | null
  comment: string
  links: string
}

const parseLinks = (s: string) => s.split(/[,\n]/).map((l) => l.trim()).filter(Boolean)

const TYPE_LABEL: Record<CompetencyType, string> = {
  organizacional: 'Competencias organizacionales (transversales)',
  familia: 'Competencias de la familia de rol',
  liderazgo: 'Competencias de liderazgo',
}

export default function Evaluation360() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [assignment, setAssignment] = useState<EvaluationAssignment | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [evaluatee, setEvaluatee] = useState<Profile | null>(null)
  const [people, setPeople] = useState<Profile[]>([])
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [families, setFamilies] = useState<RoleFamily[]>([])
  const [wellbeing, setWellbeing] = useState<WellbeingQuestion[]>([])
  const [wellbeingAnswers, setWellbeingAnswers] = useState<Record<string, string>>({})
  const [items, setItems] = useState<Record<string, ItemState>>({})
  const [extra, setExtra] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id || !profile) return
    let cancelled = false
    ;(async () => {
      const { data: a } = await supabase.from('evaluation_assignments').select('*').eq('id', id).maybeSingle()
      if (cancelled) return
      if (!a) {
        setLoading(false)
        return
      }
      const asg = a as EvaluationAssignment
      setAssignment(asg)

      const [ev, pp, comps, fams] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', asg.evaluatee_id).single(),
        supabase.from('profiles').select('*'),
        supabase.from('competencies').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('role_families').select('*'),
      ])
      if (cancelled) return
      setEvaluatee(ev.data as Profile)
      setPeople((pp.data as Profile[]) ?? [])
      setCompetencies((comps.data as Competency[]) ?? [])
      setFamilies((fams.data as RoleFamily[]) ?? [])

      // Dimensión humana solo en la autoevaluación
      if (asg.kind === 'auto') {
        const [wq, wa] = await Promise.all([
          supabase.from('wellbeing_questions').select('*').eq('is_active', true).order('sort_order'),
          // user_id = evaluatee: permite que admin/TH vean las respuestas al revisar
          supabase.from('wellbeing_answers').select('*').eq('cycle_id', asg.cycle_id).eq('user_id', asg.evaluatee_id),
        ])
        if (cancelled) return
        setWellbeing((wq.data as WellbeingQuestion[]) ?? [])
        const map: Record<string, string> = {}
        for (const row of (wa.data as { question_code: string; answer: string }[]) ?? []) {
          map[row.question_code] = row.answer
        }
        setWellbeingAnswers(map)
      }

      // Review asociada: reutiliza la existente o crea una en borrador
      const type = reviewTypeFor(asg.kind)
      let rev: Review | null = null
      const { data: existing } = await supabase
        .from('reviews')
        .select('*')
        .eq('cycle_id', asg.cycle_id)
        .eq('evaluatee_id', asg.evaluatee_id)
        .eq('reviewer_id', profile.id)
        .eq('type', type)
        .maybeSingle()
      if (existing) {
        rev = existing as Review
      } else if (asg.evaluator_id === profile.id && asg.status !== 'enviada') {
        const { data: created, error } = await supabase
          .from('reviews')
          .insert({ cycle_id: asg.cycle_id, evaluatee_id: asg.evaluatee_id, reviewer_id: profile.id, type, status: 'draft' })
          .select()
          .single()
        if (error) {
          toast(`No se pudo iniciar la evaluación: ${error.message}`, 'error')
        } else {
          rev = created as Review
        }
      }
      if (cancelled) return
      setReview(rev)

      if (rev) {
        if (asg.review_id !== rev.id || asg.status === 'pendiente') {
          const newStatus = asg.status === 'enviada' ? asg.status : 'en-curso'
          await supabase.from('evaluation_assignments').update({ review_id: rev.id, status: newStatus }).eq('id', asg.id)
          setAssignment({ ...asg, review_id: rev.id, status: newStatus })
        }
        const { data: rItems } = await supabase.from('review_items').select('*').eq('review_id', rev.id)
        if (cancelled) return
        const map: Record<string, ItemState> = {}
        for (const it of rItems ?? []) {
          if (it.block === 'contribution' && it.item_ref === 'adicional') {
            setExtra(it.comment ?? '')
          } else if (it.block === 'skills') {
            map[it.item_ref] = { score: it.score, comment: it.comment ?? '', links: (it.evidence_links ?? []).join(', ') }
          }
        }
        setItems(map)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, profile, toast])

  const scoped = useMemo(() => {
    if (!assignment || !evaluatee) return []
    return competenciesForAssignment(assignment, evaluatee, competencies, people)
  }, [assignment, evaluatee, competencies, people])

  const sections = useMemo(() => {
    const order: CompetencyType[] = ['organizacional', 'familia', 'liderazgo']
    return order
      .map((t) => ({ type: t, comps: scoped.filter((c) => c.comp_type === t) }))
      .filter((s) => s.comps.length > 0)
  }, [scoped])

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
  if (!assignment || !evaluatee || !profile) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-slate-400">No se encontró la asignación (o no tienes acceso a ella).</p>
        <Link to="/mis-evaluaciones" className="mt-3 inline-block text-sm font-bold text-primary">← Volver a mis evaluaciones</Link>
      </div>
    )
  }

  const readonly = assignment.status === 'enviada' || assignment.evaluator_id !== profile.id
  const isSelf = assignment.kind === 'auto'
  const familyName = families.find((f) => f.id === evaluatee.family_id)?.name

  function setItem(code: string, patch: Partial<ItemState>) {
    setItems((prev) => {
      const base: ItemState = prev[code] ?? { score: null, comment: '', links: '' }
      return { ...prev, [code]: { ...base, ...patch } }
    })
    setErrors((prev) => {
      if (!prev[code]) return prev
      const next = { ...prev }
      delete next[code]
      return next
    })
  }

  async function save(submit: boolean) {
    if (!review || !assignment) return
    // Casillas opcionales: solo se exige al menos UNA competencia
    // calificada para enviar (evita envíos completamente vacíos).
    if (submit && !scoped.some((c) => items[c.code]?.score != null)) {
      toast('Califica al menos una competencia antes de enviar', 'error')
      return
    }
    setErrors({})
    setSaving(true)
    try {
      const rows: {
        review_id: string
        block: 'skills' | 'contribution'
        item_ref: string
        score: number | null
        comment: string | null
        evidence_links: string[]
      }[] = scoped
        .filter((c) => items[c.code] && (items[c.code].score != null || items[c.code].comment.trim()))
        .map((c) => ({
          review_id: review.id,
          block: 'skills' as const,
          item_ref: c.code,
          score: items[c.code].score,
          comment: items[c.code].comment.trim() || null,
          evidence_links: parseLinks(items[c.code].links),
        }))
      if (extra.trim()) {
        rows.push({
          review_id: review.id,
          block: 'contribution',
          item_ref: 'adicional',
          score: null,
          comment: extra.trim(),
          evidence_links: [],
        })
      }
      if (rows.length > 0) {
        const { error } = await supabase.from('review_items').upsert(rows, { onConflict: 'review_id,block,item_ref' })
        if (error) throw new Error(error.message)
      }
      if (isSelf && wellbeing.length > 0) {
        const answers = wellbeing
          .filter((q) => (wellbeingAnswers[q.code] ?? '').trim())
          .map((q) => ({
            cycle_id: assignment.cycle_id,
            user_id: profile!.id,
            question_code: q.code,
            answer: wellbeingAnswers[q.code].trim(),
          }))
        if (answers.length > 0) {
          const { error } = await supabase.from('wellbeing_answers').upsert(answers, { onConflict: 'cycle_id,user_id,question_code' })
          if (error) throw new Error(error.message)
        }
      }
      if (submit) {
        const { error: e1 } = await supabase
          .from('reviews')
          .update({ status: 'submitted', submitted_at: new Date().toISOString() })
          .eq('id', review.id)
        if (e1) throw new Error(e1.message)
        const { error: e2 } = await supabase.from('evaluation_assignments').update({ status: 'enviada' }).eq('id', assignment.id)
        if (e2) throw new Error(e2.message)
        toast(isSelf ? '✓ Autoevaluación enviada' : `✓ Evaluación de ${evaluatee!.name.split(' ')[0]} enviada`)
        navigate('/mis-evaluaciones')
      } else {
        toast('Borrador guardado')
      }
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const answered = scoped.filter((c) => items[c.code]?.score != null).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/mis-evaluaciones" className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-primary">
        <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
        Mis evaluaciones
      </Link>

      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Avatar profile={evaluatee} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            {isSelf ? 'Mi autoevaluación' : evaluatee.name}
          </h2>
          <p className="text-sm text-slate-500">
            {kindLabel(assignment.kind)}
            {familyName && assignment.kind !== 'par' ? ` · Familia: ${familyName}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold text-primary">{answered}/{scoped.length}</p>
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">calificadas</p>
        </div>
      </div>

      {assignment.kind === 'par' && (
        <p className="rounded-xl bg-accent/5 px-4 py-3 text-xs leading-relaxed text-slate-600">
          <strong>Evaluación entre pares:</strong> solo calificas las 5 competencias organizacionales
          (transversales). Regla de oro: <em>solo evalúa quien observa comportamientos reales</em> — apóyate en
          ejemplos concretos, no en impresiones.
        </p>
      )}

      {sections.map((section) => (
        <div key={section.type} className="space-y-4">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{TYPE_LABEL[section.type]}</p>
          {section.comps.map((c) => {
            const st = items[c.code] ?? { score: null, comment: '', links: '' }
            const err = errors[c.code]
            const indicators = c.indicators ?? []
            return (
              <div key={c.code} className={`rounded-2xl border bg-white p-6 shadow-sm ${err ? 'border-highlight/50' : 'border-slate-200'}`}>
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h3 className="text-sm font-extrabold tracking-tight text-slate-900">{c.name}</h3>
                  {indicators.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [c.code]: !prev[c.code] }))}
                      className="shrink-0 text-[10px] font-bold text-primary hover:underline"
                    >
                      {expanded[c.code] ? 'Ocultar comportamientos' : 'Ver comportamientos observables'}
                    </button>
                  )}
                </div>
                <p className="mb-3 text-xs leading-relaxed text-slate-500">{c.definition}</p>
                {expanded[c.code] && indicators.length > 0 && (
                  <ul className="mb-4 space-y-1.5 rounded-xl bg-slate-50 p-4">
                    {indicators.map((ind) => (
                      <li key={ind.name} className="text-xs leading-relaxed text-slate-600">
                        <strong>{ind.name}:</strong> {ind.description}
                      </li>
                    ))}
                  </ul>
                )}

                <ScaleSelector
                  label={c.name}
                  value={st.score}
                  disabled={readonly}
                  onChange={(v) => setItem(c.code, { score: v })}
                />

                <div className="mt-3">
                  <label htmlFor={`c-${c.code}`} className="mb-1 block text-xs font-bold text-slate-600">
                    Cuenta una historia breve (Situación → Acción → Resultado) <span className="font-semibold text-slate-400">— opcional</span>
                  </label>
                  <textarea
                    id={`c-${c.code}`}
                    rows={3}
                    disabled={readonly}
                    value={st.comment}
                    onChange={(e) => setItem(c.code, { comment: e.target.value })}
                    placeholder={c.star_question ?? 'Describe una situación reciente y concreta que sustente tu calificación.'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:bg-slate-50"
                  />
                </div>
                {st.score === 4 && (
                  <div className="mt-2">
                    <label htmlFor={`l-${c.code}`} className="mb-1 block text-xs font-bold text-slate-600">
                      Evidencia del nivel Sobresaliente (links, separados por coma) <span className="font-semibold text-slate-400">— opcional</span>
                    </label>
                    <input
                      id={`l-${c.code}`}
                      disabled={readonly}
                      value={st.links}
                      onChange={(e) => setItem(c.code, { links: e.target.value })}
                      placeholder="https://…"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:bg-slate-50"
                    />
                  </div>
                )}
                {err && <p role="alert" className="mt-2 text-xs font-semibold text-highlight">{err}</p>}
              </div>
            )
          })}
        </div>
      ))}

      {/* Casilla final abierta: lo que no encaja en las categorías */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-extrabold tracking-tight text-slate-900">¿Algo más que agregar?</h3>
        <p className="mt-1 mb-3 text-xs text-slate-500">
          Espacio libre y opcional para cualquier elemento que haya faltado o que no encaje en las categorías anteriores.
        </p>
        <textarea
          rows={4}
          disabled={readonly}
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Comentarios, contexto o aspectos adicionales…"
          aria-label="Comentarios adicionales"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:bg-slate-50"
        />
      </div>

      {isSelf && wellbeing.length > 0 && (
        <div className="space-y-4">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Mapa de energía y bienestar</p>
          <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs leading-relaxed text-slate-600">
            Esta sección no lleva calificación numérica y es opcional, pero tus respuestas alimentan directamente la
            conversación 1:1 con tu líder y ayudan a ajustar cargas a tiempo.
          </p>
          {wellbeing.map((q) => (
            <div key={q.code} className={`rounded-2xl border bg-white p-6 shadow-sm ${errors[q.code] ? 'border-highlight/50' : 'border-slate-200'}`}>
              <p className="mb-1 text-[10px] font-bold tracking-wider text-primary uppercase">{q.category}</p>
              <label htmlFor={`w-${q.code}`} className="mb-2 block text-sm font-bold text-slate-800">{q.question}</label>
              <textarea
                id={`w-${q.code}`}
                rows={3}
                disabled={readonly}
                value={wellbeingAnswers[q.code] ?? ''}
                onChange={(e) => {
                  setWellbeingAnswers((prev) => ({ ...prev, [q.code]: e.target.value }))
                  setErrors((prev) => {
                    if (!prev[q.code]) return prev
                    const next = { ...prev }
                    delete next[q.code]
                    return next
                  })
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:bg-slate-50"
              />
              {errors[q.code] && <p role="alert" className="mt-2 text-xs font-semibold text-highlight">{errors[q.code]}</p>}
            </div>
          ))}
        </div>
      )}

      {!readonly && (
        <div className="sticky bottom-4 flex gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur">
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Enviar evaluación'}
          </button>
        </div>
      )}
      {readonly && assignment.status === 'enviada' && (
        <p className="rounded-xl bg-primary/5 px-4 py-3 text-center text-xs font-semibold text-primary">
          Esta evaluación ya fue enviada — gracias por tu feedback.
        </p>
      )}
    </div>
  )
}
