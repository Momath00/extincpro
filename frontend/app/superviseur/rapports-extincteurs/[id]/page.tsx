'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import TableExtincteurs from '@/components/rapports-extincteurs/TableExtincteurs'
import TableBoyaux from '@/components/rapports-extincteurs/TableBoyaux'
import ModalModifierRapport from '@/components/rapports/ModalModifierRapport'
import ModuleBadge from '@/components/dashboard/ModuleBadge'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

async function downloadHtml(url: string): Promise<boolean> {
  try {
    const token = localStorage.getItem('access_token')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return false
    const html = await res.text()
    const blob = new Blob([html], { type: 'text/html' })
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, '_blank')
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    return true
  } catch {
    return false
  }
}

async function downloadFichier(url: string, nomFichier: string): Promise<boolean> {
  try {
    const token = localStorage.getItem('access_token')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return false
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = nomFichier
    a.click()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    return true
  } catch {
    return false
  }
}

function SpinnerBouton({ color = '#fff' }: { color?: string }) {
  return (
    <div
      className="w-3.5 h-3.5 rounded-full animate-spin flex-shrink-0"
      style={{ border: `2px solid ${color}`, borderTopColor: 'transparent' }}
    />
  )
}

// ── Certificat tab ───────────────────────────────────────────────────────────
function CertificatTab({
  rapport,
  onEnvoyer,
  actionLoading,
}: {
  rapport: any
  onEnvoyer: () => void
  actionLoading: boolean
}) {
  const t = useT()
  const cert = rapport.certificat
  const modeDirect = rapport.batiment?.client_mode_livraison === 'direct'
  const contactEmail = rapport.batiment?.client_contact_email
  const peutEnvoyer = modeDirect ? !!contactEmail : !!rapport.citoyen

  if (!cert) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <i className="ti ti-certificate text-5xl text-gray-200" />
        <p className="mt-4 text-sm font-semibold text-gray-400">{t('aucun_certificat_genere')}</p>
        <p className="text-xs text-gray-300 mt-1">{t('fermez_pour_generer')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-8 py-10 text-center" style={{ background: 'linear-gradient(135deg,#0a0b0d,#000000)' }}>
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-certificate text-white text-3xl" />
          </div>
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">{t('certificat_verification')}</p>
          <p className="text-white text-2xl font-bold tracking-wide">{cert.numero}</p>
          <p className="text-white/50 text-xs mt-2">{t('extincteurs_portatifs')}</p>
        </div>

        <div className="p-6">
          <div className="flex flex-col divide-y divide-gray-50 mb-6">
            {[
              [t('adresse'), rapport.batiment?.adresse_complete],
              [t('client'), rapport.batiment?.client_nom],
              [t('date_emission'), new Date(cert.date_emission).toLocaleDateString('fr-CA', { dateStyle: 'long' })],
              [t('emis_par'), cert.emis_par?.username || '—'],
              [t('date_fermeture'), rapport.date_fermeture
                ? new Date(rapport.date_fermeture).toLocaleDateString('fr-CA', { dateStyle: 'long' })
                : '—'],
              [t('techniciens_col'), (rapport.techniciens || []).map((t: any) => t.username).join(', ') || '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between items-center py-2.5 text-sm">
                <span className="text-gray-400 font-medium">{label}</span>
                <span className="font-semibold text-right max-w-[60%]" style={{ color: NAVY }}>{value || '—'}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-4 mb-5" style={{ background: cert.certificat_envoye ? '#f0fdf4' : '#fffbeb' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: cert.certificat_envoye ? '#bbf7d0' : '#fde68a' }}>
                <i className={`ti ${cert.certificat_envoye ? 'ti-check text-green-800' : 'ti-clock text-yellow-800'} text-sm`} />
              </div>
              <div>
                <p className="text-sm font-bold"
                  style={{ color: cert.certificat_envoye ? '#166534' : '#92400e' }}>
                  {cert.certificat_envoye
                    ? (modeDirect ? t('certificat_envoye_email_pdf') : t('certificat_envoye_citoyen'))
                    : t('pas_encore_envoye')}
                </p>
                {modeDirect && contactEmail && !cert.certificat_envoye && (
                  <p className="text-xs text-gray-500 mt-0.5">{t('destinataire')} : {contactEmail} <span className="text-gray-300">({t('envoi_direct_sans_compte')})</span></p>
                )}
                {modeDirect && !contactEmail && (
                  <p className="text-xs text-red-500 mt-0.5">{t('client_sans_email_contact')}</p>
                )}
                {!modeDirect && rapport.citoyen && !cert.certificat_envoye && (
                  <p className="text-xs text-gray-500 mt-0.5">{t('destinataire')} : {rapport.citoyen.username}</p>
                )}
                {!modeDirect && !rapport.citoyen && (
                  <p className="text-xs text-gray-400 mt-0.5">{t('aucun_citoyen_assigne')}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {peutEnvoyer && !cert.certificat_envoye && (
              <button
                onClick={onEnvoyer}
                disabled={actionLoading}
                className="flex-1 text-sm font-bold px-4 py-3 rounded-lg text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: ORANGE }}
              >
                <i className={`ti ${modeDirect ? 'ti-mail-forward' : 'ti-send'}`} />
                {actionLoading ? t('envoi_en_cours') : modeDirect ? t('envoyer_par_courriel_pdf') : t('envoyer_au_citoyen')}
              </button>
            )}
            <button
              onClick={() => downloadHtml(`${API_URL}/api/rapports-extincteurs/${rapport.id}/certificat-pdf/`)}
              className="flex-1 text-sm font-bold px-4 py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: '#eef2f7', color: NAVY }}
            >
              <i className="ti ti-download" /> {t('telecharger_pdf')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type OngletType = 'extincteurs' | 'certificat' | 'historique'

export default function SuperviseurRapportExtincteurDetailPage() {
  const router = useRouter()
  const params = useParams()
  const t = useT()
  const [rapport, setRapport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState<OngletType>('extincteurs')
  const [actionLoading, setActionLoading] = useState(false)
  const [telechargement, setTelechargement] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmFermer, setConfirmFermer] = useState(false)
  const [confirmRouvrir, setConfirmRouvrir] = useState(false)
  const [modalMode, setModalMode] = useState<'technicien' | 'citoyen' | null>(null)

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    fetch(`${API_URL}/api/rapports-extincteurs/${params.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        if (res.status === 404) { router.push('/superviseur/rapports-extincteurs'); return null }
        return res.json()
      })
      .then(data => { if (data) { setRapport(data); setLoading(false) } })
      .catch(() => setLoading(false))
  }

  useEffect(() => { charger() }, [params.id])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function fermerRapport() {
    setActionLoading(true)
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports-extincteurs/${rapport.id}/fermer/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setActionLoading(false)
    setConfirmFermer(false)
    if (res.ok) {
      showToast(t('rapport_ferme_cert_genere'), 'success')
      charger()
      setOnglet('certificat')
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error || t('erreur_fermeture'), 'error')
    }
  }

  async function rouvrirRapport() {
    setActionLoading(true)
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports-extincteurs/${rapport.id}/rouvrir/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setActionLoading(false)
    setConfirmRouvrir(false)
    if (res.ok) {
      showToast(t('rapport_ouvert_succes'), 'success')
      setOnglet('extincteurs')
      charger()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error || t('erreur_reouverture'), 'error')
    }
  }

  async function envoyerCertificat() {
    setActionLoading(true)
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports-extincteurs/${rapport.id}/envoyer-certificat/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setActionLoading(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      showToast(d.message || t('certificat_envoye_toast'), 'success')
      charger()
    } else {
      showToast(d.error || t('erreur_envoi'), 'error')
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

  const estFerme = rapport.statut === 'ferme'

  const onglets: { key: OngletType; label: string; shortLabel: string }[] = [
    { key: 'extincteurs', label: `${t('col_extincteurs')} (${rapport.extincteurs?.length || 0})`, shortLabel: `${t('col_extincteurs')} (${rapport.extincteurs?.length || 0})` },
    ...(estFerme ? [{ key: 'certificat' as OngletType, label: `🏆 ${t('certificat')}`, shortLabel: '🏆' }] : []),
    { key: 'historique', label: `${t('historique')} (${rapport.historique?.length || 0})`, shortLabel: `${t('historique')} (${rapport.historique?.length || 0})` },
  ]

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border px-5 py-3.5"
          style={{ borderColor: toast.type === 'success' ? '#bbf7d0' : '#fecaca' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2' }}>
            <i className={`ti ${toast.type === 'success' ? 'ti-check text-green-600' : 'ti-x text-red-500'} text-sm`} />
          </div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>{toast.msg}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 gap-3">
        <Link href="/superviseur/rapports-extincteurs"
          className="text-xs text-gray-400 hover:text-[#0a0b0d] flex items-center gap-1">
          <i className="ti ti-arrow-left" /> {t('retour_aux_rapports')}
        </Link>
        <ModuleBadge type="extincteur" />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: ORANGE }}>
            {rapport.batiment?.client_nom || '—'}
          </p>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: NAVY }}>
              {rapport.batiment?.adresse_complete}
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={estFerme
                ? { background: '#e9f6f2', color: '#0d6b4f' }
                : { background: '#fff2e8', color: '#9a4a13' }}>
              {estFerme ? t('ferme') : t('ouvert')}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {rapport.numero_job ? `${t('job')} ${rapport.numero_job}` : ''}
            {rapport.date_inspection
              ? ` ${rapport.numero_job ? '· ' : ''}${new Date(rapport.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'long' })}`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {!estFerme && (
            <button
              onClick={() => setConfirmFermer(true)}
              disabled={actionLoading}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: NAVY }}
            >
              <i className="ti ti-lock" /> {t('fermer_rapport')}
            </button>
          )}

          {estFerme && rapport.certificat && !rapport.certificat.certificat_envoye &&
            (rapport.batiment?.client_mode_livraison === 'direct' ? !!rapport.batiment?.client_contact_email : !!rapport.citoyen) && (
            <button
              onClick={envoyerCertificat}
              disabled={actionLoading}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: ORANGE }}
            >
              <i className={`ti ${rapport.batiment?.client_mode_livraison === 'direct' ? 'ti-mail-forward' : 'ti-send'}`} />
              {rapport.batiment?.client_mode_livraison === 'direct' ? t('envoyer_par_courriel_pdf') : t('envoyer_certificat_btn')}
            </button>
          )}

          {estFerme && (
            <button
              onClick={() => setConfirmRouvrir(true)}
              disabled={actionLoading}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: '#eef2f7', color: NAVY }}
            >
              <i className="ti ti-lock-open" /> {t('rouvrir_rapport')}
            </button>
          )}

          {estFerme && (
            <>
              <button
                onClick={async () => {
                  setTelechargement('rapport')
                  const ok = await downloadHtml(`${API_URL}/api/rapports-extincteurs/${rapport.id}/telecharger/`)
                  if (!ok) showToast(t('erreur_telechargement_rapport'), 'error')
                  setTelechargement(null)
                }}
                disabled={telechargement !== null}
                className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ background: '#eef2f7', color: NAVY }}
              >
                {telechargement === 'rapport' ? <SpinnerBouton color={NAVY} /> : <i className="ti ti-file-download" />} {t('telecharger_rapport')}
              </button>
              <button
                onClick={async () => {
                  setTelechargement('excel')
                  const ok = await downloadFichier(`${API_URL}/api/rapports-extincteurs/${rapport.id}/excel/`, `Extincteur - ${rapport.batiment?.adresse_complete || rapport.id}.xlsx`)
                  if (!ok) showToast(t('erreur_telechargement_excel'), 'error')
                  setTelechargement(null)
                }}
                disabled={telechargement !== null}
                className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ background: '#16a34a' }}
              >
                {telechargement === 'excel' ? <SpinnerBouton /> : <i className="ti ti-file-spreadsheet" />} {t('excel')}
              </button>
              {rapport.certificat && (
                <button
                  onClick={async () => {
                    setTelechargement('certificat')
                    const ok = await downloadHtml(`${API_URL}/api/rapports-extincteurs/${rapport.id}/certificat-pdf/`)
                    if (!ok) showToast(t('erreur_telechargement_certificat'), 'error')
                    setTelechargement(null)
                  }}
                  disabled={telechargement !== null}
                  className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ background: '#fef2f2', color: ORANGE }}
                >
                  {telechargement === 'certificat' ? <SpinnerBouton color={ORANGE} /> : <i className="ti ti-certificate" />} {t('certificat')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {rapport.rapport_eclairage_lie && (
        <Link
          href={`/superviseur/rapports-eclairage-urgence/${rapport.rapport_eclairage_lie.id}`}
          className="mb-4 flex items-center gap-3 px-4 py-3 rounded-md border text-sm hover:shadow-sm transition-shadow"
          style={{ background: '#fff2e8', borderColor: '#fde3cc' }}
        >
          <i className="ti ti-bulb flex-shrink-0" style={{ color: ORANGE }} />
          <span className="flex-1" style={{ color: NAVY }}>
            {t('rapport_eclairage_lie_texte')}{' '}
            <strong>{rapport.rapport_eclairage_lie.statut === 'ferme' ? t('ferme') : t('ouvert')}</strong>
          </span>
          <i className="ti ti-chevron-right flex-shrink-0" style={{ color: ORANGE }} />
        </Link>
      )}

      {estFerme && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-md border text-sm"
          style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <i className="ti ti-edit text-yellow-600 flex-shrink-0" />
          <span style={{ color: '#92400e' }}>
            {t('rapport_ferme_superviseur_note')}
          </span>
        </div>
      )}

      {modalMode && (
        <ModalModifierRapport
          rapport={rapport}
          mode={modalMode}
          apiBase="/api/rapports-extincteurs/"
          onClose={() => setModalMode(null)}
          onSaved={() => { charger(); showToast(t('modification_succes'), 'success') }}
        />
      )}

      <div className="bg-white rounded-md border border-gray-100 p-4 mb-6 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('techniciens_col')}</span>
        {rapport.techniciens?.length
          ? rapport.techniciens.map((t: any) => (
            <div key={t.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full pl-1 pr-3 py-1">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: NAVY }}>
                {t.username?.[0]?.toUpperCase()}
              </span>
              <span className="text-xs font-medium" style={{ color: NAVY }}>{t.username}</span>
            </div>
          ))
          : <span className="text-xs text-gray-300 italic">{t('aucun_technicien_assigne')}</span>}
        <button
          onClick={() => setModalMode('technicien')}
          className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 hover:border-[#e11324] transition-colors flex items-center gap-1"
          style={{ color: NAVY }}
        >
          <i className="ti ti-edit text-[11px]" /> {t('reassigner')}
        </button>

        <span className="w-px h-4 bg-gray-200 flex-shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('citoyen_col')}</span>
        <span className="text-xs font-medium" style={{ color: rapport.citoyen ? NAVY : '#9ca3af' }}>
          {rapport.citoyen?.username || t('aucun')}
        </span>
        {rapport.certificat?.certificat_envoye && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-50 text-green-700 flex items-center gap-1">
            <i className="ti ti-check text-[10px]" /> {t('certificat_envoye_citoyen')}
          </span>
        )}
        <button
          onClick={() => setModalMode('citoyen')}
          className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 hover:border-[#e11324] transition-colors flex items-center gap-1"
          style={{ color: NAVY }}
        >
          <i className="ti ti-edit text-[11px]" /> {t('reassigner')}
        </button>
      </div>

      <div className="flex gap-0.5 sm:gap-1 mb-6 border-b border-gray-100 overflow-x-auto">
        {onglets.map(o => (
          <button
            key={o.key}
            onClick={() => setOnglet(o.key)}
            className="px-2.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0"
            style={{
              borderColor: onglet === o.key ? ORANGE : 'transparent',
              color: onglet === o.key ? NAVY : '#9ca3af',
            }}
          >
            <span className="sm:hidden">{o.shortLabel}</span>
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        ))}
      </div>

      {onglet === 'extincteurs' && (
        <div className="flex flex-col gap-8">
          <TableExtincteurs rapport={rapport} readOnly={false} onRefresh={charger} />
          <TableBoyaux rapport={rapport} readOnly={false} onRefresh={charger} />
        </div>
      )}

      {onglet === 'certificat' && estFerme && (
        <CertificatTab rapport={rapport} onEnvoyer={envoyerCertificat} actionLoading={actionLoading} />
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
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#fff2e8' }}>
              <i className="ti ti-lock text-xl" style={{ color: ORANGE }} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>{t('fermer_confirm_titre')}</h3>
            <p className="text-xs text-gray-400 mb-1">
              {t('fermer_confirm_texte2')}
            </p>
            <p className="text-xs text-gray-400 mb-5">
              {t('superviseur_peut_modifier_apres')}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmFermer(false)}
                className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200"
                style={{ color: NAVY }}>
                {t('annuler')}
              </button>
              <button onClick={fermerRapport} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50"
                style={{ background: NAVY }}>
                {actionLoading ? t('fermeture_en_cours') : t('fermer_rapport')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRouvrir && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmRouvrir(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#fff2e8' }}>
              <i className="ti ti-lock-open text-xl" style={{ color: ORANGE }} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>{t('rouvrir_confirm_titre')}</h3>
            <p className="text-xs text-gray-400 mb-5">
              {t('rouvrir_confirm_texte')}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRouvrir(false)}
                className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200"
                style={{ color: NAVY }}>
                {t('annuler')}
              </button>
              <button onClick={rouvrirRapport} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50"
                style={{ background: NAVY }}>
                {actionLoading ? t('reouverture_en_cours') : t('rouvrir_rapport')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
