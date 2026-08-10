import { useState } from 'react'
import { ScanSearch, Loader2, Wrench, CircleCheck, CircleX } from 'lucide-react'
import PageHeader from './PageHeader'
import { api } from '../lib/api'

const severityClass = {
  critical: 'text-signal-red',
  warning: 'text-signal-amber',
  info: 'text-signal-blue',
}

function LogLine({ children, severity }) {
  return (
    <div className="font-mono text-xs leading-5 border-b border-ink-600/50 py-2">
      <span className={severityClass[severity] || 'text-text-dim'}>[{(severity || 'info').toUpperCase()}]</span>{' '}
      <span className="text-text-dim">{children}</span>
    </div>
  )
}

export default function SecurityView({ error }) {
  const [scanning, setScanning] = useState(false)
  const [logs, setLogs] = useState([])
  const [fixing, setFixing] = useState(null)
  const [fixMessages, setFixMessages] = useState({})

  const runScan = async () => {
    setScanning(true)
    setLogs([])
    setFixMessages({})
    try {
      const audit = await api.securityAudit()
      const next = []
      for (const c of audit.containers || []) {
        for (const f of c.findings || []) {
          next.push({
            kind: 'finding',
            severity: f.severity,
            container: c,
            finding: f,
            text: `${c.name} :: ${f.title} — ${f.detail}`,
          })
        }
        try {
          const scan = await api.scanImage(c.image)
          const counts = Object.entries(scan.counts || {}).map(([k, v]) => `${k}:${v}`).join(' ')
          next.push({
            kind: 'trivy',
            severity: (scan.counts?.CRITICAL || scan.counts?.HIGH) ? 'critical' : 'info',
            text: `${c.name} :: Trivy ${c.image} :: ${counts || 'aucune vulnérabilité'}`,
            vulnerabilities: scan.topVulnerabilities || [],
          })
        } catch (e) {
          next.push({ kind: 'error', severity: 'warning', text: `${c.name} :: scan Trivy impossible :: ${e.message}` })
        }
      }
      setLogs(next)
    } catch (e) {
      setLogs([{ kind: 'error', severity: 'critical', text: e.message || 'Scan impossible' }])
    } finally {
      setScanning(false)
    }
  }

  const fix = async (entry) => {
    const key = `${entry.container.name}:${entry.finding.id}`
    setFixing(key)
    try {
      const result = await api.securityAutoFix(entry.container.name, entry.finding.id, entry.container.host)
      setFixMessages((m) => ({ ...m, [key]: result.message }))
    } catch (e) {
      setFixMessages((m) => ({ ...m, [key]: e.message || 'Correction impossible' }))
    } finally {
      setFixing(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Sécurité"
        description=""
        action={
          <button onClick={runScan} disabled={scanning} className="btn-primary !py-2 !px-4">
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
            {scanning ? 'Scan…' : 'Scanner'}
          </button>
        }
      />

      {error && <div className="panel p-4 text-signal-red text-xs">{error}</div>}

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-500 font-mono text-xs text-text-faint">
          {scanning ? 'scan en cours…' : logs.length ? `${logs.length} événements` : 'aucun log — cliquez sur Scanner'}
        </div>

        <div className="px-4">
          {!logs.length && !scanning ? (
            <div className="py-14 text-center text-text-faint text-xs">
              <ScanSearch size={20} className="mx-auto mb-2 opacity-60" />
              Scanner
            </div>
          ) : logs.map((entry, index) => {
            const key = entry.kind === 'finding' ? `${entry.container.name}:${entry.finding.id}` : null
            const message = key ? fixMessages[key] : null
            const canFix = entry.kind === 'finding' && entry.finding.id === 'no-resource-limits'
            return (
              <div key={index}>
                <LogLine severity={entry.severity}>{entry.text}</LogLine>
                {entry.vulnerabilities?.map((v) => (
                  <LogLine key={`${v.id}-${v.package}`} severity={v.severity === 'CRITICAL' ? 'critical' : v.severity === 'HIGH' ? 'warning' : 'info'}>
                    {v.id} :: {v.package} :: {v.installedVersion}{v.fixedVersion ? ` → ${v.fixedVersion}` : ' → aucun correctif'}
                  </LogLine>
                ))}
                {canFix && (
                  <div className="py-2 flex items-center gap-2">
                    {message ? (
                      <span className="text-xs text-signal-accent flex items-center gap-1"><CircleCheck size={13} />{message}</span>
                    ) : (
                      <button onClick={() => fix(entry)} disabled={fixing === key} className="btn-ghost !py-1 !px-2 text-xs">
                        {fixing === key ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}
                        Corriger
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {scanning && (
            <div className="py-4 flex items-center gap-2 text-xs text-text-faint">
              <Loader2 size={13} className="animate-spin" /> Lecture des logs…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
