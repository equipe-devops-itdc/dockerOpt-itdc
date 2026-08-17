import { useEffect, useRef, useState } from 'react'
import { X, Terminal, Loader2, RadioTower } from 'lucide-react'
import { api } from '../lib/api'

// Fréquence de rafraîchissement du journal pendant que la modale est
// ouverte — assez rapide pour donner l'impression d'un suivi en direct
// (façon `docker logs -f`), sans bombarder le backend de requêtes.
const POLL_INTERVAL_MS = 3000

export default function ContainerLogsModal({ container, onClose }) {
  const [logs, setLogs] = useState(null)
  const [logsError, setLogsError] = useState(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const scrollRef = useRef(null)

  const loadLogs = async (silent = false) => {
    if (!container) return
    if (!silent) setLogsLoading(true)
    try {
      const data = await api.containerLogs(container.id, container.host || 'local')
      setLogs(data.lines)
      setLogsError(null)
    } catch (err) {
      setLogsError(err.message || 'Indisponible')
    } finally {
      if (!silent) setLogsLoading(false)
    }
  }

  // Chargement initial à l'ouverture, puis suivi en temps réel : tant que
  // la modale reste ouverte sur ce conteneur, on repolle silencieusement
  // (sans montrer le loader) pour que TOUTE nouvelle action du conteneur
  // (redémarrage, écriture applicative, etc.) apparaisse sans action de
  // l'utilisateur. L'intervalle s'arrête proprement à la fermeture ou au
  // changement de conteneur.
  useEffect(() => {
    if (!container) return
    setLogs(null)
    setLogsError(null)
    loadLogs(false)

    const interval = setInterval(() => loadLogs(true), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container])

  // Défile automatiquement vers la dernière ligne à chaque nouvelle entrée,
  // comme un vrai terminal qui suit le flux.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  if (!container) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative panel w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-500 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-base truncate">{container.name}</h2>
            <p className="text-xs text-text-faint mt-0.5 font-mono truncate">{container.id}</p>
          </div>
          <button onClick={onClose} className="text-text-faint hover:text-text p-1 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-ink-500 shrink-0">
          <div className="flex items-center gap-1.5 text-sm font-medium text-signal-accent">
            <Terminal size={14} /> Journal du conteneur
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-faint">
            <RadioTower size={12} className="text-signal-accent animate-pulse" />
            suivi en direct
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-5 pt-3">
          {logsLoading && !logs ? (
            <div className="flex items-center justify-center gap-2 text-text-faint text-sm py-10">
              <Loader2 size={16} className="animate-spin" /> Chargement des journaux…
            </div>
          ) : logsError ? (
            <div className="text-sm text-signal-red bg-signal-red/10 border border-signal-red/20 rounded-lg px-3.5 py-2.5">
              {logsError}
            </div>
          ) : !logs?.length ? (
            <div className="text-sm text-text-faint text-center py-10">Aucune sortie récente pour ce conteneur</div>
          ) : (
            <pre className="bg-ink-950 border border-ink-500 rounded-lg p-3.5 text-[11px] leading-relaxed font-mono text-text-dim overflow-x-auto max-h-[55vh] whitespace-pre-wrap break-all">
              {logs.join('\n')}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}