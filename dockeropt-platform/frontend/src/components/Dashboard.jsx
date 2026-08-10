import { Cpu, MemoryStick, HardDrive, Boxes, Network, Square } from 'lucide-react'
import StatCard from './StatCard'
import PageHeader from './PageHeader'
import CpuBarChart from './charts/CpuBarChart'
import MemoryDonut from './charts/MemoryDonut'
import NetworkLineChart from './charts/NetworkLineChart'
import EfficiencyRadar from './charts/EfficiencyRadar'
import ContainerStatusDonut from './charts/ContainerStatusDonut'
import ErrorBanner from './ErrorBanner'
import { clampPercent, formatBytes } from '../lib/format'

function firstValue(block) {
  const v = block?.data?.result?.[0]?.value?.[1]
  return v != null ? parseFloat(v) : null
}

export default function Dashboard({ system, containers, recommendations, networkHistory, cpuHistory, memHistory, diskHistory, netRateHistory, errors }) {
  const cpuVal = firstValue(system?.resources?.cpu)
  const memVal = firstValue(system?.resources?.memory)
  const diskVal = firstValue(system?.resources?.disk)
  const running = containers.filter((c) => c.status === 'running')
  const stopped = containers.filter((c) => c.status !== 'running')

  const cpuData = running.map((c) => ({ name: c.name, value: clampPercent(c.cpu?.usage) }))
  const memData = running.map((c) => ({ name: c.name, value: clampPercent(c.memory?.percent) }))
  const efficiencyData = running.map((c) => ({
    name: c.name,
    value: Math.max(0, 100 - clampPercent(c.memory?.percent)),
  }))

  const totalNetworkBytes = running.reduce((acc, c) => acc + (c.network?.rx || 0) + (c.network?.tx || 0), 0)
  const lastNetRate = netRateHistory?.length ? netRateHistory[netRateHistory.length - 1].value : null

  return (
    <div>
      <PageHeader
        hero
        title="Supervision et Optimisation des Ressources"
        description="Architectures microservices déployées sous Docker — analyse en temps réel."
      />

      <div className="space-y-6">
      <ErrorBanner message={errors.system && `Statistiques système indisponibles — ${errors.system}`} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          icon={Cpu}
          label="CPU"
          value={cpuVal != null ? `${cpuVal.toFixed(0)}%` : '—'}
          meta="Utilisation système"
          ring={cpuVal}
          unknown={cpuVal == null}
          sparkline={cpuHistory}
        />
        <StatCard
          icon={MemoryStick}
          label="Mémoire"
          value={memVal != null ? `${memVal.toFixed(0)}%` : '—'}
          meta="Utilisation système"
          ring={memVal}
          unknown={memVal == null}
          sparkline={memHistory}
        />
        <StatCard
          icon={HardDrive}
          label="Stockage"
          value={diskVal != null ? `${diskVal.toFixed(0)}%` : '—'}
          meta="Partition racine"
          ring={diskVal}
          unknown={diskVal == null}
          sparkline={diskHistory}
        />
        <StatCard
          icon={Boxes}
          label="Conteneurs"
          value={system?.docker ? system.docker.containers.running : running.length || '—'}
          meta={system?.docker ? `${system.docker.containers.total} au total` : 'En cours'}
          accent="blue"
        />
        <StatCard
          icon={Network}
          label="Réseau"
          value={lastNetRate != null ? `${lastNetRate} Ko/s` : formatBytes(totalNetworkBytes)}
          meta="Trafic cumulé"
          accent="violet"
          sparkline={netRateHistory}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="panel p-4 sm:p-5">
          <div className="eyebrow mb-4">Utilisation CPU par conteneur</div>
          <CpuBarChart data={cpuData} />
        </div>
        <div className="panel p-4 sm:p-5">
          <div className="eyebrow mb-4">Répartition des conteneurs</div>
          <ContainerStatusDonut containers={containers} />
        </div>
        <div className="panel p-4 sm:p-5">
          <div className="eyebrow mb-4">Utilisation mémoire par conteneur</div>
          <MemoryDonut data={memData} />
        </div>
        <div className="panel p-4 sm:p-5">
          <div className="eyebrow mb-4">Trafic réseau cumulé (Rx / Tx)</div>
          <NetworkLineChart data={networkHistory} />
        </div>
        <div className="panel p-4 sm:p-5 lg:col-span-2">
          <div className="eyebrow mb-4">Score d'efficacité par conteneur</div>
          <EfficiencyRadar data={efficiencyData} />
        </div>
      </div>

      {stopped.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="eyebrow px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
            Conteneurs arrêtés ({stopped.length})
          </div>
          <div className="divide-y divide-ink-600/50">
            {stopped.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                <div className="h-7 w-7 rounded-full bg-signal-red/10 text-signal-red flex items-center justify-center shrink-0">
                  <Square size={12} />
                </div>
                <span className="text-sm text-text truncate flex-1">{c.name}</span>
                <span className="text-xs font-medium text-signal-red shrink-0">
                  {c.status === 'paused' ? 'En pause' : 'Arrêté'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
