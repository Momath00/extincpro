'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

async function downloadHtml(url: string) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return
  const html = await res.text()
  const blob = new Blob([html], { type: 'text/html' })
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
}

export default function CitoyenRapportExtincteurDetailPage() {
  const router = useRouter()
  const params = useParams()
  const t = useT()
  const [rapport, setRapport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    fetch(`${API_URL}/api/rapports-extincteurs/${params.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        if (res.status === 404) { router.push('/citoyen/rapports-extincteurs'); return null }
        return res.json()
      })
      .then(data => {
        if (data) { setRapport(data); setLoading(false) }
      })
      .catch(() => setLoading(false))
  }, [params.id])

  if (loading || !rapport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const estFerme = rapport.statut === 'ferme'
  const certificatEnvoye = rapport.certificat?.certificat_envoye === true
  const nbExtincteurs = rapport.extincteurs?.length || 0

  return (
    <div className="max-w-2xl">
      <Link href="/citoyen/rapports-extincteurs" className="text-xs text-gray-400 hover:text-[#0a0b0d] flex items-center gap-1 mb-4">
        <i className="ti ti-arrow-left" /> {t('retour')}
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{rapport.batiment?.adresse_complete || '—'}</h1>
          {estFerme ? (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-50 text-green-700">
              {t('verification_terminee')}
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#fff2e8', color: '#9a4a13' }}>
              {t('verification_en_cours')}
            </span>
          )}
        </div>
        {rapport.date_inspection && (
          <p className="text-gray-500 text-sm">
            <i className="ti ti-calendar mr-1" />
            {new Date(rapport.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'long' })}
          </p>
        )}
      </div>

      {!estFerme && (
        <div className="bg-white rounded-md border border-gray-100 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#fff2e8' }}>
              <i className="ti ti-clock text-2xl" style={{ color: ORANGE }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: NAVY }}>{t('verification_en_cours')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t('equipe_travaille_extincteurs')}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            {t('notification_des_completee')}
          </p>
        </div>
      )}

      {estFerme && (
        <>
          <div className="bg-white rounded-md border border-gray-100 p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
                <i className="ti ti-fire-extinguisher text-white text-sm" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
                {t('resume_verification')}
              </h2>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {nbExtincteurs} {t('col_extincteurs').toLowerCase()} {nbExtincteurs !== 1 ? t('extincteurs_verifies_par_equipe') : t('extincteur_verifie_par_equipe')}
            </p>
            <button
              onClick={() => downloadHtml(`${API_URL}/api/rapports-extincteurs/${rapport.id}/telecharger/`)}
              className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-md border-2 hover:bg-gray-50 transition-colors"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              <i className="ti ti-file-download" /> {t('telecharger_le_rapport')}
            </button>
          </div>

          {certificatEnvoye ? (
            <div className="bg-white rounded-md border p-6" style={{ borderColor: '#dcfce7' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f0fdf4' }}>
                  <i className="ti ti-certificate text-xl text-green-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-green-700">{t('certificat_disponible')}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{t('votre_certificat_emis')}</p>
                </div>
              </div>

              <div className="rounded-md px-4 py-3 mb-4 flex flex-col gap-1" style={{ background: '#f0fdf4' }}>
                {rapport.certificat?.numero && (
                  <p className="text-xs text-green-800">
                    <span className="font-semibold">{t('numero_deux_points')}</span> {rapport.certificat.numero}
                  </p>
                )}
                {rapport.certificat?.date_emission && (
                  <p className="text-xs text-green-800">
                    <span className="font-semibold">{t('date_emission_deux_points')}</span>{' '}
                    {new Date(rapport.certificat.date_emission).toLocaleDateString('fr-CA', { dateStyle: 'long' })}
                  </p>
                )}
              </div>

              <button
                onClick={() => downloadHtml(`${API_URL}/api/rapports-extincteurs/${rapport.id}/certificat-pdf/`)}
                className="flex items-center justify-center gap-2 w-full text-white py-3 rounded-md text-sm font-bold uppercase hover:opacity-90 transition-opacity"
                style={{ background: NAVY }}
              >
                <i className="ti ti-download" /> {t('telecharger_mon_certificat')}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-md border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f8f9fa' }}>
                  <i className="ti ti-hourglass text-xl text-gray-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold" style={{ color: NAVY }}>{t('certificat_en_preparation')}</h2>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    {t('certificat_preparation_texte')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
