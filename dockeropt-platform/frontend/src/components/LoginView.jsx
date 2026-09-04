import { useState } from 'react'
import {
  ShieldCheck,
  Loader2,
  CircleX,
  Eye,
  EyeOff,
  Activity,
  Server,
  Container,
  Gauge,
  Terminal,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function LoginView() {
  const { login, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    await login(email, password)
    setSubmitting(false)
  }

  return (
    <main className="login-shell">
      <div className="login-grid-glow" aria-hidden="true" />

      <section className="login-layout">
        <div className="login-panel-wrap">
          <form onSubmit={handleSubmit} className="login-card">
            <div className="login-brand">
              <div className="login-brand-mark">
                <ShieldCheck size={23} strokeWidth={2.1} />
              </div>
              <div>
                <div className="login-brand-name">DockerOpt</div>
                <div className="login-brand-kicker">DEVOPS CONTROL PLANE</div>
              </div>
              <span className="login-live-dot" title="Plateforme sécurisée" />
            </div>

            <div className="login-heading">
              <span className="login-eyebrow">ACCÈS SÉCURISÉ</span>
              <h1>Bienvenue, administrateur.</h1>
              <p>Surveillez, optimisez et sécurisez votre infrastructure Docker en temps réel.</p>
            </div>

            <div className="login-fields">
              <label className="login-field">
                <span>Email administrateur</span>
                <div className="login-input-wrap">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                    className="input login-input"
                    placeholder="admin@dockeropt.local"
                  />
                </div>
              </label>

              <label className="login-field">
                <span>Mot de passe</span>
                <div className="login-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="input login-input login-password-input"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <CircleX size={16} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={submitting} className="login-submit">
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
              <span>{submitting ? 'Authentification…' : 'Accéder à la plateforme'}</span>
            </button>

            <div className="login-trust">
              <span><span className="login-status-pip" /> Connexion sécurisée</span>
              <span>•</span>
              <span>Monitoring temps réel</span>
            </div>
          </form>
        </div>

        <aside className="devops-stage" aria-label="Aperçu animé de DockerOpt">
          <div className="devops-stage-copy">
            <span className="login-eyebrow">OBSERVABILITÉ • AUTOMATISATION • OPTIMISATION</span>
            <h2>Votre infrastructure,<br /><strong>sous contrôle.</strong></h2>
            <p>
              Une vue opérationnelle unifiée pour suivre les conteneurs,
              les ressources de l’hôte et les signaux de sécurité.
            </p>
          </div>

          <div className="devops-scene" aria-hidden="true">
            <div className="scene-orbit orbit-a" />
            <div className="scene-orbit orbit-b" />
            <div className="scene-orbit orbit-c" />

            <div className="scene-core">
              <div className="core-glass">
                <Container size={42} strokeWidth={1.35} />
                <span>DOCKER</span>
                <b>OPT</b>
              </div>
              <div className="core-scan" />
            </div>

            <div className="scene-node node-server">
              <Server size={18} />
              <span>HOST</span>
              <b>CPU 42%</b>
            </div>
            <div className="scene-node node-metrics">
              <Activity size={18} />
              <span>METRICS</span>
              <b>LIVE</b>
            </div>
            <div className="scene-node node-gauge">
              <Gauge size={18} />
              <span>OPTIMIZER</span>
              <b>READY</b>
            </div>
            <div className="scene-node node-terminal">
              <Terminal size={17} />
              <span>SECURITY</span>
              <b>SCAN</b>
            </div>

            <div className="scene-packet packet-one" />
            <div className="scene-packet packet-two" />
            <div className="scene-packet packet-three" />
          </div>

          <div className="devops-stats">
            <div><strong>Sytème</strong><span>Containers</span></div>
            <div><strong>Télémétrie</strong><span>Metrics</span></div>
            <div><strong>Sécurité</strong><span>Identity</span></div>
          </div>
        </aside>
      </section>
    </main>
  )
}