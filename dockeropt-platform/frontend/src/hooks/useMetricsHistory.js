import { useEffect, useRef, useState } from 'react'

const MAX_SAMPLES = 40

function firstValue(block) {
  const v = block?.data?.result?.[0]?.value?.[1]
  return v != null ? parseFloat(v) : null
}
export function useMetricsHistory({ system, containers }) {
  const [pressureHistory, setPressureHistory] = useState([])
  const [networkHistory, setNetworkHistory] = useState([])
  const [cpuHistory, setCpuHistory] = useState([])
  const [memHistory, setMemHistory] = useState([])
  const [diskHistory, setDiskHistory] = useState([])
  const [netRateHistory, setNetRateHistory] = useState([])
  const prevNetRef = useRef(null)

  useEffect(() => {
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
      const rxRate = Math.max(0, (totals.rx - prev.rx) / dt / 1024)
      const txRate = Math.max(0, (totals.tx - prev.tx) / dt / 1024)
      const label = new Date(totals.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setNetworkHistory((h) => [...h, { t: label, rx: Number(rxRate.toFixed(1)), tx: Number(txRate.toFixed(1)) }].slice(-MAX_SAMPLES))
      setNetRateHistory((h) => [...h, { value: Number((rxRate + txRate).toFixed(1)) }].slice(-MAX_SAMPLES))
    }
  }, [containers])

  return { pressureHistory, networkHistory, cpuHistory, memHistory, diskHistory, netRateHistory }
}