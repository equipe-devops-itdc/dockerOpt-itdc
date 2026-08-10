import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'
import { getAccentHex } from '../lib/theme-colors'
import { useTheme } from '../hooks/useTheme'

const COLORS = { ok: null, warning: '#F5A524', critical: '#FB5B4C' }

export default function Sparkline({ data, level = 'ok', height = 34 }) {
  const { theme } = useTheme()
  if (!data || data.length < 2) {
    return <div style={{ height }} />
  }
  const color = COLORS[level] || getAccentHex(theme)
  const gradientId = `spark-${color.replace('#', '')}`

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.75} fill={`url(#${gradientId})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
