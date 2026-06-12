import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

/**
 * Cambio de contraseña. En modo `forced` (primer ingreso con contraseña
 * temporal) se muestra a pantalla completa y bloquea el resto de la app.
 */
export default function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { profile, refreshProfile, signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return void setError('Mínimo 8 caracteres')
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return void setError('Debe combinar letras y números')
    }
    if (password !== confirm) return void setError('Las contraseñas no coinciden')
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setSaving(false)
      setError(err.message === 'New password should be different from the old password.' ? 'La nueva contraseña debe ser distinta a la temporal' : err.message)
      return
    }
    if (profile?.must_change_password) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', profile.id)
      await refreshProfile()
    }
    setSaving(false)
    toast('✓ Contraseña actualizada')
    if (!forced) navigate('/')
  }

  const form = (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
      {forced && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <span className="material-symbols-outlined text-accent" aria-hidden="true">key</span>
          <p className="text-xs leading-relaxed text-slate-600">
            <strong>Hola, {profile?.name.split(' ')[0]}.</strong> Estás usando una contraseña temporal —
            por seguridad debes definir la tuya antes de continuar.
          </p>
        </div>
      )}
      <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
        {forced ? 'Crea tu contraseña' : 'Cambiar contraseña'}
      </h2>
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="new-pwd" className="mb-1.5 block text-xs font-bold text-slate-600">Nueva contraseña</label>
          <input
            id="new-pwd" type="password" required autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            placeholder="Mínimo 8 caracteres, letras y números"
          />
        </div>
        <div>
          <label htmlFor="confirm-pwd" className="mb-1.5 block text-xs font-bold text-slate-600">Confirmar contraseña</label>
          <input
            id="confirm-pwd" type="password" required autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
            placeholder="Repite la contraseña"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-highlight/10 px-4 py-3 text-xs font-semibold text-highlight">{error}</p>
      )}
      <button
        type="submit" disabled={saving}
        className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-105 disabled:opacity-60"
      >
        {saving ? 'Guardando…' : forced ? 'Guardar y continuar' : 'Actualizar contraseña'}
      </button>
      {forced && (
        <button type="button" onClick={signOut} className="mt-3 w-full text-center text-xs font-bold text-slate-400 hover:text-highlight">
          Salir sin cambiarla (no podrás usar la plataforma)
        </button>
      )}
    </form>
  )

  if (forced) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="view-enter flex w-full flex-col items-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-2xl text-white" aria-hidden="true">insights</span>
          </div>
          {form}
        </div>
      </div>
    )
  }
  return <div className="mx-auto flex max-w-4xl justify-center">{form}</div>
}
