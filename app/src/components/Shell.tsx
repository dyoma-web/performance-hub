import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { statusLabel, roleLabel } from '../lib/labels'
import type { Cycle, Role } from '../types'
import Avatar from './Avatar'

interface NavItem {
  to: string
  icon: string
  label: string
}

function navItems(roles: Role[]): NavItem[] {
  const items: NavItem[] = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/mi-perfil', icon: 'person', label: 'Mi Perfil' },
    { to: '/trayectoria', icon: 'history_edu', label: 'Mi Trayectoria' },
    { to: '/competencias', icon: 'radar', label: 'Competencias' },
    { to: '/organigrama', icon: 'lan', label: 'Organigrama' },
  ]
  // Multi-rol: el menú es la unión de lo que cada rol habilita
  if (roles.includes('colaborador')) {
    items.push(
      { to: '/objetivos', icon: 'flag', label: 'Mis Objetivos' },
      { to: '/mi-evaluacion', icon: 'rate_review', label: 'Mi Evaluación' },
      { to: '/check-in', icon: 'event_available', label: 'Check-in Mensual' },
      { to: '/feedback', icon: 'reviews', label: 'Feedback a Pares' },
      { to: '/reuniones', icon: 'handshake', label: 'Reunión 1:1' },
      { to: '/mi-desarrollo', icon: 'trending_up', label: 'Mi Desarrollo' },
    )
  }
  if (roles.includes('facilitador')) {
    items.push(
      { to: '/equipo', icon: 'groups', label: 'Mi Equipo' },
      { to: '/feedback', icon: 'reviews', label: 'Feedback a Pares' },
      { to: '/reuniones', icon: 'handshake', label: 'Reuniones 1:1' },
    )
  }
  if (roles.includes('admin')) {
    items.push(
      { to: '/ciclos', icon: 'rebase_edit', label: 'Ciclos' },
      { to: '/calibracion', icon: 'tune', label: 'Calibración' },
      { to: '/reportes', icon: 'assessment', label: 'Reportes' },
      { to: '/directorio', icon: 'group', label: 'Directorio' },
      { to: '/organizacion', icon: 'account_tree', label: 'Organización' },
    )
  }
  // dedupe conservando el orden
  return items.filter((it, i) => items.findIndex((x) => x.to === it.to) === i)
}

export default function Shell() {
  const { profile, roles, signOut } = useAuth()
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    supabase
      .from('cycles')
      .select('*')
      .not('status', 'in', '("draft","finalized","archived")')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCycle(data as Cycle | null))
  }, [])

  // Cierra el sidebar móvil al navegar
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  if (!profile) return null

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-40 flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
            <span className="material-symbols-outlined text-xl text-white" aria-hidden="true">
              insights
            </span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              Hub<span className="text-primary">.</span>
            </h1>
            <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
              Performance
            </p>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-4" aria-label="Navegación principal">
          {navItems(roles).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-100'
                }`
              }
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Tarjeta de usuario */}
        <div className="p-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <Avatar profile={profile} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{profile.name}</p>
              <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {profile.position ?? roleLabel(profile.role)}
              </p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-highlight"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto bg-background-light">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                menu
              </span>
            </button>
            {cycle && (
              <p className="text-[10px] font-extrabold tracking-[0.2em] text-primary uppercase">
                {cycle.name} • {statusLabel(cycle.status)}
              </p>
            )}
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            {roleLabel(profile.role)}
          </span>
        </header>

        <div className="view-enter p-4 sm:p-8">
          <Outlet context={{ cycle }} />
        </div>
      </main>
    </div>
  )
}
