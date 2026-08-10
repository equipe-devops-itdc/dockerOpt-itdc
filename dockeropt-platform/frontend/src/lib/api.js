const API_BASE = import.meta.env.VITE_API_BASE || '/api'

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// Le jeton de session est géré ici (module-level) plutôt que passé en
// argument à chaque appel : plus simple, et un seul endroit à mettre à
// jour au login/logout. AuthProvider appelle setAuthToken()/clearAuthToken().
let authToken = null
let onUnauthorized = null

function setAuthToken(token) {
  authToken = token
}
function clearAuthToken() {
  authToken = null
}
function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

async function request(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeout || 10000)
  try {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    if (authToken) headers.Authorization = `Bearer ${authToken}`

    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      ...options,
      headers,
    })
    if (!res.ok) {
      let detail = ''
      try {
        const body = await res.json()
        detail = body.error || ''
      } catch (_) {
        /* noop */
      }
      if (res.status === 401 && path !== '/auth/login') {
        onUnauthorized?.()
      }
      throw new ApiError(detail || `Erreur ${res.status}`, res.status)
    }
    return await res.json()
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('Délai de réponse dépassé', 0)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  systemAnalysis: () => request('/analysis/system'),
  containers: () => request('/containers'),
  recommendations: () => request('/optimize/recommendations'),
  history: () => request('/optimize/history'),
  applyOptimization: (container, action, host = 'local') =>
    request('/optimize/apply', {
      method: 'POST',
      body: JSON.stringify({ container, action, host }),
    }),
  logHistory: (entry) =>
    request('/optimize/history', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),
  predict: (containerName) => request(`/predict/resource/${encodeURIComponent(containerName)}`),
  containerLogs: (id, host = 'local', tail = 200) =>
    request(`/containers/${encodeURIComponent(id)}/logs?host=${encodeURIComponent(host)}&tail=${tail}`),
  optimizationLogs: (containerName) =>
    request(`/optimize/logs${containerName ? `?container=${encodeURIComponent(containerName)}` : ''}`),
  securityAudit: () => request('/security/audit'),
  securityAutoFix: (container, findingId, host = 'local') =>
    request('/security/auto-fix', {
      method: 'POST',
      body: JSON.stringify({ container, findingId, host }),
    }),
  scanImage: (image) =>
    request('/security/scan-image', {
      method: 'POST',
      body: JSON.stringify({ image }),
      timeout: 190000,
    }),
}

export { ApiError, setAuthToken, clearAuthToken, setUnauthorizedHandler }
