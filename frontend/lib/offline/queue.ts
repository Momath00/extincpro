// File de mutations en attente — cœur de la résilience hors-ligne.
//
// Chaque entrée représente un appel API qui a échoué à cause du réseau et
// doit être rejoué plus tard. Une entrée "create" (POST) peut porter un
// tempId : les entrées suivantes qui visent cette ressource pas-encore-née
// utilisent une URL contenant ce tempId ; dès que la création réussit, on
// réécrit ces URLs avec l'ID réel renvoyé par le serveur avant de les rejouer.

import { dbGetAll, dbPut, dbDelete, STORE_QUEUE } from './db'

export type QueueMethod = 'PATCH' | 'POST' | 'DELETE'

export interface QueueEntry {
  id: string
  method: QueueMethod
  url: string
  body: any
  createdAt: number
  attempts: number
  nextAttemptAt: number
  tempId?: string
}

export interface Rejection {
  id: string
  at: number
}

type Listener = () => void

const listeners = new Set<Listener>()
let needsAuth = false
const rejections: Rejection[] = []
let flushing = false

function notify() {
  listeners.forEach((fn) => fn())
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getNeedsAuth(): boolean {
  return needsAuth
}

export function getRejections(): Rejection[] {
  return rejections
}

export function clearRejections() {
  rejections.length = 0
  notify()
}

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function genTempId(): string {
  return `temp-${genId()}`
}

async function loadQueue(): Promise<QueueEntry[]> {
  const items = await dbGetAll<QueueEntry>(STORE_QUEUE)
  return items.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getPendingCount(): Promise<number> {
  return (await loadQueue()).length
}

/**
 * Ajoute une mutation à la file. Si c'est une suppression visant un item
 * temporaire dont la création n'a jamais été envoyée, on annule les deux
 * localement plutôt que de faire un aller-retour réseau inutile.
 */
export async function enqueue(entry: Omit<QueueEntry, 'id' | 'createdAt' | 'attempts' | 'nextAttemptAt'>): Promise<void> {
  const queue = await loadQueue()

  if (entry.method === 'DELETE') {
    const tempIdInUrl = extractTempId(entry.url)
    if (tempIdInUrl) {
      const createEntry = queue.find((e) => e.tempId === tempIdInUrl)
      if (createEntry) {
        // La création n'a jamais été envoyée : on retire la création et
        // toute entrée dépendante, sans jamais toucher le réseau.
        const toRemove = queue.filter((e) => e.id === createEntry.id || e.url.includes(tempIdInUrl))
        for (const e of toRemove) await dbDelete(STORE_QUEUE, e.id)
        notify()
        return
      }
    }
  }

  const full: QueueEntry = {
    ...entry,
    id: genId(),
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
  }
  await dbPut(STORE_QUEUE, full)
  notify()
}

function extractTempId(url: string): string | null {
  const match = url.match(/temp-[a-zA-Z0-9-]+/)
  return match ? match[0] : null
}

async function resolveTempId(tempId: string, realId: string | number) {
  const queue = await loadQueue()
  for (const entry of queue) {
    if (entry.url.includes(tempId)) {
      const rewritten = { ...entry, url: entry.url.replace(tempId, String(realId)) }
      await dbPut(STORE_QUEUE, rewritten)
    }
  }
  reconcileListeners.forEach((fn) => fn(tempId, realId))
}

type ReconcileListener = (tempId: string, realId: string | number) => void
const reconcileListeners = new Set<ReconcileListener>()

export function onReconciled(fn: ReconcileListener): () => void {
  reconcileListeners.add(fn)
  return () => reconcileListeners.delete(fn)
}

function backoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** attempts, 5 * 60_000)
}

function freshHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Rejoue la file en ordre FIFO. S'arrête net dès qu'une entrée échoue pour
 * une raison réseau (hors-ligne) ou 401 (session expirée) — le reste de la
 * file attend le prochain déclencheur. Les rejets permanents (4xx) et les
 * erreurs serveur (5xx, avec backoff) sont traités par entrée, sans
 * bloquer les autres.
 */
export async function flush(): Promise<void> {
  if (flushing) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  flushing = true
  try {
    const queue = await loadQueue()
    const now = Date.now()
    let cascadeRemoved = new Set<string>()

    for (const entry of queue) {
      if (cascadeRemoved.has(entry.id)) continue
      if (entry.nextAttemptAt > now) continue

      const tempIdDep = extractTempId(entry.url)
      if (tempIdDep && queue.some((e) => e.tempId === tempIdDep && e.id !== entry.id)) {
        // Dépend d'une création pas encore résolue — on attend son tour.
        continue
      }

      let res: Response
      try {
        res = await fetch(entry.url, {
          method: entry.method,
          headers: freshHeaders(),
          body: entry.method === 'DELETE' ? undefined : JSON.stringify(entry.body),
        })
      } catch {
        // Pas de réseau — on arrête complètement ce passage.
        return
      }

      if (res.ok) {
        if (entry.tempId) {
          const data = await res.json().catch(() => null)
          if (data && data.id != null) await resolveTempId(entry.tempId, data.id)
        }
        await dbDelete(STORE_QUEUE, entry.id)
        needsAuth = false
        notify()
        continue
      }

      if (res.status === 401) {
        needsAuth = true
        notify()
        return
      }

      if (res.status >= 500) {
        const updated = { ...entry, attempts: entry.attempts + 1, nextAttemptAt: Date.now() + backoffMs(entry.attempts) }
        await dbPut(STORE_QUEUE, updated)
        continue
      }

      // 4xx permanent (validation, rapport fermé, module inactif, etc.)
      const orphans = entry.tempId ? queue.filter((e) => e.url.includes(entry.tempId!) && e.id !== entry.id) : []
      for (const orphan of orphans) {
        await dbDelete(STORE_QUEUE, orphan.id)
        cascadeRemoved.add(orphan.id)
      }
      await dbDelete(STORE_QUEUE, entry.id)
      rejections.push({ id: entry.id, at: Date.now() })
      notify()
    }
  } finally {
    flushing = false
  }
}

let initialized = false

export function initOfflineQueue() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('online', () => { flush() })
  window.addEventListener('focus', () => { flush() })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush()
  })
  window.addEventListener('storage', (e) => {
    if (e.key === 'access_token' && e.newValue) flush()
  })
  setInterval(() => { flush() }, 20_000)

  flush()
}
