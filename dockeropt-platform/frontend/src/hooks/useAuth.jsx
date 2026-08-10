import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, setAuthToken, clearAuthToken, setUnauthorizedHandler } from '../lib/api'

const STORAGE_KEY = 'dockeropt-auth-token'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState(null)

  const logout = useCallback(() => {
    clearAuthToken()
    window.localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  // Restaure la session existante au chargement (jeton en localStorage),
  // en vérifiant sa validité auprès du backend plutôt que de faire
  // confiance à sa seule présence.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      setChecking(false)
      return
    }
    setAuthToken(stored)
    api.me()
      .then((data) => setUser(data.user))
      .catch(() => {
        clearAuthToken()
        window.localStorage.removeItem(STORAGE_KEY)
      })
      .finally(() => setChecking(false))
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    try {
      const data = await api.login(email, password)
      setAuthToken(data.token)
      window.localStorage.setItem(STORAGE_KEY, data.token)
      setUser(data.user)
      return true
    } catch (err) {
      setError(err.message || 'Connexion impossible')
      return false
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, checking, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
