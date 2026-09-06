'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

type DocumentsPrets = {
  mode_direct: boolean
  contact_email: string | null
  count: number
  nb_rapports: number
  labels: string[]
}

/**
 * Bannière unique, partagée par tous les types de rapport (incendie,
 * extincteur, et tout futur module suivant le même patron « rapport fermé ->
 * certificat »), affichée au niveau du bâtiment : elle montre en un coup
 * d'œil tout ce qui est prêt à envoyer en mode livraison directe et envoie
 * tout en un seul courriel, peu importe depuis quelle page de rapport on
 * l'ouvre.
 */
export default function EnvoiDirectBanner({
  batimentId,
  onEnvoye,
}: {
  batimentId: number
  onEnvoye?: () => void
}) {
  const t = useT()
  const [donnees, setDonnees] = useState<DocumentsPrets | null>(null)
  const [phase, setPhase] = useState<'idle' | 'envoi' | 'succes' | 'erreur'>('idle')
  const [message, setMessage] = useState('')

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) return
    fetch(`${API_URL}/api/batiments/${batimentId}/documents-a-envoyer/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data) setDonnees(data) })
      .catch(() => {})
  }

  useEffect(() => { charger() }, [batimentId])

  async function envoyer() {
    setPhase('envoi')
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/batiments/${batimentId}/envoyer-documents/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      setMessage(d.message || t('certificat_envoye_toast'))
      setPhase('succes')
      charger()
      onEnvoye?.()
      setTimeout(() => setPhase('idle'), 2800)
    } else {
      setMessage(d.error || t('erreur_envoi'))
      setPhase('erreur')
    }
  }

  const overlay = phase !== 'idle' && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={() => phase === 'erreur' && setPhase('idle')}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
        {phase === 'envoi' && (
          <>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 animate-spin"
              style={{ border: `4px solid #fde3cc`, borderTopColor: ORANGE }} />
            <p className="text-sm font-bold" style={{ color: NAVY }}>{t('envoi_en_cours')}</p>
          </>
        )}
        {phase === 'succes' && (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#e9f6f2' }}>
              <i className="ti ti-check text-2xl" style={{ color: '#0d6b4f' }} />
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: '#0d6b4f' }}>{t('envoi_reussi_titre')}</p>
            <p className="text-xs text-gray-500">{message}</p>
          </>
        )}
        {phase === 'erreur' && (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#fef2f2' }}>
              <i className="ti ti-x text-2xl" style={{ color: ORANGE }} />
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: ORANGE }}>{t('envoi_echec_titre')}</p>
            <p className="text-xs text-gray-500 mb-4">{message}</p>
            <button onClick={() => setPhase('idle')}
              className="text-sm font-semibold px-4 py-2 rounded-md border border-gray-200" style={{ color: NAVY }}>
              {t('fermer')}
            </button>
          </>
        )}
      </div>
    </div>
  )

  if (!donnees || !donnees.mode_direct || donnees.count === 0) return overlay

  return (
    <>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-md border"
        style={{ background: '#fff2e8', borderColor: '#fde3cc' }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
            <i className="ti ti-mail-forward text-white text-base" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: NAVY }}>
              {donnees.nb_rapports} {donnees.nb_rapports > 1 ? t('rapports_pluriel') : t('rapport_singulier')}
              {' '}{t('et')}{' '}
              {donnees.count} {donnees.count > 1 ? t('certificats_pluriel') : t('certificat_singulier')}
              {' '}{(donnees.nb_rapports + donnees.count) > 1 ? t('prets_a_envoyer_pluriel') : t('pret_a_envoyer_singulier')}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {donnees.labels.join(' + ')} — {t('documents_prets_desc')}
            </p>
          </div>
        </div>
        <button
          onClick={envoyer}
          disabled={phase === 'envoi'}
          className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-mail-forward" /> {phase === 'envoi' ? t('envoi_en_cours') : t('envoyer_tout_bouton')}
        </button>
      </div>
      {overlay}
    </>
  )
}
