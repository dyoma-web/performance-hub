import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Shell from './components/Shell'
import Login from './views/Login'
import Dashboard from './views/Dashboard'
import Placeholder from './views/Placeholder'
import type { ReactNode } from 'react'

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-3xl text-white" aria-hidden="true">
            insights
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-400">Cargando Performance Hub…</p>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        {/* Colaborador */}
        <Route path="/mi-evaluacion" element={<Placeholder title="Mi Evaluación" phase={4} />} />
        <Route path="/check-in" element={<Placeholder title="Check-in Mensual" phase={5} />} />
        <Route path="/mi-desarrollo" element={<Placeholder title="Mi Desarrollo" phase={6} />} />
        {/* Facilitador */}
        <Route path="/equipo" element={<Placeholder title="Mi Equipo" phase={5} />} />
        <Route path="/evaluar" element={<Placeholder title="Evaluar" phase={5} />} />
        <Route path="/reuniones" element={<Placeholder title="Reuniones 1:1" phase={6} />} />
        {/* Admin */}
        <Route path="/ciclos" element={<Placeholder title="Gestión de Ciclos" phase={7} />} />
        <Route path="/calibracion" element={<Placeholder title="Calibración" phase={7} />} />
        <Route path="/reportes" element={<Placeholder title="Reportes" phase={7} />} />
        <Route path="/directorio" element={<Placeholder title="Directorio" phase={7} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
