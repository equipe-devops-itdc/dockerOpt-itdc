import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getChartTheme } from './theme'
import { useTheme } from '../../hooks/useTheme'
import { getAccentHex } from '../../lib/theme-colors'

export default function NetworkLineChart({ data }) {
  const { theme } = useTheme()
  const t = getChartTheme(theme)
  const accent = getAccentHex(theme)

  if (!data.length) {
    return (
      <div className="h-[230px] flex items-center justify-center text-text-faint text-sm text-center px-6">
        En cours de collecte — le débit réseau s'affiche après quelques cycles d'actualisation
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="t" tick={{ fill: t.text, fontSize: 11 }} axisLine={{ stroke: t.grid }} tickLine={false} />
        <YAxis tick={{ fill: t.text, fontSize: 11 }} axisLine={false} tickLine={false} unit=" Ko/s" width={70} />
        <Tooltip {...t.tooltip} />
        <Legend wrapperStyle={{ fontSize: 11, color: t.text }} />
        <Line type="monotone" dataKey="rx" name="Entrant (Rx)" stroke={accent} dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="tx" name="Sortant (Tx)" stroke="#4C8DFF" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
