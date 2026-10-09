'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { downloadHtml } from '@/lib/download'
import { useLangue, useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

type Statut = 'conforme' | 'non_conforme' | 'so'

type Ligne = {
  systeme: string
  label: string
  present: boolean
  statut_calcule: Statut
  statut: Statut
  ajuste: boolean
  raison: string
  ajuste_par: string
  echeance: string | null
  deficiences: string[]
}

type Certificat = {
  id: number
  numero: string
  numero_affiche: string
  revision: number
  statut: 'brouillon' | 'emis'
  type_document: 'certificat' | 'avis'
  type_document_prevu: 'certificat' | 'avis'
  conforme: boolean
  lignes: Ligne[]
  a_changements: boolean
  ancre_fermee: boolean
  peut_emettre: boolean
  peut_ajuster: boolean
  mode_emission: 'auto' | 'manuel'
  date_emission: string
  emis_par: string
  url_verification: string | null
  revisions: { revision: number; numero_affiche: string; type_document: string; conforme: boolean; date_emission: string; emis_par: string; remplacee_le: string | null }[]
}

type Reponse = {
  certificat: Certificat | null
  couvert_par_extincteur?: boolean
  rapport_extincteur_id?: number | null
  rapport_ferme?: boolean
  attend_rapport_extincteur?: boolean
}

const STYLE_STATUT: Record<Statut, { couleur: string; fond: string; bord: string }> = {
  conforme: { couleur: '#16a34a', fond: '#dcfce7', bord: '#bbf7d0' },
  non_conforme: { couleur: ORANGE, fond: '#fee2e2', bord: '#fecaca' },
  so: { couleur: '#6b7280', fond: '#f3f4f6', bord: '#e5e7eb' },
}

function BadgeStatut({ statut }: { statut: Statut }) {
  const t = useT()
  const s = STYLE_STATUT[statut]
  const libelle = statut === 'conforme' ? t('cp_conforme') : statut === 'non_conforme' ? t('cp_non_conforme') : t('cp_so')
  return (
    <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{ color: s.couleur, background: s.fond, borderColor: s.bord }}>
      {libelle}
    </span>
  )
}

/**
 * Panneau « Certificat » d'une page de rapport (extincteurs, cuisine,
 * éclairage) : lignes du certificat avec leur statut calculé, ajustement
 * manuel (raison obligatoire), émission / réémission, aperçu, historique
 * des révisions et lien de vérification publique. Toute la logique est
 * côté serveur (inspections/certificats.py).
 */
export default function PanneauCertificat({
  type,
  rapportId,
  cle,
}: {
  type: 'extincteurs' | 'cuisine' | 'eclairage'
  rapportId: number
  /** Change quand le rapport change (fermé, rouvert…) pour recharger. */
  cle?: unknown
}) {
  const t = useT()
  const langue = useLangue()
  const [donnees, setDonnees] = useState<Reponse | null>(null)
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [edition, setEdition] = useState<{ systeme: string; statut: Statut | ''; raison: string } | null>(null)
  const [copie, setCopie] = useState(false)

  const dateFmt = (iso: string | null) =>
    iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(langue === 'en' ? 'en-CA' : 'fr-CA', { dateStyle: 'medium' }) : '—'

  async function charger() {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/certificats-visite/pour-rapport/?type=${type}&id=${rapportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setDonnees(await res.json())
  }

  useEffect(() => { charger() }, [type, rapportId, cle])

  async function poster(chemin: string, corps: Record<string, unknown> = {}) {
    const cert = donnees?.certificat
    if (!cert) return null
    setEnCours(true)
    setErreur('')
    setMessage('')
    const token = localStorage.getItem('access_token')
    try {
      const res = await fetch(`${API_URL}/api/certificats-visite/${cert.id}/${chemin}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corps),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErreur(d.error || t('cp_erreur'))
        return null
      }
      setDonnees(prev => (prev ? { ...prev, certificat: d } : prev))
      return d
    } finally {
      setEnCours(false)
    }
  }

  async function enregistrerAjustement() {
    if (!edition) return
    if (edition.statut && edition.raison.trim().length < 3) {
      setErreur(t('cp_raison_obligatoire'))
      return
    }
    const d = await poster('ajuster', { systeme: edition.systeme, statut: edition.statut || null, raison: edition.raison })
    if (d) setEdition(null)
  }

  async function emettre() {
    const d = await poster('emettre')
    if (d) setMessage(d.nouvelle_revision ? t('cp_revision_emise') : t('cp_aucun_changement'))
  }

  if (!donnees) return null

  const cert = donnees.certificat
  if (!cert) {
    return (
      <div className="bg-white rounded-md border border-gray-100 p-5 flex items-center gap-3">
        <i className="ti ti-certificate text-2xl text-gray-300" />
        <p className="text-sm text-gray-500">
          {donnees.attend_rapport_extincteur ? t('cp_attente_extincteur') : t('cp_attente_fermeture')}
        </p>
        {donnees.attend_rapport_extincteur && donnees.rapport_extincteur_id && (
          <Link href={`/superviseur/rapports-extincteurs/${donnees.rapport_extincteur_id}`}
            className="ml-auto text-xs font-bold whitespace-nowrap hover:underline" style={{ color: ORANGE }}>
            {t('cp_voir_rapport_extincteur')} →
          </Link>
        )}
      </div>
    )
  }

  const estAvis = (cert.statut === 'emis' ? cert.type_document : cert.type_document_prevu) === 'avis'
  const aReemettre = cert.statut === 'brouillon' && cert.revisions.length > 0
  const libelleStatut = cert.statut === 'emis' ? t('cp_emis') : aReemettre ? t('cp_a_reemettre') : t('cp_brouillon')
  const couleurStatut = cert.statut === 'emis' ? '#16a34a' : '#b45309'
  const libelleEmettre = cert.revisions.length > 0 ? t('cp_emettre_revision') : cert.type_document_prevu === 'avis' ? t('cp_emettre_avis') : t('cp_emettre')

  return (
    <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
      {/* En-tête */}
      <div className="px-5 py-4 flex flex-wrap items-center gap-3" style={{ background: NAVY }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: estAvis ? ORANGE : 'rgba(255,255,255,0.1)' }}>
          <i className={`ti ${estAvis ? 'ti-alert-triangle' : 'ti-certificate'} text-white text-xl`} />
        </div>
        <div className="min-w-0">
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{estAvis ? t('cp_avis') : t('cp_certificat')}</p>
          <p className="text-white text-lg font-bold tracking-wide truncate">{cert.statut === 'emis' ? cert.numero_affiche : cert.numero}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white" style={{ color: couleurStatut }}>
            {libelleStatut}
          </span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={cert.conforme ? { background: '#dcfce7', color: '#16a34a' } : { background: '#fee2e2', color: ORANGE }}>
            {cert.conforme ? t('cp_conforme') : t('cp_non_conforme')}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {donnees.couvert_par_extincteur && donnees.rapport_extincteur_id && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md border" style={{ background: '#f8fafc', borderColor: '#e5e7eb' }}>
            <i className="ti ti-link text-gray-400" />
            <span className="text-gray-600 flex-1">{t('cp_couvert_extincteur')}</span>
            <Link href={`/superviseur/rapports-extincteurs/${donnees.rapport_extincteur_id}`} className="font-bold hover:underline" style={{ color: ORANGE }}>
              {t('cp_voir_rapport_extincteur')} →
            </Link>
          </div>
        )}

        {/* Notes d'état */}
        {cert.statut === 'brouillon' && (
          <div className="text-xs px-3 py-2 rounded-md border flex items-start gap-2" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
            <i className="ti ti-info-circle mt-0.5" />
            <span>
              {!cert.ancre_fermee ? t('cp_note_rouvert') : cert.a_changements ? t('cp_note_changements') : t('cp_note_manuel')}
              {cert.ancre_fermee && cert.type_document_prevu === 'avis' && <> {t('cp_note_avis')}</>}
            </span>
          </div>
        )}

        {/* Lignes */}
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-gray-400 text-left">
                <th className="font-bold px-1 pb-2">{t('cp_col_systeme')}</th>
                <th className="font-bold px-1 pb-2">{t('cp_col_calcule')}</th>
                <th className="font-bold px-1 pb-2">{t('cp_col_final')}</th>
                <th className="font-bold px-1 pb-2">{t('cp_col_echeance')}</th>
                <th className="px-1 pb-2" />
              </tr>
            </thead>
            <tbody>
              {cert.lignes.map(l => (
                <tr key={l.systeme} className="border-t border-gray-50 align-top">
                  <td className="px-1 py-2.5">
                    <p className="font-semibold" style={{ color: NAVY }}>{l.label}</p>
                    {l.ajuste && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        <i className="ti ti-hand-finger" /> {t('cp_ajuste_par')} {l.ajuste_par} — {l.raison}
                      </p>
                    )}
                    {!l.ajuste && l.raison && <p className="text-[11px] text-gray-400 mt-0.5">{l.raison}</p>}
                    {l.deficiences.length > 0 && (
                      <ul className="text-[11px] mt-1 list-disc pl-4" style={{ color: ORANGE }}>
                        {l.deficiences.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                  </td>
                  <td className="px-1 py-2.5"><BadgeStatut statut={l.statut_calcule} /></td>
                  <td className="px-1 py-2.5"><BadgeStatut statut={l.statut} /></td>
                  <td className="px-1 py-2.5 text-xs text-gray-600 whitespace-nowrap">{dateFmt(l.echeance)}</td>
                  <td className="px-1 py-2.5 text-right">
                    {cert.peut_ajuster && (
                      <button
                        type="button"
                        onClick={() => setEdition({ systeme: l.systeme, statut: l.ajuste ? l.statut : '', raison: l.ajuste ? l.raison : '' })}
                        className="text-xs font-bold px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 whitespace-nowrap"
                        style={{ color: NAVY }}
                      >
                        <i className="ti ti-adjustments-horizontal" /> {t('cp_ajuster')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Formulaire d'ajustement */}
        {edition && (
          <div className="rounded-md border p-4 flex flex-col gap-3" style={{ borderColor: '#e5e7eb', background: '#f8fafc' }}>
            <p className="text-xs font-bold" style={{ color: NAVY }}>
              {t('cp_ajuster')} — {cert.lignes.find(l => l.systeme === edition.systeme)?.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {([['', t('cp_auto')], ['conforme', t('cp_conforme')], ['non_conforme', t('cp_non_conforme')], ['so', t('cp_so')]] as [Statut | '', string][]).map(([valeur, libelle]) => (
                <button
                  key={valeur || 'auto'}
                  type="button"
                  onClick={() => setEdition({ ...edition, statut: valeur })}
                  className="text-xs font-bold px-3 py-1.5 rounded-md border"
                  style={edition.statut === valeur
                    ? { background: NAVY, color: '#fff', borderColor: NAVY }
                    : { background: '#fff', color: NAVY, borderColor: '#e5e7eb' }}
                >
                  {libelle}
                </button>
              ))}
            </div>
            {edition.statut && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">{t('cp_raison')}</label>
                <input
                  value={edition.raison}
                  onChange={e => setEdition({ ...edition, raison: e.target.value })}
                  placeholder={t('cp_raison_placeholder')}
                  maxLength={300}
                  className="w-full border-2 border-[#0a0b0d] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#e11324] bg-white"
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setEdition(null); setErreur('') }} className="text-xs font-semibold px-3 py-2 rounded-md border border-gray-200 bg-white" style={{ color: NAVY }}>
                {t('annuler')}
              </button>
              <button type="button" disabled={enCours} onClick={enregistrerAjustement} className="text-xs font-bold px-3 py-2 rounded-md text-white disabled:opacity-50" style={{ background: ORANGE }}>
                {t('enregistrer')}
              </button>
            </div>
          </div>
        )}

        {erreur && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-md border border-red-100">{erreur}</div>}
        {message && <div className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-md border border-green-100"><i className="ti ti-check" /> {message}</div>}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {cert.peut_emettre && (
            <button type="button" disabled={enCours} onClick={emettre}
              className="text-sm font-bold px-4 py-2.5 rounded-md text-white flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
              style={{ background: ORANGE }}>
              <i className="ti ti-stamp" /> {libelleEmettre}
            </button>
          )}
          {cert.statut === 'emis' && (
            <button type="button" onClick={() => downloadHtml(`${API_URL}/api/certificats-visite/${cert.id}/pdf/`)}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 hover:opacity-90"
              style={{ background: '#e0e7ff', color: '#3730a3' }}>
              <i className="ti ti-download" /> {t('cp_telecharger')}
            </button>
          )}
          <button type="button" onClick={() => downloadHtml(`${API_URL}/api/certificats-visite/${cert.id}/pdf/?apercu=1`)}
            className="text-sm font-semibold px-4 py-2.5 rounded-md border border-gray-200 flex items-center gap-2 hover:bg-gray-50"
            style={{ color: NAVY }}>
            <i className="ti ti-eye" /> {t('cp_apercu')}
          </button>
        </div>

        {/* Lien de vérification */}
        {cert.url_verification && (
          <div className="flex items-center gap-2 text-xs">
            <i className="ti ti-qrcode text-gray-400" />
            <span className="text-gray-500">{t('cp_lien_verification')} :</span>
            <a href={cert.url_verification} target="_blank" rel="noreferrer" className="truncate hover:underline" style={{ color: NAVY }}>{cert.url_verification}</a>
            <button type="button"
              onClick={() => { navigator.clipboard?.writeText(cert.url_verification!); setCopie(true); setTimeout(() => setCopie(false), 1500) }}
              className="font-bold flex-shrink-0" style={{ color: ORANGE }}>
              {copie ? t('cp_copie') : t('cp_copier')}
            </button>
          </div>
        )}

        {/* Historique des révisions */}
        {cert.revisions.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{t('cp_historique')}</p>
            <div className="flex flex-col">
              {cert.revisions.map(r => (
                <div key={r.revision} className="flex items-center gap-2 py-1.5 border-t border-gray-50 text-xs">
                  <button type="button"
                    onClick={() => downloadHtml(`${API_URL}/api/certificats-visite/${cert.id}/revision-pdf/?revision=${r.revision}`)}
                    className="font-bold hover:underline" style={{ color: NAVY }}>
                    {r.numero_affiche}
                  </button>
                  <span className="text-gray-400">
                    {r.type_document === 'avis' ? t('cp_avis') : t('cp_certificat')} · {t('cp_emis_le')} {dateFmt(r.date_emission)}{r.emis_par ? ` ${t('cp_par')} ${r.emis_par}` : ''}
                  </span>
                  <span className="ml-auto text-[10px] font-bold uppercase" style={{ color: r.remplacee_le ? '#9ca3af' : '#16a34a' }}>
                    {r.remplacee_le ? t('cp_remplacee') : t('cp_en_vigueur')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
