import { useEffect, useRef, useState } from 'react'

const MAX_SAMPLES = 40

function firstValue(block) {
  const v = block?.data?.result?.[0]?.value?.[1]
  return v != null ? parseFloat(v) : null
}

// Tracks genuine rolling history from live polls: system resource levels,
// network throughput (derived from real cumulative byte counters) — never
// fabricated. This keeps every chart/sparkline traceable to an actual
// measurement taken at that point in time.
export function useMetricsHistory({ system, containers }) {
  const [pressureHistory, setPressureHistory] = useState([])
  const [networkHistory, setNetworkHistory] = useState([])
  const [cpuHistory, setCpuHistory] = useState([])
  const [memHistory, setMemHistory] = useState([])
  const [diskHistory, setDiskHistory] = useState([])
  const [netRateHistory, setNetRateHistory] = useState([])
  const prevNetRef = useRef(null)

  useEffect(() => {
    // CORRECTIF : auparavant, `if (!system) return` arrêtait complètement
    // de pousser des points dès que le fetch système échouait (backend/
    // Docker/Prometheus injoignable) — les sparklines CPU/mémoire/disque
    // restaient figées sur leur dernière valeur, donnant l'illusion que
    // tout allait encore bien. On pousse maintenant un point `null`
    // explicite dans ce cas : le graphique montre un vrai trou/creux au
    // lieu de mentir par immobilité.
    if (!system) {
      setCpuHistory((h) => [...h, { value: null }].slice(-MAX_SAMPLES))
      setMemHistory((h) => [...h, { value: null }].slice(-MAX_SAMPLES))
      setDiskHistory((h) => [...h, { value: null }].slice(-MAX_SAMPLES))
      setPressureHistory((h) => [...h, null].slice(-MAX_SAMPLES))
      return
    }

    const cpu = firstValue(system.resources?.cpu)
    const mem = firstValue(system.resources?.memory)
    const disk = firstValue(system.resources?.disk)

    setCpuHistory((h) => [...h, { value: cpu }].slice(-MAX_SAMPLES))
    setMemHistory((h) => [...h, { value: mem }].slice(-MAX_SAMPLES))
    setDiskHistory((h) => [...h, { value: disk }].slice(-MAX_SAMPLES))

    const overall = [cpu, mem].filter((v) => v != null)
    const avg = overall.length ? overall.reduce((a, b) => a + b, 0) / overall.length : null
    setPressureHistory((prev) => [...prev, avg].slice(-MAX_SAMPLES))
  }, [system])

  useEffect(() => {
    // CORRECTIF : auparavant, `if (!containers?.length) return` arrêtait le
    // calcul du débit réseau dès que la liste devenait vide (conteneurs
    // tous arrêtés, ou état vidé après un échec de fetch) — le débit
    // restait bloqué sur sa dernière valeur positive au lieu de retomber à
    // 0. On calcule maintenant toujours les totaux (0 par défaut sur liste
    // vide), donc le débit redescend naturellement à 0 en temps réel.
    const totals = (containers || []).reduce(
      (acc, c) => {
        acc.rx += c.network?.rx || 0
        acc.tx += c.network?.tx || 0
        return acc
      },
      { rx: 0, tx: 0, t: Date.now() }
    )

    const prev = prevNetRef.current
    prevNetRef.current = totals

    if (prev) {
      const dt = Math.max((totals.t - prev.t) / 1000, 1)
      // Un compteur qui redémarre (conteneur relancé, ou liste qui repart
      // de 0 après une coupure) peut donner un delta négatif : on le
      // ramène à 0 plutôt que d'afficher un débit négatif absurde.
      const rxRate = Math.max(0, (totals.rx - prev.rx) / dt / 1024)
      const txRate = Math.max(0, (totals.tx - prev.tx) / dt / 1024)
      const label = new Date(totals.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setNetworkHistory((h) => [...h, { t: label, rx: Number(rxRate.toFixed(1)), tx: Number(txRate.toFixed(1)) }].slice(-MAX_SAMPLES))
      setNetRateHistory((h) => [...h, { value: Number((rxRate + txRate).toFixed(1)) }].slice(-MAX_SAMPLES))
    }
  }, [containers])

  return { pressureHistory, networkHistory, cpuHistory, memHistory, diskHistory, netRateHistory }
}