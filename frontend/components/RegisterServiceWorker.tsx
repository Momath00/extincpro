'use client'

import { useEffect } from 'react'

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') {
      // En développement, un service worker resté d'une version de production
      // sert l'ancien JavaScript depuis son cache (cache-first sur /_next/static) :
      // on le désinscrit et on vide ses caches pour voir le code à jour.
      navigator.serviceWorker.getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .catch(() => {})
      if (typeof caches !== 'undefined') {
        caches.keys()
          .then(cles => Promise.all(cles.filter(c => c.startsWith('extincpro-shell-')).map(c => caches.delete(c))))
          .catch(() => {})
      }
      return
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return null
}
