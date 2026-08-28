'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import OngletE1 from '@/components/rapports/OngletE1'
import OngletE2 from '@/components/rapports/OngletE2'
import OngletLegende from '@/components/rapports/OngletLegende'
import OngletE3 from '@/components/rapports/OngletE3'
import ModalModifierRapport from '@/components/rapports/ModalModifierRapport'

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
  const cert = rapport.certificat

  if (!cert) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <i className="ti ti-certificate text-5xl text-gray-200" />
        <p className="mt-4 text-sm font-semibold text-gray-400">Aucun certificat généré pour ce rapport.</p>
        <p className="text-xs text-gray-300 mt-1">Fermez le rapport pour générer le certificat.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Header certificat */}
        <div className="px-8 py-10 text-center" style={{ background: 'linear-gradient(135deg,#123a63,#0a1c2e)' }}>
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-certificate text-white text-3xl" />
          </div>
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Certificat d'inspection</p>
          <p className="text-white text-2xl font-bold tracking-wide">{cert.numero}</p>
          <p className="text-white/50 text-xs mt-2">CAN/ULC-S536</p>
          <span
            className="inline-block mt-3 text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full"
            style={{
              background: cert.conforme ? '#e9f6f2' : '#fef2f2',
              color: cert.conforme ? '#0d6b4f' : '#e11324',
            }}
          >
            {cert.conforme ? 'Conforme' : 'Non conforme'}
          </span>
        </div>

        {/* Infos */}
        <div className="p-6">
          {!cert.conforme && (
            <div className="flex items-start gap-2.5 rounded-lg p-3.5 mb-5" style={{ background: '#fffbeb' }}>
              <i className="ti ti-alert-triangle text-base flex-shrink-0 mt-0.5" style={{ color: '#b45309' }} />
              <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                Des réparations sont requises avant que ce certificat soit conforme. Il redeviendra
                conforme automatiquement dès que les dispositifs défectueux seront corrigés.
              </p>
            </div>
          )}
          <div className="flex flex-col divide-y divide-gray-50 mb-6">
            {[
              ['Adresse', rapport.batiment?.adresse_complete],
              ['Client', rapport.batiment?.client_nom],
              ['Date d\'émission', new Date(cert.date_emission).toLocaleDateString('fr-CA', { dateStyle: 'long' })],
              ['Émis par', cert.emis_par?.username || '—'],
              ['Date de fermeture', rapport.date_fermeture
                ? new Date(rapport.date_fermeture).toLocaleDateString('fr-CA', { dateStyle: 'long' })
                : '—'],
              ['Techniciens', (rapport.techniciens || []).map((t: any) => t.username).join(', ') || '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between items-center py-2.5 text-sm">
                <span className="text-gray-400 font-medium">{label}</span>
                <span className="font-semibold text-right max-w-[60%]" style={{ color: NAVY }}>{value || '—'}</span>
              </div>
            ))}
          </div>

          {/* Statut d'envoi */}
          <div className="rounded-lg p-4 mb-5" style={{ background: cert.certificat_envoye ? '#f0fdf4' : '#fffbeb' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: cert.certificat_envoye ? '#bbf7d0' : '#fde68a' }}>
                <i className={`ti ${cert.certificat_envoye ? 'ti-check text-green-800' : 'ti-clock text-yellow-800'} text-sm`} />
              </div>
              <div>
                <p className="text-sm font-bold"
                  style={{ color: cert.certificat_envoye ? '#166534' : '#92400e' }}>
                  {cert.certificat_envoye ? 'Certificat envoyé au citoyen' : 'Pas encore envoyé'}
                </p>
                {rapport.citoyen && !cert.certificat_envoye && (
                  <p className="text-xs text-gray-500 mt-0.5">Destinataire : {rapport.citoyen.username}</p>
                )}
                {!rapport.citoyen && (
                  <p className="text-xs text-gray-400 mt-0.5">Aucun citoyen assigné au rapport</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {rapport.citoyen && !cert.certificat_envoye && (
              <button
                onClick={onEnvoyer}
                disabled={actionLoading}
                className="flex-1 text-sm font-bold px-4 py-3 rounded-lg text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: ORANGE }}
              >
                <i className="ti ti-send" />
                {actionLoading ? 'Envoi...' : 'Envoyer au citoyen'}
              </button>
            )}
            <button
              onClick={() => downloadHtml(`${API_URL}/api/rapports/${rapport.id}/certificat-pdf/`)}
              className="flex-1 text-sm font-bold px-4 py-3 rounded-lg border-2 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              <i className="ti ti-download" /> Télécharger PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Indicateur de progression ────────────────────────────────────────────────
function ProgressionRapport({ rapport }: { rapport: any }) {
  const e1 = rapport.fiche_e1
  const e2 = rapport.fiche_e2
  const totalDisp = (rapport.sections || []).reduce((s: number, sec: any) => s + (sec.dispositifs?.length || 0), 0)
  const estFerme = rapport.statut === 'ferme'
  const aCartificat = !!rapport.certificat

  const etapes = [
    {
      label: 'E1',
      done: e1 && (e1.fonctionnement_une_etape !== null || e1.reseau_fonctionnel !== null),
      color: '#9a4a13',
    },
    {
      label: 'E2',
      done: e2 && Object.keys(e2.details || {}).length > 0,
      color: '#0d6b4f',
    },
    {
      label: 'E3',
      done: totalDisp > 0,
      color: '#4b2f8c',
    },
    {
      label: 'Fermé',
      done: estFerme,
      color: NAVY,
    },
    {
      label: 'Certificat',
      done: aCartificat,
      color: ORANGE,
    },
  ]

  return (
    <div className="flex items-center gap-1">
      {etapes.map((e, i) => (
        <div key={e.label} className="flex items-center gap-1">
          <div
            title={e.label}
            className="w-2.5 h-2.5 rounded-full transition-colors duration-300"
            style={{ background: e.done ? e.color : '#e2e8f0' }}
          />
          {i < etapes.length - 1 && (
            <div className="w-3 h-px" style={{ background: '#e2e8f0' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
type OngletType = 'e1' | 'e2' | 'legende' | 'e3' | 'certificat' | 'historique'

export default function SuperviseurRapportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [rapport, setRapport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState<OngletType>('e1')
  const [actionLoading, setActionLoading] = useState(false)
  const [telechargement, setTelechargement] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmFermer, setConfirmFermer] = useState(false)
  const [confirmRouvrir, setConfirmRouvrir] = useState(false)
  const [modalMode, setModalMode] = useState<'technicien' | 'citoyen' | null>(null)

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    fetch(`${API_URL}/api/rapports/${params.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        if (res.status === 404) { router.push('/superviseur/rapports'); return null }
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
    const res = await fetch(`${API_URL}/api/rapports/${rapport.id}/fermer/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setActionLoading(false)
    setConfirmFermer(false)
    if (res.ok) {
      showToast('Rapport fermé. Certificat généré automatiquement.', 'success')
      charger()
      setOnglet('certificat')
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error || 'Erreur lors de la fermeture.', 'error')
    }
  }

  async function rouvrirRapport() {
    setActionLoading(true)
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports/${rapport.id}/rouvrir/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setActionLoading(false)
    setConfirmRouvrir(false)
    if (res.ok) {
      showToast('Le rapport est ouvert avec succès.', 'success')
      setOnglet('e1')
      charger()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error || 'Erreur lors de la réouverture.', 'error')
    }
  }

  async function envoyerCertificat() {
    setActionLoading(true)
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports/${rapport.id}/envoyer-certificat/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setActionLoading(false)
    if (res.ok) {
      showToast('Certificat envoyé au citoyen.', 'success')
      charger()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error || 'Erreur lors de l\'envoi.', 'error')
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
  const totalDispositifs = (rapport.sections || []).reduce(
    (sum: number, s: any) => sum + (s.dispositifs?.length || 0), 0
  )

  const onglets: { key: OngletType; label: string; shortLabel: string }[] = [
    { key: 'e1', label: 'E1 — Rapport annuel', shortLabel: 'E1' },
    { key: 'e2', label: 'E2 — Poste de contrôle', shortLabel: 'E2' },
    { key: 'legende', label: 'Légende', shortLabel: 'Légende' },
    { key: 'e3', label: `E3 — Dispositifs (${totalDispositifs})`, shortLabel: `E3 (${totalDispositifs})` },
    ...(estFerme ? [{ key: 'certificat' as OngletType, label: '🏆 Certificat', shortLabel: '🏆' }] : []),
    { key: 'historique', label: `Historique (${rapport.historique?.length || 0})`, shortLabel: `Hist. (${rapport.historique?.length || 0})` },
  ]

  return (
    <div>
      {/* Toast */}
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

      <Link href="/superviseur/rapports"
        className="text-xs text-gray-400 hover:text-[#0a0b0d] flex items-center gap-1 mb-4">
        <i className="ti ti-arrow-left" /> Retour aux rapports
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: NAVY }}>
              {rapport.batiment?.adresse_complete}
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={estFerme
                ? { background: '#e9f6f2', color: '#0d6b4f' }
                : { background: '#fff2e8', color: '#9a4a13' }}>
              {estFerme ? 'Fermé' : 'Ouvert'}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-gray-400 text-sm">
              {rapport.batiment?.client_nom}
              {rapport.batiment?.fabricant_reseau ? ` · ${rapport.batiment.fabricant_reseau}` : ''}
              {rapport.batiment?.modele_systeme ? ` · ${rapport.batiment.modele_systeme}` : ''}
              {rapport.date_inspection
                ? ` · ${new Date(rapport.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'long' })}`
                : ''}
            </p>
            <ProgressionRapport rapport={rapport} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {!estFerme && (
            <button
              onClick={() => setConfirmFermer(true)}
              disabled={actionLoading}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: NAVY }}
            >
              <i className="ti ti-lock" /> Fermer le rapport
            </button>
          )}

          {estFerme && rapport.citoyen && rapport.certificat && !rapport.certificat.certificat_envoye && (
            <button
              onClick={envoyerCertificat}
              disabled={actionLoading}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: ORANGE }}
            >
              <i className="ti ti-send" /> Envoyer le certificat
            </button>
          )}

          {estFerme && (
            <button
              onClick={() => setConfirmRouvrir(true)}
              disabled={actionLoading}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 border-2 disabled:opacity-50 hover:bg-gray-50 transition-colors"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              <i className="ti ti-lock-open" /> Rouvrir le rapport
            </button>
          )}

          {estFerme && (
            <>
              <button
                onClick={async () => {
                  setTelechargement('rapport')
                  const ok = await downloadHtml(`${API_URL}/api/rapports/${rapport.id}/telecharger/`)
                  if (!ok) showToast('Erreur lors du téléchargement du rapport.', 'error')
                  setTelechargement(null)
                }}
                disabled={telechargement !== null}
                className="text-sm font-bold px-4 py-2.5 rounded-md border-2 flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                {telechargement === 'rapport' ? <SpinnerBouton color={NAVY} /> : <i className="ti ti-file-download" />} Rapport
              </button>
              <button
                onClick={async () => {
                  setTelechargement('excel')
                  const ok = await downloadFichier(`${API_URL}/api/rapports/${rapport.id}/excel/`, `Incendie - ${rapport.batiment?.adresse_complete || rapport.id}.xlsx`)
                  if (!ok) showToast("Erreur lors du téléchargement de l'Excel.", 'error')
                  setTelechargement(null)
                }}
                disabled={telechargement !== null}
                className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ background: '#16a34a' }}
              >
                {telechargement === 'excel' ? <SpinnerBouton /> : <i className="ti ti-file-spreadsheet" />} Excel
              </button>
              {rapport.certificat && (
                <button
                  onClick={async () => {
                    setTelechargement('certificat')
                    const ok = await downloadHtml(`${API_URL}/api/rapports/${rapport.id}/certificat-pdf/`)
                    if (!ok) showToast('Erreur lors du téléchargement du certificat.', 'error')
                    setTelechargement(null)
                  }}
                  disabled={telechargement !== null}
                  className="text-sm font-bold px-4 py-2.5 rounded-md border-2 flex items-center gap-2 hover:bg-orange-50 transition-colors disabled:opacity-50"
                  style={{ borderColor: ORANGE, color: ORANGE }}
                >
                  {telechargement === 'certificat' ? <SpinnerBouton color={ORANGE} /> : <i className="ti ti-certificate" />} Certificat
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notice superviseur sur rapport fermé */}
      {estFerme && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-md border text-sm"
          style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <i className="ti ti-edit text-yellow-600 flex-shrink-0" />
          <span style={{ color: '#92400e' }}>
            Rapport fermé · En tant que superviseur vous pouvez quand même modifier toutes les données.
          </span>
        </div>
      )}

      {/* Techniciens + citoyen */}
      {modalMode && (
        <ModalModifierRapport
          rapport={rapport}
          mode={modalMode}
          apiBase="/api/rapports/"
          onClose={() => setModalMode(null)}
          onSaved={() => { charger(); showToast('Modification faite avec succès', 'success') }}
        />
      )}

      <div className="bg-white rounded-md border border-gray-100 p-4 mb-6 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Techniciens</span>
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
          : <span className="text-xs text-gray-300 italic">Aucun technicien assigné</span>}
        <button
          onClick={() => setModalMode('technicien')}
          className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 hover:border-[#e11324] transition-colors flex items-center gap-1"
          style={{ color: NAVY }}
        >
          <i className="ti ti-edit text-[11px]" /> Réassigner
        </button>

        <span className="w-px h-4 bg-gray-200 flex-shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Citoyen</span>
        <span className="text-xs font-medium" style={{ color: rapport.citoyen ? NAVY : '#9ca3af' }}>
          {rapport.citoyen?.username || 'Aucun'}
        </span>
        {rapport.certificat?.certificat_envoye && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-50 text-green-700 flex items-center gap-1">
            <i className="ti ti-check text-[10px]" /> Certificat envoyé
          </span>
        )}
        <button
          onClick={() => setModalMode('citoyen')}
          className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 hover:border-[#e11324] transition-colors flex items-center gap-1"
          style={{ color: NAVY }}
        >
          <i className="ti ti-edit text-[11px]" /> Réassigner
        </button>
      </div>

      {/* Onglets */}
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

      {/* Contenu onglets — superviseur peut toujours éditer (readOnly=false) */}
      {onglet === 'e1' && <OngletE1 rapport={rapport} readOnly={false} onSaved={charger} />}
      {onglet === 'e2' && <OngletE2 rapport={rapport} readOnly={false} onSaved={charger} />}
      {onglet === 'legende' && <OngletLegende rapport={rapport} readOnly={false} onSaved={charger} />}
      {onglet === 'e3' && <OngletE3 rapport={rapport} readOnly={false} onRefresh={charger} />}

      {onglet === 'certificat' && estFerme && (
        <CertificatTab rapport={rapport} onEnvoyer={envoyerCertificat} actionLoading={actionLoading} />
      )}

      {onglet === 'historique' && (
        <div className="bg-white rounded-md border border-gray-100 p-5">
          {(!rapport.historique || rapport.historique.length === 0) ? (
            <p className="text-gray-300 text-sm text-center py-10">Aucune activité enregistrée</p>
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

      {/* Modal confirmation fermeture */}
      {confirmFermer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmFermer(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#fff2e8' }}>
              <i className="ti ti-lock text-xl" style={{ color: ORANGE }} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>Fermer ce rapport ?</h3>
            <p className="text-xs text-gray-400 mb-1">
              Le rapport sera verrouillé et le certificat généré automatiquement.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              En tant que superviseur, vous pourrez toujours modifier les données après la fermeture.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmFermer(false)}
                className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200"
                style={{ color: NAVY }}>
                Annuler
              </button>
              <button onClick={fermerRapport} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50"
                style={{ background: NAVY }}>
                {actionLoading ? 'Fermeture...' : 'Fermer le rapport'}
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
            <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>Rouvrir ce rapport ?</h3>
            <p className="text-xs text-gray-400 mb-5">
              Le rapport repassera au statut « Ouvert » et pourra être modifié normalement.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRouvrir(false)}
                className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200"
                style={{ color: NAVY }}>
                Annuler
              </button>
              <button onClick={rouvrirRapport} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50"
                style={{ background: NAVY }}>
                {actionLoading ? 'Réouverture...' : 'Rouvrir le rapport'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
