import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import type { Cycle, Profile, Review, ReviewItem, Team } from '../types'

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = String(v ?? '')
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function AdminReports() {
  const { profile } = useAuth()
  const { cycle } = useOutletContext<{ cycle: Cycle | null }>()
  const toast = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [items, setItems] = useState<ReviewItem[]>([])
  const [checkins, setCheckins] = useState<{ user_id: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cycle) return
    async function load() {
      const [{ data: ppl }, { data: tms }, { data: revs }, { data: cis }] = await Promise.all([
        supabase.from('profiles').select('*').eq('is_active', true),
        supabase.from('teams').select('*'),
        supabase.from('reviews').select('*').eq('cycle_id', cycle!.id),
        supabase.from('checkins').select('user_id').eq('cycle_id', cycle!.id).neq('status', 'draft'),
      ])
      const ids = ((revs as Review[]) ?? []).map((r) => r.id)
      const { data: ri } = ids.length > 0
        ? await supabase.from('review_items').select('*').in('review_id', ids)
        : { data: [] }
      setProfiles((ppl as Profile[]) ?? [])
      setTeams((tms as Team[]) ?? [])
      setReviews((revs as Review[]) ?? [])
      setItems((ri as ReviewItem[]) ?? [])
      setCheckins(cis ?? [])
      setLoading(false)
    }
    load()
  }, [cycle])

  const adoption = useMemo(() => {
    return teams
      .map((t) => {
        const members = profiles.filter((p) => p.team_id === t.id && p.role !== 'admin')
        if (members.length === 0) return null
        const pct = (pred: (id: string) => boolean) =>
          Math.round((members.filter((m) => pred(m.id)).length / members.length) * 100)
        return {
          team: t.name,
          members: members.length,
          self: pct((id) => reviews.some((r) => r.evaluatee_id === id && r.type === 'self' && r.status === 'submitted')),
          facilitator: pct((id) => reviews.some((r) => r.evaluatee_id === id && r.type === 'facilitator' && r.status === 'submitted')),
          checkin: pct((id) => checkins.some((c) => c.user_id === id)),
        }
      })
      .filter(Boolean) as { team: string; members: number; self: number; facilitator: number; checkin: number }[]
  }, [teams, profiles, reviews, checkins])

  const quality = useMemo(() => {
    const scored = items.filter((i) => i.score != null)
    const withEvidence = scored.filter((i) => (i.evidence_links ?? []).length > 0)
    const avgLen = scored.length > 0 ? Math.round(scored.reduce((s, i) => s + (i.comment?.length ?? 0), 0) / scored.length) : 0
    return {
      scored: scored.length,
      evidencePct: scored.length > 0 ? Math.round((withEvidence.length / scored.length) * 100) : 0,
      avgLen,
    }
  }, [items])

  if (!profile || profile.role !== 'admin') return <p className="py-12 text-center text-sm text-slate-400">Solo People Ops puede ver reportes.</p>
  if (!cycle) return null

  function exportReviews() {
    const name = (id: string) => profiles.find((p) => p.id === id)?.name ?? id
    const rows: (string | number | null)[][] = [
      ['Ciclo', 'Evaluado', 'Evaluador', 'Tipo', 'Estado', 'Bloque', 'Item', 'Puntaje', 'Comentario', 'Evidencia'],
    ]
    for (const r of reviews) {
      const its = items.filter((i) => i.review_id === r.id)
      if (its.length === 0) {
        rows.push([cycle!.name, name(r.evaluatee_id), name(r.reviewer_id), r.type, r.status, '', '', null, '', ''])
      }
      for (const it of its) {
        rows.push([cycle!.name, name(r.evaluatee_id), name(r.reviewer_id), r.type, r.status, it.block, it.item_ref, it.score, it.comment ?? '', (it.evidence_links ?? []).join(' | ')])
      }
    }
    downloadCsv(`reviews-${cycle!.name.replace(/\s/g, '-')}.csv`, rows)
    toast(`✓ CSV exportado (${rows.length - 1} filas)`)
  }

  function exportAdoption() {
    const rows: (string | number)[][] = [['Equipo', 'Miembros', '% Autoevaluación', '% Eval. Facilitador', '% Con check-in']]
    for (const a of adoption) rows.push([a.team, a.members, a.self, a.facilitator, a.checkin])
    downloadCsv(`adopcion-${cycle!.name.replace(/\s/g, '-')}.csv`, rows)
    toast('✓ CSV de adopción exportado')
  }

  const bar = (pct: number) => (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${pct >= 75 ? 'bg-primary' : pct >= 40 ? 'bg-accent' : 'bg-highlight'}`} style={{ width: `${pct}%` }} />
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Reportes</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Ciclo {cycle.name} · agregados (los comentarios individuales requieren permisos)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportAdoption} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:border-primary/50">
            <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
            Adopción CSV
          </button>
          <button onClick={exportReviews} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 hover:brightness-105">
            <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
            Reviews CSV
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
      ) : (
        <>
          {/* KPIs de calidad */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-extrabold text-slate-900">{quality.scored}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Ítems calificados</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-extrabold text-primary">{quality.evidencePct}%</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Con link de evidencia</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-extrabold text-slate-900">{quality.avgLen}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Caracteres promedio por comentario</p>
            </div>
          </div>

          {/* Adopción por equipo */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-extrabold text-slate-900">Adopción por equipo</h3>
            {adoption.length === 0 ? (
              <p className="text-xs text-slate-400">Sin equipos con miembros.</p>
            ) : (
              <div className="space-y-4">
                {adoption.map((a) => (
                  <div key={a.team} className="rounded-xl bg-slate-50/60 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-800">{a.team}</p>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{a.members} miembro(s)</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="mb-1 flex justify-between text-[10px] font-bold text-slate-500"><span>Autoevaluación</span><span>{a.self}%</span></p>
                        {bar(a.self)}
                      </div>
                      <div>
                        <p className="mb-1 flex justify-between text-[10px] font-bold text-slate-500"><span>Eval. facilitador</span><span>{a.facilitator}%</span></p>
                        {bar(a.facilitator)}
                      </div>
                      <div>
                        <p className="mb-1 flex justify-between text-[10px] font-bold text-slate-500"><span>Check-ins</span><span>{a.checkin}%</span></p>
                        {bar(a.checkin)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Estado de reviews */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-extrabold text-slate-900">Reviews del ciclo</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['self', 'peer', 'facilitator', 'stakeholder'] as const).map((t) => {
                const of = reviews.filter((r) => r.type === t)
                const done = of.filter((r) => r.status === 'submitted').length
                const label = { self: 'Autoevaluaciones', peer: 'De pares', facilitator: 'De facilitador', stakeholder: 'Stakeholders' }[t]
                return (
                  <div key={t} className="rounded-xl bg-slate-50 p-4 text-center">
                    <p className="text-xl font-extrabold text-slate-900">{done}<span className="text-sm font-bold text-slate-400">/{of.length}</span></p>
                    <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase">{label}</p>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
