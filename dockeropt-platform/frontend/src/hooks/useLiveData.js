import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

const REFRESH_MS = 15000

export function useLiveData() {
  const [system, setSystem] = useState(null)
  const [containers, setContainers] = useState([])
  const [recommendations, setRecommendations] = useState(null)
  const [history, setHistory] = useState([])
  const [errors, setErrors] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  const refresh = useCallback(async () => {
    const nextErrors = {}

    const [systemRes, containersRes, recRes, histRes] = await Promise.allSettled([
      api.systemAnalysis(),
      api.containers(),
      api.recommendations(),
      api.history(),
    ])

    if (systemRes.status === 'fulfilled') setSystem(systemRes.value)
    else nextErrors.system = systemRes.reason?.message || 'Indisponible'

    if (containersRes.status === 'fulfilled') setContainers(containersRes.value)
    else nextErrors.containers = containersRes.reason?.message || 'Indisponible'

    if (recRes.status === 'fulfilled') setRecommendations(recRes.value)
    else nextErrors.recommendations = recRes.reason?.message || 'Indisponible'

    if (histRes.status === 'fulfilled') setHistory(histRes.value)
    else nextErrors.history = histRes.reason?.message || 'Indisponible'

    setErrors(nextErrors)
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timerRef.current)
  }, [refresh])

  return { system, containers, recommendations, history, errors, lastUpdated, loading, refresh }
}
