import { clampPercent } from '../lib/format'
import { useTheme } from '../hooks/useTheme'
import { getAccentHex } from '../lib/theme-colors'

function levelFor(value, thresholds) {
  const v = Number(value) || 0
  if (v >= thresholds.critical) return 'critical'
  if (v >= thresholds.warning) return 'warning'
  return 'ok'
}

export default function ResourceRing({
  value,
  size = 64,
  stroke = 6,
  thresholds = { warning: 65, critical: 85 },
  unknown = false,
  invert = false,
}) {
  const { theme } = useTheme()
  const COLORS = {
    ok: getAccentHex(theme),
    warning: '#F5A524',
    critical: '#FB5B4C',
    neutral: '#37414F',
  }
  const pct = clampPercent(value)
  // invert=true : une valeur ÉLEVÉE est BONNE (ex: score de sécurité sur
  // 100) — on évalue alors le niveau sur son complément à 100.
  const level = unknown ? 'neutral' : levelFor(invert ? 100 - pct : pct, thresholds)
  const color = COLORS[level]
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = unknown ? 0 : circumference * (1 - pct / 100)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-ink-600"
      />
      {!unknown && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
      )}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-text font-mono font-semibold"
        style={{ fontSize: size * 0.24 }}
      >
        {unknown ? '—' : `${Math.round(pct)}`}
      </text>
    </svg>
  )
}
