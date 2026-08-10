import { useEffect, useState } from 'react'
import { X, Terminal, History, Loader2, RefreshCw, Cpu, MemoryStick } from 'lucide-react'
import { api } from '../lib/api'

const TYPE_ICON = { cpu: Cpu, memory: MemoryStick }

export default function ContainerLogsModal({ container, onClose }) {
  const [tab, setTab] = useState('logs')
  const [logs, setLogs] = useState(null)
  const [logsError, setLogsError] = useState(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [detections, setDetections] = useState(null)
  const [detectionsError, setDetectionsError] = useState(null)

  const loadLogs = async () => {
    if (!container) return
    setLogsLoading(true)
    setLogsError(null)
    try {
      const data = await api.containerLogs(container.id, container.host || 'local')
      setLogs(data.lines)
    } catch (err) {
      setLogsError(err.message || 'Indisponible')
    } finally {
      setLogsLoading(false)
    }
  }

  const loadDetections = async () => {
    if (!container) return
    try {
      const data = await api.optimizationLogs(container.name)
      setDetections(data)
      setDetectionsError(null)
    } catch (err) {
      setDetectionsError(err.message || 'Indisponible')
    }
  }

  useEffect(() => {
    if (!container) return
    setLogs(null)
    setDetections(null)
    loadLogs()
    loadDetections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container])

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

        <div className="flex items-center gap-1 px-5 pt-3 border-b border-ink-500 shrink-0">
          <button
            onClick={() => setTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'logs' ? 'border-signal-accent text-signal-accent' : 'border-transparent text-text-faint hover:text-text'
            }`}
          >
            <Terminal size={14} /> Journal du conteneur
          </button>
          <button
            onClick={() => setTab('detections')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'detections' ? 'border-signal-accent text-signal-accent' : 'border-transparent text-text-faint hover:text-text'
            }`}
          >
            <History size={14} /> Détections d'optimisation
            {detections?.length > 0 && (
              <span className="text-[10px] font-mono bg-ink-600 text-text-dim rounded-full px-1.5 py-0.5">{detections.length}</span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'logs' && (
            <div>
              <div className="flex items-center justify-end px-5 pt-3">
                <button onClick={loadLogs} disabled={logsLoading} className="btn-ghost !py-1 !px-2.5 text-xs">
                  <RefreshCw size={12} className={logsLoading ? 'animate-spin' : ''} /> Rafraîchir
                </button>
              </div>
              <div className="px-5 pb-5 pt-2">
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
                  <pre className="bg-ink-950 border border-ink-500 rounded-lg p-3.5 text-[11px] leading-relaxed font-mono text-text-dim overflow-x-auto max-h-[45vh] whitespace-pre-wrap break-all">
                    {logs.join('\n')}
                  </pre>
                )}
              </div>
            </div>
          )}

          {tab === 'detections' && (
            <div className="px-5 py-4">
              {detectionsError ? (
                <div className="text-sm text-signal-red bg-signal-red/10 border border-signal-red/20 rounded-lg px-3.5 py-2.5">
                  {detectionsError}
                </div>
              ) : !detections?.length ? (
                <div className="text-sm text-text-faint text-center py-10">
                  Aucune optimisation détectée pour ce conteneur pour le moment
                </div>
              ) : (
                <div className="divide-y divide-ink-600/50 -mx-5">
                  {detections.map((d, i) => {
                    const Icon = TYPE_ICON[d.type] || Cpu
                    return (
                      <div key={i} className="flex items-start gap-3 px-5 py-3">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                          d.severity === 'critical' ? 'bg-signal-red/10 text-signal-red' : d.severity === 'warning' ? 'bg-signal-amber/10 text-signal-amber' : 'bg-signal-blue/10 text-signal-blue'
                        }`}>
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-text">{d.suggestion}</div>
                          <div className="text-xs text-text-faint mt-0.5">
                            Cause : {d.cause} · {new Date(d.timestamp).toLocaleString('fr-FR')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
