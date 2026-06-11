import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: GitHub Pages no conoce las rutas internas; con hash no hay 404 */}
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
