'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LangueProvider, useT, type Langue } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

type Verification = {
  etat: 'valide' | 'remplace' | 'en_revision' | 'expire'
  numero: string
  numero_actuel: string
  code_integrite: string
  type_document: 'certificat' | 'avis'
  conforme: boolean
  date_emission: string
  organisation: string
  langue: Langue
  adresse: string
  lignes: { label: string; statut: 'conforme' | 'non_conforme' | 'so'; echeance: string | null }[]
}

const ETATS = {
  valide: { icone: 'ti-rosette-discount-check', couleur: '#16a34a', fond: '#dcfce7', cle: 'vc_valide' },
  expire: { icone: 'ti-clock-exclamation', couleur: '#b45309', fond: '#fef3c7', cle: 'vc_expire' },
  en_revision: { icone: 'ti-pencil-exclamation', couleur: '#b45309', fond: '#fef3c7', cle: 'vc_en_revision' },
  remplace: { icone: 'ti-replace', couleur: '#6b7280', fond: '#f3f4f6', cle: 'vc_remplace' },
} as const

function Contenu({ v, introuvable }: { v: Verification | null; introuvable: boolean }) {
  const t = useT()
  const dateFmt = (iso: string) =>
    new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(v?.langue === 'en' ? 'en-CA' : 'fr-CA', { dateStyle: 'long' })

  if (introuvable) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#fee2e2' }}>
          <i className="ti ti-shield-x text-3xl" style={{ color: ORANGE }} />
        </div>
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>{t('vc_introuvable')}</h1>
        <p className="text-sm text-gray-500 mt-2">{t('vc_introuvable_desc')}</p>
      </div>
    )
  }
  if (!v) return null

  const etat = ETATS[v.etat]
  const statuts = {
    conforme: { texte: t('cp_conforme'), couleur: '#16a34a', fond: '#dcfce7' },
    non_conforme: { texte: t('cp_non_conforme'), couleur: ORANGE, fond: '#fee2e2' },
    so: { texte: t('cp_so'), couleur: '#6b7280', fond: '#f3f4f6' },
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-6 text-center" style={{ background: etat.fond }}>
        <i className={`ti ${etat.icone} text-5xl`} style={{ color: etat.couleur }} />
        <h1 className="text-lg font-bold mt-2" style={{ color: etat.couleur }}>{t(etat.cle)}</h1>
        {v.etat === 'remplace' && (
          <p className="text-sm mt-1 text-gray-600">{t('vc_version_actuelle')} : <strong>{v.numero_actuel}</strong></p>
        )}
      </div>

      <div className="p-6 flex flex-col gap-4">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {v.type_document === 'avis' ? t('cp_avis') : t('cp_certificat')}
          </p>
          <p className="text-2xl font-bold tracking-wide" style={{ color: NAVY }}>{v.numero}</p>
          {v.type_document !== 'avis' && (
            <span className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full"
              style={v.conforme ? { background: '#dcfce7', color: '#16a34a' } : { background: '#fee2e2', color: ORANGE }}>
              {v.conforme ? t('cp_conforme') : t('cp_non_conforme')}
            </span>
          )}
        </div>

        <div className="rounded-lg border-2 border-dashed px-4 py-3 text-center" style={{ borderColor: '#cbd5e1' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('vc_code')}</p>
          <p className="font-mono text-xl font-extrabold tracking-widest" style={{ color: NAVY }}>{v.code_integrite}</p>
          <p className="text-[11px] text-gray-500 mt-1">{t('vc_comparer')}</p>
        </div>

        <dl className="flex flex-col divide-y divide-gray-50 text-sm">
          {[
            [t('vc_emis_par'), v.organisation],
            [t('vc_adresse'), v.adresse],
            [t('vc_date'), dateFmt(v.date_emission)],
          ].map(([label, valeur]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5">
              <dt className="text-gray-400">{label}</dt>
              <dd className="font-semibold text-right" style={{ color: NAVY }}>{valeur}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{t('vc_systemes')}</p>
          <div className="flex flex-col gap-2">
            {v.lignes.map(l => (
              <div key={l.label} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: NAVY }}>{l.label}</p>
                  {l.echeance && <p className="text-xs text-gray-400">{t('cp_col_echeance')} : {dateFmt(l.echeance)}</p>}
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{ color: statuts[l.statut].couleur, background: statuts[l.statut].fond }}>
                  {statuts[l.statut].texte}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Page publique ouverte par le QR code imprimé sur le certificat. */
export default function VerifierCertificatPage() {
  const { jeton } = useParams<{ jeton: string }>()
  const [v, setV] = useState<Verification | null>(null)
  const [introuvable, setIntrouvable] = useState(false)

  useEffect(() => {
    const revision = new URLSearchParams(window.location.search).get('r')
    fetch(`${API_URL}/api/verifier-certificat/${jeton}/${revision ? `?r=${encodeURIComponent(revision)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(setV)
      .catch(() => setIntrouvable(true))
  }, [jeton])

  const langue: Langue = v?.langue || (typeof navigator !== 'undefined' && navigator.language.startsWith('en') ? 'en' : 'fr')

  return (
    <LangueProvider langue={langue}>
      <main className="min-h-screen px-4 py-10" style={{ background: '#f8fafc' }}>
        <div className="max-w-md mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2">
            <img src="/logo-mark.png" alt="ExtincPro" className="h-8 w-auto" />
            <TitrePage />
          </div>
          <Contenu v={v} introuvable={introuvable} />
        </div>
      </main>
    </LangueProvider>
  )
}

function TitrePage() {
  const t = useT()
  return <span className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('vc_titre')}</span>
}
