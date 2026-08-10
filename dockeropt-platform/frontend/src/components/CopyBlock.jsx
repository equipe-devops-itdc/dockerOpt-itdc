import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyBlock({ code, language = 'yaml' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (_) {
      /* clipboard unavailable — silently ignore */
    }
  }

  return (
    <div className="relative group">
      <pre className="bg-ink-950 border border-ink-500 rounded-lg p-3.5 text-[12px] leading-relaxed font-mono text-text-dim overflow-x-auto">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2.5 right-2.5 flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md bg-ink-700 text-text-dim hover:text-text border border-ink-500 opacity-80 hover:opacity-100 transition"
        aria-label={`Copier le bloc ${language}`}
      >
        {copied ? <Check size={12} className="text-signal-accent" /> : <Copy size={12} />}
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  )
}
