'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { secteurColor } from '@/lib/secteurColor'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

type Echeance = { type: string; label_cle: string; date: string; en_retard: boolean }
type BatimentAPlanifier = {
  batiment_id: number
  adresse: string
  secteur: string
  taille: 'petit' | 'moyen' | 'gros' | null
  client_nom: string
  echeances: Echeance[]
  prochaine_echeance: string
  en_retard: boolean
}

function labelTaille(taille: string | null, t: (c: string) => string) {
  if (taille === 'petit') return t('taille_petit')
  if (taille === 'moyen') return t('taille_moyen')
  if (taille === 'gros') return t('taille_gros')
  return null
}

// ── Carte d'un bâtiment à planifier, avec case à cocher ──────────────────
function CarteAPlanifier({ b, coche, onToggle, t }: { b: BatimentAPlanifier; coche: boolean; onToggle: () => void; t: (c: string) => string }) {
  const taille = labelTaille(b.taille, t)
  const col = secteurColor(b.secteur)
  return (
    <button onClick={onToggle} type="button"
      className="w-full text-left rounded-xl border-2 p-3.5 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{ borderLeft: `3px solid ${col.bg}`, borderColor: coche ? ORANGE : undefined, background: coche ? '#fff2e8' : '#fff' }}>
      <div className="flex items-start gap-2">
        <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 mt-0.5"
          style={{ borderColor: coche ? ORANGE : '#d1d5db', background: coche ? ORANGE : 'transparent' }}>
          {coche && <i className="ti ti-check text-white text-[10px]" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-snug" style={{ color: NAVY }}>{b.adresse}</p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
            <i className="ti ti-building text-[11px] text-gray-300" /> {b.client_nom}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pl-[22px]">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: col.light, color: col.bg }}>
          <i className="ti ti-map-pin-filled text-[10px]" />
          {b.secteur || t('secteur_non_precise')}
        </span>
        {taille && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: NAVY }}>
            {taille}
          </span>
        )}
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{ background: b.en_retard ? '#fee2e2' : '#fef2f2', color: b.en_retard ? '#7f1d1d' : ORANGE }}>
          {t('echeance_le')} {new Date(b.prochaine_echeance + 'T00:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </button>
  )
}

// ── Groupe de bâtiments d'un secteur, repliable ──────────────────────────
// Replié par défaut quand il y a plusieurs secteurs (« Tous les secteurs »)
// pour économiser l'espace — pas la peine de replier s'il n'y en a qu'un
// (secteur déjà choisi via les puces), il reste toujours ouvert.
function GroupeAPlanifier({
  secteur, batiments, collapsible, selection, toggleSelection, selectionnerGroupe, t,
}: {
  secteur: string
  batiments: BatimentAPlanifier[]
  collapsible: boolean
  selection: Set<number>
  toggleSelection: (id: number) => void
  selectionnerGroupe: (batiments: BatimentAPlanifier[]) => void
  t: (c: string) => string
}) {
  const [ouvert, setOuvert] = useState(!collapsible)
  const col = secteurColor(secteur)

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        {collapsible ? (
          <button onClick={() => setOuvert(v => !v)} type="button" className="flex items-center gap-2 min-w-0">
            <i className={`ti ti-chevron-right text-xs transition-transform duration-150 flex-shrink-0 ${ouvert ? 'rotate-90' : ''}`} style={{ color: '#94a3b8' }} />
            <i className="ti ti-map-pin text-[12px] flex-shrink-0" style={{ color: col.bg }} />
            <p className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: col.bg }}>
              {secteur || t('secteur_non_precise')} · {batiments.length}
            </p>
          </button>
        ) : <div className="flex-1" />}
        <div className="h-px flex-1" style={{ background: col.light }} />
        <button onClick={() => selectionnerGroupe(batiments)}
          className="text-[11px] font-bold uppercase tracking-wide flex-shrink-0" style={{ color: ORANGE }}>
          {t('selectionner_tout_secteur')}
        </button>
      </div>
      {ouvert && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {batiments.map(b => (
            <CarteAPlanifier key={b.batiment_id} b={b} coche={selection.has(b.batiment_id)} onToggle={() => toggleSelection(b.batiment_id)} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modale de renommage de secteur ───────────────────────────────────────
// Renomme le secteur sur tous les bâtiments qui le portent actuellement —
// pas de table à part à mettre à jour, `direction` est la seule source.
function ModaleRenommerSecteur({ ancienNom, onClose, onRenomme, t }: { ancienNom: string; onClose: () => void; onRenomme: () => void; t: (c: string) => string }) {
  const [nouveauNom, setNouveauNom] = useState(ancienNom)
  const [nbBatiments, setNbBatiments] = useState<number | null>(null)
  const [batimentIds, setBatimentIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/batiments/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        const liste = Array.isArray(data) ? data : (data.results || [])
        const concernes = liste.filter((b: any) => b.direction === ancienNom)
        setBatimentIds(concernes.map((b: any) => b.id))
        setNbBatiments(concernes.length)
      })
  }, [ancienNom])

  async function renommer(e: React.FormEvent) {
    e.preventDefault()
    if (!nouveauNom.trim()) { setError(t('nom_secteur_obligatoire')); return }
    setSubmitting(true)
    setError('')
    const token = localStorage.getItem('access_token')
    try {
      const resultats = await Promise.all(batimentIds.map(id =>
        fetch(`${API_URL}/api/batiments/${id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ direction: nouveauNom.trim() }),
        })
      ))
      if (resultats.some(r => !r.ok)) throw new Error(t('erreur_generique'))
      onRenomme()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('renommer_secteur_titre')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><i className="ti ti-x text-lg" /></button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">{error}</div>}

        <form onSubmit={renommer} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('champ_secteur')}</label>
            <input value={nouveauNom} onChange={e => setNouveauNom(e.target.value)} autoFocus
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
          </div>

          <p className="text-xs text-gray-400">
            {nbBatiments === null ? t('chargement') : `${nbBatiments} ${t('batiments_du_secteur').toLowerCase()}`}
          </p>

          <button type="submit" disabled={submitting || nbBatiments === null}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest mt-2 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            style={{ background: ORANGE }}>
            {submitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />}
            {submitting ? t('creation_en_cours') : t('renommer_secteur_titre')}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Modale de création de secteur ────────────────────────────────────────
// Un secteur n'est rien d'autre qu'une valeur de `Batiment.direction` — le
// créer revient à choisir un nom et à l'assigner à un ou plusieurs bâtiments.
function ModaleCreerSecteur({ onClose, onCree, t }: { onClose: () => void; onCree: () => void; t: (c: string) => string }) {
  const [nom, setNom] = useState('')
  const [batiments, setBatiments] = useState<any[]>([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/batiments/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setBatiments(Array.isArray(data) ? data : (data.results || [])))
      .finally(() => setChargement(false))
  }, [])

  function toggle(id: number) {
    setSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const filtres = batiments.filter(b => {
    const r = recherche.trim().toLowerCase()
    if (!r) return true
    return `${b.adresse_complete} ${b.client_nom}`.toLowerCase().includes(r)
  })

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) { setError(t('nom_secteur_obligatoire')); return }
    if (selection.size === 0) { setError(t('choisir_au_moins_un_batiment')); return }
    setSubmitting(true)
    setError('')
    const token = localStorage.getItem('access_token')
    try {
      const resultats = await Promise.all([...selection].map(id =>
        fetch(`${API_URL}/api/batiments/${id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ direction: nom.trim() }),
        })
      ))
      if (resultats.some(r => !r.ok)) throw new Error(t('erreur_generique'))
      onCree()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('creer_secteur_bouton')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><i className="ti ti-x text-lg" /></button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">{error}</div>}

        <form onSubmit={creer} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('champ_secteur')}</label>
            <input value={nom} onChange={e => setNom(e.target.value)} autoFocus
              placeholder={t('nom_nouveau_secteur_placeholder')}
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>
              {t('batiments_du_secteur')} <span className="text-gray-300 normal-case font-normal">({selection.size})</span>
            </label>
            <div className="relative mb-2">
              <i className="ti ti-search text-[13px] text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={recherche} onChange={e => setRecherche(e.target.value)}
                placeholder={t('rechercher_placeholder')}
                className="w-full border border-gray-200 rounded-md pl-8 pr-2.5 py-2 text-xs focus:outline-none focus:border-[#e11324]" />
            </div>
            {chargement ? (
              <p className="text-xs text-gray-300 italic">{t('chargement')}</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-56 overflow-y-auto border border-gray-100 rounded-md p-1.5">
                {filtres.map(b => {
                  const checked = selection.has(b.id)
                  return (
                    <button type="button" key={b.id} onClick={() => toggle(b.id)}
                      className="flex items-center gap-2.5 p-2 rounded-md text-left transition-colors"
                      style={{ background: checked ? '#fff2e8' : 'transparent' }}>
                      <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2"
                        style={{ borderColor: checked ? ORANGE : '#d1d5db', background: checked ? ORANGE : 'transparent' }}>
                        {checked && <i className="ti ti-check text-white text-[10px]" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: NAVY }}>{b.adresse_complete}</p>
                        <p className="text-[11px] text-gray-400 truncate">{b.client_nom}{b.direction && ` · ${b.direction}`}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest mt-2 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            style={{ background: ORANGE }}>
            {submitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />}
            {submitting ? t('creation_en_cours') : t('creer_secteur_bouton')}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Modale d'assignation (date + techniciens) ────────────────────────────
// Planifie la prochaine visite pour tous les rapports dus des bâtiments
// sélectionnés — écrit sur le vrai rapport (voir AssignerPlanificationView
// côté backend), pas sur un objet séparé.
function ModaleAssigner({
  nbBatiments, techniciensDisponibles, onClose, onAssigne, t,
}: {
  nbBatiments: number
  techniciensDisponibles: { id: number; username: string }[]
  onClose: () => void
  onAssigne: (dateInspection: string, techniciens: number[]) => Promise<void>
  t: (c: string) => string
}) {
  const [dateInspection, setDateInspection] = useState('')
  const [technicienIds, setTechnicienIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function toggleTechnicien(id: number) {
    setTechnicienIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function assigner(e: React.FormEvent) {
    e.preventDefault()
    if (technicienIds.length === 0) { setError(t('choisir_au_moins_un_technicien')); return }
    setSubmitting(true)
    setError('')
    try {
      await onAssigne(dateInspection, technicienIds)
      onClose()
    } catch (err: any) {
      setError(err.message || t('erreur_generique'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('assigner_bouton')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><i className="ti ti-x text-lg" /></button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">{error}</div>}

        <p className="text-xs text-gray-400 mb-4">{nbBatiments} {t('batiments_selectionnes')}</p>

        <form onSubmit={assigner} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('champ_date_tournee')}</label>
            <input type="date" value={dateInspection} onChange={e => setDateInspection(e.target.value)} required
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('champ_techniciens')}</label>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {techniciensDisponibles.map(tech => {
                const checked = technicienIds.includes(tech.id)
                return (
                  <button type="button" key={tech.id} onClick={() => toggleTechnicien(tech.id)}
                    className="flex items-center gap-2.5 p-2 rounded-md border-2 text-left transition-colors"
                    style={{ borderColor: checked ? ORANGE : '#e5e7eb', background: checked ? '#fff2e8' : '#fff' }}>
                    <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2"
                      style={{ borderColor: checked ? ORANGE : '#d1d5db', background: checked ? ORANGE : 'transparent' }}>
                      {checked && <i className="ti ti-check text-white text-[10px]" />}
                    </span>
                    <span className="text-sm" style={{ color: NAVY }}>{tech.username}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <button type="submit" disabled={submitting}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest mt-2 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            style={{ background: ORANGE }}>
            {submitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />}
            {submitting ? t('creation_en_cours') : t('assigner_bouton')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function TourneesPage() {
  const router = useRouter()
  const t = useT()
  const [aPlanifier, setAPlanifier] = useState<BatimentAPlanifier[]>([])
  const [loading, setLoading] = useState(true)
  const [modaleSecteurOuverte, setModaleSecteurOuverte] = useState(false)
  const [secteurARenommer, setSecteurARenommer] = useState<string | null>(null)
  const [filtreSecteur, setFiltreSecteur] = useState('')
  const [filtreTaille, setFiltreTaille] = useState<'' | 'petit' | 'moyen' | 'gros'>('')
  const [recherche, setRecherche] = useState('')
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [techniciensDisponibles, setTechniciensDisponibles] = useState<{ id: number; username: string }[]>([])
  const [modaleAssignerOuverte, setModaleAssignerOuverte] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    fetch(`${API_URL}/api/utilisateurs/?role=technicien`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setTechniciensDisponibles(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => {})
  }, [])

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    const headers = { Authorization: `Bearer ${token}` }
    // Ne montre l'écran de chargement plein-page qu'au tout premier appel —
    // sinon chaque assignation/renommage remplace toute la liste par le
    // spinner, ce qui fait revenir la page en haut à chaque action.
    if (aPlanifier.length === 0) setLoading(true)
    fetch(`${API_URL}/api/planification/a-planifier/`, { headers })
      .then(res => (res.status === 401 ? (router.push('/login'), null) : res.json()))
      .then(data => { if (data) setAPlanifier(data.batiments || []) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

  const secteurs = useMemo(
    () => [...new Set(aPlanifier.map(b => b.secteur || ''))].filter(Boolean).sort(),
    [aPlanifier]
  )

  const filtres = useMemo(() => {
    const r = recherche.trim().toLowerCase()
    return aPlanifier.filter(b => {
      if (filtreSecteur && (b.secteur || '') !== filtreSecteur) return false
      if (filtreTaille && b.taille !== filtreTaille) return false
      if (r && !`${b.adresse} ${b.client_nom}`.toLowerCase().includes(r)) return false
      return true
    })
  }, [aPlanifier, filtreSecteur, filtreTaille, recherche])

  // Regroupé par secteur pour l'affichage — des adresses d'un même secteur
  // doivent être visuellement ensemble, pas mélangées.
  const groupes = useMemo(() => {
    if (filtreSecteur) return [{ secteur: filtreSecteur, batiments: filtres }]
    const parSecteur: Record<string, BatimentAPlanifier[]> = {}
    for (const b of filtres) {
      const cle = b.secteur || ''
      ;(parSecteur[cle] ||= []).push(b)
    }
    return Object.entries(parSecteur)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([secteur, batiments]) => ({ secteur, batiments }))
  }, [filtres, filtreSecteur])

  function toggleSelection(id: number) {
    setSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function selectionnerGroupe(batiments: BatimentAPlanifier[]) {
    setSelection(prev => {
      const next = new Set(prev)
      for (const b of batiments) next.add(b.batiment_id)
      return next
    })
  }

  async function assignerSelection(dateInspection: string, techniciens: number[]) {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/planification/assigner/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batiment_ids: [...selection], techniciens, date_inspection: dateInspection }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((Object.values(data) as any[])?.[0]?.[0] || data.error || t('erreur_generique'))
    }
    setSelection(new Set())
    charger()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{t('tournees_titre')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('tournees_sous_titre')}</p>
        </div>
        <button
          onClick={() => setModaleSecteurOuverte(true)}
          className="text-white px-4 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 flex-shrink-0"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-plus" /> {t('creer_secteur_bouton')}
        </button>
      </div>

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('a_planifier_titre')}</h2>
        <span className="text-[11px] font-bold text-gray-300">{filtres.length}</span>
      </div>

      {/* Puces de secteur — évite d'empiler des dizaines de groupes à l'écran
          quand il y a beaucoup de secteurs ; une seule liste filtrée. */}
      {secteurs.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          <button onClick={() => setFiltreSecteur('')}
            className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors flex-shrink-0"
            style={{ background: filtreSecteur === '' ? NAVY : '#f1f5f9', color: filtreSecteur === '' ? '#fff' : '#6b7280' }}>
            {t('tous_les_secteurs')} · {aPlanifier.length}
          </button>
          {secteurs.map(s => {
            const col = secteurColor(s)
            const actif = filtreSecteur === s
            return (
            <div key={s} className="inline-flex items-center rounded-full text-[11px] font-bold flex-shrink-0 overflow-hidden"
              style={{ background: actif ? col.bg : col.light, color: actif ? '#fff' : col.bg }}>
              <button onClick={() => setFiltreSecteur(actif ? '' : s)}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 transition-colors">
                <i className="ti ti-map-pin text-[11px]" />
                {s} · {aPlanifier.filter(b => (b.secteur || '') === s).length}
              </button>
              <button onClick={() => setSecteurARenommer(s)} title={t('renommer_secteur_titre')}
                className="pr-2.5 pl-1 py-1 opacity-70 hover:opacity-100 transition-opacity">
                <i className="ti ti-pencil text-[11px]" />
              </button>
            </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <i className="ti ti-search text-[13px] text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder={t('rechercher_placeholder')}
            className="w-full border border-gray-200 rounded-md pl-8 pr-2.5 py-2 text-xs focus:outline-none focus:border-[#e11324]" />
        </div>
        <div className="flex gap-1 p-1 rounded-md border border-gray-100 bg-white">
          {(['', 'petit', 'moyen', 'gros'] as const).map(taille => (
            <button key={taille || 'tous'} onClick={() => setFiltreTaille(taille)}
              className="px-2.5 py-1 rounded text-[11px] font-bold transition-colors"
              style={{ background: filtreTaille === taille ? NAVY : 'transparent', color: filtreTaille === taille ? '#fff' : '#6b7280' }}>
              {taille === '' ? t('tous') : taille === 'petit' ? t('taille_petit') : taille === 'moyen' ? t('taille_moyen') : t('taille_gros')}
            </button>
          ))}
        </div>
      </div>

      {filtres.length === 0 ? (
        <p className="text-sm text-gray-300 italic">{aPlanifier.length === 0 ? t('aucun_batiment_a_planifier') : t('aucun_resultat_filtre')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {groupes.map(({ secteur, batiments }) => (
            <GroupeAPlanifier
              key={secteur || 'sans-secteur'}
              secteur={secteur}
              batiments={batiments}
              collapsible={groupes.length > 1}
              selection={selection}
              toggleSelection={toggleSelection}
              selectionnerGroupe={selectionnerGroupe}
              t={t}
            />
          ))}
        </div>
      )}

      {modaleSecteurOuverte && (
        <ModaleCreerSecteur
          onClose={() => setModaleSecteurOuverte(false)}
          onCree={charger}
          t={t}
        />
      )}

      {secteurARenommer !== null && (
        <ModaleRenommerSecteur
          ancienNom={secteurARenommer}
          onClose={() => setSecteurARenommer(null)}
          onRenomme={() => { if (filtreSecteur === secteurARenommer) setFiltreSecteur(''); charger() }}
          t={t}
        />
      )}

      {selection.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-gray-100 shadow-2xl px-5 py-3.5 flex items-center justify-between gap-3 z-30">
          <p className="text-sm font-bold" style={{ color: NAVY }}>{selection.size} {t('batiments_selectionnes')}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelection(new Set())} className="text-xs font-semibold px-3 py-2 rounded-md border border-gray-200" style={{ color: NAVY }}>
              {t('annuler')}
            </button>
            <button onClick={() => setModaleAssignerOuverte(true)}
              className="text-white px-4 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
              style={{ background: ORANGE }}>
              <i className="ti ti-user-check" /> {t('assigner_bouton')}
            </button>
          </div>
        </div>
      )}

      {modaleAssignerOuverte && (
        <ModaleAssigner
          nbBatiments={selection.size}
          techniciensDisponibles={techniciensDisponibles}
          onClose={() => setModaleAssignerOuverte(false)}
          onAssigne={assignerSelection}
          t={t}
        />
      )}
    </div>
  )
}
