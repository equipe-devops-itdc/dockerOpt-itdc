import { useState, useEffect, useRef } from 'react'
import {
  ShieldCheck,
  Loader2,
  CircleX,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

// Composant pour reproduire la vague filaire 3D de MinIO
function MinioWaveCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId

    let width = (canvas.width = canvas.offsetWidth)
    let height = (canvas.height = canvas.offsetHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth
      height = canvas.height = canvas.offsetHeight
    }
    window.addEventListener('resize', handleResize)

    // Configuration de la grille
    const cols = 45
    const rows = 28
    let step = 0

    const render = () => {
      step += 0.025
      ctx.clearRect(0, 0, width, height)

      ctx.save()
      // Origine centrée avec perspective
      ctx.translate(width * 0.5, height * 0.65)

      const spacingX = width / (cols * 0.8)
      const spacingY = height / (rows * 1.5)

      // Rendu de la grille filaire avec lignes horizontales et verticales
      for (let r = 0; r < rows; r++) {
        ctx.beginPath()
        for (let c = 0; c < cols; c++) {
          const x = (c - cols / 2) * spacingX
          const z = r * spacingY

          // Calcul de la déformation en vague
          const distance = Math.sqrt(x * x + z * z)
          const wave = Math.sin(distance * 0.015 - step) * 28 + Math.cos(c * 0.3 + step) * 12

          // Projection perspective 3D -> 2D
          const perspective = 300 / (300 + z)
          const projX = x * perspective
          const projY = (wave - z * 0.35) * perspective

          if (c === 0) {
            ctx.moveTo(projX, projY)
          } else {
            ctx.lineTo(projX, projY)
          }
        }

        // Degradé bleu/cyan de la vague MinIO
        const alpha = Math.max(0, 1 - r / rows)
        ctx.strokeStyle = `rgba(45, 212, 191, ${alpha * 0.65})`
        ctx.lineWidth = 1.2
        ctx.stroke()
      }

      ctx.restore()
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="minio-wave-canvas" />
}

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
        {/* Formulaire DockerOpt : Forme et style strictement conservés */}
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

        {/* Section visuelle avec la vague 3D MinIO */}
        <aside className="devops-stage" aria-label="Aperçu visuel DockerOpt">
          <div className="devops-stage-copy">
            <span className="login-eyebrow">OBSERVABILITÉ • AUTOMATISATION • OPTIMISATION</span>
            <h2>Votre infrastructure,<br /><strong>sous contrôle.</strong></h2>
            <p>
              Une vue opérationnelle unifiée pour suivre les conteneurs,
              les ressources de l’hôte et les signaux de sécurité.
            </p>
          </div>

          <div className="wave-container">
            <MinioWaveCanvas />
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