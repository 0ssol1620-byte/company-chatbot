'use client'

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timerRef = useRef<Record<string, NodeJS.Timeout>>({})

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timerRef.current[id]) {
      clearTimeout(timerRef.current[id])
      delete timerRef.current[id]
    }
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }])
    timerRef.current[id] = setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  useEffect(() => {
    return () => {
      Object.values(timerRef.current).forEach(clearTimeout)
    }
  }, [])

  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }

  const colors: Record<ToastType, string> = {
    success: '#2ed573',
    error: '#ff4757',
    info: '#1e90ff',
    warning: '#ffd700',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium"
            style={{
              background: '#0d0d0d',
              border: `2px solid ${colors[t.type]}`,
              boxShadow: `3px 3px 0 ${colors[t.type]}66`,
              color: '#ededed',
              animation: 'slideInRight 0.2s ease-out',
              minWidth: '220px',
              maxWidth: '320px',
            }}
          >
            <span style={{ color: colors[t.type], fontWeight: 'bold', flexShrink: 0 }}>
              {icons[t.type]}
            </span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
