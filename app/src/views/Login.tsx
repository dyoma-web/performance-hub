import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DEMO_ACCOUNTS = [
  { email: 'alejandra@demo360.co', label: 'Alejandra Rivera', role: 'Colaboradora · Diseño' },
  { email: 'sara@demo360.co', label: 'Sara Méndez', role: 'Facilitadora · Diseño' },
  { email: 'daniela@demo360.co', label: 'Daniela Ruiz', role: 'People Ops (Admin)' },
]

export default function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const err = await signIn(email.trim(), password)
    if (err) setError(err)
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="view-enter w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-2xl text-white" aria-hidden="true">
              insights
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Performance Hub<span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Feedback honesto, crecimiento continuo
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-slate-600">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                placeholder="tu@empresa.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-slate-600">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-highlight/10 px-4 py-3 text-xs font-semibold text-highlight">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-105 disabled:opacity-60"
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/60 p-5">
          <p className="mb-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Cuentas demo (contraseña: Demo1234!)
          </p>
          <div className="space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email)
                  setPassword('Demo1234!')
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-slate-100"
              >
                <span className="font-semibold text-slate-700">{a.label}</span>
                <span className="text-slate-400">{a.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
