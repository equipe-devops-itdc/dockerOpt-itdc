import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getChartTheme } from './theme'
import { useTheme } from '../../hooks/useTheme'
import { getAccentHex } from '../../lib/theme-colors'

export default function MemoryDonut({ data }) {
  const { theme } = useTheme()
  const t = getChartTheme(theme)
  const PALETTE = [getAccentHex(theme), '#4C8DFF', '#8B7CF6', '#F5A524', '#FB5B4C', '#5FD0E8']

  if (!data.length) {
    return (
      <div className="h-[230px] flex items-center justify-center text-text-faint text-sm">
        Aucune donnée mémoire disponible
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip {...t.tooltip} formatter={(v) => [`${v}%`, 'Mémoire']} />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          wrapperStyle={{ fontSize: 11, color: t.text }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
