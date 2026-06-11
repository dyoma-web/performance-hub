import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Shell from './components/Shell'
import Login from './views/Login'
import Dashboard from './views/Dashboard'
import Objectives from './views/Objectives'
import SelfReview from './views/SelfReview'
import Checkin from './views/Checkin'
import PeerFeedback from './views/PeerFeedback'
import Team from './views/Team'
import FacilitatorReview from './views/FacilitatorReview'
import Meetings from './views/Meetings'
import Development from './views/Development'
import AdminCycles from './views/AdminCycles'
import AdminCalibration from './views/AdminCalibration'
import AdminReports from './views/AdminReports'
import AdminDirectory from './views/AdminDirectory'
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
        <Route path="/objetivos" element={<Objectives />} />
        <Route path="/mi-evaluacion" element={<SelfReview />} />
        <Route path="/check-in" element={<Checkin />} />
        <Route path="/feedback" element={<PeerFeedback />} />
        <Route path="/mi-desarrollo" element={<Development />} />
        <Route path="/reuniones" element={<Meetings />} />
        {/* Facilitador */}
        <Route path="/equipo" element={<Team />} />
        <Route path="/evaluar" element={<Navigate to="/equipo" replace />} />
        <Route path="/evaluar/:userId" element={<FacilitatorReview />} />
        {/* Admin */}
        <Route path="/ciclos" element={<AdminCycles />} />
        <Route path="/calibracion" element={<AdminCalibration />} />
        <Route path="/reportes" element={<AdminReports />} />
        <Route path="/directorio" element={<AdminDirectory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
