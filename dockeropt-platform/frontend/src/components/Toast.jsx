import { useEffect } from 'react'
import { CircleCheck, CircleX } from 'lucide-react'

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 3200)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (!toast) return null
  const isError = toast.type === 'error'
  const Icon = isError ? CircleX : CircleCheck

  return (
    <div
      style={{ boxShadow: 'var(--panel-shadow)' }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium animate-[slideIn_0.25s_ease] ${
        isError
          ? 'bg-signal-red/10 border-signal-red/30 text-signal-red'
          : 'bg-signal-accent/10 border-signal-accent/30 text-signal-accent'
      }`}
    >
      <Icon size={16} />
      {toast.message}
    </div>
  )
}
