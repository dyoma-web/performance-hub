import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './Toast'
import type { NotificationRule, RuleCadence, RuleKind } from '../types'

const KIND_LABEL: Record<RuleKind, string> = {
  'recordatorio-pendientes': 'Recordatorio a personas con pendientes',
  'reporte-avance': 'Reporte de avance a admin y Talento Humano',
}

const CADENCE_LABEL: Record<RuleCadence, string> = {
  diaria: 'Todos los días',
  'dia-por-medio': 'Día por medio',
  semanal: 'Semanal',
  fechas: 'Fechas específicas',
}

const EMPTY_FORM = {
  kind: 'recordatorio-pendientes' as RuleKind,
  mode: 'auto' as 'auto' | 'manual',
  cadence: 'diaria' as RuleCadence,
  specific_dates: '',
  exclude_weekends: true,
  exclude_dates: '',
  window_start: '',
  window_end: '',
  message: '',
}

const parseDates = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean)

/**
 * Reglas de notificación del ciclo (solo admin/TH): recordatorios a
 * pendientes y reportes de avance, automáticos (corren a diario a las
 * 7:00 Bogotá) o manuales con el botón «Ejecutar ahora».
 */
export default function EvalReminders({
  cycleId,
  deadline,
  onDeadlineChange,
}: {
  cycleId: string
  deadline: string | null
  onDeadlineChange: (d: string | null) => void
}) {
  const toast = useToast()
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [running, setRunning] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('notification_rules')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('created_at')
      .then(({ data }) => setRules((data as NotificationRule[]) ?? []))
  }, [cycleId])

  async function saveDeadline(value: string) {
    const d = value || null
    const { error } = await supabase
      .from('cycle_eval_policies')
      .upsert({ cycle_id: cycleId, eval_deadline: d }, { onConflict: 'cycle_id' })
    if (error) return toast(error.message, 'error')
    onDeadlineChange(d)
    toast('✓ Fecha límite guardada — todos la verán en su dashboard')
  }

  async function createRule() {
    if (form.cadence === 'fechas' && parseDates(form.specific_dates).length === 0) {
      return toast('Indica al menos una fecha específica', 'error')
    }
    const { data, error } = await supabase
      .from('notification_rules')
      .insert({
        cycle_id: cycleId,
        kind: form.kind,
        mode: form.mode,
        cadence: form.cadence,
        specific_dates: parseDates(form.specific_dates),
        exclude_weekends: form.exclude_weekends,
        exclude_dates: parseDates(form.exclude_dates),
        window_start: form.window_start || null,
        window_end: form.window_end || null,
        message: form.message.trim() || null,
      })
      .select().single()
    if (error) return toast(error.message, 'error')
    setRules((prev) => [...prev, data as NotificationRule])
    setForm(EMPTY_FORM)
    setShowForm(false)
    toast('✓ Regla creada')
  }

  async function toggleRule(r: NotificationRule) {
    const { error } = await supabase.from('notification_rules').update({ is_active: !r.is_active }).eq('id', r.id)
    if (error) return toast(error.message, 'error')
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)))
  }

  async function deleteRule(r: NotificationRule) {
    const { error } = await supabase.from('notification_rules').delete().eq('id', r.id)
    if (error) return toast(error.message, 'error')
    setRules((prev) => prev.filter((x) => x.id !== r.id))
    toast('Regla eliminada')
  }

  async function runNow(r: NotificationRule) {
    setRunning(r.id)
    const { data, error } = await supabase.rpc('run_notification_rule', { p_rule: r.id, p_force: true })
    setRunning(null)
    if (error) return toast(error.message, 'error')
    const res = data as { ejecutada: boolean; notificados?: number }
    toast(res.ejecutada ? `✓ ${res.notificados} notificación(es) enviada(s)` : 'La regla no generó notificaciones')
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, last_run_on: new Date().toISOString().slice(0, 10) } : x)))
  }

  return (
    <div className="space-y-6">
      {/* Fecha límite */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-extrabold tracking-tight text-slate-900">Fecha límite de diligenciamiento</h3>
        <p className="mt-1 text-xs text-slate-500">
          Todos la verán en su dashboard con un aviso de urgencia cuando se acerque. Si no se define, se usa la
          fecha de fin del ciclo (el inicio y fin del ciclo se configuran en <strong>Ciclos</strong>).
        </p>
        <input
          type="date"
          value={deadline ?? ''}
          onChange={(e) => saveDeadline(e.target.value)}
          aria-label="Fecha límite de diligenciamiento"
          className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {/* Reglas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold tracking-tight text-slate-900">Reglas de notificación</h3>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>
            Nueva regla
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Las reglas <strong>automáticas</strong> corren a diario a las 7:00 (hora Bogotá) y respetan cadencia y
          exclusiones. Las <strong>manuales</strong> solo se disparan con «Ejecutar ahora». El canal es la
          notificación in-app; el correo automático requiere configurar SMTP (pendiente de infraestructura).
        </p>

        {showForm && (
          <div className="mb-4 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="r-kind" className="mb-1 block text-xs font-bold text-slate-600">Tipo</label>
                <select id="r-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as RuleKind })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  {(Object.keys(KIND_LABEL) as RuleKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="r-mode" className="mb-1 block text-xs font-bold text-slate-600">Disparo</label>
                <select id="r-mode" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as 'auto' | 'manual' })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="auto">Automático (diario 7:00)</option>
                  <option value="manual">Manual (botón)</option>
                </select>
              </div>
              <div>
                <label htmlFor="r-cadence" className="mb-1 block text-xs font-bold text-slate-600">Cadencia</label>
                <select id="r-cadence" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value as RuleCadence })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  {(Object.keys(CADENCE_LABEL) as RuleCadence[]).map((c) => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
                </select>
              </div>
              {form.cadence === 'fechas' && (
                <div>
                  <label htmlFor="r-dates" className="mb-1 block text-xs font-bold text-slate-600">Fechas (AAAA-MM-DD, separadas por coma)</label>
                  <input id="r-dates" value={form.specific_dates} onChange={(e) => setForm({ ...form, specific_dates: e.target.value })}
                    placeholder="2026-08-20, 2026-08-25"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                </div>
              )}
              <div>
                <label htmlFor="r-ws" className="mb-1 block text-xs font-bold text-slate-600">Desde (opcional)</label>
                <input id="r-ws" type="date" value={form.window_start} onChange={(e) => setForm({ ...form, window_start: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label htmlFor="r-we" className="mb-1 block text-xs font-bold text-slate-600">Hasta (opcional)</label>
                <input id="r-we" type="date" value={form.window_end} onChange={(e) => setForm({ ...form, window_end: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={form.exclude_weekends} onChange={(e) => setForm({ ...form, exclude_weekends: e.target.checked })}
                className="h-4 w-4 rounded accent-primary" />
              Excluir fines de semana
            </label>
            <div>
              <label htmlFor="r-exc" className="mb-1 block text-xs font-bold text-slate-600">Fechas excluidas (opcional)</label>
              <input id="r-exc" value={form.exclude_dates} onChange={(e) => setForm({ ...form, exclude_dates: e.target.value })}
                placeholder="2026-08-18"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
            {form.kind === 'recordatorio-pendientes' && (
              <div>
                <label htmlFor="r-msg" className="mb-1 block text-xs font-bold text-slate-600">
                  Mensaje (opcional — usa {'{pendientes}'} y {'{fecha_limite}'})
                </label>
                <textarea id="r-msg" rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tienes {pendientes} evaluación(es) pendiente(s). Fecha límite: {fecha_limite}."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
            )}
            <button onClick={createRule}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:brightness-105">
              Crear regla
            </button>
          </div>
        )}

        {rules.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No hay reglas aún. Crea, por ejemplo, un recordatorio diario a pendientes y un reporte semanal de avance.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-4 py-3 ${r.is_active ? '' : 'opacity-50'}`}>
                <div className="min-w-48 flex-1">
                  <p className="text-xs font-bold text-slate-800">{KIND_LABEL[r.kind]}</p>
                  <p className="text-[10px] text-slate-400">
                    {r.mode === 'auto' ? `Automática · ${CADENCE_LABEL[r.cadence]}` : 'Manual'}
                    {r.exclude_weekends ? ' · sin fines de semana' : ''}
                    {r.window_start ? ` · desde ${r.window_start}` : ''}
                    {r.window_end ? ` · hasta ${r.window_end}` : ''}
                    {r.last_run_on ? ` · última: ${r.last_run_on}` : ' · nunca ejecutada'}
                  </p>
                </div>
                <button onClick={() => runNow(r)} disabled={running === r.id}
                  className="rounded-lg bg-primary/10 px-3 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/20 disabled:opacity-60">
                  {running === r.id ? 'Ejecutando…' : 'Ejecutar ahora'}
                </button>
                <button onClick={() => toggleRule(r)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200">
                  {r.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => deleteRule(r)} aria-label="Eliminar regla"
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-highlight/10 hover:text-highlight">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
