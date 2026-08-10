import { useState } from 'react'
import { CircleCheck, Cpu, MemoryStick, Loader2 } from 'lucide-react'
import PageHeader from './PageHeader'

const SEVERITY_META = {
  info: { text: 'text-signal-blue', bg: 'bg-signal-blue/10' },
  warning: { text: 'text-signal-amber', bg: 'bg-signal-amber/10' },
  critical: { text: 'text-signal-red', bg: 'bg-signal-red/10' },
}

const TYPE_ICON = { cpu: Cpu, memory: MemoryStick }

// Le backend applique un délai de grâce (3 min) avant de rejuger un
// conteneur après une optimisation appliquée avec succès. On aligne la
// durée de masquage local sur cette même fenêtre, en garantie côté
// interface : l'élément ne doit pas pouvoir réapparaître avant que le
// backend n'ait lui-même arrêté de le proposer.
const OPTIMISTIC_HIDE_MS = 3 * 60 * 1000

export default function OptimizationView({ recommendations, history, error, onApply }) {
  const [applying, setApplying] = useState(null)
  const [justApplied, setJustApplied] = useState(new Set())

  const header = (
    <PageHeader
      title="Optimisation"
      description="Recommandations basées sur l'usage réel de vos conteneurs, avec application en un clic."
    />
  )

  if (error) {
    return (
      <div>
        {header}
        <div className="panel p-10 text-center text-signal-red text-sm">
          Analyse indisponible — {error}
        </div>
      </div>
    )
  }

  if (!recommendations) {
    return (
      <div>
        {header}
        <div className="panel p-10 text-center text-text-faint text-sm flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Analyse des ressources en cours…
        </div>
      </div>
    )
  }

  const windowMinutes = recommendations.analysis_window_minutes || 5
  const monitored = recommendations.total_containers ?? 0
  const excluded = recommendations.excluded_infra_containers ?? 0
  const list = (recommendations.recommendations || []).filter(
    (rec) => !justApplied.has(`${rec.host || 'local'}:${rec.container}:${rec.action}`)
  )

  const handleApply = async (rec) => {
    const key = `${rec.host || 'local'}:${rec.container}:${rec.action}`
    setApplying(key)
    const success = await onApply(rec.container, rec.action, rec.host || 'local')
    setApplying(null)
    if (!success) return // échec : on laisse la recommandation visible, rien à masquer
    setJustApplied((prev) => new Set(prev).add(key))
    setTimeout(() => {
      setJustApplied((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, OPTIMISTIC_HIDE_MS)
  }

  return (
    <div>
      {header}
      <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="eyebrow">Recommandations d'optimisation</div>
          <div className="text-[11px] text-text-faint">
            Moyenne glissante sur {windowMinutes} min · {monitored} service{monitored > 1 ? 's' : ''} surveillé{monitored > 1 ? 's' : ''}
            {excluded > 0 ? ` · ${excluded} composant${excluded > 1 ? 's' : ''} d'infrastructure exclu${excluded > 1 ? 's' : ''}` : ''}
          </div>
        </div>
        {!list.length ? (
          <div className="panel p-8 text-center text-signal-accent text-sm flex items-center justify-center gap-2">
            <CircleCheck size={16} /> Aucune recommandation — l'allocation actuelle des ressources est optimale
          </div>
        ) : (
          <div className="panel overflow-hidden divide-y divide-ink-600/50">
            {list.map((rec, idx) => {
              const Icon = TYPE_ICON[rec.type] || Cpu
              const key = `${rec.host || 'local'}:${rec.container}:${rec.action}`
              const isApplying = applying === key
              const meta = SEVERITY_META[rec.severity] || SEVERITY_META.info
              return (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-ink-700/25 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text">
                        {rec.container} <span className="text-text-faint font-normal">· {rec.type.toUpperCase()}</span>
                      </div>
                      <div className="text-xs text-text-dim mt-0.5">
                        {rec.suggestion} — <span className="text-text-faint">{rec.impact}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className={`w-full sm:w-auto justify-center shrink-0 ${rec.severity === 'critical' ? 'btn-warning' : 'btn-primary'}`}
                    onClick={() => handleApply(rec)}
                    disabled={isApplying}
                  >
                    {isApplying ? <Loader2 size={14} className="animate-spin" /> : null}
                    Appliquer
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <div className="eyebrow mb-3">Historique des optimisations</div>
        {!history.length ? (
          <div className="panel p-8 text-center text-text-faint text-sm">Aucune optimisation appliquée pour l'instant</div>
        ) : (
          <div className="panel overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-ink-500 text-left">
                  {['Date', 'Conteneur', 'Action', 'Statut'].map((h) => (
                    <th key={h} className="eyebrow px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.slice(-10).reverse().map((h, i) => (
                  <tr key={i} className="border-b border-ink-600/60 last:border-0">
                    <td className="px-4 py-3 text-xs text-text-dim font-mono">
                      {new Date(h.timestamp).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-text">{h.container}</td>
                    <td className="px-4 py-3 text-text-dim text-xs">{h.action}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${h.status === 'applied' ? 'text-signal-accent' : 'text-signal-amber'}`}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
