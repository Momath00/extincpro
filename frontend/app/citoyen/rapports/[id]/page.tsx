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

function ProgressionRapport({ rapport }: { rapport: any }) {
  const t = useT()
  const prog = rapport.progression || {}
  const etapes = [
    { label: t('etape_inspection'), done: prog.e1 || prog.e2 || prog.e3, color: '#9a4a13' },
    { label: t('etape_dispositifs'), done: prog.e3, color: '#4b2f8c' },
    { label: t('etape_rapport_ferme'), done: prog.ferme, color: NAVY },
    { label: t('certificat'), done: prog.certificat, color: ORANGE },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap mt-3">
      {etapes.map((e, i) => (
        <div key={e.label} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: e.done ? e.color : '#e2e8f0' }}
          />
          <span className="text-xs font-medium" style={{ color: e.done ? e.color : '#9ca3af' }}>
            {e.label}
          </span>
          {i < etapes.length - 1 && <span className="w-4 h-px bg-gray-200 flex-shrink-0" />}
        </div>
      ))}
    </div>
  )
}

export default function CitoyenRapportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const t = useT()
  const [rapport, setRapport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    fetch(`${API_URL}/api/rapports/${params.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        if (res.status === 404) { router.push('/citoyen'); return null }
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
  const etages: any[] = rapport.resume_sommaire?.etages || []
  const resumeCitoyen = rapport.resume_sommaire?.resume_citoyen || rapport.resume_citoyen || null

  return (
    <div className="max-w-2xl">
      <Link href="/citoyen" className="text-xs text-gray-400 hover:text-[#0a0b0d] flex items-center gap-1 mb-4">
        <i className="ti ti-arrow-left" /> {t('retour')}
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{rapport.batiment?.adresse_complete || '—'}</h1>
          {estFerme ? (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-50 text-green-700">
              {t('inspection_terminee')}
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#fff2e8', color: '#9a4a13' }}>
              {t('inspection_en_cours')}
            </span>
          )}
        </div>
        {rapport.date_inspection && (
          <p className="text-gray-500 text-sm">
            <i className="ti ti-calendar mr-1" />
            {new Date(rapport.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'long' })}
          </p>
        )}
        <ProgressionRapport rapport={rapport} />
      </div>

      {/* Rapport ouvert */}
      {!estFerme && (
        <div className="bg-white rounded-md border border-gray-100 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#fff2e8' }}>
              <i className="ti ti-clock text-2xl" style={{ color: ORANGE }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: NAVY }}>{t('inspection_en_cours')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t('equipe_travaille_inspection')}</p>
            </div>
          </div>

          {rapport.date_inspection && (
            <div className="bg-gray-50 rounded-md px-4 py-3">
              <p className="text-xs text-gray-500">
                <span className="font-semibold">{t('date_prevue')}</span>{' '}
                {new Date(rapport.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'long' })}
              </p>
            </div>
          )}

          <p className="text-sm text-gray-500 leading-relaxed">
            {t('notification_inspection_completee')}
          </p>
        </div>
      )}

      {/* Rapport fermé */}
      {estFerme && (
        <>
          {/* Résumé citoyen */}
          <div className="bg-white rounded-md border border-gray-100 p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
                <i className="ti ti-file-description text-white text-sm" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
                {t('resume_inspection')}
              </h2>
            </div>

            {resumeCitoyen ? (
              <p className="text-sm text-gray-700 leading-relaxed">{resumeCitoyen}</p>
            ) : (
              <div className="flex flex-col gap-2 text-sm text-gray-700 leading-relaxed">
                <p>{t('resume_defaut_p1')}</p>
                <p>{t('resume_defaut_p2')}</p>
              </div>
            )}

            {/* Télécharger le rapport */}
            <button
              onClick={() => downloadHtml(`${API_URL}/api/rapports/${rapport.id}/telecharger/`)}
              className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-md border-2 hover:bg-gray-50 transition-colors"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              <i className="ti ti-file-download" /> {t('telecharger_le_rapport')}
            </button>
          </div>

          {/* Étages / état */}
          {etages.length > 0 && (
            <div className="bg-white rounded-md border border-gray-100 overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('etat_par_section')}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {etages.map((etage: any, i: number) => {
                  const etatBon = etage.etat === 'bon' || etage.etat === 'Bon'
                  const etatAcceptable = etage.etat === 'acceptable' || etage.etat === 'Acceptable'
                  return (
                    <div key={i} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm font-medium" style={{ color: NAVY }}>{etage.nom}</span>
                      {etatBon ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-50 text-green-700">{t('etat_bon')}</span>
                      ) : etatAcceptable ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-yellow-50 text-yellow-700">{t('etat_acceptable')}</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-50 text-red-600">{t('etat_a_reviser')}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Certificat */}
          {certificatEnvoye ? (
            <div className="bg-white rounded-md border p-6" style={{ borderColor: rapport.certificat?.conforme === false ? '#fecaca' : '#dcfce7' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: rapport.certificat?.conforme === false ? '#fef2f2' : '#f0fdf4' }}>
                  <i className={`ti ti-certificate text-xl ${rapport.certificat?.conforme === false ? 'text-red-500' : 'text-green-600'}`} />
                </div>
                <div>
                  <h2 className={`text-sm font-bold ${rapport.certificat?.conforme === false ? 'text-red-600' : 'text-green-700'}`}>
                    {rapport.certificat?.conforme === false ? t('certificat_non_conforme') : t('certificat_disponible')}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {rapport.certificat?.conforme === false
                      ? t('reparations_requises_avant_conforme')
                      : t('votre_certificat_conformite_emis')}
                  </p>
                </div>
              </div>

              {rapport.certificat?.conforme === false && (
                <div className="flex items-start gap-2.5 rounded-md p-3.5 mb-4" style={{ background: '#fffbeb' }}>
                  <i className="ti ti-alert-triangle text-base flex-shrink-0 mt-0.5" style={{ color: '#b45309' }} />
                  <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                    {t('reparations_requises_detail')}
                  </p>
                </div>
              )}

              <div className="rounded-md px-4 py-3 mb-4 flex flex-col gap-1"
                style={{ background: rapport.certificat?.conforme === false ? '#fef2f2' : '#f0fdf4' }}>
                {rapport.certificat?.numero && (
                  <p className={`text-xs ${rapport.certificat?.conforme === false ? 'text-red-800' : 'text-green-800'}`}>
                    <span className="font-semibold">{t('numero_deux_points')}</span> {rapport.certificat.numero}
                  </p>
                )}
                {rapport.certificat?.date_emission && (
                  <p className={`text-xs ${rapport.certificat?.conforme === false ? 'text-red-800' : 'text-green-800'}`}>
                    <span className="font-semibold">{t('date_emission_deux_points')}</span>{' '}
                    {new Date(rapport.certificat.date_emission).toLocaleDateString('fr-CA', { dateStyle: 'long' })}
                  </p>
                )}
              </div>

              <button
                onClick={() => downloadHtml(`${API_URL}/api/rapports/${rapport.id}/certificat-pdf/`)}
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
