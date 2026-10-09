'use client'

import { useEffect, useState } from 'react'
import DossierBatiment from '@/components/dossier/DossierBatiment'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'

// Espace client : l'historique de chaque bâtiment, année par année —
// rapports et certificats figés, envois reçus (factures comprises).
export default function MonDossierPage() {
  const t = useT()
  const [batiments, setBatiments] = useState<any[] | null>(null)
  const [choisi, setChoisi] = useState<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/cycles/mes-batiments/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        const liste = Array.isArray(data) ? data : []
        setBatiments(liste)
        if (liste.length) setChoisi(liste[0].id)
      })
      .catch(() => setBatiments([]))
  }, [])

  if (batiments === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (batiments.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
        <i className="ti ti-folder-off text-5xl text-gray-300" />
        <p className="mt-3 text-sm font-semibold text-gray-500">{t('dossier_aucun_cycle')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {batiments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {batiments.map(b => (
            <button key={b.id} onClick={() => setChoisi(b.id)} aria-pressed={choisi === b.id}
              className="h-10 flex items-center gap-2 px-3.5 rounded-md border-2 text-sm font-bold shadow-sm transition-all"
              style={choisi === b.id ? { background: NAVY, borderColor: NAVY, color: '#fff' } : { background: '#fff', borderColor: '#cbd5e1', color: NAVY }}>
              <i className="ti ti-building" /> {b.adresse_complete}
            </button>
          ))}
        </div>
      )}
      {choisi && <DossierBatiment key={choisi} batimentId={choisi} role="citoyen" />}
    </div>
  )
}
