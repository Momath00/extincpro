'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useT, useLangue } from '@/lib/i18n'
import { downloadFichier, downloadHtml } from '@/lib/download'
import BarreOutils, { BoutonPrincipal } from '@/components/rapports/BarreOutils'
import ChoixFichiers, { posterAvecFichiers, tailleLisible } from './ChoixFichiers'

// Dossier du bâtiment : un cycle par année d'inspection, qui regroupe tous
// les rapports, les documents figés, les envois (avec factures) et le
// journal — la preuve en cas de litige. Logique serveur :
// securiteincendie/inspections/dossier.py et views_dossier.py.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const RED = '#e11324'
const VERT = '#0d6b4f'

type ResumeCycle = {
  id: number
  libelle: string
  statut: 'ouvert' | 'ferme'
  date_debut: string
  date_fin_prevue: string
  date_fermeture: string | null
  ferme_par: string | null
  nb_rapports: number
  nb_rapports_ouverts: number
  nb_archives: number
  nb_envois: number
  pret_a_cloturer: boolean
}

function jeton() {
  return localStorage.getItem('access_token')
}

async function api(chemin: string, options: { method?: string; body?: any } = {}) {
  const res = await fetch(`${API_URL}${chemin}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${jeton()}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (res.status === 401) window.location.href = '/login'
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

// ── Petits éléments ─────────────────────────────────────────────────────────

function Carte({ icone, titre, compteur, children, droite }: {
  icone: string; titre: string; compteur?: number | string; children: React.ReactNode; droite?: React.ReactNode
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5" style={{ background: NAVY }}>
        <i className={`ti ${icone} text-base`} style={{ color: RED }} />
        <h3 className="text-xs font-bold uppercase tracking-widest text-white flex-1">{titre}</h3>
        {compteur !== undefined && (
          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-white/15 text-white">{compteur}</span>
        )}
        {droite}
      </div>
      <div>{children}</div>
    </section>
  )
}

function Vide({ texte }: { texte: string }) {
  return <p className="px-4 py-6 text-center text-xs text-gray-400">{texte}</p>
}

function BoutonSecondaire({ onClick, icone, children, disabled, titre }: {
  onClick: () => void; icone: string; children: React.ReactNode; disabled?: boolean; titre?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={titre}
      className="h-9 flex items-center gap-1.5 px-3 rounded-md text-xs font-bold border-2 border-[#0a0b0d] bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color: NAVY }}>
      <i className={`ti ${icone} text-sm`} /> {children}
    </button>
  )
}

// ── Fenêtres ────────────────────────────────────────────────────────────────

function Fenetre({ titre, icone, onClose, children }: { titre: string; icone: string; onClose: () => void; children: React.ReactNode }) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center gap-2 px-5 py-3.5 flex-shrink-0" style={{ background: NAVY }}>
          <i className={`ti ${icone} text-lg`} style={{ color: RED }} />
          <h3 className="text-sm font-bold uppercase tracking-widest text-white flex-1">{titre}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white" aria-label={t('fermer')}><i className="ti ti-x text-lg" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Actions({ onAnnuler, onValider, libelle, enCours, desactive, danger }: {
  onAnnuler: () => void; onValider: () => void; libelle: string; enCours?: boolean; desactive?: boolean; danger?: boolean
}) {
  const t = useT()
  return (
    <div className="flex gap-2 justify-end">
      <button onClick={onAnnuler} disabled={enCours}
        className="h-10 px-4 rounded-md text-sm font-bold border-2 border-gray-300 bg-white hover:border-[#0a0b0d]" style={{ color: NAVY }}>
        {t('annuler')}
      </button>
      <button onClick={onValider} disabled={enCours || desactive}
        className="h-10 px-5 rounded-md text-sm font-bold text-white shadow-sm disabled:opacity-50 flex items-center gap-2"
        style={{ background: danger ? '#d97706' : RED }}>
        {enCours && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
        {libelle}
      </button>
    </div>
  )
}

const champ = 'w-full border-2 border-[#0a0b0d] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#e11324] bg-white'

// ── Composant principal ─────────────────────────────────────────────────────

export default function DossierBatiment({ batimentId, role, cycleInitial = null, ouvrirEnvoi = false }: {
  batimentId: number
  role: 'superviseur' | 'citoyen'
  /** Cycle à afficher à l'ouverture (sinon le plus récent). */
  cycleInitial?: number | null
  /** Ouvre tout de suite la fenêtre « Envoyer tous les rapports au client ». */
  ouvrirEnvoi?: boolean
}) {
  const t = useT()
  const langue = useLangue()
  const [entete, setEntete] = useState<any>(null)
  const [cycles, setCycles] = useState<ResumeCycle[]>([])
  const [cycleId, setCycleId] = useState<number | null>(cycleInitial)
  const [envoiAuto, setEnvoiAuto] = useState(ouvrirEnvoi && role === 'superviseur')
  const [detail, setDetail] = useState<any>(null)
  const [chargement, setChargement] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [fenetre, setFenetre] = useState<null | 'nouveau' | 'fermer' | 'rouvrir' | 'envoyer'>(null)
  const [enCours, setEnCours] = useState(false)
  const [exportEnCours, setExportEnCours] = useState(false)
  const superviseur = role === 'superviseur'

  const dateFmt = (iso: string | null, avecHeure = false) => {
    if (!iso) return '—'
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
    return d.toLocaleString(langue === 'en' ? 'en-CA' : 'fr-CA', avecHeure ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
  }

  function afficher(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const chargerCycles = useCallback(async (garder?: number | null) => {
    const { ok, data } = await api(`/api/cycles/?batiment=${batimentId}`)
    setChargement(false)
    if (!ok) { afficher(data.error || data.detail || t('dossier_erreur_chargement'), 'error'); return }
    setEntete(data.batiment)
    setCycles(data.cycles)
    const voulu = garder ?? cycleId
    const suivant = data.cycles.find((c: ResumeCycle) => c.id === voulu) ? voulu : data.cycles[0]?.id ?? null
    setCycleId(suivant)
  }, [batimentId, cycleId])

  const chargerDetail = useCallback(async (id: number) => {
    setDetail(null)
    const { ok, data } = await api(`/api/cycles/${id}/`)
    if (ok) setDetail(data)
    else afficher(data.error || data.detail || t('dossier_erreur_chargement'), 'error')
  }, [])

  useEffect(() => { chargerCycles() }, [batimentId])
  useEffect(() => { if (cycleId) chargerDetail(cycleId) }, [cycleId])
  useEffect(() => {
    if (envoiAuto && detail && detail.id === cycleId) { setFenetre('envoyer'); setEnvoiAuto(false) }
  }, [envoiAuto, detail, cycleId])

  async function rafraichir(id?: number | null) {
    await chargerCycles(id ?? cycleId)
    const cible = id ?? cycleId
    if (cible) chargerDetail(cible)
  }

  async function exporter() {
    if (!detail) return
    setExportEnCours(true)
    const ok = await downloadFichier(`${API_URL}/api/cycles/${detail.id}/export/`,
      `dossier-${detail.batiment.adresse_complete}-${detail.libelle}.zip`.replace(/[^\w.-]+/g, '-'))
    setExportEnCours(false)
    if (!ok) afficher(t('dossier_erreur_export'), 'error')
    else rafraichir()
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }
  if (!entete) return <Vide texte={t('dossier_erreur_chargement')} />

  return (
    <div className="flex flex-col gap-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* En-tête du bâtiment */}
      <div className="rounded-lg overflow-hidden shadow-sm border border-gray-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4" style={{ background: NAVY }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>{entete.client_nom}</p>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <i className="ti ti-folders text-xl" style={{ color: RED }} /> {t('dossier_titre')}
            </h1>
            <p className="text-sm text-white/70 flex items-center gap-1.5 mt-0.5">
              <i className="ti ti-map-pin" /> {entete.adresse_complete}{entete.code_postal ? `, ${entete.code_postal}` : ''}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-extrabold leading-none text-white">{cycles.length}</p>
            <p className="text-[11px] text-white/60 mt-1">{t('dossier_cycles_inspection')}</p>
          </div>
        </div>
        <p className="px-5 py-2.5 text-xs text-gray-600 flex items-start gap-2 bg-gray-50">
          <i className="ti ti-shield-check text-base flex-shrink-0" style={{ color: VERT }} />
          {t('dossier_explication')}
        </p>
      </div>

      {superviseur && (
        <BarreOutils>
          <BoutonPrincipal onClick={() => setFenetre('nouveau')}>{t('dossier_nouveau_cycle')}</BoutonPrincipal>
        </BarreOutils>
      )}

      {cycles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          <i className="ti ti-folder-off text-5xl text-gray-300" />
          <p className="mt-3 text-sm font-semibold text-gray-500">{t('dossier_aucun_cycle')}</p>
          {superviseur && <p className="text-xs text-gray-400 mt-1">{t('dossier_aucun_cycle_aide')}</p>}
        </div>
      ) : (
        <>
          {/* Frise des cycles */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cycles.map(c => {
              const actif = c.id === cycleId
              return (
                <button key={c.id} onClick={() => setCycleId(c.id)} aria-pressed={actif}
                  className={`flex-shrink-0 text-left px-4 py-2.5 rounded-lg border-2 shadow-sm transition-all active:scale-[0.98] ${actif ? '' : 'hover:border-[#0a0b0d] hover:shadow'}`}
                  style={actif ? { background: NAVY, borderColor: NAVY, color: '#fff' } : { background: '#fff', borderColor: '#cbd5e1', color: NAVY }}>
                  <span className="flex items-center gap-1.5 text-sm font-extrabold">
                    <i className={`ti ${c.statut === 'ferme' ? 'ti-lock' : 'ti-lock-open'} text-sm`} style={{ color: c.statut === 'ferme' ? (actif ? '#fff' : '#64748b') : (actif ? '#4ade80' : VERT) }} />
                    {c.libelle}
                  </span>
                  <span className={`block text-[11px] mt-0.5 ${actif ? 'text-white/60' : 'text-gray-500'}`}>
                    {c.statut === 'ferme' ? t('dossier_ferme') : t('dossier_ouvert')} · {c.nb_rapports} {t('dossier_rapports_court')}
                  </span>
                  {c.pret_a_cloturer && (
                    <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: VERT }}>
                      {t('dossier_pret_a_cloturer')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {!detail ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <DetailCycle
              detail={detail}
              superviseur={superviseur}
              dateFmt={dateFmt}
              exportEnCours={exportEnCours}
              onExporter={exporter}
              onFenetre={setFenetre}
              onErreur={m => afficher(m, 'error')}
            />
          )}
        </>
      )}

      {fenetre === 'nouveau' && (
        <FenetreNouveauCycle batimentId={batimentId} onClose={() => setFenetre(null)}
          onCree={(id) => { setFenetre(null); afficher(t('dossier_cycle_cree')); rafraichir(id) }} />
      )}
      {fenetre === 'fermer' && detail && (
        <Fenetre titre={t('dossier_cloturer_titre')} icone="ti-lock" onClose={() => setFenetre(null)}>
          <FermerCycle detail={detail} enCours={enCours} onAnnuler={() => setFenetre(null)}
            onValider={async (note) => {
              setEnCours(true)
              const { ok, data } = await api(`/api/cycles/${detail.id}/fermer/`, { method: 'POST', body: { note } })
              setEnCours(false)
              if (ok) { setFenetre(null); afficher(t('dossier_cycle_ferme_toast')); rafraichir() }
              else afficher(data.error || t('erreur_generique'), 'error')
            }} />
        </Fenetre>
      )}
      {fenetre === 'rouvrir' && detail && (
        <Fenetre titre={t('dossier_rouvrir_titre')} icone="ti-lock-open" onClose={() => setFenetre(null)}>
          <RouvrirCycle enCours={enCours} onAnnuler={() => setFenetre(null)}
            onValider={async (motif) => {
              setEnCours(true)
              const { ok, data } = await api(`/api/cycles/${detail.id}/rouvrir/`, { method: 'POST', body: { motif } })
              setEnCours(false)
              if (ok) { setFenetre(null); afficher(t('dossier_cycle_rouvert_toast')); rafraichir() }
              else afficher(data.error || t('erreur_generique'), 'error')
            }} />
        </Fenetre>
      )}
      {fenetre === 'envoyer' && detail && (
        <FenetreEnvoi detail={detail} onClose={() => setFenetre(null)}
          onEnvoye={(m) => { setFenetre(null); afficher(m); rafraichir() }}
          onErreur={(m) => { afficher(m, 'error'); rafraichir() }} />
      )}
    </div>
  )
}

// ── Détail d'un cycle ───────────────────────────────────────────────────────

function DetailCycle({ detail, superviseur, dateFmt, exportEnCours, onExporter, onFenetre, onErreur }: {
  detail: any
  superviseur: boolean
  dateFmt: (iso: string | null, avecHeure?: boolean) => string
  exportEnCours: boolean
  onExporter: () => void
  onFenetre: (f: 'fermer' | 'rouvrir' | 'envoyer') => void
  onErreur: (m: string) => void
}) {
  const t = useT()
  const ferme = detail.statut === 'ferme'
  const def = detail.deficiences
  const recurrentes = def.actuelles.filter((d: any) => d.statut === 'recurrente').length

  async function ouvrirArchive(a: any, pdf = false) {
    const ok = pdf
      ? await downloadFichier(`${API_URL}/api/archives/${a.id}/?format=pdf`, `${a.titre}-v${a.version}.pdf`.replace(/[^\w.-]+/g, '-'))
      : await downloadHtml(`${API_URL}/api/archives/${a.id}/`)
    if (!ok) onErreur(t('dossier_erreur_document'))
  }

  async function telechargerPj(pj: any) {
    const ok = await downloadFichier(`${API_URL}/api/pieces-jointes/${pj.id}/`, pj.nom)
    if (!ok) onErreur(t('dossier_erreur_document'))
  }

  return (
    <div className="flex flex-col gap-5">
      {/* État du cycle + actions */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold" style={{ color: NAVY }}>{detail.libelle}</h2>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ background: ferme ? '#475569' : VERT }}>
                <i className={`ti ${ferme ? 'ti-lock' : 'ti-lock-open'}`} />
                {ferme ? t('dossier_ferme_verrouille') : t('dossier_ouvert')}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {t('dossier_periode')} : {dateFmt(detail.date_debut)} → {dateFmt(detail.date_fin_prevue)}
              {ferme && <> · {t('dossier_ferme_le')} {dateFmt(detail.date_fermeture, true)}{detail.ferme_par ? ` (${detail.ferme_par})` : ''}</>}
            </p>
            {detail.note_fermeture && <p className="text-xs text-gray-500 mt-0.5 italic">« {detail.note_fermeture} »</p>}
          </div>
          {superviseur && (
            <div className="flex flex-wrap gap-2">
              <BoutonSecondaire onClick={onExporter} icone="ti-folder-down" disabled={exportEnCours}>
                {exportEnCours ? t('dossier_export_en_cours') : t('dossier_exporter')}
              </BoutonSecondaire>
              <button onClick={() => onFenetre('envoyer')}
                className="h-9 flex items-center gap-1.5 px-3.5 rounded-md text-xs font-bold text-white shadow-sm hover:opacity-90"
                style={{ background: RED }}>
                <i className="ti ti-send text-sm" /> {t('dossier_envoyer_client')}
              </button>
              {ferme ? (
                <button onClick={() => onFenetre('rouvrir')}
                  className="h-9 flex items-center gap-1.5 px-3 rounded-md text-xs font-bold text-white shadow-sm hover:opacity-90"
                  style={{ background: '#d97706' }}>
                  <i className="ti ti-lock-open text-sm" /> {t('dossier_rouvrir_cycle')}
                </button>
              ) : (
                <button onClick={() => onFenetre('fermer')} disabled={!detail.pret_a_cloturer}
                  title={detail.pret_a_cloturer ? '' : t('dossier_cloturer_impossible')}
                  className="h-9 flex items-center gap-1.5 px-3 rounded-md text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#475569' }}>
                  <i className="ti ti-lock text-sm" /> {t('dossier_cloturer_cycle')}
                </button>
              )}
            </div>
          )}
        </div>
        {superviseur && !ferme && detail.rapports_ouverts?.length > 0 && (
          <p className="text-xs px-3 py-2 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-1.5" style={{ color: '#92400e' }}>
            <i className="ti ti-info-circle text-sm flex-shrink-0" />
            <span>{t('dossier_rapports_encore_ouverts')} : <strong>{detail.rapports_ouverts.join(', ')}</strong></span>
          </p>
        )}
        {superviseur && !ferme && detail.pret_a_cloturer && (
          <p className="text-xs px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 flex items-start gap-1.5" style={{ color: VERT }}>
            <i className="ti ti-circle-check text-sm flex-shrink-0" /> {t('dossier_pret_explication')}
          </p>
        )}
        {/* Compteurs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icone: 'ti-clipboard-list', label: t('dossier_rapports'), valeur: detail.rapports.length },
            { icone: 'ti-file-certificate', label: t('dossier_documents_figes'), valeur: detail.archives.length },
            { icone: 'ti-mail-forward', label: t('dossier_envois'), valeur: detail.envois.length },
            { icone: 'ti-alert-triangle', label: t('onglet_deficiences'), valeur: def.actuelles.length, alerte: def.actuelles.length > 0 },
          ].map(s => (
            <div key={s.label} className="rounded-md border border-gray-200 px-3 py-2.5 flex items-center gap-2.5">
              <i className={`ti ${s.icone} text-lg`} style={{ color: s.alerte ? '#dc2626' : NAVY }} />
              <div>
                <p className="text-xl font-extrabold leading-none" style={{ color: s.alerte ? '#dc2626' : NAVY }}>{s.valeur}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rapports */}
      <Carte icone="ti-clipboard-list" titre={t('dossier_rapports_du_cycle')} compteur={detail.rapports.length}>
        {detail.rapports.length === 0 ? <Vide texte={t('dossier_aucun_rapport')} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-[10px] font-extrabold uppercase tracking-widest text-gray-600 bg-gray-50">
                  <th className="text-left px-4 py-2">{t('dossier_module')}</th>
                  <th className="text-left px-3 py-2">{t('dossier_inspection')}</th>
                  <th className="text-left px-3 py-2">{t('statut')}</th>
                  <th className="text-left px-3 py-2">{t('certificat')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {detail.rapports.map((r: any) => (
                  <tr key={`${r.module}-${r.id}`} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      <p className="font-bold" style={{ color: NAVY }}>{r.module_libelle}</p>
                      <p className="text-[11px] text-gray-500">#{r.id}{r.techniciens.length ? ` · ${r.techniciens.join(', ')}` : ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: NAVY }}>{dateFmt(r.date_inspection)}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={r.statut === 'ferme' ? { background: '#e9f6f2', color: VERT } : { background: '#fff2e8', color: '#9a4a13' }}>
                        {r.statut === 'ferme' ? t('ferme') : t('ouvert')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.certificat ? (
                        <span style={{ color: NAVY }}>
                          <span className="font-mono font-bold">{r.certificat.numero}</span>
                          <span className={`ml-1.5 font-semibold ${r.certificat.envoye ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {r.certificat.envoye ? `✓ ${t('envoye')}` : t('non_envoye')}
                          </span>
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {superviseur && (
                        <Link href={`/superviseur/${r.chemin}/${r.id}`}
                          className="inline-flex h-8 items-center gap-1 px-2.5 rounded-md text-xs font-bold border-2 border-[#0a0b0d] hover:bg-gray-50" style={{ color: NAVY }}>
                          {t('ouvrir')} <i className="ti ti-arrow-right text-xs" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>

      {/* Documents figés */}
      <Carte icone="ti-file-certificate" titre={t('dossier_documents_figes')} compteur={detail.archives.length}>
        <p className="px-4 pt-3 text-[11px] text-gray-500">{t('dossier_documents_aide')}</p>
        {detail.archives.length === 0 ? <Vide texte={t('dossier_aucun_document')} /> : (
          <ul className="divide-y divide-gray-100">
            {detail.archives.map((a: any) => (
              <li key={a.id} className={`px-4 py-3 flex flex-wrap items-center gap-3 ${a.courante ? '' : 'bg-gray-50/70'}`}>
                <i className={`ti ${a.type_document === 'rapport' ? 'ti-file-text' : 'ti-certificate'} text-xl`} style={{ color: a.courante ? RED : '#94a3b8' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold flex items-center gap-2 flex-wrap" style={{ color: a.courante ? NAVY : '#64748b' }}>
                    {a.titre}
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded text-white" style={{ background: a.courante ? NAVY : '#94a3b8' }}>v{a.version}</span>
                    {!a.courante && <span className="text-[10px] font-bold text-gray-500">{t('dossier_remplacee_le')} {dateFmt(a.remplacee_le)}</span>}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {a.module_libelle} · {t('dossier_fige_le')} {dateFmt(a.date_creation, true)}{a.cree_par ? ` · ${a.cree_par}` : ''}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono break-all" title={t('dossier_empreinte_aide')}>SHA-256 {a.empreinte}</p>
                </div>
                <div className="flex gap-2">
                  <BoutonSecondaire onClick={() => ouvrirArchive(a)} icone="ti-eye">{t('voir')}</BoutonSecondaire>
                  <BoutonSecondaire onClick={() => ouvrirArchive(a, true)} icone="ti-file-type-pdf">PDF</BoutonSecondaire>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {/* Envois */}
      <Carte icone="ti-mail-forward" titre={t('dossier_envois_client')} compteur={detail.envois.length}>
        {detail.envois.length === 0 ? <Vide texte={t('dossier_aucun_envoi')} /> : (
          <ul className="divide-y divide-gray-100">
            {detail.envois.map((e: any) => (
              <li key={e.id} className="px-4 py-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-start gap-3">
                  <i className={`ti ${e.statut === 'envoye' ? 'ti-mail-check' : 'ti-mail-x'} text-xl`} style={{ color: e.statut === 'envoye' ? VERT : '#dc2626' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: NAVY }}>{e.sujet}</p>
                    <p className="text-[11px] text-gray-600">
                      {dateFmt(e.date_envoi, true)} · {e.type_libelle} · {t('dossier_a')} <strong>{e.destinataire}</strong>
                      {e.destinataire_nom ? ` (${e.destinataire_nom})` : ''} · {t('dossier_par')} {e.envoye_par}
                    </p>
                    {e.statut !== 'envoye' && <p className="text-[11px] font-bold text-red-600">{t('dossier_envoi_echec')}{e.erreur ? ` — ${e.erreur}` : ''}</p>}
                    {e.message && <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">« {e.message} »</p>}
                  </div>
                  {superviseur && (
                    <BoutonSecondaire onClick={() => downloadHtml(`${API_URL}/api/envois/${e.id}/courriel/`)} icone="ti-mail-opened">
                      {t('dossier_voir_courriel')}
                    </BoutonSecondaire>
                  )}
                </div>
                {e.pieces_jointes.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-8">
                    {e.pieces_jointes.map((pj: any) => (
                      <button key={pj.id} onClick={() => telechargerPj(pj)}
                        className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border text-xs font-semibold shadow-sm hover:border-[#0a0b0d]"
                        style={pj.origine === 'ajout'
                          ? { background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }
                          : { background: '#f8fafc', borderColor: '#cbd5e1', color: NAVY }}
                        title={`SHA-256 ${pj.empreinte}`}>
                        <i className={`ti ${pj.origine === 'ajout' ? 'ti-file-invoice' : 'ti-paperclip'} text-sm`} />
                        {pj.nom} <span className="text-gray-500 font-normal">({tailleLisible(pj.taille)})</span>
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {/* Déficiences */}
      <Carte icone="ti-alert-triangle" titre={t('dossier_suivi_deficiences')} compteur={def.actuelles.length}
        droite={recurrentes > 0 ? (
          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full text-white" style={{ background: '#dc2626' }}>
            {recurrentes} {t('dossier_recurrentes')}
          </span>
        ) : undefined}>
        <p className="px-4 pt-3 text-[11px] text-gray-500">
          {def.cycle_precedent ? `${t('dossier_compare_avec')} ${def.cycle_precedent}.` : t('dossier_premier_cycle')}
        </p>
        {def.actuelles.length === 0 && def.corrigees.length === 0 ? <Vide texte={t('aucune_deficience')} /> : (
          <ul className="divide-y divide-gray-100 mt-2">
            {def.actuelles.map((d: any) => (
              <li key={d.cle} className="px-4 py-2.5 flex flex-wrap items-start gap-3"
                style={{ borderLeft: `4px solid ${d.statut === 'recurrente' ? '#dc2626' : '#f59e0b'}` }}>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white flex-shrink-0 mt-0.5"
                  style={{ background: d.statut === 'recurrente' ? '#dc2626' : '#d97706' }}>
                  {d.statut === 'recurrente' ? `${t('dossier_recurrente_depuis')} ${d.depuis}` : t('dossier_nouvelle')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: NAVY }}>{d.libelle} — {d.localisation}</p>
                  <p className="text-xs text-gray-600">{d.detail}</p>
                </div>
              </li>
            ))}
            {def.corrigees.map((d: any) => (
              <li key={`c-${d.cle}`} className="px-4 py-2.5 flex flex-wrap items-start gap-3 bg-emerald-50/40" style={{ borderLeft: `4px solid ${d.statut === 'corrigee' ? '#22c55e' : '#94a3b8'}` }}>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white flex-shrink-0 mt-0.5"
                  style={{ background: d.statut === 'corrigee' ? '#16a34a' : '#64748b' }}>
                  {d.statut === 'corrigee' ? t('dossier_corrigee') : t('dossier_non_reverifiee')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-600 line-through decoration-1">{d.libelle} — {d.localisation}</p>
                  <p className="text-xs text-gray-500">{t('dossier_signalee_en')} {d.cycle} : {d.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {/* Journal */}
      {superviseur && detail.journal && (
        <Carte icone="ti-history" titre={t('dossier_journal')} compteur={detail.journal.length}>
          {detail.journal.length === 0 ? <Vide texte={t('aucune_activite')} /> : (
            <ul className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
              {detail.journal.map((j: any, i: number) => (
                <li key={i} className="px-4 py-2 flex items-start gap-3 text-xs">
                  <span className="text-gray-500 w-36 flex-shrink-0">{dateFmt(j.date, true)}</span>
                  <span className="font-bold w-28 flex-shrink-0 truncate" style={{ color: NAVY }}>{j.utilisateur}</span>
                  <span className="flex-1" style={{ color: j.source === 'cycle' ? NAVY : '#475569', fontWeight: j.source === 'cycle' ? 700 : 400 }}>
                    {j.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      )}
    </div>
  )
}

// ── Fenêtres d'action ───────────────────────────────────────────────────────

function FenetreNouveauCycle({ batimentId, onClose, onCree }: { batimentId: number; onClose: () => void; onCree: (id: number) => void }) {
  const t = useT()
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  return (
    <Fenetre titre={t('dossier_nouveau_cycle')} icone="ti-folder-plus" onClose={onClose}>
      <p className="text-sm text-gray-600">{t('dossier_nouveau_cycle_aide')}</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>{t('dossier_date_debut')}</span>
        <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className={champ} />
      </label>
      {erreur && <p className="text-sm font-semibold text-red-600">{erreur}</p>}
      <Actions onAnnuler={onClose} libelle={t('dossier_ouvrir_cycle')} enCours={enCours} desactive={!dateDebut}
        onValider={async () => {
          setEnCours(true)
          setErreur('')
          const { ok, data } = await api('/api/cycles/ouvrir/', { method: 'POST', body: { batiment: batimentId, date_debut: dateDebut } })
          setEnCours(false)
          if (ok) onCree(data.id)
          else setErreur(data.error || t('erreur_generique'))
        }} />
    </Fenetre>
  )
}

function FermerCycle({ detail, enCours, onAnnuler, onValider }: { detail: any; enCours: boolean; onAnnuler: () => void; onValider: (note: string) => void }) {
  const t = useT()
  const [note, setNote] = useState('')
  const nonEnvoyes = detail.rapports.filter((r: any) => r.certificat && !r.certificat.envoye).length
  return (
    <>
      <p className="text-sm text-gray-600">{t('dossier_cloturer_explication')}</p>
      {nonEnvoyes > 0 && (
        <p className="text-xs px-3 py-2 rounded-md bg-amber-50 border border-amber-200 font-semibold" style={{ color: '#92400e' }}>
          <i className="ti ti-alert-triangle mr-1" /> {nonEnvoyes} {t('dossier_certificats_non_envoyes')}
        </p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>{t('dossier_note_optionnelle')}</span>
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} className={champ} placeholder={t('dossier_note_placeholder')} />
      </label>
      <Actions onAnnuler={onAnnuler} onValider={() => onValider(note)} libelle={t('dossier_cloturer_cycle')} enCours={enCours} />
    </>
  )
}

function RouvrirCycle({ enCours, onAnnuler, onValider }: { enCours: boolean; onAnnuler: () => void; onValider: (motif: string) => void }) {
  const t = useT()
  const [motif, setMotif] = useState('')
  return (
    <>
      <p className="text-sm text-gray-600">{t('dossier_rouvrir_explication')}</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>{t('dossier_motif_obligatoire')}</span>
        <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={3} maxLength={300} className={champ}
          placeholder={t('dossier_motif_placeholder')} />
      </label>
      <Actions onAnnuler={onAnnuler} onValider={() => onValider(motif)} libelle={t('dossier_rouvrir_cycle')}
        enCours={enCours} desactive={motif.trim().length < 5} danger />
    </>
  )
}

function FenetreEnvoi({ detail, onClose, onEnvoye, onErreur }: {
  detail: any; onClose: () => void; onEnvoye: (m: string) => void; onErreur: (m: string) => void
}) {
  const t = useT()
  const suggestions: { email: string; libelle: string }[] = detail.destinataires_suggeres || []
  const [destinataires, setDestinataires] = useState<string[]>(suggestions[0] ? [suggestions[0].email] : [])
  const [saisie, setSaisie] = useState('')
  const MAX_DEST = 5
  const courrielValide = (x: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(x)

  // Ajoute une ou plusieurs adresses (séparées par virgule, point-virgule ou espace).
  function ajouterAdresses(texte: string) {
    const nouvelles = texte.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean)
    const invalides = nouvelles.filter(x => !courrielValide(x))
    if (invalides.length) { setErreur(`${t('dossier_courriel_invalide')} : ${invalides.join(', ')}`); return false }
    setDestinataires(prev => {
      const suite = [...prev]
      for (const a of nouvelles) if (!suite.some(x => x.toLowerCase() === a.toLowerCase())) suite.push(a)
      if (suite.length > MAX_DEST) setErreur(t('dossier_max_destinataires'))
      return suite.slice(0, MAX_DEST)
    })
    setErreur('')
    return true
  }

  function basculerSuggestion(email: string) {
    if (destinataires.some(x => x.toLowerCase() === email.toLowerCase())) {
      setDestinataires(prev => prev.filter(x => x.toLowerCase() !== email.toLowerCase()))
    } else {
      ajouterAdresses(email)
    }
  }
  const [sujet, setSujet] = useState('')
  const [message, setMessage] = useState('')
  const courantes = detail.archives.filter((a: any) => a.courante)
  const [choisies, setChoisies] = useState<number[]>(courantes.map((a: any) => a.id))
  const [fichiers, setFichiers] = useState<File[]>([])
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  async function envoyer() {
    // Une adresse tapée mais pas encore validée par Entrée compte aussi.
    let liste = destinataires
    if (saisie.trim()) {
      if (!ajouterAdresses(saisie)) return
      liste = [...destinataires, ...saisie.split(/[\s,;]+/).filter(Boolean)].slice(0, MAX_DEST)
      setSaisie('')
    }
    setEnCours(true)
    setErreur('')
    const { ok, data } = await posterAvecFichiers(`${API_URL}/api/cycles/${detail.id}/envoyer/`, fichiers, {
      destinataires: liste, sujet, message, archives: choisies.map(String),
    })
    setEnCours(false)
    if (ok) onEnvoye(data.message || t('certificat_envoye_toast'))
    else if (data.error && String(data.error).includes('conservée')) onErreur(data.error)
    else setErreur(data.error || data.detail || t('erreur_envoi'))
  }

  const ouverts: string[] = detail.rapports_ouverts || []

  return (
    <Fenetre titre={t('dossier_envoyer_client')} icone="ti-send" onClose={onClose}>
      <p className="text-sm text-gray-600">{t('dossier_envoi_tous_explication')}</p>
      {ouverts.length > 0 && (
        <p className="text-xs px-3 py-2 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-1.5" style={{ color: '#92400e' }}>
          <i className="ti ti-alert-triangle text-sm flex-shrink-0" />
          <span>{t('dossier_envoi_rapports_ouverts')} : <strong>{ouverts.join(', ')}</strong></span>
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>
          {t('dossier_destinataires')} ({destinataires.length}/{MAX_DEST})
        </span>
        {/* Adresses retenues : une étiquette par destinataire, ✕ pour la retirer. */}
        <div className="flex flex-wrap items-center gap-1.5 min-h-[44px] border-2 border-[#0a0b0d] rounded-md px-2 py-1.5 bg-white focus-within:border-[#e11324]">
          {destinataires.map(d => (
            <span key={d} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-bold text-white" style={{ background: NAVY }}>
              {d}
              <button type="button" onClick={() => setDestinataires(prev => prev.filter(x => x !== d))}
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20" aria-label={t('retirer')}>
                <i className="ti ti-x text-[11px]" />
              </button>
            </span>
          ))}
          {destinataires.length < MAX_DEST && (
            <input type="email" value={saisie} onChange={e => setSaisie(e.target.value)}
              onKeyDown={e => {
                if (['Enter', ',', ';', ' '].includes(e.key)) {
                  e.preventDefault()
                  if (saisie.trim() && ajouterAdresses(saisie)) setSaisie('')
                } else if (e.key === 'Backspace' && !saisie && destinataires.length) {
                  setDestinataires(prev => prev.slice(0, -1))
                }
              }}
              onBlur={() => { if (saisie.trim() && ajouterAdresses(saisie)) setSaisie('') }}
              className="flex-1 min-w-[180px] text-sm px-1 py-1 focus:outline-none bg-transparent"
              placeholder={destinataires.length ? t('dossier_ajouter_destinataire') : 'courriel@exemple.com'} />
          )}
        </div>
        <span className="text-[11px] text-gray-500">{t('dossier_destinataires_aide')}</span>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(s => {
              const choisi = destinataires.some(x => x.toLowerCase() === s.email.toLowerCase())
              return (
                <button key={s.email} type="button" onClick={() => basculerSuggestion(s.email)} aria-pressed={choisi}
                  className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border text-[11px] font-bold shadow-sm transition-all hover:border-[#0a0b0d]"
                  style={choisi ? { background: '#e9f6f2', borderColor: '#0d6b4f', color: '#0d6b4f' } : { background: '#f8fafc', borderColor: '#94a3b8', color: NAVY }}
                  title={s.email}>
                  <i className={`ti ${choisi ? 'ti-check' : 'ti-plus'} text-xs`} /> {s.libelle}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>{t('pj_titre')}</span>
        <ChoixFichiers fichiers={fichiers} onChange={setFichiers} grand />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>{t('dossier_objet')}</span>
        <input value={sujet} onChange={e => setSujet(e.target.value)} className={champ} placeholder={t('dossier_objet_placeholder')} maxLength={250} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>{t('dossier_message')}</span>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className={champ} placeholder={t('dossier_message_placeholder')} />
      </label>
      {courantes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>
            {t('dossier_documents_a_joindre')} ({choisies.length}/{courantes.length})
          </span>
          {courantes.map((a: any) => (
            <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-[#e11324]" checked={choisies.includes(a.id)}
                onChange={e => setChoisies(prev => e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id))} />
              <span style={{ color: NAVY }}>{a.titre} <span className="text-xs text-gray-500">(v{a.version}, PDF)</span></span>
            </label>
          ))}
        </div>
      )}
      <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
        <i className="ti ti-shield-check text-sm" style={{ color: VERT }} /> {t('envoi_conserve_dossier')}
      </p>
      {erreur && <p className="text-sm font-semibold text-red-600">{erreur}</p>}
      <Actions onAnnuler={onClose} onValider={envoyer} libelle={t('envoyer')} enCours={enCours} desactive={destinataires.length === 0 && !courrielValide(saisie.trim())} />
    </Fenetre>
  )
}
