'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import SectionPhotos from '@/components/rapports/SectionPhotos'
import FichesGicleur from '@/components/rapports-gicleurs/FichesGicleur'
import OngletDeficiencesGicleur from '@/components/rapports-gicleurs/OngletDeficiencesGicleur'
import type { DebitsValves } from '@/components/rapports-gicleurs/SectionDebitsValves'
import { deficiencesSousRapport, nbDeficiencesIdentification, useFichesGicleur, type Identification, type SousRapport } from '@/lib/gicleurFiches'
import { resilientMutate } from '@/lib/offline/resilientFetch'
import ModuleBadge from '@/components/dashboard/ModuleBadge'
import { useT } from '@/lib/i18n'
import { fetchWithCache } from '@/lib/offline/reportCache'
import { dateLocale } from '@/lib/dates'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

type OngletPrincipal = 'formulaire' | 'deficiences' | 'historique'

export default function TechnicienRapportGicleurDetailPage() {
  const router = useRouter()
  const params = useParams()
  const t = useT()
  const [rapport, setRapport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState<OngletPrincipal>('formulaire')
  const [horsLigne, setHorsLigne] = useState(false)
  const [horsLigneDepuis, setHorsLigneDepuis] = useState<number | null>(null)
  const [confirmFermer, setConfirmFermer] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const fiches = useFichesGicleur()
  const sousRapports: SousRapport[] = rapport?.sous_rapports || []
  const debitsValves: DebitsValves | null = rapport?.debits_valves ?? null
  const nbDeficiences = sousRapports.reduce((n, sr) => n + deficiencesSousRapport(fiches?.[sr.type_fiche], sr).length, 0)
    + ((debitsValves?.deficiences || '').trim() ? 1 : 0)
    + nbDeficiencesIdentification(rapport?.identification)
  const identification: Identification = {
    reponses: rapport?.identification?.reponses || {}, remarques: rapport?.identification?.remarques || {},
  }
  const majIdentification = (i: Identification) => setRapport((r: any) => ({ ...r, identification: i }))
  /** Bon de travail / type d'inspection, modifiés depuis l'identification. */
  async function majEntete(champ: 'numero_job' | 'frequence_inspection', valeur: string) {
    setRapport((r: any) => ({ ...r, [champ]: valeur }))
    await resilientMutate('PATCH', `${API_URL}/api/rapports-gicleurs/${rapport.id}/`, { [champ]: valeur })
  }
  const majDebitsValves = (v: DebitsValves | null) => setRapport((r: any) => ({ ...r, debits_valves: v }))
  const majSousRapports = (f: (liste: SousRapport[]) => SousRapport[]) =>
    setRapport((r: any) => ({ ...r, sous_rapports: f(r?.sous_rapports || []) }))

  const STATUT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    ouvert: { label: t('ouvert'), bg: '#fff2e8', color: '#9a4a13' },
    ferme: { label: t('ferme'), bg: '#e9f6f2', color: '#0d6b4f' },
  }

  async function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    try {
      const { data, fromCache, cachedAt, status } = await fetchWithCache(`${API_URL}/api/rapports-gicleurs/${params.id}/`, token)
      if (status === 401) { router.push('/login'); return }
      if (status === 404) { router.push('/technicien/rapports-gicleurs'); return }
      if (data) {
        setRapport(data)
        setHorsLigne(fromCache)
        setHorsLigneDepuis(cachedAt ?? null)
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [params.id])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function fermerRapport() {
    setActionLoading(true)
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports-gicleurs/${rapport.id}/fermer/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null)
    setActionLoading(false)
    setConfirmFermer(false)
    if (res && res.ok) {
      showToast(t('rapport_ferme_cert_genere'), 'success')
      charger()
    } else {
      const d = res ? await res.json().catch(() => ({})) : {}
      showToast(d.error || t('erreur_fermeture'), 'error')
    }
  }

  if (loading || !rapport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const badge = STATUT_BADGE[rapport.statut] || STATUT_BADGE.ouvert
  const readOnly = rapport.statut === 'ferme'

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border px-5 py-3.5"
          style={{ borderColor: toast.type === 'success' ? '#bbf7d0' : '#fecaca' }}>
          <i className={`ti ${toast.type === 'success' ? 'ti-check text-green-600' : 'ti-x text-red-500'}`} />
          <p className="text-sm font-semibold" style={{ color: NAVY }}>{toast.msg}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 gap-3">
        <Link href="/technicien/rapports-gicleurs" className="text-xs text-gray-400 hover:text-[#0a0b0d] flex items-center gap-1">
          <i className="ti ti-arrow-left" /> {t('retour_aux_rapports')}
        </Link>
        <ModuleBadge type="gicleur" />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: ORANGE }}>
            {rapport.batiment?.client_nom || '—'}
          </p>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: NAVY }}>
              {rapport.batiment?.adresse_complete || '—'}
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            {rapport.date_inspection
              ? dateLocale(rapport.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'long' })
              : ''}
          </p>
          {horsLigne && (
            <p className="text-xs text-gray-400 mt-0.5">
              {t('donnees_hors_ligne')}{horsLigneDepuis ? ` (${new Date(horsLigneDepuis).toLocaleTimeString('fr-CA', { timeStyle: 'short' })})` : ''}
            </p>
          )}
        </div>

        {!readOnly && (
          <button
            onClick={() => setConfirmFermer(true)}
            disabled={actionLoading || horsLigne}
            className="h-10 text-sm font-bold px-4 rounded-md flex items-center gap-2 shadow-sm active:scale-[0.97] text-white disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
            style={{ background: NAVY }}
          >
            <i className="ti ti-lock" /> {t('fermer_rapport')}
          </button>
        )}
      </div>

      {readOnly && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-md border text-sm font-semibold"
          style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#475569' }}>
          <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: NAVY }}>
            <i className="ti ti-lock text-white text-sm" />
          </div>
          <div>
            <p className="font-bold" style={{ color: NAVY }}>{t('rapport_ferme_lecture_seule')}</p>
            <p className="text-xs font-normal text-gray-400 mt-0.5">{t('seul_superviseur_modifie')}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 sm:gap-2 mb-6 overflow-x-auto">
        {([
          { key: 'formulaire', label: t('gic_onglet_inspection'), shortLabel: t('gic_onglet_inspection') },
          { key: 'deficiences' as OngletPrincipal, label: `${t('onglet_deficiences')} (${nbDeficiences})`, shortLabel: `${t('onglet_deficiences')} (${nbDeficiences})` },
          { key: 'historique', label: `${t('historique')} (${rapport.historique?.length || 0})`, shortLabel: `${t('historique')} (${rapport.historique?.length || 0})` },
        ] as { key: OngletPrincipal; label: string; shortLabel: string }[]).map(o => (
          <button
            key={o.key}
            onClick={() => setOnglet(o.key)}
            className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-bold rounded-md border shadow-sm transition-all whitespace-nowrap flex-shrink-0 hover:border-[#0a0b0d] hover:shadow active:scale-[0.97]"
            style={{
              background: onglet === o.key ? NAVY : '#f8fafc',
              color: onglet === o.key ? '#fff' : NAVY,
              borderColor: onglet === o.key ? NAVY : '#94a3b8',
            }}
          >
            <span className="sm:hidden">{o.shortLabel}</span>
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        ))}
      </div>

      {onglet === 'formulaire' && (
        <div className="flex flex-col gap-5">
          <FichesGicleur rapportId={rapport.id} sousRapports={sousRapports} majSousRapports={majSousRapports}
            debitsValves={debitsValves} onDebitsValves={majDebitsValves}
            identification={identification} onIdentification={majIdentification} onEntete={majEntete}
            entete={{
              client: rapport.batiment?.client_nom || '', adresse: rapport.batiment?.adresse_complete || '',
              contact: rapport.batiment?.client_contact_nom || '',
              infosContact: [rapport.batiment?.client_contact_telephone, rapport.batiment?.client_contact_email].filter(Boolean).join(' · '),
              inspecteurs: (rapport.techniciens || []).map((x: any) => [x.first_name, x.last_name].filter(Boolean).join(' ') || x.username).join(', '),
              date: rapport.date_inspection ? dateLocale(rapport.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'long' }) : '',
              numeroJob: rapport.numero_job || '', frequence: rapport.frequence_inspection || '',
            }}
            readOnly={readOnly} onErreur={undefined} />
          {/* Photos rattachées au rapport seulement (hors fiche). */}
          <SectionPhotos photosUrl={`${API_URL}/api/rapports-gicleurs/${rapport.id}/photos/`} readOnly={readOnly}
            filtre={{ sous_rapport: 'aucune' }} titre={t('gic_autres_photos')} />
        </div>
      )}

      {onglet === 'deficiences' && (
        <OngletDeficiencesGicleur rapport={rapport} sousRapports={sousRapports} debitsValves={debitsValves} identification={identification} />
      )}

      {onglet === 'historique' && (
        <div className="bg-white rounded-md border border-gray-100 p-5">
          {(!rapport.historique || rapport.historique.length === 0) ? (
            <p className="text-gray-300 text-sm text-center py-10">{t('aucune_activite')}</p>
          ) : (
            <div className="flex flex-col">
              {rapport.historique.map((h: any, i: number) => (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: ORANGE }} />
                    {i < rapport.historique.length - 1 && (
                      <span className="w-px flex-1" style={{ background: '#eef1f5' }} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm" style={{ color: NAVY }}>
                      <span className="font-semibold">{h.utilisateur?.username || 'Système'}</span> — {h.description}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(h.date_heure).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmFermer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmFermer(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#fff2e8' }}>
              <i className="ti ti-lock text-xl" style={{ color: ORANGE }} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>{t('fermer_confirm_titre')}</h3>
            <p className="text-xs text-gray-400 mb-5">{t('fermer_confirm_texte')}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmFermer(false)}
                className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200" style={{ color: NAVY }}>
                {t('annuler')}
              </button>
              <button onClick={fermerRapport} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50" style={{ background: NAVY }}>
                {actionLoading ? t('fermeture_en_cours') : t('fermer_rapport')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
