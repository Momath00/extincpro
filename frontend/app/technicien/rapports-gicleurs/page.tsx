'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/i18n'
import { FICHES_MENU, ICONES_FICHES } from '@/lib/gicleurFiches'
import LignesFiches from '@/components/rapports-gicleurs/LignesFiches'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

type FiltreStatut = 'tous' | 'ouvert' | 'ferme'

export default function TechnicienRapportsGicleursPage() {
  return <Suspense><TechnicienRapportsGicleursContent /></Suspense>
}

function TechnicienRapportsGicleursContent() {
  const router = useRouter()
  const t = useT()
  // ?fiche=eau : sous-menu « Système sous eau » du menu Gicleurs.
  const fiche = useSearchParams().get('fiche') || ''
  const ficheMenu = FICHES_MENU.find(f => f.code === fiche)
  const [rapports, setRapports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<FiltreStatut>('tous')

  const STATUT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    ouvert: { label: t('ouvert'), bg: '#fff2e8', color: '#9a4a13' },
    ferme: { label: t('ferme'), bg: '#e9f6f2', color: '#0d6b4f' },
  }

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    fetch(`${API_URL}/api/rapports-gicleurs/${fiche ? `?fiche=${fiche}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        const list = Array.isArray(data) ? data : (data.results || [])
        setRapports(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [fiche])

  const rapportsFiltres = filtre === 'tous'
    ? rapports
    : rapports.filter(r => r.statut === filtre)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap" style={{ color: NAVY }}>
            {t('titre_rapport_gicleur')}
            {ficheMenu && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: ORANGE }}>
                <i className={`ti ${ICONES_FICHES[ficheMenu.code]}`} /> {t(ficheMenu.cle)}
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-sm mt-1">{rapports.length} {rapports.length !== 1 ? t('rapports_pluriel') : t('rapport_singulier')} {t('rapports_assignes')}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {([
          { key: 'tous', label: t('tous') },
          { key: 'ouvert', label: t('en_cours') },
          { key: 'ferme', label: t('termines') },
        ] as { key: FiltreStatut; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setFiltre(f.key)}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all duration-200"
            style={{
              background: filtre === f.key ? NAVY : '#f1f5f9',
              color: filtre === f.key ? '#fff' : '#64748b',
            }}
          >
            {f.label}
            {f.key !== 'tous' && (
              <span className="ml-1.5 opacity-70">
                ({rapports.filter(r => f.key === 'tous' || r.statut === f.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {rapportsFiltres.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-md border border-gray-100">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f8f9fa' }}>
            <i className="ti ti-droplets text-xl text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm font-medium">{t('aucun_rapport_avec_statut')} {filtre !== 'tous' ? `"${STATUT_BADGE[filtre]?.label}"` : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-[2fr_1.5fr_auto] gap-4 px-5 py-3 border-b border-gray-100 bg-slate-50 text-xs font-black uppercase tracking-widest text-gray-500">
            <span>{t('adresse')}</span>
            <span>{t('client')}</span>
            <span>{t('statut')}</span>
          </div>

          <div className="divide-y divide-gray-100">
            {rapportsFiltres.map((r: any) => {
              const badge = STATUT_BADGE[r.statut] || STATUT_BADGE.ouvert
              const ferme = r.statut === 'ferme'
              const lien = `/technicien/rapports-gicleurs/${r.id}`
              return (
                <div key={r.id}>
                  <Link
                    href={lien}
                    className="flex flex-col md:grid md:grid-cols-[2fr_1.5fr_auto] gap-2 md:gap-4 px-5 py-4 hover:bg-gray-50 transition-colors items-start md:items-center group"
                  >
                    <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
                      <div className="w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center"
                        style={{ background: ferme ? '#e9f6f2' : '#fff2e8' }}>
                        <i className="ti ti-droplets text-sm" style={{ color: ferme ? '#0d6b4f' : '#9a4a13' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate group-hover:text-[#e11324] transition-colors" style={{ color: NAVY }}>
                          {r.batiment?.adresse_complete || '—'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {r.date_inspection
                            ? new Date(r.date_inspection).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
                            : t('date_non_definie')}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 truncate">{r.batiment?.client_nom || '—'}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </Link>
                  <LignesFiches fiches={r.fiches || []} debitsValves={r.resume_debits_valves} lienRapport={lien} filtre={fiche} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
