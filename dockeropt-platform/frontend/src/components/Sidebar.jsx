import { LayoutDashboard, Boxes, Gauge, BellRing, Layers, X, ShieldCheck } from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { id: 'services', label: 'Services', icon: Layers },
      { id: 'containers', label: 'Conteneurs', icon: Boxes },
    ],
  },
  {
    label: 'Surveillance',
    items: [
      { id: 'optimization', label: 'Optimisation', icon: Gauge },
      { id: 'security', label: 'Sécurité', icon: ShieldCheck },
      { id: 'alerts', label: 'Alertes', icon: BellRing },
    ],
  },
]
const NAV = NAV_GROUPS.flatMap((g) => g.items)

export default function Sidebar({
  active,
  onChange,
  alertCount = 0,
  newServicesCount = 0,
  isOpen = false,
  onClose,
  collapsed = false,
}) {
  const fullContent = (
    <>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-signal-accent/10 flex items-center justify-center text-signal-accent shrink-0">
            <ShieldCheck size={18} strokeWidth={2} />
          </div>
          <div>
            <div className="font-display font-semibold text-[15px] leading-none">DockerOpt</div>
            <div className="text-[10px] text-text-faint font-mono tracking-wide mt-1">SUPERVISION v1.0</div>
          </div>
        </div>
        <button onClick={onClose} className="md:hidden text-text-faint hover:text-text p-1">
          <X size={18} />
        </button>
      </div>

      <nav className="flex flex-col gap-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="eyebrow px-3 mb-1.5">{group.label}</div>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = active === item.id
                const Icon = item.icon
                // Sécurité n'affiche plus de compteur : le terminal de scan (onglet
                // Sécurité) montre déjà l'état en direct, un badge numérique ici
                // ferait doublon et n'a plus de sens avec un scan à la demande.
                const badge = item.id === 'alerts' ? alertCount : item.id === 'services' ? newServicesCount : 0
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onChange(item.id)
                      onClose?.()
                    }}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-signal-accent/10 text-signal-accent'
                        : 'text-text-dim hover:text-text hover:bg-ink-700'
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span className="font-medium">{item.label}</span>
                    {badge > 0 && (
                      <span
                        className={`ml-auto text-[10px] font-mono font-semibold rounded-full px-1.5 py-0.5 ${
                          item.id === 'alerts' ? 'bg-signal-red/15 text-signal-red' : 'bg-signal-accent/15 text-signal-accent'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto px-3 space-y-3">
        <div className="flex items-center gap-2 px-1 py-2 rounded-lg bg-signal-accent/10 text-signal-accent">
          <ShieldCheck size={15} className="shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-medium leading-tight">Sécurisé</div>
            <div className="text-[10px] text-signal-accent/80 leading-tight">Connexion chiffrée</div>
          </div>
        </div>
        <p className="text-[10px] text-text-faint text-center leading-relaxed">
          © {new Date().getFullYear()} DockerOpt Platform
        </p>
      </div>
    </>
  )

  // Rendu réduit (icônes seules) pour grand écran : évite de compresser le
  // contenu complet, qui contient du texte non tronquable proprement.
  const collapsedContent = (
    <>
      <div className="flex items-center justify-center">
        <div className="h-8 w-8 rounded-md bg-signal-accent/10 flex items-center justify-center text-signal-accent shrink-0">
          <ShieldCheck size={18} strokeWidth={2} />
        </div>
      </div>

      <nav className="flex flex-col gap-1 items-center">
        {NAV.map((item) => {
          const isActive = active === item.id
          const Icon = item.icon
          // Même règle qu'en vue complète : pas de badge pour Sécurité.
          const badge = item.id === 'alerts' ? alertCount : item.id === 'services' ? newServicesCount : 0
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              title={item.label}
              aria-label={item.label}
              className={`relative flex items-center justify-center h-10 w-10 rounded-lg transition-colors ${
                isActive
                  ? 'bg-signal-accent/10 text-signal-accent'
                  : 'text-text-dim hover:text-text hover:bg-ink-700'
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {badge > 0 && (
                <span
                  className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                    item.id === 'alerts' ? 'bg-signal-red' : 'bg-signal-accent'
                  }`}
                />
              )}
            </button>
          )
        })}
      </nav>
    </>
  )

  return (
    <>
      {/* Desktop: static sidebar, réductible */}
      <aside
        className={`hidden md:flex md:flex-col shrink-0 border-r border-ink-500 bg-ink-950/45 backdrop-blur-md py-5 gap-6 sticky top-0 h-screen overflow-y-auto transition-[width] duration-200 ${
          collapsed ? 'w-[72px] px-2 items-center' : 'w-[220px] px-3'
        }`}
      >
        {collapsed ? collapsedContent : fullContent}
      </aside>

      {/* Mobile: slide-in drawer, toujours complet */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-[260px] bg-ink-950/85 backdrop-blur-md border-r border-ink-500 px-3 py-5 gap-6 flex flex-col overflow-y-auto transition-transform duration-200 ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {fullContent}
        </aside>
      </div>
    </>
  )
}