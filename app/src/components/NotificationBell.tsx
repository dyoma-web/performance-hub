import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { AppNotification } from '../types'

/** Campana de notificaciones in-app (recordatorios 360, reportes, etc.) */
export default function NotificationBell() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setItems((data as AppNotification[]) ?? [])
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 90_000) // refresco suave
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  // Cierra al hacer clic fuera
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const unread = items.filter((n) => !n.read_at).length

  async function openItem(n: AppNotification) {
    if (!n.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  async function markAll() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
        aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ''}`}
      >
        <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-highlight px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">Notificaciones</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-[10px] font-bold text-primary hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">No tienes notificaciones.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`block w-full border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    n.read_at ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{n.body}</p>}
                      <p className="mt-1 text-[10px] text-slate-400">
                        {new Date(n.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
