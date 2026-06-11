/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'warning'
interface Toast {
  id: number
  message: string
  type: ToastType
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {})

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const colors: Record<ToastType, string> = {
    success: 'bg-primary',
    error: 'bg-highlight',
    warning: 'bg-accent',
  }
  const icons: Record<ToastType, string> = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2 sm:right-6 sm:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${colors[t.type]} view-enter flex items-start gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-xl`}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {icons[t.type]}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
