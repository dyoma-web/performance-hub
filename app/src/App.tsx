import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Shell from './components/Shell'
import Login from './views/Login'
import Dashboard from './views/Dashboard'

// Code-splitting: cada vista pesada se carga bajo demanda
const Objectives = lazy(() => import('./views/Objectives'))
const SelfReview = lazy(() => import('./views/SelfReview'))
const Checkin = lazy(() => import('./views/Checkin'))
const PeerFeedback = lazy(() => import('./views/PeerFeedback'))
const Team = lazy(() => import('./views/Team'))
const FacilitatorReview = lazy(() => import('./views/FacilitatorReview'))
const Meetings = lazy(() => import('./views/Meetings'))
const Development = lazy(() => import('./views/Development'))
const AdminCycles = lazy(() => import('./views/AdminCycles'))
const AdminCalibration = lazy(() => import('./views/AdminCalibration'))
const AdminReports = lazy(() => import('./views/AdminReports'))
const AdminDirectory = lazy(() => import('./views/AdminDirectory'))
const AdminOrganization = lazy(() => import('./views/AdminOrganization'))
const MyProfile = lazy(() => import('./views/MyProfile'))
const CareerProfile = lazy(() => import('./views/CareerProfile'))
const Skills360 = lazy(() => import('./views/Skills360'))
const OrgChart = lazy(() => import('./views/OrgChart'))
const PersonProfile = lazy(() => import('./views/PersonProfile'))

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

function ViewLoading() {
  return <p className="py-12 text-center text-sm text-slate-400">Cargando…</p>
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
        <Route path="/mi-perfil" element={<Suspense fallback={<ViewLoading />}><MyProfile /></Suspense>} />
        <Route path="/trayectoria" element={<Suspense fallback={<ViewLoading />}><CareerProfile /></Suspense>} />
        <Route path="/competencias" element={<Suspense fallback={<ViewLoading />}><Skills360 /></Suspense>} />
        <Route path="/organigrama" element={<Suspense fallback={<ViewLoading />}><OrgChart /></Suspense>} />
        <Route path="/persona/:userId" element={<Suspense fallback={<ViewLoading />}><PersonProfile /></Suspense>} />
        {/* Colaborador */}
        <Route path="/objetivos" element={<Suspense fallback={<ViewLoading />}><Objectives /></Suspense>} />
        <Route path="/mi-evaluacion" element={<Suspense fallback={<ViewLoading />}><SelfReview /></Suspense>} />
        <Route path="/check-in" element={<Suspense fallback={<ViewLoading />}><Checkin /></Suspense>} />
        <Route path="/feedback" element={<Suspense fallback={<ViewLoading />}><PeerFeedback /></Suspense>} />
        <Route path="/mi-desarrollo" element={<Suspense fallback={<ViewLoading />}><Development /></Suspense>} />
        <Route path="/reuniones" element={<Suspense fallback={<ViewLoading />}><Meetings /></Suspense>} />
        {/* Facilitador */}
        <Route path="/equipo" element={<Suspense fallback={<ViewLoading />}><Team /></Suspense>} />
        <Route path="/evaluar" element={<Navigate to="/equipo" replace />} />
        <Route path="/evaluar/:userId" element={<Suspense fallback={<ViewLoading />}><FacilitatorReview /></Suspense>} />
        {/* Admin */}
        <Route path="/ciclos" element={<Suspense fallback={<ViewLoading />}><AdminCycles /></Suspense>} />
        <Route path="/calibracion" element={<Suspense fallback={<ViewLoading />}><AdminCalibration /></Suspense>} />
        <Route path="/reportes" element={<Suspense fallback={<ViewLoading />}><AdminReports /></Suspense>} />
        <Route path="/directorio" element={<Suspense fallback={<ViewLoading />}><AdminDirectory /></Suspense>} />
        <Route path="/organizacion" element={<Suspense fallback={<ViewLoading />}><AdminOrganization /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
