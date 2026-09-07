'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { initOfflineQueue, subscribe, getRejections, getNeedsAuth, clearRejections } from '@/lib/offline/queue'

const NAVY = '#0a0b0d'

/**
 * Monté dans les layouts technicien/superviseur : démarre la file de
 * synchronisation en arrière-plan et affiche un toast ponctuel uniquement
 * quand un changement fait hors ligne n'a pas pu être appliqué, ou que la
 * session a expiré pendant que des changements sont en attente. Sinon,
 * complètement invisible — pas de bandeau de statut permanent.
 */
export default function OfflineSyncInit() {
  const t = useT()
  const [toast, setToast] = useState<string | null>(null)
  const [seenNeedsAuth, setSeenNeedsAuth] = useState(false)

  useEffect(() => {
    initOfflineQueue()
    const unsub = subscribe(() => {
      const rejections = getRejections()
      if (rejections.length > 0) {
        setToast(t('changement_non_applique'))
        clearRejections()
        return
      }
      if (getNeedsAuth() && !seenNeedsAuth) {
        setSeenNeedsAuth(true)
        setToast(t('session_expiree_sync_en_attente'))
      }
    })
    return unsub
  }, [t, seenNeedsAuth])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border px-5 py-3.5 max-w-[90vw]"
      style={{ borderColor: '#fecaca' }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#fef2f2' }}>
        <i className="ti ti-alert-triangle text-red-500 text-sm" />
      </div>
      <p className="text-sm font-semibold" style={{ color: NAVY }}>{toast}</p>
    </div>
  )
}
