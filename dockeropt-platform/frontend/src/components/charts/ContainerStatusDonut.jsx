import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getChartTheme } from './theme'
import { useTheme } from '../../hooks/useTheme'
import { getAccentHex } from '../../lib/theme-colors'

const STATUS_GROUPS = [
  { key: 'running', label: 'Running', match: (s) => s === 'running' },
  { key: 'stopped', label: 'Stopped', match: (s) => s === 'exited' },
  { key: 'pending', label: 'Pending', match: (s) => ['created', 'restarting', 'paused', 'removing'].includes(s) },
  { key: 'error', label: 'Error', match: (s) => s === 'dead' },
]

export default function ContainerStatusDonut({ containers }) {
  const { theme } = useTheme()
  const t = getChartTheme(theme)
  const COLORS = { running: getAccentHex(theme), stopped: '#4C8DFF', pending: '#F5A524', error: '#FB5B4C' }

  const total = containers.length
  const counts = STATUS_GROUPS.map((g) => ({
    ...g,
    count: containers.filter((c) => g.match(c.status)).length,
  })).filter((g) => g.count > 0)

  if (!total) {
    return (
      <div className="h-[230px] flex items-center justify-center text-text-faint text-sm">
        Aucun conteneur détecté
      </div>
    )
  }

  const data = counts.map((g) => ({ name: g.label, value: g.count, key: g.key }))

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-[170px] h-[170px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.key} fill={COLORS[d.key]} />
              ))}
            </Pie>
            <Tooltip {...t.tooltip} formatter={(v, n) => [v, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="font-display text-2xl font-semibold text-text leading-none">{total}</div>
          <div className="text-[11px] text-text-faint mt-1">Total</div>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 min-w-0">
        {counts.map((g) => (
          <div key={g.key} className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[g.key] }} />
            <span className="text-text-dim flex-1 truncate">{g.label}</span>
            <span className="text-text font-medium font-mono text-xs">
              {g.count} <span className="text-text-faint">({Math.round((g.count / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
