import { useMemo, useState } from 'react'
import { ChevronDown, Layers, Sparkles } from 'lucide-react'
import SearchInput from './SearchInput'
import PageHeader from './PageHeader'
import { clampPercent, formatBytes } from '../lib/format'

function groupByStack(containers) {
  const groups = new Map()
  containers.forEach((c) => {
    const key = c.stack || 'standalone'
    if (!groups.has(key)) groups.set(key, { stack: key, items: [] })
    groups.get(key).items.push(c)
  })
  return Array.from(groups.values()).map(({ stack, items }) => {
    const running = items.filter((c) => c.status === 'running')
    const avgCpu = running.length
      ? running.reduce((acc, c) => acc + clampPercent(c.cpu?.usage), 0) / running.length
      : 0
    const totalMem = running.reduce((acc, c) => acc + (c.memory?.usage || 0), 0)
    const isNew = items.some((c) => c.isNew)
    return { key: stack, stack, items, running: running.length, total: items.length, avgCpu, totalMem, isNew }
  }).sort((a, b) => a.stack.localeCompare(b.stack))
}

export default function ServicesView({ containers, error }) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())

  const filtered = useMemo(() => {
    if (!query.trim()) return containers
    const q = query.toLowerCase()
    return containers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.stack || '').toLowerCase().includes(q)
    )
  }, [containers, query])

  const groups = useMemo(() => groupByStack(filtered), [filtered])

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (error) {
    return <div className="panel p-10 text-center text-signal-red text-sm">Impossible de charger les services — {error}</div>
  }

  return (
    <div>
      <PageHeader
        title="Services"
        description="Vos microservices regroupés par stack applicative (déploiement docker-compose), avec leur état de santé global."
      />

      <div className="space-y-5">
        <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un service ou une stack…" />

        {!groups.length ? (
          <div className="panel p-10 text-center text-text-faint text-sm">Aucun service ne correspond à cette recherche</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {groups.map((g) => {
              const isOpen = expanded.has(g.key)
              return (
                <div key={g.key} className="panel overflow-hidden">
                  <button
                    onClick={() => toggle(g.key)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-ink-700/30 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-signal-blue/10 text-signal-blue flex items-center justify-center shrink-0">
                      <Layers size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-text truncate">{g.stack}</div>
                        {g.isNew && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-signal-accent bg-signal-accent/15 rounded-full px-2 py-0.5">
                            <Sparkles size={10} /> Nouveau
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-faint mt-0.5">
                        {g.running}/{g.total} actifs · CPU moy. {g.avgCpu.toFixed(0)}% · {formatBytes(g.totalMem)}
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-text-faint shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-ink-500 divide-y divide-ink-600/60">
                      {g.items.map((c) => {
                        const isRunning = c.status === 'running'
                        return (
                          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                isRunning ? 'bg-signal-accent' : 'bg-signal-red'
                              }`}
                            />
                            <span className="text-text truncate flex-1">{c.service || c.name}</span>
                            {c.isNew && (
                              <span className="text-[10px] font-semibold text-signal-accent bg-signal-accent/15 rounded-full px-1.5 py-0.5 shrink-0">
                                Nouveau
                              </span>
                            )}
                            {isRunning ? (
                              c.cpu && <span className="text-xs text-text-faint font-mono w-16 text-right shrink-0">{clampPercent(c.cpu.usage).toFixed(0)}%</span>
                            ) : (
                              <span className="text-xs font-medium text-signal-red w-16 text-right shrink-0">Arrêté</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
