// dealiq/frontend/components/ui/Toast.js
'use client'
import { useUIStore } from '../../lib/store'

export default function Toast() {
  const { toast, hideToast } = useUIStore()
  if (!toast) return null
  const styles = {
    success: { bg: '#111119', icon: '✅' },
    error:   { bg: '#dc2626', icon: '⚠️' },
    info:    { bg: '#3d5afe', icon: 'ℹ️' },
  }
  const s = styles[toast.type] || styles.success
  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-semibold shadow-2xl max-w-xs animate-[fadeUp_0.4s_cubic-bezier(0.34,1.56,0.64,1)_both]"
      style={{ background: s.bg }}
    >
      <span>{s.icon}</span>
      <span>{toast.message}</span>
      <button onClick={hideToast} className="ml-2 opacity-60 hover:opacity-100 transition-opacity text-base">✕</button>
    </div>
  )
}
