// Renouvellement silencieux du token d'accès JWT (voir /api/token/refresh/,
// déjà exposé côté backend mais jamais utilisé côté frontend jusqu'ici).
//
// Sans ça, la session expire après ACCESS_TOKEN_LIFETIME (60 min) même si
// l'utilisateur est actif, et il se retrouve déconnecté en plein travail.
// On planifie un renouvellement juste avant l'expiration réelle du token
// (lue directement dans son payload JWT), tant qu'un refresh_token valide
// existe — pas de polling, pas de requête inutile.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SAFETY_MARGIN_MS = 60_000
const RETRY_AFTER_NETWORK_ERROR_MS = 30_000

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

function decodeExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const { exp } = JSON.parse(json)
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

type RefreshOutcome = 'ok' | 'invalid' | 'network-error'

async function doRefresh(): Promise<RefreshOutcome> {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return 'invalid'
  try {
    const res = await fetch(`${API_URL}/api/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) return 'invalid'
    const data = await res.json()
    localStorage.setItem('access_token', data.access)
    // Pas de rotation activée côté backend (SIMPLE_JWT par défaut) : le
    // refresh token reste le même. On le remplace quand même s'il en
    // renvoie un, pour rester correct si la rotation est activée plus tard.
    if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
    return 'ok'
  } catch {
    // Panne réseau — le refresh_token n'est pas forcément invalide, on
    // réessaiera bientôt plutôt que d'abandonner.
    return 'network-error'
  }
}

/**
 * (Ré)planifie le prochain renouvellement en fonction de l'expiration
 * réelle du token d'accès actuel. Sans effet si aucun token n'est présent
 * (utilisateur non connecté, ex. page de login/vitrine).
 */
export function scheduleRefresh(): void {
  if (typeof window === 'undefined') return
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null }

  const token = localStorage.getItem('access_token')
  if (!token) return
  const exp = decodeExpiryMs(token)
  if (!exp) return

  const delay = Math.max(exp - Date.now() - SAFETY_MARGIN_MS, 0)
  refreshTimer = setTimeout(async () => {
    const outcome = await doRefresh()
    if (outcome === 'ok') {
      scheduleRefresh()
    } else if (outcome === 'network-error') {
      refreshTimer = setTimeout(() => scheduleRefresh(), RETRY_AFTER_NETWORK_ERROR_MS)
    }
    // 'invalid' : le refresh token est mort (expiré ou révoqué) — on ne
    // reprogramme rien. La session expirera naturellement et le prochain
    // appel API échouera en 401, ce que chaque page gère déjà en
    // redirigeant vers /login.
  }, delay)
}

/**
 * À appeler une fois, globalement (layout racine) : reprend le cycle de
 * renouvellement au chargement de l'app si une session existe déjà, et le
 * réajuste quand l'onglet redevient visible (les timers sont limités en
 * arrière-plan par le navigateur) ou qu'un autre onglet écrit un nouveau
 * token.
 */
/** À appeler à la déconnexion pour ne pas laisser un renouvellement programmé
 * tenter d'utiliser un refresh_token qui vient d'être supprimé. */
export function cancelRefresh(): void {
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null }
}

export function initTokenRefresh(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  scheduleRefresh()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleRefresh()
  })
  window.addEventListener('storage', (e) => {
    if (e.key === 'access_token' || e.key === 'refresh_token') scheduleRefresh()
  })
}
