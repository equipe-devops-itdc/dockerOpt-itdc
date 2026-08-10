import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './components/Dashboard'
import ServicesView from './components/ServicesView'
import ContainersView from './components/ContainersView'
import OptimizationView from './components/OptimizationView'
import AlertsView, { buildAlerts } from './components/AlertsView'
import SecurityView from './components/SecurityView'
import CyberBackground from './components/CyberBackground'
import LoginView from './components/LoginView'
import Toast from './components/Toast'
import { useLiveData } from './hooks/useLiveData'
import { useMetricsHistory } from './hooks/useMetricsHistory'
import { useAuth } from './hooks/useAuth'
import { api } from './lib/api'

function alertKey(a) {
  return `${a.severity}::${a.title}`
}

export default function App() {
  const { user, checking } = useAuth()

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-ink-500 border-t-signal-accent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginView />
  }

  // AppShell n'est monté qu'une fois authentifié : le rafraîchissement
  // rapide (containers, système, optimisation...) ne démarre donc jamais
  // tant que la session n'est pas valide.
  return <AppShell />
}

function AppShell() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [toast, setToast] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('dockeropt-sidebar-collapsed') === '1'
  )
  const [security, setSecurity] = useState(null)
  const [securityError, setSecurityError] = useState(null)
  const [securityLoading, setSecurityLoading] = useState(false)
  const { system, containers, recommendations, history, errors, lastUpdated, loading, refresh } = useLiveData()
  const { pressureHistory, networkHistory, cpuHistory, memHistory, diskHistory, netRateHistory } = useMetricsHistory({ system, containers })
  const announcedRef = useRef(new Set())

  // L'audit de sécurité inspecte chaque conteneur individuellement — plus
  // coûteux que les autres vues, donc volontairement PAS inclus dans le
  // rafraîchissement rapide (15s) : il se charge à l'ouverture de l'onglet,
  // avec un bouton de rafraîchissement manuel dans la vue elle-même.
  const loadSecurity = useCallback(async () => {
    setSecurityLoading(true)
    try {
      const data = await api.securityAudit()
      setSecurity(data)
      setSecurityError(null)
    } catch (err) {
      setSecurityError(err.message || 'Indisponible')
    } finally {
      setSecurityLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'security' && !security && !securityLoading) {
      loadSecurity()
    }
  }, [tab, security, securityLoading, loadSecurity])

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem('dockeropt-sidebar-collapsed', next ? '1' : '0')
      return next
    })
  }

  const errorCount = Object.keys(errors).length
  const status = errorCount === 0 ? 'healthy' : errorCount >= 3 ? 'offline' : 'degraded'

  const alerts = useMemo(
    () => buildAlerts({ recommendations, containers, security }),
    [recommendations, containers, security]
  )

  // Le badge de notifications ne doit compter que les alertes que
  // l'utilisateur n'a PAS encore vues — pas simplement le nombre total,
  // qui resterait affiché indéfiniment même après consultation. Une
  // alerte est identifiée par sévérité+titre (stable tant que la cause
  // persiste) ; une nouvelle alerte fait donc réapparaître le badge même
  // si d'anciennes ont déjà été vues.
  const [seenAlertKeys, setSeenAlertKeys] = useState(() => {
    try {
      const stored = window.localStorage.getItem('dockeropt-seen-alerts')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch (_) {
      return new Set()
    }
  })
  const unseenAlertCount = useMemo(
    () => alerts.filter((a) => !seenAlertKeys.has(alertKey(a))).length,
    [alerts, seenAlertKeys]
  )

  useEffect(() => {
    if (tab !== 'alerts' || !alerts.length) return
    setSeenAlertKeys((prev) => {
      const next = new Set(prev)
      let changed = false
      alerts.forEach((a) => {
        const key = alertKey(a)
        if (!next.has(key)) {
          next.add(key)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [tab, alerts])

  // Persiste l'état "vu" pour qu'un rechargement de page (F5) ne fasse pas
  // réapparaître le badge pour des alertes déjà consultées. On ne garde que
  // les clés correspondant à des alertes toujours actives (+ celles encore
  // en mémoire) pour éviter une croissance illimitée du stockage.
  useEffect(() => {
    try {
      const currentKeys = new Set(alerts.map(alertKey))
      const toKeep = new Set([...seenAlertKeys].filter((k) => currentKeys.has(k)))
      window.localStorage.setItem('dockeropt-seen-alerts', JSON.stringify([...toKeep]))
    } catch (_) {
      /* stockage indisponible : le badge fonctionnera quand même pour cette session */
    }
  }, [seenAlertKeys, alerts])

  const newStacks = useMemo(() => {
    const stacks = new Set(containers.filter((c) => c.isNew).map((c) => c.stack))
    return stacks
  }, [containers])

  // Annonce (toast) chaque nouveau service détecté une seule fois, en se basant
  // sur les vraies données Docker (aucune simulation).
  useEffect(() => {
    containers.forEach((c) => {
      if (c.isNew && !announcedRef.current.has(`${c.host}:${c.id}`)) {
        announcedRef.current.add(`${c.host}:${c.id}`)
        setToast({ type: 'success', message: `Nouveau conteneur détecté : ${c.name}` })
      }
    })
  }, [containers])

  // Retourne un booléen de succès explicite : la vue Optimisation ne doit
  // retirer une recommandation de la liste QUE si l'application a
  // réellement réussi, jamais en cas d'échec.
  const handleApply = async (container, action, host = 'local') => {
    try {
      const result = await api.applyOptimization(container, action, host)
      await api.logHistory({ container, action, host, status: 'applied' })
      setToast({ type: 'success', message: result.description || 'Optimisation appliquée' })
      refresh()
      return true
    } catch (err) {
      setToast({ type: 'error', message: err.message || "Échec de l'application" })
      return false
    }
  }

  return (
    <>
      <CyberBackground />
      <div className="min-h-screen flex relative z-[1]">
        <Sidebar
          active={tab}
          onChange={setTab}
          alertCount={unseenAlertCount}
          newServicesCount={newStacks.size}
          securityCriticalCount={security?.critical_count || 0}
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          collapsed={sidebarCollapsed}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            status={status}
            lastUpdated={lastUpdated}
            pressureHistory={pressureHistory}
            onOpenMenu={() => setMobileNavOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            alertCount={unseenAlertCount}
            onOpenAlerts={() => setTab('alerts')}
            containers={containers}
            onSelectContainer={() => setTab('containers')}
            user={user}
            onLogout={logout}
          />

          <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6">
            {loading && !lastUpdated ? (
              <InitialLoad />
            ) : (
              <>
                {tab === 'dashboard' && (
                  <Dashboard
                    system={system}
                    containers={containers}
                    recommendations={recommendations}
                    networkHistory={networkHistory}
                    cpuHistory={cpuHistory}
                    memHistory={memHistory}
                    diskHistory={diskHistory}
                    netRateHistory={netRateHistory}
                    errors={errors}
                  />
                )}
                {tab === 'services' && (
                  <ServicesView containers={containers} error={errors.containers} />
                )}
                {tab === 'security' && (
                  <SecurityView audit={security} error={securityError} loading={securityLoading} onRefresh={loadSecurity} />
                )}
                {tab === 'containers' && (
                  <ContainersView containers={containers} error={errors.containers} />
                )}
                {tab === 'optimization' && (
                  <OptimizationView
                    recommendations={recommendations}
                    history={history}
                    error={errors.recommendations}
                    onApply={handleApply}
                  />
                )}
                {tab === 'alerts' && (
                  <AlertsView
                    recommendations={recommendations}
                    containers={containers}
                    containersError={errors.containers}
                    security={security}
                  />
                )}
              </>
            )}
          </main>
        </div>

        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </>
  )
}

function InitialLoad() {
  return (
    <div className="h-full min-h-[60vh] flex flex-col items-center justify-center gap-3 text-text-faint">
      <div className="h-8 w-8 rounded-full border-2 border-ink-500 border-t-signal-accent animate-spin" />
      <p className="text-sm">Connexion à la plateforme DockerOpt…</p>
    </div>
  )
}
