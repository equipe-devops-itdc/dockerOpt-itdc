import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

// Intervalle raccourci (5s au lieu de 15s) pour un rendu plus "temps réel" —
// ajustez si c'est trop agressif pour votre backend.
const REFRESH_MS = 5000

export function useLiveData() {
  const [system, setSystem] = useState(null)
  const [containers, setContainers] = useState([])
  const [recommendations, setRecommendations] = useState(null)
  const [history, setHistory] = useState([])
  const [errors, setErrors] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  // Empêche deux cycles de se chevaucher si le backend met plus longtemps
  // à répondre que REFRESH_MS (utile en particulier juste après un
  // `docker compose down`, où les requêtes peuvent traîner en timeout
  // avant d'échouer).
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true

    const nextErrors = {}

    const [systemRes, containersRes, recRes, histRes] = await Promise.allSettled([
      api.systemAnalysis(),
      api.containers(),
      api.recommendations(),
      api.history(),
    ])

    // CORRECTIF : sur échec, on vide explicitement l'état plutôt que de
    // laisser la dernière valeur connue en place. Sans ça, quand le
    // backend/Docker devient injoignable (ex. après `docker compose
    // down`), le tableau de bord continue d'afficher les derniers chiffres
    // vus comme s'ils étaient toujours d'actualité — ce n'est jamais
    // signalé nulle part sauf dans `errors`, que rien n'affiche vraiment
    // comme une coupure.
    if (systemRes.status === 'fulfilled') {
      setSystem(systemRes.value)
    } else {
      nextErrors.system = systemRes.reason?.message || 'Indisponible'
      setSystem(null)
    }

    if (containersRes.status === 'fulfilled') {
      setContainers(containersRes.value)
    } else {
      nextErrors.containers = containersRes.reason?.message || 'Indisponible'
      setContainers([])
    }

    if (recRes.status === 'fulfilled') {
      setRecommendations(recRes.value)
    } else {
      nextErrors.recommendations = recRes.reason?.message || 'Indisponible'
      setRecommendations(null)
    }

    if (histRes.status === 'fulfilled') {
      setHistory(histRes.value)
    } else {
      nextErrors.history = histRes.reason?.message || 'Indisponible'
      setHistory([])
    }

    setErrors(nextErrors)
    setLastUpdated(new Date())
    setLoading(false)
    inFlightRef.current = false
  }, [])

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, REFRESH_MS)

    // Retour au premier plan (l'utilisateur revient sur l'onglet) : on
    // relance immédiatement un cycle pour rattraper l'écart plutôt que
    // d'attendre le prochain tick.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refresh])

  return { system, containers, recommendations, history, errors, lastUpdated, loading, refresh }
}