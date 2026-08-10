import './cyber-background.css'

// Anneaux orbitaux : chacun est incliné différemment (rotateX) et tourne
// à sa propre vitesse/direction (rotateZ, via CSS) — évoque un réseau de
// données / un système distribué plutôt qu'une planète. Un seul satellite
// glissé sur chaque anneau, aucune ligne à recalculer : 100% CSS, très peu
// d'éléments animés, donc léger pour le navigateur.
const RINGS = [
  { tilt: 12, size: 100, duration: 26, reverse: false },
  { tilt: 55, size: 78, duration: 19, reverse: true },
  { tilt: 80, size: 92, duration: 33, reverse: false },
  { tilt: 35, size: 62, duration: 14, reverse: true },
]

export default function CyberBackground() {
  return (
    <div className="cyber-bg" aria-hidden="true">
      <div className="cyber-bg__field">
        <div className="cyber-bg__core" />
        {RINGS.map((r, i) => (
          <div
            key={i}
            className="cyber-bg__ring"
            style={{
              width: `${r.size}%`,
              height: `${r.size}%`,
              transform: `translate(-50%, -50%) rotateX(${r.tilt}deg)`,
            }}
          >
            <div
              className={`cyber-bg__spin ${r.reverse ? 'cyber-bg__spin--reverse' : ''}`}
              style={{ animationDuration: `${r.duration}s` }}
            >
              <div className="cyber-bg__track" />
              <div className="cyber-bg__satellite" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
