import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import { SCALE } from '../lib/scale'
import type { Cycle, Profile, Review, ReviewItem, Team } from '../types'

interface Calibration {
  id: string
  evaluatee_id: string
  original_score: number
  adjusted_score: number | null
  rationale: string | null
  adjusted_by: string | null
  created_at: string
}

export default function AdminCalibration() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [facReviews, setFacReviews] = useState<Review[]>([])
  const [items, setItems] = useState<ReviewItem[]>([])
  const [calibrations, setCalibrations] = useState<Calibration[]>([])
  const [drafts, setDrafts] = useState<Record<string, { adjusted: string; rationale: string }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cycle) return
    async function load() {
      const [{ data: ppl }, { data: tms }, { data: revs }, { data: cals }] = await Promise.all([
        supabase.from('profiles').select('*').eq('is_active', true),
        supabase.from('teams').select('*'),
        supabase.from('reviews').select('*').eq('cycle_id', cycle!.id).eq('type', 'facilitator').eq('status', 'submitted'),
        supabase.from('calibrations').select('*').eq('cycle_id', cycle!.id).order('created_at', { ascending: false }),
      ])
      const revIds = ((revs as Review[]) ?? []).map((r) => r.id)
      const { data: ri } = revIds.length > 0
        ? await supabase.from('review_items').select('*').in('review_id', revIds)
        : { data: [] }
      setProfiles((ppl as Profile[]) ?? [])
      setTeams((tms as Team[]) ?? [])
      setFacReviews((revs as Review[]) ?? [])
      setItems((ri as ReviewItem[]) ?? [])
      setCalibrations((cals as Calibration[]) ?? [])
      setLoading(false)
    }
    load()
  }, [cycle])

  const weighted = useMemo(() => {
    if (!cycle) return []
    const weights = cycle.config.weights
    return facReviews.map((rev) => {
      const its = items.filter((i) => i.review_id === rev.id && i.score != null)
      const byBlock: Record<string, number[]> = {}
      for (const it of its) (byBlock[it.block] ??= []).push(it.score!)
      let wsum = 0
      let score = 0
      for (const [block, scores] of Object.entries(byBlock)) {
        const w = weights[block as keyof typeof weights] ?? 0
        score += (scores.reduce((s, x) => s + x, 0) / scores.length) * w
        wsum += w
      }
      return {
        review: rev,
        person: profiles.find((p) => p.id === rev.evaluatee_id),
        score: wsum > 0 ? score / wsum : 0,
        itemCount: its.length,
      }
    })
  }, [facReviews, items, profiles, cycle])

  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0]
    for (const it of items) if (it.score) counts[it.score - 1]++
    const total = counts.reduce((s, x) => s + x, 0)
    return SCALE.map((s, i) => ({ ...s, count: counts[i], pct: total > 0 ? Math.round((counts[i] / total) * 100) : 0 }))
  }, [items])

  const alerts = useMemo(() => {
    const out: { severity: 'warning' | 'error'; text: string }[] = []
    // Tendencia central por equipo
    for (const t of teams) {
      const teamIds = profiles.filter((p) => p.team_id === t.id).map((p) => p.id)
      const teamItems = items.filter((i) => {
        const r = facReviews.find((x) => x.id === i.review_id)
        return r && teamIds.includes(r.evaluatee_id) && i.score != null
      })
      if (teamItems.length >= 5) {
        const mode = [1, 2, 3, 4].map((s) => teamItems.filter((i) => i.score === s).length)
        const max = Math.max(...mode)
        if (max / teamItems.length >= 0.7) {
          out.push({ severity: 'warning', text: `${t.name}: ${Math.round((max / teamItems.length) * 100)}% de los puntajes son "${SCALE[mode.indexOf(max)].label}" — posible sesgo de tendencia central.` })
        }
      }
    }
    // 4 sin link de evidencia (la BD exige comentario largo, pero el link es lo ideal)
    const fours = items.filter((i) => i.score === 4 && (i.evidence_links ?? []).length === 0)
    if (fours.length > 0) {
      out.push({ severity: 'error', text: `${fours.length} calificación(es) de "4 — Sobresaliente" sin link de evidencia (pasaron por comentario extenso).` })
    }
    return out
  }, [items, teams, profiles, facReviews])

  if (!profile || profile.role !== 'admin') return <p className="py-12 text-center text-sm text-slate-400">Solo People Ops puede calibrar.</p>
  if (!cycle) return null

  async function saveCalibration(evaluateeId: string, original: number) {
    const d = drafts[evaluateeId]
    const adjusted = d?.adjusted ? Number(d.adjusted) : original
    const rationale = d?.rationale?.trim() ?? ''
    if (adjusted !== Number(original.toFixed(2)) && rationale.length < 20) {
      toast('Cambiar una nota exige un racional de al menos 20 caracteres (regla de auditoría)', 'error')
      return
    }
    const { data, error } = await supabase
      .from('calibrations')
      .insert({
        cycle_id: cycle!.id, evaluatee_id: evaluateeId,
        original_score: Number(original.toFixed(2)),
        adjusted_score: adjusted, rationale: rationale || null, adjusted_by: profile!.id,
      })
      .select().single()
    if (error) {
      toast(`Rechazado: ${error.message}`, 'error')
      return
    }
    setCalibrations((prev) => [data as Calibration, ...prev])
    setDrafts((prev) => ({ ...prev, [evaluateeId]: { adjusted: '', rationale: '' } }))
    toast('✓ Calibración registrada con auditoría')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Calibración</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Ciclo {cycle.name} · {weighted.length} evaluación(es) listas para calibrar
        </p>
      </div>

      <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs leading-relaxed text-slate-500">
        <strong className="text-slate-700">No hay distribución "ideal" ni cuotas.</strong> La calibración busca consistencia
        y justicia entre equipos, no forzar una curva. Todo ajuste queda en el log de auditoría con su racional.
      </p>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
      ) : (
        <>
          {/* Distribución */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-extrabold text-slate-900">Distribución de puntajes (evaluaciones de facilitador)</h3>
            <div className="space-y-2">
              {distribution.map((d) => (
                <div key={d.value} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-xs font-bold text-slate-600">{d.value} · {d.label}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-lg bg-slate-100">
                    <div className={`flex h-full items-center rounded-lg px-2 text-[10px] font-bold text-white ${['bg-highlight', 'bg-accent', 'bg-primary', 'bg-teal-600'][d.value - 1]}`}
                      style={{ width: `${Math.max(d.pct, d.count > 0 ? 8 : 0)}%` }}>
                      {d.count > 0 && `${d.count}`}
                    </div>
                  </div>
                  <span className="w-10 text-right text-xs font-bold text-slate-500">{d.pct}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* Alertas de sesgo */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-extrabold text-slate-900">Alertas de sesgo</h3>
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-400">Sin alertas con los datos actuales.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a, i) => (
                  <li key={i} className={`flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold ${a.severity === 'error' ? 'bg-highlight/10 text-highlight' : 'bg-accent/10 text-yellow-700'}`}>
                    <span className="material-symbols-outlined text-base" aria-hidden="true">{a.severity === 'error' ? 'error' : 'warning'}</span>
                    {a.text}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Panel de calibración */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-extrabold text-slate-900">Panel de ajuste</h3>
            {weighted.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                Aparecerán las personas cuando sus facilitadores envíen las evaluaciones.
              </p>
            ) : (
              <div className="space-y-4">
                {weighted.map(({ person, score, itemCount }) => {
                  if (!person) return null
                  const existing = calibrations.find((c) => c.evaluatee_id === person.id)
                  const d = drafts[person.id] ?? { adjusted: '', rationale: '' }
                  return (
                    <div key={person.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar profile={person} size="h-9 w-9" />
                          <div>
                            <p className="text-sm font-bold">{person.name}</p>
                            <p className="text-[10px] text-slate-500">{teams.find((t) => t.id === person.team_id)?.name} · {itemCount} ítems</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200">
                            {score.toFixed(2)}
                          </span>
                          {existing?.adjusted_score != null && Number(existing.adjusted_score) !== Number(existing.original_score) && (
                            <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-extrabold text-primary ring-1 ring-primary/30">
                              → {Number(existing.adjusted_score).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      {existing ? (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Calibrado el {new Date(existing.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          {existing.rationale && <> — "{existing.rationale}"</>}
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr_auto]">
                          <input
                            type="number" step="0.25" min={1} max={4} value={d.adjusted}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [person.id]: { ...d, adjusted: e.target.value } }))}
                            aria-label={`Nota ajustada para ${person.name}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary focus:outline-none"
                            placeholder={`Ajuste (${score.toFixed(2)})`}
                          />
                          <input
                            value={d.rationale}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [person.id]: { ...d, rationale: e.target.value } }))}
                            aria-label={`Racional para ${person.name}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary focus:outline-none"
                            placeholder="Racional (obligatorio si cambias la nota, mín. 20 caracteres)"
                          />
                          <button
                            onClick={() => saveCalibration(person.id, score)}
                            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:brightness-105"
                          >
                            Registrar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Log */}
          {calibrations.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 font-extrabold text-slate-900">Log de calibración ({calibrations.length})</h3>
              <ul className="space-y-2">
                {calibrations.map((c) => {
                  const p = profiles.find((x) => x.id === c.evaluatee_id)
                  const by = profiles.find((x) => x.id === c.adjusted_by)
                  const changed = c.adjusted_score != null && Number(c.adjusted_score) !== Number(c.original_score)
                  return (
                    <li key={c.id} className={`rounded-xl p-3 text-xs ${changed ? 'bg-accent/5 ring-1 ring-accent/20' : 'bg-slate-50'}`}>
                      <span className="font-bold">{p?.name ?? '—'}</span>: {Number(c.original_score).toFixed(2)}
                      {changed && <span className="font-bold text-primary"> → {Number(c.adjusted_score).toFixed(2)}</span>}
                      <span className="text-slate-400"> · por {by?.name ?? '—'} · {new Date(c.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>
                      {c.rationale && <p className="mt-1 text-slate-500">"{c.rationale}"</p>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
