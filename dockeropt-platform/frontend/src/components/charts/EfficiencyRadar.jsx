import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { getChartTheme } from './theme'
import { useTheme } from '../../hooks/useTheme'
import { getAccentHex } from '../../lib/theme-colors'

export default function EfficiencyRadar({ data }) {
  const { theme } = useTheme()
  const t = getChartTheme(theme)
  const accent = getAccentHex(theme)

  if (!data.length) {
    return (
      <div className="h-[230px] flex items-center justify-center text-text-faint text-sm">
        Aucun conteneur actif à analyser
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={230}>
      <RadarChart data={data}>
        <PolarGrid stroke={t.grid} />
        <PolarAngleAxis dataKey="name" tick={{ fill: t.text, fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: t.text, fontSize: 10 }} axisLine={false} />
        <Tooltip {...t.tooltip} formatter={(v) => [`${v}%`, 'Efficacité']} />
        <Radar dataKey="value" stroke={accent} fill={accent} fillOpacity={0.22} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
