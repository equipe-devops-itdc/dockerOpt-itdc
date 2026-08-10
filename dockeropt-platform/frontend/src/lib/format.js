export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(bytes / Math.pow(k, i) < 10 ? 2 : 1))} ${sizes[i]}`
}

export function formatPercent(value, digits = 1) {
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `${n.toFixed(digits)}%`
}

export function clampPercent(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, n))
}

export function severityColor(severity) {
  switch (severity) {
    case 'critical': return 'signal-red'
    case 'warning': return 'signal-amber'
    default: return 'signal-blue'
  }
}

export function pressureLevel(value) {
  const n = Number(value) || 0
  if (n >= 85) return 'critical'
  if (n >= 65) return 'warning'
  return 'ok'
}

export function relativeTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 5) return "à l'instant"
  if (s < 60) return `il y a ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  return `il y a ${h} h`
}

export function shortId(id) {
  return id ? id.substring(0, 12) : '—'
}
