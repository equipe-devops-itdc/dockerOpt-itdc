import { clampPercent } from '../lib/format'
import Sparkline from './Sparkline'

const ACCENT_CLASSES = {
  cyan: 'bg-signal-accent/10 text-signal-accent',
  blue: 'bg-signal-blue/10 text-signal-blue',
  violet: 'bg-signal-violet/10 text-signal-violet',
  amber: 'bg-signal-amber/10 text-signal-amber',
  red: 'bg-signal-red/10 text-signal-red',
}

const BAR_CLASSES = {
  ok: 'bg-signal-accent',
  warning: 'bg-signal-amber',
  critical: 'bg-signal-red',
  neutral: 'bg-ink-400',
}

function barLevel(pct, invert, thresholds) {
  const v = invert ? 100 - pct : pct
  if (v >= thresholds.critical) return 'critical'
  if (v >= thresholds.warning) return 'warning'
  return 'ok'
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  meta,
  accent = 'cyan',
  ring,
  unknown,
  invertRing = false,
  thresholds = { warning: 65, critical: 85 },
  sparkline,
}) {
  const hasRing = ring !== undefined && !unknown
  const pct = hasRing ? clampPercent(ring) : 0
  const level = hasRing ? barLevel(pct, invertRing, thresholds) : 'neutral'

  return (
    <div className="panel p-4 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="eyebrow">{label}</div>
        {Icon && (
          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${ACCENT_CLASSES[accent]}`}>
            <Icon size={15} strokeWidth={1.8} />
          </div>
        )}
      </div>

      <div className="font-display text-2xl sm:text-[26px] font-semibold text-text leading-none tabular-nums mt-2.5">
        {value}
      </div>
      {meta && <div className="text-xs text-text-faint mt-1 truncate">{meta}</div>}

      {sparkline?.length > 1 ? (
        <div className="mt-2.5 -mx-1">
          <Sparkline data={sparkline} level={level} />
        </div>
      ) : ring !== undefined ? (
        <div className="h-1 w-2/3 rounded-full bg-ink-600 overflow-hidden mt-3">
          {!unknown && (
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${BAR_CLASSES[level]}`}
              style={{ width: `${Math.max(pct, 4)}%` }}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
