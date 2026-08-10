import { useEffect, useRef, useState } from 'react'
import {
  CircleCheck, CircleAlert, CircleX, Menu, PanelLeftClose, PanelLeftOpen,
  Sun, Moon, Search, Bell, ChevronDown, LogOut, ShieldCheck,
} from 'lucide-react'
import PressureStrip from './PressureStrip'
import { relativeTime, clampPercent } from '../lib/format'
import { useTheme } from '../hooks/useTheme'

const STATUS_MAP = {
  healthy: { label: 'Opérationnel', icon: CircleCheck, cls: 'text-signal-accent bg-signal-accent/10' },
  degraded: { label: 'Mode dégradé', icon: CircleAlert, cls: 'text-signal-amber bg-signal-amber/10' },
  offline: { label: 'Hors ligne', icon: CircleX, cls: 'text-signal-red bg-signal-red/10' },
}

export default function TopBar({
  status,
  lastUpdated,
  pressureHistory,
  onOpenMenu,
  sidebarCollapsed,
  onToggleSidebar,
  alertCount = 0,
  onOpenAlerts,
  containers = [],
  onSelectContainer,
  user,
  onLogout,
}) {
  const s = STATUS_MAP[status] || STATUS_MAP.degraded
  const StatusIcon = s.icon
  const { theme, toggle: toggleTheme } = useTheme()

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-ink-500 bg-ink-950/55 backdrop-blur-md">
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <button onClick={onOpenMenu} className="md:hidden text-text-dim hover:text-text p-1 shrink-0">
          <Menu size={20} />
        </button>
        <button
          onClick={onToggleSidebar}
          className="hidden md:flex text-text-dim hover:text-text p-1 shrink-0"
          title={sidebarCollapsed ? 'Afficher le menu' : 'Réduire le menu'}
          aria-label={sidebarCollapsed ? 'Afficher le menu latéral' : 'Réduire le menu latéral'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
        <div className="min-w-0 hidden sm:block">
          <h1 className="font-display text-base sm:text-lg font-semibold truncate">Supervision des ressources</h1>
          <p className="text-xs text-text-faint mt-0.5 hidden lg:block">
            Dernière mise à jour : {lastUpdated ? relativeTime(lastUpdated.toISOString()) : '—'}
          </p>
        </div>
      </div>

      <QuickSearch containers={containers} onSelectContainer={onSelectContainer} />

      <div className="hidden 2xl:flex items-center gap-3 panel px-3 py-2 shrink-0">
        <span className="eyebrow whitespace-nowrap">Pression système</span>
        <PressureStrip history={pressureHistory} />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-ink-700 border border-ink-500">
          <button
            onClick={() => theme !== 'light' && toggleTheme()}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
              theme === 'light' ? 'bg-signal-accent text-accent-fg' : 'text-text-faint hover:text-text'
            }`}
            title="Mode clair"
            aria-label="Mode clair"
          >
            <Sun size={13} />
          </button>
          <button
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
              theme === 'dark' ? 'bg-ink-950 text-signal-accent' : 'text-text-faint hover:text-text'
            }`}
            title="Mode sombre"
            aria-label="Mode sombre"
          >
            <Moon size={13} />
          </button>
        </div>

        <button
          onClick={onOpenAlerts}
          className="btn-ghost !px-2.5 relative"
          title="Alertes"
          aria-label={`Alertes (${alertCount})`}
        >
          <Bell size={15} />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-signal-red text-white text-[10px] font-semibold flex items-center justify-center">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>

        <div className={`hidden md:flex items-center gap-2 text-xs font-medium px-2.5 sm:px-3 py-2 rounded-lg ${s.cls}`}>
          <StatusIcon size={15} />
          <span className="hidden xl:inline">{s.label}</span>
        </div>

        <UserMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  )
}

function QuickSearch({ containers, onSelectContainer }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const matches = query.trim().length
    ? containers.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : []

  const handlePick = () => {
    setQuery('')
    setOpen(false)
    onSelectContainer?.()
  }

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md hidden md:block">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' && matches.length) handlePick() }}
        placeholder="Rechercher un service, conteneur…"
        className="w-full bg-ink-800/60 border border-ink-500 rounded-lg pl-9 pr-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-signal-accent/50 transition-colors"
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 panel p-1.5 max-h-64 overflow-y-auto z-30">
          {matches.map((c) => (
            <button
              key={`${c.host}:${c.id}`}
              onClick={handlePick}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left hover:bg-ink-700/60 transition-colors"
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.status === 'running' ? 'bg-signal-accent' : 'bg-signal-red'}`} />
              <span className="truncate flex-1">{c.name}</span>
              {c.cpu && <span className="text-xs text-text-faint font-mono">{clampPercent(c.cpu.usage).toFixed(0)}%</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1.5 pr-2 sm:pr-3 py-1.5 rounded-lg hover:bg-ink-700/60 transition-colors"
      >
        <div className="h-7 w-7 rounded-full bg-signal-accent/15 text-signal-accent flex items-center justify-center shrink-0">
          <ShieldCheck size={14} />
        </div>
        <span className="hidden sm:block text-sm font-medium text-text max-w-[120px] truncate">
          {user?.email?.split('@')[0] || 'Admin'}
        </span>
        <ChevronDown size={14} className={`hidden sm:block text-text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 panel p-1.5 z-30">
          <div className="px-2.5 py-2 border-b border-ink-600 mb-1">
            <div className="text-sm font-medium text-text truncate">{user?.email}</div>
            <div className="text-[11px] text-text-faint mt-0.5">Administrateur</div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-signal-red hover:bg-signal-red/10 transition-colors"
          >
            <LogOut size={15} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
