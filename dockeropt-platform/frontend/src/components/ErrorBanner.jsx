import { TriangleAlert } from 'lucide-react'

export default function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="flex items-center gap-2 text-sm text-signal-red bg-signal-red/10 border border-signal-red/20 rounded-lg px-4 py-3 mb-4">
      <TriangleAlert size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  )
}
