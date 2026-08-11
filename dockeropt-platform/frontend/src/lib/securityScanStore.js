
import { api } from './api'

let state = {
  status: 'idle',       // idle | scanning | done | error
  entries: [],           // lignes du "terminal", ajoutées une à une
  fixMessages: {},        // "container:findingId" -> message de correction
  fixingKey: null,
  startedAt: null,
  finishedAt: null,
  error: null,
}

const listeners = new Set()

function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  listeners.forEach((l) => l())
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return state
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Permet d'ignorer les résultats d'un scan devenu obsolète si un
// nouveau scan est relancé pendant qu'un ancien tournait encore.
let currentScanId = 0

function push(scanId, entry) {
  if (scanId !== currentScanId) return
  setState((s) => ({
    entries: [...s.entries, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ...entry }],
  }))
}

async function runScan() {
  if (state.status === 'scanning') return // un scan tourne déjà, on ne double pas

  const scanId = ++currentScanId
  setState({
    status: 'scanning',
    entries: [],
    fixMessages: {},
    fixingKey: null,
    startedAt: Date.now(),
    finishedAt: null,
    error: null,
  })

  try {
    push(scanId, { kind: 'system', severity: 'info', text: '$ dockeropt security-audit --scan' })

    const audit = await api.securityAudit()
    if (scanId !== currentScanId) return

    push(scanId, {
      kind: 'system',
      severity: 'info',
      text: `${audit.total_containers} conteneur(s) actif(s) à analyser`,
    })
    await sleep(150)

    const containers = audit.containers || []

    for (const c of containers) {
      if (scanId !== currentScanId) return

      push(scanId, { kind: 'header', severity: 'info', text: `→ ${c.name}  (${c.image})` })
      await sleep(120)

      if (!c.findings?.length) {
        push(scanId, { kind: 'ok', severity: 'info', text: '  aucune anomalie de configuration' })
        await sleep(80)
      } else {
        for (const f of c.findings) {
          push(scanId, {
            kind: 'finding',
            severity: f.severity,
            container: c,
            finding: f,
            text: `  [config] ${f.title} — ${f.detail}`,
          })
          await sleep(100)
        }
      }

      push(scanId, { kind: 'system', severity: 'info', text: `  analyse des vulnérabilités (Trivy) sur ${c.image}…` })
      await sleep(60)

      try {
        const scan = await api.scanImage(c.image)
        if (scanId !== currentScanId) return

        const counts = Object.entries(scan.counts || {})
          .map(([k, v]) => `${k}:${v}`)
          .join('  ')

        push(scanId, {
          kind: 'trivy',
          severity: scan.counts?.CRITICAL || scan.counts?.HIGH ? 'critical' : 'info',
          text: `  [trivy] ${counts || 'aucune vulnérabilité connue'}`,
        })

        for (const v of scan.topVulnerabilities || []) {
          push(scanId, {
            kind: 'vuln',
            severity: v.severity === 'CRITICAL' ? 'critical' : v.severity === 'HIGH' ? 'warning' : 'info',
            text: `    ${v.id} :: ${v.package} :: ${v.installedVersion}${v.fixedVersion ? ` → ${v.fixedVersion}` : ' → aucun correctif'}`,
          })
          await sleep(50)
        }
      } catch (e) {
        push(scanId, { kind: 'error', severity: 'warning', text: `  scan Trivy impossible :: ${e.message}` })
      }

      await sleep(150)
    }

    if (scanId !== currentScanId) return
    push(scanId, { kind: 'system', severity: 'info', text: '$ scan terminé.' })
    setState({ status: 'done', finishedAt: Date.now() })
  } catch (e) {
    if (scanId !== currentScanId) return
    push(scanId, { kind: 'error', severity: 'critical', text: e.message || 'Scan impossible' })
    setState({ status: 'error', error: e.message, finishedAt: Date.now() })
  }
}

async function fixFinding(entry) {
  const key = `${entry.container.name}:${entry.finding.id}`
  setState({ fixingKey: key })
  try {
    const result = await api.securityAutoFix(entry.container.name, entry.finding.id, entry.container.host)
    setState((s) => ({ fixMessages: { ...s.fixMessages, [key]: result.message }, fixingKey: null }))
  } catch (e) {
    setState((s) => ({
      fixMessages: { ...s.fixMessages, [key]: e.message || 'Correction impossible' },
      fixingKey: null,
    }))
  }
}

export const securityScanStore = { subscribe, getSnapshot, runScan, fixFinding }