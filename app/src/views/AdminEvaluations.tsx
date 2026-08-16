import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import EvalTracking from '../components/EvalTracking'
import EvalReminders from '../components/EvalReminders'
import { assignmentStatusLabel, isLeader, kindLabel, originLabel } from '../lib/eval360'
import type {
  AssignmentKind,
  Cycle,
  CycleEvalPolicy,
  EvalPolicyOverride,
  EvaluationAssignment,
  Profile,
  RoleFamily,
} from '../types'

const KIND_BADGE: Record<AssignmentKind, string> = {
  auto: 'bg-slate-100 text-slate-600',
  lider: 'bg-primary/10 text-primary',
  par: 'bg-accent/10 text-accent',
}

export default function AdminEvaluations() {
  const { profile, roles } = useAuth()
  const toast = useToast()
  const canManage = roles.includes('admin') || roles.includes('talento')

  const [cycles, setCycles] = useState<Cycle[]>([])
  const [cycleId, setCycleId] = useState<string>('')
  const [people, setPeople] = useState<Profile[]>([])
  const [families, setFamilies] = useState<RoleFamily[]>([])
  const [policy, setPolicy] = useState<CycleEvalPolicy | null>(null)
  const [overrides, setOverrides] = useState<EvalPolicyOverride[]>([])
  const [assignments, setAssignments] = useState<EvaluationAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'politica' | 'asignaciones' | 'seguimiento' | 'recordatorios'>('politica')
  // formulario de asignación dirigida: pares, o líder EXCEPCIONAL para
  // relaciones de evaluación que no existen en el organigrama (ej. el
  // CINO evalúa al CEO). Las de líder del organigrama siguen siendo
  // automáticas e intocables.
  const [newEvaluator, setNewEvaluator] = useState('')
  const [newEvaluatee, setNewEvaluatee] = useState('')
  const [newKind, setNewKind] = useState<'par' | 'lider'>('par')

  useEffect(() => {
    if (!canManage) return
    Promise.all([
      supabase.from('cycles').select('*').order('start_date', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).is('archived_at', null).neq('role', 'invitado').order('name'),
      supabase.from('role_families').select('*').eq('is_active', true).order('sort_order'),
    ]).then(([c, p, f]) => {
      const cs = (c.data as Cycle[]) ?? []
      setCycles(cs)
      setPeople((p.data as Profile[]) ?? [])
      setFamilies((f.data as RoleFamily[]) ?? [])
      const current = cs.find((x) => !['finalized', 'archived'].includes(x.status)) ?? cs[0]
      if (current) setCycleId(current.id)
      setLoading(false)
    })
  }, [canManage])

  useEffect(() => {
    if (!cycleId) return
    Promise.all([
      supabase.from('cycle_eval_policies').select('*').eq('cycle_id', cycleId).maybeSingle(),
      supabase.from('eval_policy_overrides').select('*').eq('cycle_id', cycleId),
      supabase.from('evaluation_assignments').select('*').eq('cycle_id', cycleId).order('created_at'),
    ]).then(([pol, ovr, asg]) => {
      setPolicy((pol.data as CycleEvalPolicy) ?? { cycle_id: cycleId, peer_target: 2, random_enabled: true, eval_deadline: null })
      setOverrides((ovr.data as EvalPolicyOverride[]) ?? [])
      setAssignments((asg.data as EvaluationAssignment[]) ?? [])
    })
  }, [cycleId])

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const grouped = useMemo(() => {
    const map = new Map<string, EvaluationAssignment[]>()
    for (const a of assignments) {
      if (!map.has(a.evaluator_id)) map.set(a.evaluator_id, [])
      map.get(a.evaluator_id)!.push(a)
    }
    return [...map.entries()].sort((x, y) =>
      (byId.get(x[0])?.name ?? '').localeCompare(byId.get(y[0])?.name ?? ''))
  }, [assignments, byId])

  const stats = useMemo(() => {
    const act = assignments.filter((a) => a.status !== 'anulada')
    return {
      lider: act.filter((a) => a.kind === 'lider').length,
      auto: act.filter((a) => a.kind === 'auto').length,
      par: act.filter((a) => a.kind === 'par').length,
      enviadas: act.filter((a) => a.status === 'enviada').length,
      total: act.length,
    }
  }, [assignments])

  if (!profile || !canManage) {
    return <p className="py-12 text-center text-sm text-slate-400">Solo administración o Talento Humano puede configurar evaluaciones.</p>
  }

  async function savePolicy() {
    if (!policy) return
    const { error } = await supabase.from('cycle_eval_policies').upsert(
      { cycle_id: cycleId, peer_target: policy.peer_target, random_enabled: policy.random_enabled, eval_deadline: policy.eval_deadline, updated_by: profile!.id },
      { onConflict: 'cycle_id' },
    )
    if (error) toast(error.message, 'error')
    else toast('✓ Política del ciclo guardada')
  }

  async function saveOverride(userId: string, value: string) {
    if (value === '') {
      const { error } = await supabase.from('eval_policy_overrides').delete().eq('cycle_id', cycleId).eq('user_id', userId)
      if (error) return toast(error.message, 'error')
      setOverrides((prev) => prev.filter((o) => o.user_id !== userId))
      return
    }
    const target = Number(value)
    if (Number.isNaN(target) || target < 0 || target > 10) return
    const { error } = await supabase.from('eval_policy_overrides').upsert(
      { cycle_id: cycleId, user_id: userId, peer_target: target },
      { onConflict: 'cycle_id,user_id' },
    )
    if (error) return toast(error.message, 'error')
    setOverrides((prev) => {
      const rest = prev.filter((o) => o.user_id !== userId)
      return [...rest, { cycle_id: cycleId, user_id: userId, peer_target: target }]
    })
  }

  async function setFamily(userId: string, familyId: string) {
    const { error } = await supabase.from('profiles').update({ family_id: familyId || null }).eq('id', userId)
    if (error) return toast(error.message, 'error')
    setPeople((prev) => prev.map((p) => (p.id === userId ? { ...p, family_id: familyId || null } : p)))
    toast('✓ Familia actualizada')
  }

  async function generate() {
    setGenerating(true)
    const { data, error } = await supabase.rpc('generate_evaluation_assignments', { p_cycle: cycleId })
    setGenerating(false)
    if (error) return toast(error.message, 'error')
    const r = data as { lider: number; auto: number; par: number }
    toast(`✓ Generadas: ${r.lider} de líder, ${r.auto} autoevaluaciones, ${r.par} de pares`)
    const { data: asg } = await supabase.from('evaluation_assignments').select('*').eq('cycle_id', cycleId).order('created_at')
    setAssignments((asg as EvaluationAssignment[]) ?? [])
    setTab('asignaciones')
  }

  async function addManual() {
    if (!newEvaluator || !newEvaluatee) return toast('Elige evaluador y evaluado', 'error')
    if (newEvaluator === newEvaluatee) return toast('Una persona no puede evaluarse a sí misma aquí (eso es la autoevaluación)', 'error')
    const { data, error } = await supabase
      .from('evaluation_assignments')
      .insert({ cycle_id: cycleId, evaluator_id: newEvaluator, evaluatee_id: newEvaluatee, kind: newKind, origin: 'manual', created_by: profile!.id })
      .select().single()
    if (error) {
      toast(error.message.includes('duplicate') ? 'Esa asignación ya existe en el ciclo' : error.message, 'error')
      return
    }
    setAssignments((prev) => [...prev, data as EvaluationAssignment])
    setNewEvaluatee('')
    toast('✓ Asignación creada')
  }

  async function removeAssignment(a: EvaluationAssignment) {
    // solo pares y líderes excepcionales; las de líder del organigrama y
    // la autoevaluación se rigen por el organigrama
    if (!(a.kind === 'par' || (a.kind === 'lider' && a.origin === 'manual'))) return
    if (a.status === 'enviada') {
      // No se destruye una evaluación enviada: se anula (queda en auditoría)
      const { error } = await supabase.from('evaluation_assignments').update({ status: 'anulada' }).eq('id', a.id)
      if (error) return toast(error.message, 'error')
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: 'anulada' } : x)))
      toast('Asignación anulada (la evaluación enviada queda en auditoría)')
    } else {
      const { error } = await supabase.from('evaluation_assignments').delete().eq('id', a.id)
      if (error) return toast(error.message, 'error')
      setAssignments((prev) => prev.filter((x) => x.id !== a.id))
      toast('Asignación eliminada')
    }
  }

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Evaluación 360</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Configura la política, asigna familias y genera las evaluaciones del ciclo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            aria-label="Ciclo"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-primary focus:outline-none"
          >
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">auto_awesome</span>
            {generating ? 'Generando…' : 'Generar asignaciones'}
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Obligatorias (líder)', value: stats.lider },
          { label: 'Autoevaluaciones', value: stats.auto },
          { label: 'Pares', value: stats.par },
          { label: 'Enviadas', value: stats.enviadas },
          { label: 'Total activas', value: stats.total },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-900">{s.value}</p>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          ['politica', 'Política y personas'],
          ['asignaciones', 'Asignaciones'],
          ['seguimiento', 'Seguimiento'],
          ['recordatorios', 'Recordatorios'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'politica' && policy && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-extrabold tracking-tight text-slate-900">Política general del ciclo</h3>
            <p className="mt-1 text-xs text-slate-500">
              El líder evalúa <strong>obligatoriamente</strong> a todos sus subordinados directos. Adicionalmente,
              cada persona debe completar un número de evaluaciones a pares (solo competencias transversales),
              dirigidas o aleatorias.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="peer-target" className="mb-1 block text-xs font-bold text-slate-600">
                  Evaluaciones de pares por persona
                </label>
                <input
                  id="peer-target"
                  type="number"
                  min={0}
                  max={10}
                  value={policy.peer_target}
                  onChange={(e) => setPolicy({ ...policy, peer_target: Number(e.target.value) })}
                  className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={policy.random_enabled}
                  onChange={(e) => setPolicy({ ...policy, random_enabled: e.target.checked })}
                  className="h-4 w-4 rounded accent-primary"
                />
                Completar cupos faltantes con personas aleatorias
              </label>
              <button
                onClick={savePolicy}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105"
              >
                Guardar política
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="text-sm font-extrabold tracking-tight text-slate-900">Distribución de evaluaciones por persona</h3>
              <p className="mt-1 text-xs text-slate-500">
                Las <strong>obligatorias de líder</strong> salen del organigrama (subordinados directos) y solo cambian
                si cambia el organigrama. La <strong>meta de pares</strong> (transversales) sale de la política general,
                o de la meta individual si la defines aquí. El total es la suma de ambas.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    <th className="px-5 py-3">Persona</th>
                    <th className="px-5 py-3">Familia de rol</th>
                    <th className="px-5 py-3">Obligatorias · líder</th>
                    <th className="px-5 py-3">Meta pares</th>
                    <th className="px-5 py-3">Total a evaluar</th>
                    <th className="px-5 py-3">Avance (enviadas)</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => {
                    const ovr = overrides.find((o) => o.user_id === p.id)
                    const directReports = people.filter((x) => x.manager_id === p.id).length
                    const mine = assignments.filter((a) => a.evaluator_id === p.id && a.status !== 'anulada')
                    const liderAsg = mine.filter((a) => a.kind === 'lider')
                    const parAsg = mine.filter((a) => a.kind === 'par')
                    const target = ovr?.peer_target ?? policy.peer_target
                    const total = directReports + target
                    const sent = liderAsg.filter((a) => a.status === 'enviada').length
                      + parAsg.filter((a) => a.status === 'enviada').length
                    return (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar profile={p} size="h-8 w-8" />
                            <div>
                              <p className="font-bold text-slate-800">{p.name}</p>
                              <p className="text-[10px] text-slate-400">{p.position ?? ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={p.family_id ?? ''}
                            onChange={(e) => setFamily(p.id, e.target.value)}
                            aria-label={`Familia de ${p.name}`}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
                          >
                            <option value="">Sin familia</option>
                            {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          {isLeader(p.id, people) && (
                            <p className="mt-1 text-[10px] font-semibold text-primary">Lidera — se le miden comp. de liderazgo</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {directReports > 0 ? (
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary" title={`${directReports} subordinado(s) directo(s) según el organigrama`}>
                              {directReports}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            min={0}
                            max={10}
                            placeholder={String(policy.peer_target)}
                            value={ovr?.peer_target ?? ''}
                            onChange={(e) => saveOverride(p.id, e.target.value)}
                            aria-label={`Meta de pares de ${p.name}`}
                            className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                          />
                          {ovr == null && <span className="ml-1.5 text-[10px] text-slate-400">global</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm font-extrabold text-slate-800">{total}</span>
                          <span className="ml-1.5 text-[10px] text-slate-400">= {directReports} líder + {target} pares</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-xs font-bold text-slate-600">
                            <span className={sent >= liderAsg.length + parAsg.length && sent > 0 ? 'text-primary' : ''}>
                              {sent} / {liderAsg.length + parAsg.length}
                            </span>
                            <span className="ml-1.5 font-semibold text-slate-400">
                              (L {liderAsg.filter((a) => a.status === 'enviada').length}/{liderAsg.length} · P {parAsg.filter((a) => a.status === 'enviada').length}/{parAsg.length})
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'asignaciones' && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-extrabold tracking-tight text-slate-900">Asignación dirigida (manual)</h3>
            <p className="mb-3 text-xs text-slate-500">
              <strong>Par</strong>: solo competencias transversales. <strong>Líder excepcional</strong>: úsalo
              únicamente para relaciones de evaluación que no existen en el organigrama (ej. el CINO evalúa al CEO);
              las de líder normales salen del organigrama automáticamente.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="na-evaluator" className="mb-1 block text-xs font-bold text-slate-600">Evaluador</label>
                <select id="na-evaluator" value={newEvaluator} onChange={(e) => setNewEvaluator(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="">Elegir…</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="na-evaluatee" className="mb-1 block text-xs font-bold text-slate-600">Evaluado</label>
                <select id="na-evaluatee" value={newEvaluatee} onChange={(e) => setNewEvaluatee(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="">Elegir…</option>
                  {people.filter((p) => p.id !== newEvaluator).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="na-kind" className="mb-1 block text-xs font-bold text-slate-600">Tipo</label>
                <select id="na-kind" value={newKind} onChange={(e) => setNewKind(e.target.value as 'par' | 'lider')}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="par">Par — transversales</option>
                  <option value="lider">Líder excepcional — transversales + familia</option>
                </select>
              </div>
              <button onClick={addManual}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105">
                Asignar
              </button>
            </div>
          </div>

          {grouped.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              Aún no hay asignaciones en este ciclo — usa «Generar asignaciones» o crea una dirigida.
            </p>
          ) : (
            grouped.map(([evaluatorId, list]) => {
              const evaluator = byId.get(evaluatorId)
              return (
                <div key={evaluatorId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
                    {evaluator && <Avatar profile={evaluator} size="h-8 w-8" />}
                    <p className="text-sm font-extrabold text-slate-900">{evaluator?.name ?? 'Desconocido'}</p>
                    <span className="text-xs text-slate-400">evalúa a {list.filter((a) => a.status !== 'anulada').length} persona(s)</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {list.map((a) => {
                      const evaluatee = byId.get(a.evaluatee_id)
                      return (
                        <div key={a.id} className={`flex flex-wrap items-center gap-3 px-5 py-2.5 ${a.status === 'anulada' ? 'opacity-40' : ''}`}>
                          <p className="min-w-40 flex-1 text-sm font-semibold text-slate-700">
                            {a.kind === 'auto' ? 'Autoevaluación (incluye bienestar)' : evaluatee?.name ?? '—'}
                          </p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_BADGE[a.kind]}`}>{kindLabel(a.kind)}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{originLabel(a.origin)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            a.status === 'enviada' ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-600'
                          }`}>{assignmentStatusLabel(a.status)}</span>
                          {a.status !== 'anulada' && (a.kind === 'par' || (a.kind === 'lider' && a.origin === 'manual')) && (
                            <button
                              onClick={() => removeAssignment(a)}
                              title={a.status === 'enviada' ? 'Anular (queda en auditoría)' : 'Eliminar asignación'}
                              aria-label={`Quitar asignación a ${evaluatee?.name}`}
                              className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-highlight/10 hover:text-highlight"
                            >
                              <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                            </button>
                          )}
                          {a.kind === 'lider' && a.origin === 'auto' && (
                            <span className="material-symbols-outlined text-base text-slate-200" title="Obligatoria: solo cambia al modificar el organigrama" aria-label="Obligatoria por organigrama">lock</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </>
      )}

      {tab === 'seguimiento' && (
        <EvalTracking
          cycleName={cycles.find((c) => c.id === cycleId)?.name ?? ''}
          people={people}
          assignments={assignments}
          deadline={policy?.eval_deadline ?? cycles.find((c) => c.id === cycleId)?.end_date ?? null}
        />
      )}

      {tab === 'recordatorios' && policy && (
        <EvalReminders
          cycleId={cycleId}
          deadline={policy.eval_deadline}
          onDeadlineChange={(d) => setPolicy({ ...policy, eval_deadline: d })}
        />
      )}
    </div>
  )
}
