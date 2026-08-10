import { useTheme } from '../hooks/useTheme'
import { getAccentHex } from '../lib/theme-colors'

function levelColor(level, theme) {
  if (level === 'critical') return '#FB5B4C'
  if (level === 'warning') return '#F5A524'
  if (level === 'ok') return getAccentHex(theme)
  return theme === 'light' ? '#CBD5E1' : '#232B36' // pas de donnée
}

function levelFor(value) {
  if (value == null) return 'unknown'
  if (value >= 85) return 'critical'
  if (value >= 65) return 'warning'
  return 'ok'
}

// Renders a rolling strip of ticks representing recent overall system pressure,
// similar in spirit to a heart-rate monitor: reads at a glance, degrades gracefully
// when data points are missing rather than showing a broken chart.
export default function PressureStrip({ history = [], width = 260, height = 28 }) {
  const { theme } = useTheme()
  const slots = 36
  const padded = Array.from({ length: slots }, (_, i) => {
    const idx = history.length - (slots - i)
    return idx >= 0 ? history[idx] : null
  })
  const barWidth = width / slots

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {padded.map((v, i) => {
        const level = levelFor(v)
        const h = v == null ? 4 : Math.max(4, (v / 100) * height)
        return (
          <rect
            key={i}
            x={i * barWidth + 0.5}
            y={height - h}
            width={Math.max(barWidth - 1.5, 1)}
            height={h}
            rx={1}
            fill={levelColor(level, theme)}
            opacity={v == null ? 0.5 : 0.55 + (i / slots) * 0.45}
          />
        )
      })}
    </svg>
  )
}
