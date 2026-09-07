'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

const STYLES: Record<string, { bg: string; color: string; dot: string; icon: string }> = {
  incendie: { bg: '#eef2ff', color: '#4338ca', dot: '#6366f1', icon: 'ti-clipboard-check' },
  extincteur: { bg: '#fff2e8', color: '#9a4a13', dot: '#f97316', icon: 'ti-fire-extinguisher' },
  eclairage: { bg: '#ecfeff', color: '#0e7490', dot: '#06b6d4', icon: 'ti-bulb' },
  cuisine: { bg: '#faf5ff', color: '#7e22ce', dot: '#a855f7', icon: 'ti-tools-kitchen-2' },
}

// Couleur de catégorie — indépendante du module, pour distinguer une visite
// planifiée d'avance (bleu), un rappel de conformité (rouge) et un rappel en
// retard (rouge foncé, plus alarmant), peu importe le type de rapport
// concerné. Appliquée en anneau autour du point du module.
const COULEUR_CATEGORIE: Record<'planifie' | 'rappel' | 'en_retard', string> = {
  planifie: '#2563eb',
  rappel: '#e11324',
  en_retard: '#7f1d1d',
}

type Evenement = {
  cle: string
  type: 'incendie' | 'extincteur' | 'eclairage' | 'cuisine'
  categorie: 'rappel' | 'planifie' | 'en_retard'
  date: string
  adresse: string
  client_nom: string
  client_contact_nom: string
  client_telephone: string
  rapport_id: number
  url_rapport: string
  api_base: string
  techniciens: { id: number; username: string }[]
}

type Vue = 'mois' | 'semaine' | 'jour'

function labelType(type: string, t: (c: string) => string) {
  return type === 'incendie' ? t('titre_rapport_incendie')
    : type === 'extincteur' ? t('titre_rapport_extincteur')
    : type === 'eclairage' ? t('titre_rapport_eclairage')
    : t('systeme_cuisine')
}

function infoCategorie(categorie: 'rappel' | 'planifie' | 'en_retard', t: (c: string) => string) {
  if (categorie === 'planifie') return { icon: 'ti-calendar-event', label: t('categorie_planifiee') }
  if (categorie === 'en_retard') return { icon: 'ti-alert-triangle', label: t('categorie_en_retard') }
  return { icon: 'ti-bell', label: t('categorie_rappel') }
}

function debutSemaine(d: Date) {
  const jour = (d.getDay() + 6) % 7 // lundi = 0
  const r = new Date(d)
  r.setDate(d.getDate() - jour)
  return r
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Carte d'un événement (réutilisée dans le panneau et la vue jour), avec
// réassignation des techniciens sans quitter le calendrier. ──
function CarteEvenement({
  e, t, techniciensDisponibles, onReassigne,
}: {
  e: Evenement
  t: (c: string) => string
  techniciensDisponibles: { id: number; username: string }[]
  onReassigne: () => void
}) {
  const s = STYLES[e.type]
  const [edition, setEdition] = useState<'techniciens' | 'date' | null>(null)
  const [selection, setSelection] = useState<number[]>(e.techniciens.map(tech => tech.id))
  const [nouvelleDate, setNouvelleDate] = useState(e.date)
  const [sauvegarde, setSauvegarde] = useState(false)

  function toggle(id: number) {
    setSelection(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function sauvegarder() {
    setSauvegarde(true)
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/calendrier/${e.type}/${e.rapport_id}/reassigner/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ techniciens: selection }),
    })
    setSauvegarde(false)
    setEdition(null)
    onReassigne()
  }

  async function sauvegarderDate() {
    setSauvegarde(true)
    const token = localStorage.getItem('access_token')
    const champ = e.categorie === 'planifie' ? 'date_inspection' : 'prochaine_inspection'
    await fetch(`${API_URL}/api/${e.api_base}/${e.rapport_id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [champ]: nouvelleDate }),
    })
    setSauvegarde(false)
    setEdition(null)
    onReassigne()
  }

  const couleurCat = COULEUR_CATEGORIE[e.categorie]
  const fondCat = e.categorie === 'planifie' ? '#eff6ff' : e.categorie === 'en_retard' ? '#fee2e2' : '#fef2f2'
  const cat = infoCategorie(e.categorie, t)

  return (
    <div className="rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      style={{ borderLeft: `3px solid ${couleurCat}` }}>
      <Link href={e.url_rapport} className="block p-3.5">
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap"
            style={{ background: s.bg, color: s.color }}>
            <i className={`ti ${s.icon} text-[11px]`} />
            {labelType(e.type, t)}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap"
            style={{ background: fondCat, color: couleurCat }}>
            <i className={`ti ${cat.icon} text-[11px]`} />
            {cat.label}
          </span>
        </div>
        <div className="flex items-start gap-1.5">
          <i className="ti ti-map-pin text-[13px] mt-0.5 flex-shrink-0" style={{ color: NAVY }} />
          <p className="text-sm font-bold leading-snug" style={{ color: NAVY }}>{e.adresse}</p>
        </div>
        <div className="mt-1.5 flex flex-col gap-1 pl-[19px]">
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <i className="ti ti-building text-[12px] text-gray-300" /> {e.client_nom}
            {e.client_contact_nom && <span className="text-gray-300">· {e.client_contact_nom}</span>}
          </p>
          {e.client_telephone && (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <i className="ti ti-phone text-[12px] text-gray-300" /> {e.client_telephone}
            </p>
          )}
        </div>
      </Link>

      <div className="px-3.5 py-2.5 bg-gray-50/70 border-t border-gray-100">
        {edition === null && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <i className="ti ti-user text-[12px] text-gray-300 flex-shrink-0" />
              <span className="text-xs text-gray-500 truncate">
                {e.techniciens.length ? e.techniciens.map(tech => tech.username).join(', ') : t('non_assigne')}
              </span>
            </div>
            <button onClick={() => { setNouvelleDate(e.date); setEdition('date') }}
              className="inline-flex items-center gap-1 text-[11px] font-bold flex-shrink-0 px-2.5 py-1.5 rounded-md border transition-colors hover:bg-white"
              style={{ color: NAVY, borderColor: '#e5e7eb' }}>
              <i className="ti ti-calendar-due text-[12px]" />
              {t('modifier_date_inspection')}
            </button>
            <button onClick={() => setEdition('techniciens')}
              className="inline-flex items-center gap-1 text-[11px] font-bold flex-shrink-0 px-2.5 py-1.5 rounded-md border transition-colors hover:bg-white"
              style={{ color: ORANGE, borderColor: '#fecaca' }}>
              <i className="ti ti-user-plus text-[12px]" />
              {t('reassigner_techniciens')}
            </button>
          </div>
        )}

        {edition === 'techniciens' && (
          <div>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto mb-2">
              {techniciensDisponibles.map(tech => {
                const checked = selection.includes(tech.id)
                return (
                  <button key={tech.id} type="button" onClick={() => toggle(tech.id)}
                    className="flex items-center gap-2 p-1.5 rounded text-left transition-colors"
                    style={{ background: checked ? '#fff2e8' : 'transparent' }}>
                    <span className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border-2"
                      style={{ borderColor: checked ? ORANGE : '#d1d5db', background: checked ? ORANGE : 'transparent' }}>
                      {checked && <i className="ti ti-check text-white text-[9px]" />}
                    </span>
                    <span className="text-xs" style={{ color: NAVY }}>{tech.username}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setEdition(null)} className="flex-1 text-[11px] font-semibold py-1.5 rounded border border-gray-200" style={{ color: NAVY }}>
                {t('annuler')}
              </button>
              <button onClick={sauvegarder} disabled={sauvegarde} className="flex-1 text-[11px] font-bold py-1.5 rounded text-white disabled:opacity-50" style={{ background: ORANGE }}>
                {sauvegarde ? t('sauvegarde_en_cours') : t('enregistrer')}
              </button>
            </div>
          </div>
        )}

        {edition === 'date' && (
          <div>
            <p className="text-[11px] text-gray-400 mb-2">{t('modifier_date_inspection_note')}</p>
            <input type="date" value={nouvelleDate} onChange={ev => setNouvelleDate(ev.target.value)}
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs mb-2 focus:outline-none focus:border-[#e11324]" />
            <div className="flex gap-1.5">
              <button onClick={() => setEdition(null)} className="flex-1 text-[11px] font-semibold py-1.5 rounded border border-gray-200" style={{ color: NAVY }}>
                {t('annuler')}
              </button>
              <button onClick={sauvegarderDate} disabled={sauvegarde} className="flex-1 text-[11px] font-bold py-1.5 rounded text-white disabled:opacity-50" style={{ background: NAVY }}>
                {sauvegarde ? t('sauvegarde_en_cours') : t('enregistrer')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modale "Planifier une inspection" ────────────────────────────────────
function ModalePlanifier({
  dateInitiale,
  onClose,
  onCree,
}: {
  dateInitiale: string
  onClose: () => void
  onCree: () => void
}) {
  const t = useT()
  const [typeRapport, setTypeRapport] = useState<'incendie' | 'extincteur'>('extincteur')
  const [clients, setClients] = useState<any[]>([])
  const [batiments, setBatiments] = useState<any[]>([])
  const [techniciens, setTechniciens] = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const [batimentId, setBatimentId] = useState('')
  const [technicienIds, setTechnicienIds] = useState<number[]>([])
  const [dateInspection, setDateInspection] = useState(dateInitiale)
  const [avecSystemeCuisine, setAvecSystemeCuisine] = useState(false)
  const [moduleCuisineActif, setModuleCuisineActif] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API_URL}/api/clients/`, { headers }),
      fetch(`${API_URL}/api/utilisateurs/?role=technicien`, { headers }),
      fetch(`${API_URL}/api/me/`, { headers }),
    ]).then(async ([cRes, tRes, meRes]) => {
      const [cData, tData] = await Promise.all([cRes.json(), tRes.json()])
      setClients(Array.isArray(cData) ? cData : (cData.results || []))
      setTechniciens(Array.isArray(tData) ? tData : (tData.results || []))
      if (meRes.ok) {
        const me = await meRes.json()
        const modulesActifs: string[] = me?.organisation?.modules_actifs || []
        setModuleCuisineActif(modulesActifs.includes('rapport_cuisine'))
      }
    })
  }, [])

  useEffect(() => {
    if (!clientId) { setBatiments([]); setBatimentId(''); return }
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/batiments/?client=${clientId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { setBatiments(Array.isArray(data) ? data : (data.results || [])); setBatimentId('') })
  }, [clientId])

  function toggleTechnicien(id: number) {
    setTechnicienIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function planifier(e: React.FormEvent) {
    e.preventDefault()
    if (!batimentId) { setError(t('choisissez_batiment_erreur')); return }
    setSubmitting(true)
    setError('')
    const token = localStorage.getItem('access_token')
    const base = typeRapport === 'incendie' ? 'rapports' : 'rapports-extincteurs'
    try {
      const res = await fetch(`${API_URL}/api/${base}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          batiment: Number(batimentId),
          techniciens: technicienIds,
          date_inspection: dateInspection,
          avec_systeme_cuisine: avecSystemeCuisine,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((Object.values(data) as any[])?.[0]?.[0] || t('erreur_generique'))
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
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('planifier_inspection_titre')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><i className="ti ti-x text-lg" /></button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">{error}</div>}

        <form onSubmit={planifier} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('type_rapport_label')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['extincteur', 'incendie'] as const).map(type => (
                <button key={type} type="button" onClick={() => { setTypeRapport(type); if (type === 'incendie') setAvecSystemeCuisine(false) }}
                  className="text-sm font-semibold px-3 py-2.5 rounded-md border-2 transition-colors"
                  style={typeRapport === type ? { borderColor: ORANGE, background: '#fff2e8', color: NAVY } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {type === 'incendie' ? t('titre_rapport_incendie') : t('titre_rapport_extincteur')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('etape_client')}</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} required
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]">
              <option value="">{t('selectionner')}</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('etape_batiment')}</label>
            <select value={batimentId} onChange={e => setBatimentId(e.target.value)} required disabled={!clientId}
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324] disabled:bg-gray-50">
              <option value="">{t('selectionner')}</option>
              {batiments.map((b: any) => <option key={b.id} value={b.id}>{b.adresse_complete}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('etape_date_inspection_5')}</label>
            <input type="date" value={dateInspection} onChange={e => setDateInspection(e.target.value)} required
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('etape_technicien_4')} <span className="text-gray-300 normal-case font-normal">{t('optionnel')}</span></label>
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
              {techniciens.map((tech: any) => {
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

          {moduleCuisineActif && typeRapport === 'extincteur' && (
            <button
              type="button"
              onClick={() => setAvecSystemeCuisine(v => !v)}
              className="flex items-start gap-3 p-3 rounded-md border-2 text-left transition-colors"
              style={{ borderColor: avecSystemeCuisine ? ORANGE : '#e5e7eb', background: avecSystemeCuisine ? '#fff2e8' : '#fff' }}
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 mt-0.5"
                style={{ borderColor: avecSystemeCuisine ? ORANGE : '#d1d5db', background: avecSystemeCuisine ? ORANGE : 'transparent' }}
              >
                {avecSystemeCuisine && <i className="ti ti-check text-white text-xs" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: NAVY }}>{t('avec_systeme_cuisine_label')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('avec_systeme_cuisine_desc')}</p>
              </div>
            </button>
          )}

          <button type="submit" disabled={submitting}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-50 mt-2"
            style={{ background: ORANGE }}>
            {submitting ? t('creation_en_cours') : t('planifier_bouton')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function CalendrierPage() {
  const router = useRouter()
  const t = useT()
  const aujourdhui = new Date()
  const [vue, setVue] = useState<Vue>('mois')
  const [dateRef, setDateRef] = useState(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate()))
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [loading, setLoading] = useState(true)
  const [jourSelectionne, setJourSelectionne] = useState<string | null>(null)
  const [modalePlanifier, setModalePlanifier] = useState<string | null>(null)
  const [techniciensDisponibles, setTechniciensDisponibles] = useState<{ id: number; username: string }[]>([])
  const [filtreCategorie, setFiltreCategorie] = useState<'tous' | 'planifie' | 'rappel' | 'en_retard'>('tous')
  const panelJourRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (jourSelectionne) panelJourRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [jourSelectionne])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    fetch(`${API_URL}/api/utilisateurs/?role=technicien`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setTechniciensDisponibles(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => {})
  }, [])

  // Plage de dates couverte par la vue courante (pour savoir quels mois aller chercher)
  const { debut, fin } = (() => {
    if (vue === 'jour') return { debut: new Date(dateRef), fin: new Date(dateRef) }
    if (vue === 'semaine') {
      const d = debutSemaine(dateRef)
      const f = new Date(d); f.setDate(d.getDate() + 6)
      return { debut: d, fin: f }
    }
    const d = new Date(dateRef.getFullYear(), dateRef.getMonth(), 1)
    const f = new Date(dateRef.getFullYear(), dateRef.getMonth() + 1, 0)
    return { debut: d, fin: f }
  })()

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    setLoading(true)
    const moisAChercher = new Set<string>()
    moisAChercher.add(`${debut.getFullYear()}-${debut.getMonth() + 1}`)
    moisAChercher.add(`${fin.getFullYear()}-${fin.getMonth() + 1}`)
    Promise.all(
      [...moisAChercher].map(cle => {
        const [a, m] = cle.split('-')
        return fetch(`${API_URL}/api/calendrier/?annee=${a}&mois=${m}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => (res.status === 401 ? (router.push('/login'), null) : res.json()))
      })
    ).then(resultats => {
      const parCle = new Map<string, Evenement>()
      for (const d of resultats) {
        if (!d) continue
        for (const e of (d.evenements || [])) parCle.set(e.cle, e)
      }
      setEvenements([...parCle.values()])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { charger() }, [vue, dateRef.getFullYear(), dateRef.getMonth(), dateRef.getDate()])

  const evenementsFiltres = filtreCategorie === 'tous' ? evenements : evenements.filter(e => e.categorie === filtreCategorie)

  const parJour: Record<string, Evenement[]> = {}
  for (const e of evenementsFiltres) {
    (parJour[e.date] ||= []).push(e)
  }

  function reculer() {
    setJourSelectionne(null)
    const d = new Date(dateRef)
    if (vue === 'mois') d.setMonth(d.getMonth() - 1)
    else if (vue === 'semaine') d.setDate(d.getDate() - 7)
    else d.setDate(d.getDate() - 1)
    setDateRef(d)
  }
  function avancer() {
    setJourSelectionne(null)
    const d = new Date(dateRef)
    if (vue === 'mois') d.setMonth(d.getMonth() + 1)
    else if (vue === 'semaine') d.setDate(d.getDate() + 7)
    else d.setDate(d.getDate() + 1)
    setDateRef(d)
  }
  function allerAujourdhui() {
    setJourSelectionne(null)
    setDateRef(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate()))
  }

  const estAujourdhui = (d: Date) => iso(d) === iso(aujourdhui)
  const joursSemaine = [t('jour_lun'), t('jour_mar'), t('jour_mer'), t('jour_jeu'), t('jour_ven'), t('jour_sam'), t('jour_dim')]

  const labelPeriode = vue === 'mois'
    ? dateRef.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
    : vue === 'semaine'
      ? `${debut.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })} – ${fin.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : dateRef.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const evenementsJourSelectionne = jourSelectionne ? (parJour[jourSelectionne] || []) : []

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{t('calendrier_titre')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('calendrier_sous_titre')}</p>
        </div>
        <button
          onClick={() => setModalePlanifier(iso(dateRef))}
          className="text-white px-4 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 flex-shrink-0"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-plus" /> {t('planifier_inspection_titre')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={allerAujourdhui}
            className="text-xs font-bold px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ color: NAVY }}>
            {t('aujourdhui')}
          </button>
          <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white">
            <button onClick={reculer} className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
              <i className="ti ti-chevron-left text-sm" />
            </button>
            <span className="text-sm font-bold capitalize px-2 min-w-[160px] text-center" style={{ color: NAVY }}>{labelPeriode}</span>
            <button onClick={avancer} className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
              <i className="ti ti-chevron-right text-sm" />
            </button>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-md border border-gray-100 bg-white">
          {(['jour', 'semaine', 'mois'] as Vue[]).map(v => (
            <button key={v} onClick={() => { setVue(v); setJourSelectionne(null) }}
              className="px-3 py-1.5 rounded text-xs font-bold transition-colors capitalize"
              style={{ background: vue === v ? NAVY : 'transparent', color: vue === v ? '#fff' : '#6b7280' }}>
              {v === 'jour' ? t('vue_jour') : v === 'semaine' ? t('vue_semaine') : t('vue_mois')}
            </button>
          ))}
        </div>
      </div>

      {/* Filtre par catégorie */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex gap-1 p-1 rounded-md border border-gray-100 bg-white">
          {(['tous', 'planifie', 'rappel', 'en_retard'] as const).map(cat => (
            <button key={cat} onClick={() => setFiltreCategorie(cat)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-colors"
              style={{
                background: filtreCategorie === cat ? NAVY : 'transparent',
                color: filtreCategorie === cat ? '#fff' : (cat === 'tous' ? '#6b7280' : COULEUR_CATEGORIE[cat]),
              }}>
              {cat !== 'tous' && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: filtreCategorie === cat ? '#fff' : COULEUR_CATEGORIE[cat] }} />}
              {cat === 'tous' ? t('tous') : cat === 'planifie' ? t('categorie_planifiee') : cat === 'rappel' ? t('categorie_rappel') : t('categorie_en_retard')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-md border border-gray-100 overflow-hidden">

            {vue === 'mois' && (() => {
              const premierJourMois = new Date(dateRef.getFullYear(), dateRef.getMonth(), 1)
              const nbJoursMois = new Date(dateRef.getFullYear(), dateRef.getMonth() + 1, 0).getDate()
              const decalage = (premierJourMois.getDay() + 6) % 7
              const cases: (Date | null)[] = [
                ...Array(decalage).fill(null),
                ...Array.from({ length: nbJoursMois }, (_, i) => new Date(dateRef.getFullYear(), dateRef.getMonth(), i + 1)),
              ]
              while (cases.length % 7 !== 0) cases.push(null)
              return (
                <>
                  <div className="grid grid-cols-7 bg-slate-50 border-b border-gray-100">
                    {joursSemaine.map(j => (
                      <div key={j} className="px-1 py-2 text-center text-[10px] sm:text-xs font-black uppercase tracking-wide text-gray-400">{j}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {cases.map((d, i) => {
                      if (!d) return <div key={i} className="min-h-[60px] sm:min-h-[92px] border-b border-r border-gray-50 bg-gray-50/40" />
                      const dateStr = iso(d)
                      const evts = parJour[dateStr] || []
                      const selectionne = jourSelectionne === dateStr
                      return (
                        <button key={i} onClick={() => setJourSelectionne(selectionne ? null : dateStr)}
                          className="min-h-[60px] sm:min-h-[92px] border-b border-r border-gray-50 p-1 sm:p-1.5 text-left flex flex-col gap-1 hover:bg-gray-50 transition-colors"
                          style={selectionne ? { background: '#fff2e8' } : undefined}>
                          <span className="text-xs sm:text-sm font-semibold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full flex-shrink-0"
                            style={estAujourdhui(d) ? { background: ORANGE, color: '#fff' } : { color: NAVY }}>
                            {d.getDate()}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {evts.slice(0, 6).map(e => (
                              <span key={e.cle} className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: STYLES[e.type].dot, boxShadow: `0 0 0 1.5px ${COULEUR_CATEGORIE[e.categorie]}` }} />
                            ))}
                            {evts.length > 6 && <span className="text-[9px] text-gray-400 font-bold">+{evts.length - 6}</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )
            })()}

            {vue === 'semaine' && (() => {
              const jours = Array.from({ length: 7 }, (_, i) => { const d = new Date(debut); d.setDate(debut.getDate() + i); return d })
              return (
                <div className="grid grid-cols-7 divide-x divide-gray-50">
                  {jours.map(d => {
                    const dateStr = iso(d)
                    const evts = parJour[dateStr] || []
                    return (
                      <div key={dateStr} className="min-h-[220px]">
                        <div className="px-1.5 py-2 text-center border-b border-gray-100 bg-slate-50">
                          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{d.toLocaleDateString('fr-CA', { weekday: 'short' })}</p>
                          <p className="text-sm font-bold" style={estAujourdhui(d) ? { color: ORANGE } : { color: NAVY }}>{d.getDate()}</p>
                        </div>
                        <div className="p-1.5 flex flex-col gap-1">
                          {evts.map(e => (
                            <Link key={e.cle} href={e.url_rapport} className="block rounded px-1.5 py-1 text-[10px] font-semibold truncate"
                              style={{ background: STYLES[e.type].bg, color: STYLES[e.type].color }} title={e.adresse}>
                              {e.adresse}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {vue === 'jour' && (
              <div className="p-4 flex flex-col gap-3">
                {(parJour[iso(dateRef)] || []).length === 0 && (
                  <p className="text-sm text-gray-300 italic text-center py-10">{t('aucune_inspection_ce_jour')}</p>
                )}
                {(parJour[iso(dateRef)] || []).map(e => (
                  <CarteEvenement key={e.cle} e={e} t={t} techniciensDisponibles={techniciensDisponibles} onReassigne={charger} />
                ))}
              </div>
            )}
          </div>

          {vue === 'mois' && jourSelectionne && (
            <div ref={panelJourRef} className="bg-white rounded-md border border-gray-100 p-4 scroll-mt-4">
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: NAVY }}>
                {new Date(jourSelectionne + 'T00:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              {evenementsJourSelectionne.length === 0 ? (
                <p className="text-xs text-gray-300 italic">{t('aucune_inspection_ce_jour')}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {evenementsJourSelectionne.map(e => (
                    <CarteEvenement key={e.cle} e={e} t={t} techniciensDisponibles={techniciensDisponibles} onReassigne={charger} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {modalePlanifier && (
        <ModalePlanifier
          dateInitiale={modalePlanifier}
          onClose={() => setModalePlanifier(null)}
          onCree={charger}
        />
      )}
    </div>
  )
}
