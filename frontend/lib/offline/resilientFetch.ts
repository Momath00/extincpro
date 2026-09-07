// Point d'entrée utilisé par les composants de saisie : tente l'appel
// réseau immédiatement, et ne met en file que si l'échec est réellement
// dû à l'absence de réseau (pas à une erreur de validation serveur).

import { enqueue, flush, genTempId } from './queue'

export interface ResilientResult {
  ok: boolean
  queued: boolean
  status?: number
  data?: any
}

function isNetworkError(err: unknown): boolean {
  // fetch() rejette avec un TypeError quand la requête n'a même pas pu
  // partir (hors-ligne, DNS, CORS bloqué) — jamais pour une réponse HTTP
  // d'erreur, qui elle résout la promesse avec res.ok === false.
  return err instanceof TypeError
}

export function isTempId(id: any): boolean {
  return typeof id === 'string' && id.startsWith('temp-')
}

function extractIdFromUrl(url: string): string | null {
  const match = url.match(/temp-[a-zA-Z0-9-]+/)
  return match ? match[0] : null
}

function authHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * PATCH/DELETE résilient sur une ressource déjà existante (id réel ou
 * temporaire). En cas de coupure réseau, met la mutation en file et
 * renvoie { queued: true } — l'appelant garde sa mise à jour optimiste
 * telle quelle, sans revenir en arrière.
 */
export async function resilientMutate(
  method: 'PATCH' | 'DELETE',
  url: string,
  body?: any
): Promise<ResilientResult> {
  if (isTempId(extractIdFromUrl(url))) {
    // La ressource n'existe pas encore côté serveur (création encore en
    // file) — inutile de tenter un appel réseau qui échouerait forcément.
    await enqueue({ method, url, body: body ?? {} })
    return { ok: true, queued: true }
  }
  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: method === 'DELETE' ? undefined : JSON.stringify(body ?? {}),
    })
    if (res.ok) {
      const data = res.status === 204 ? null : await res.json().catch(() => null)
      return { ok: true, queued: false, status: res.status, data }
    }
    return { ok: false, queued: false, status: res.status }
  } catch (err) {
    if (!isNetworkError(err)) throw err
    await enqueue({ method, url, body: body ?? {} })
    return { ok: true, queued: true }
  }
}

/**
 * POST résilient de création. En ligne : comportement inchangé. Hors
 * ligne : génère un id temporaire, met la création en file, et renvoie cet
 * id pour que l'appelant insère immédiatement la ligne dans son état local.
 */
export async function resilientCreate(collectionUrl: string, body: any): Promise<ResilientResult & { tempId?: string }> {
  try {
    const res = await fetch(collectionUrl, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body ?? {}),
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      return { ok: true, queued: false, status: res.status, data }
    }
    return { ok: false, queued: false, status: res.status }
  } catch (err) {
    if (!isNetworkError(err)) throw err
    const tempId = genTempId()
    await enqueue({ method: 'POST', url: collectionUrl, body: body ?? {}, tempId })
    return { ok: true, queued: true, tempId }
  }
}

export { flush as flushQueue }
