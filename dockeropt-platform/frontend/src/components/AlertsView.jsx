import { CircleCheck, TriangleAlert, OctagonAlert, ChevronRight } from 'lucide-react'
import PageHeader from './PageHeader'

function buildAlerts({ recommendations, containers, security }) {
  const alerts = []

  ;(recommendations?.recommendations || []).forEach((rec) => {
    if (rec.severity === 'critical' || rec.severity === 'warning') {
      alerts.push({
        severity: rec.severity,
        title: `${rec.container} — ${rec.type.toUpperCase()}`,
        detail: rec.suggestion,
      })
    }
  })

  containers.forEach((c) => {
    if (c.status === 'exited') {
      alerts.push({
        severity: 'critical',
        title: `${c.name} — conteneur arrêté`,
        detail: `Politique de redémarrage : ${c.restartPolicy || 'aucune'}`,
      })
    }
  })

  ;(security?.containers || []).forEach((c) => {
    c.findings.forEach((f) => {
      if (f.severity === 'critical' || f.severity === 'warning') {
        alerts.push({
          severity: f.severity,
          title: `${c.name} — ${f.title}`,
          detail: f.remediation,
        })
      }
    })
  })

  return alerts
}

const SEVERITY_META = {
  critical: { icon: OctagonAlert, text: 'text-signal-red', bg: 'bg-signal-red/10', label: 'Critique' },
  warning: { icon: TriangleAlert, text: 'text-signal-amber', bg: 'bg-signal-amber/10', label: 'Avertissement' },
}

export default function AlertsView({ recommendations, containers, containersError, security }) {
  const alerts = buildAlerts({ recommendations, containers, security })
  const header = (
    <PageHeader title="Alertes" description="Anomalies en cours, réunies depuis l'optimisation, la sécurité et l'état des conteneurs." />
  )

  if (containersError) {
    return (
      <div>
        {header}
        <div className="panel p-10 text-center text-signal-red text-sm">
          Vérification impossible — connexion aux conteneurs perdue
        </div>
      </div>
    )
  }

  if (!alerts.length) {
    return (
      <div>
        {header}
        <div className="panel p-8 flex flex-col items-center text-center gap-2">
          <div className="h-11 w-11 rounded-full bg-signal-accent/10 text-signal-accent flex items-center justify-center">
            <CircleCheck size={20} />
          </div>
          <div className="text-sm font-medium text-signal-accent">Tous les services sont opérationnels</div>
          <div className="text-xs text-text-faint">Aucune alerte active pour le moment</div>
        </div>
      </div>
    )
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount = alerts.filter((a) => a.severity === 'warning').length

  return (
    <div>
      {header}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 font-medium text-signal-red bg-signal-red/10 rounded-full px-2.5 py-1">
              <OctagonAlert size={12} /> {criticalCount} critique{criticalCount > 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1.5 font-medium text-signal-amber bg-signal-amber/10 rounded-full px-2.5 py-1">
              <TriangleAlert size={12} /> {warningCount} avertissement{warningCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="panel overflow-hidden divide-y divide-ink-600/50">
          {alerts.map((a, i) => {
            const meta = SEVERITY_META[a.severity]
            const Icon = meta.icon
            return (
              <div key={i} className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 hover:bg-ink-700/25 transition-colors">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text truncate">{a.title}</div>
                  <div className="text-xs text-text-faint mt-0.5 truncate">{a.detail}</div>
                </div>
                <span className={`hidden sm:inline text-[10px] font-semibold uppercase tracking-wide shrink-0 ${meta.text}`}>
                  {meta.label}
                </span>
                <ChevronRight size={15} className="text-text-faint shrink-0 hidden sm:block" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { buildAlerts }
