import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getChartTheme } from './theme'
import { useTheme } from '../../hooks/useTheme'

const barColor = (v) => (v >= 85 ? '#FB5B4C' : v >= 65 ? '#F5A524' : '#4C8DFF')

export default function CpuBarChart({ data }) {
  const { theme } = useTheme()
  const t = getChartTheme(theme)

  if (!data.length) {
    return <EmptyState />
  }
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: t.text, fontSize: 11 }} axisLine={{ stroke: t.grid }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: t.text, fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip {...t.tooltip} formatter={(v) => [`${v}%`, 'CPU']} />
        <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={38}>
          {data.map((d, i) => (
            <Cell key={i} fill={barColor(d.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyState() {
  return (
    <div className="h-[230px] flex items-center justify-center text-text-faint text-sm">
      Aucune donnée de conteneur disponible
    </div>
  )
}
