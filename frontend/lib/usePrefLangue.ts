'use client'

import { useEffect, useState } from 'react'
import type { Langue } from '@/lib/i18n'

const STORAGE_KEY = 'pref_langue'

/** Langue choisie manuellement sur les pages sans organisation connue
 * (login, changement de mot de passe) — persistée en local, indépendante
 * de la langue de l'organisation utilisée une fois connecté. */
export function usePrefLangue(): [Langue, (l: Langue) => void] {
  const [langue, setLangueState] = useState<Langue>('fr')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'fr' || saved === 'en') setLangueState(saved)
  }, [])

  function setLangue(l: Langue) {
    setLangueState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  return [langue, setLangue]
}
