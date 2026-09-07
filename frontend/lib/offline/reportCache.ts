// Cache de lecture pour le mode hors ligne prolongé (Niveau 3) : la
// dernière réponse JSON réussie de chaque endpoint GET est gardée en
// IndexedDB, pour pouvoir réafficher un rapport déjà consulté quand le
// réseau n'est plus disponible.

import { dbGet, dbPut, STORE_REPORTS } from './db'

interface CachedReport {
  url: string
  data: any
  cachedAt: number
}

export async function cacheReport(url: string, data: any): Promise<void> {
  await dbPut(STORE_REPORTS, { url, data, cachedAt: Date.now() })
}

export async function readCachedReport(url: string): Promise<CachedReport | undefined> {
  return dbGet<CachedReport>(STORE_REPORTS, url)
}

/**
 * GET résilient : essaie le réseau, met le résultat en cache en cas de
 * succès. En cas d'échec réseau, retombe sur la dernière copie connue et
 * signale `fromCache: true`. Rethrow si aucune copie n'existe.
 */
export async function fetchWithCache(url: string, token: string | null): Promise<{ data: any; fromCache: boolean; cachedAt?: number; status?: number }> {
  try {
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (res.ok) {
      const data = await res.json()
      await cacheReport(url, data)
      return { data, fromCache: false }
    }
    return { data: null, fromCache: false, status: res.status }
  } catch {
    const cached = await readCachedReport(url)
    if (cached) return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt }
    throw new Error('offline-no-cache')
  }
}
