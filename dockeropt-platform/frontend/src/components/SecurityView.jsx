import { useEffect, useRef, useSyncExternalStore } from 'react'
import { ScanSearch, Loader2, Wrench, CircleCheck } from 'lucide-react'
import PageHeader from './PageHeader'
import { securityScanStore } from '../lib/securityScanStore'

const severityClass = {
  critical: 'text-signal-red',
  warning: 'text-signal-amber',
  info: 'text-signal-blue',
}

const kindPrefix = {
  system: '',
  header: '',
  ok: '  ✓ ',
  finding: '  ✗ ',
  trivy: '',
  vuln: '',
  error: '  ✗ ',
}

function useSecurityScan() {
  return useSyncExternalStore(securityScanStore.subscribe, securityScanStore.getSnapshot)
}

function TerminalLine({ entry, canFix, fixing, fixMessage, onFix }) {
  const prefix = kindPrefix[entry.kind] ?? ''
  return (
    <div className="font-mono text-xs leading-5 py-0.5">
      <span className={severityClass[entry.severity] || 'text-text-dim'}>{prefix}</span>
      <span className={entry.kind === 'header' ? 'text-text-bright font-semibold' : 'text-text-dim'}>
        {entry.text}
      </span>
      {canFix && (
        <div className="pl-6 py-1">
          {fixMessage ? (
            <span className="text-signal-accent flex items-center gap-1">
              <CircleCheck size={12} />
              {fixMessage}
            </span>
          ) : (
            <button onClick={onFix} disabled={fixing} className="btn-ghost !py-1 !px-2 text-xs">
              {fixing ? <Loader2 size={11} className="animate-spin" /> : <Wrench size={11} />}
              Corriger
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function SecurityView({ error }) {
  const scan = useSecurityScan()
  const scrolledRef = useRef(null)
  const isScanning = scan.status === 'scanning'
  const isDone = scan.status === 'done' || scan.status === 'error'

  useEffect(() => {
    if (scrolledRef.current) {
      scrolledRef.current.scrollTop = scrolledRef.current.scrollHeight
    }
  }, [scan.entries.length])

  const statusLabel = isScanning
    ? 'scan en cours…'
    : isDone
      ? `dernier scan : ${new Date(scan.finishedAt).toLocaleTimeString()}`
      : 'aucun scan lancé'

  return (
    <div>
      <PageHeader
        title="Sécurité"
        description=""
        action={
          <button onClick={() => securityScanStore.runScan()} disabled={isScanning} className="btn-primary !py-2 !px-4">
            {isScanning ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
            {isScanning ? 'Scan…' : 'Scanner'}
          </button>
        }
      />

      {error && <div className="panel p-4 text-signal-red text-xs">{error}</div>}

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-500 font-mono text-xs text-text-faint flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isScanning ? 'bg-signal-accent animate-pulse' : 'bg-ink-400'}`} />
          {statusLabel}
        </div>

        <div ref={scrolledRef} className="px-4 py-3 max-h-[70vh] overflow-y-auto bg-ink-700/40">
          {!scan.entries.length && !isScanning ? (
            <div className="py-14 text-center text-text-faint text-xs">
              <ScanSearch size={20} className="mx-auto mb-2 opacity-60" />
              Cliquez sur Scanner pour lancer une analyse
            </div>
          ) : (
            scan.entries.map((entry) => {
              // Les corrections ne sont proposées qu'une fois le scan
              // entièrement terminé : appliquer un correctif pendant que
              // l'audit est encore en cours pourrait modifier un
              // conteneur en plein milieu de son analyse.
              const key = entry.kind === 'finding' ? `${entry.container.name}:${entry.finding.id}` : null
              const canFix = isDone && entry.kind === 'finding' && entry.finding.id === 'no-resource-limits'
              return (
                <TerminalLine
                  key={entry.id}
                  entry={entry}
                  canFix={canFix}
                  fixing={scan.fixingKey === key}
                  fixMessage={key ? scan.fixMessages[key] : null}
                  onFix={() => securityScanStore.fixFinding(entry)}
                />
              )
            })
          )}
          {isScanning && (
            <div className="py-1 flex items-center gap-2 text-xs text-text-faint">
              <span className="animate-pulse">▋</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}