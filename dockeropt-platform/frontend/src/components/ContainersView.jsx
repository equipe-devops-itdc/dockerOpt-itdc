import { useMemo, useState } from 'react'
import { Play, Square, Pause, HelpCircle, Sparkles, ScrollText } from 'lucide-react'
import SearchInput from './SearchInput'
import PageHeader from './PageHeader'
import ContainerLogsModal from './ContainerLogsModal'
import { formatBytes, clampPercent } from '../lib/format'

const STATUS_META = {
  running: { label: 'Actif', icon: Play, cls: 'text-signal-accent bg-signal-accent/10' },
  exited: { label: 'Arrêté', icon: Square, cls: 'text-signal-red bg-signal-red/10' },
  paused: { label: 'En pause', icon: Pause, cls: 'text-signal-amber bg-signal-amber/10' },
}

function barTone(pct) {
  if (pct >= 85) return 'bg-signal-red'
  if (pct >= 65) return 'bg-signal-amber'
  return 'bg-signal-accent'
}

function Bar({ pct, className = 'w-24' }) {
  const clamped = clampPercent(pct)
  return (
    <div className={`h-1.5 ${className} rounded-full bg-ink-600 overflow-hidden`}>
      <div className={`h-full rounded-full ${barTone(clamped)}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, icon: HelpCircle, cls: 'text-text-dim bg-ink-600' }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${meta.cls}`}>
      <Icon size={12} />
      {meta.label}
    </span>
  )
}

function NewBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-signal-accent bg-signal-accent/15 rounded-full px-1.5 py-0.5">
      <Sparkles size={10} /> Nouveau
    </span>
  )
}

function LogsButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-text-dim hover:text-signal-accent transition-colors"
      title="Voir les journaux"
    >
      <ScrollText size={13} /> <span className="hidden lg:inline">Logs</span>
    </button>
  )
}

export default function ContainersView({ containers, error }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return containers
    const q = query.toLowerCase()
    return containers.filter((c) => c.name.toLowerCase().includes(q) || (c.stack || '').toLowerCase().includes(q))
  }, [containers, query])

  if (error) {
    return (
      <div className="panel p-10 text-center text-signal-red text-sm">
        Impossible de charger la liste des conteneurs — {error}
      </div>
    )
  }

  if (!containers.length) {
    return (
      <div>
        <PageHeader title="Conteneurs" description="Vue détaillée de chaque conteneur actif ou arrêté sur cet hôte Docker." />
        <div className="panel p-10 text-center text-text-faint text-sm">
          Aucun conteneur détecté sur cet hôte Docker
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Conteneurs" description="Vue détaillée de chaque conteneur actif ou arrêté sur cet hôte Docker." />
      <div className="space-y-4">
      <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un conteneur…" />

      {!filtered.length ? (
        <div className="panel p-10 text-center text-text-faint text-sm">Aucun conteneur ne correspond à cette recherche</div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((c) => {
              const cpuPct = clampPercent(c.cpu?.usage)
              const memPct = clampPercent(c.memory?.percent)
              return (
                <div key={c.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-text truncate">{c.name}</span>
                        {c.isNew && <NewBadge />}
                      </div>
                      <div className="text-[11px] text-text-faint font-mono mt-0.5">{c.id}</div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.cpu && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-text-faint mb-1">
                        <span>CPU</span><span className="font-mono">{cpuPct.toFixed(0)}%</span>
                      </div>
                      <Bar pct={cpuPct} className="w-full" />
                    </div>
                  )}
                  {c.memory && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-text-faint mb-1">
                        <span>Mémoire</span>
                        <span className="font-mono">{formatBytes(c.memory.usage)} / {c.memory.limit ? formatBytes(c.memory.limit) : '∞'}</span>
                      </div>
                      <Bar pct={memPct} className="w-full" />
                    </div>
                  )}
                  {!!c.ports?.length && (
                    <div className="mt-3 text-xs text-text-dim">
                      Ports : {c.ports.map((p) => `${p.PrivatePort}→${p.PublicPort || '?'}`).join(', ')}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-ink-600/60">
                    <LogsButton onClick={() => setSelected(c)} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block panel overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-500 text-left">
                  {['Conteneur', 'Image', 'Statut', 'CPU', 'Mémoire', 'Limite RAM', 'Ports', ''].map((h) => (
                    <th key={h} className="eyebrow px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const cpuPct = clampPercent(c.cpu?.usage)
                  const memPct = clampPercent(c.memory?.percent)
                  return (
                    <tr key={c.id} className="border-b border-ink-600/60 last:border-0 hover:bg-ink-700/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text">{c.name}</span>
                          {c.isNew && <NewBadge />}
                        </div>
                        <div className="text-[11px] text-text-faint font-mono">{c.id}</div>
                      </td>
                      <td className="px-4 py-3 text-text-dim text-xs">{c.image?.split('/').pop() || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3">
                        {c.cpu ? (
                          <div className="flex items-center gap-2">
                            <Bar pct={cpuPct} />
                            <span className="text-xs text-text-dim font-mono w-9">{cpuPct.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.memory ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <Bar pct={memPct} />
                              <span className="text-xs text-text-dim font-mono w-9">{memPct.toFixed(0)}%</span>
                            </div>
                            <div className="text-[11px] text-text-faint mt-1">
                              {formatBytes(c.memory.usage)} / {c.memory.limit ? formatBytes(c.memory.limit) : '∞'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-text-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-dim text-xs">{c.memoryLimit ? formatBytes(c.memoryLimit) : '∞'}</td>
                      <td className="px-4 py-3 text-text-dim text-xs whitespace-nowrap">
                        {c.ports?.length ? c.ports.map((p) => `${p.PrivatePort}→${p.PublicPort || '?'}`).join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <LogsButton onClick={() => setSelected(c)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>

      <ContainerLogsModal container={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
