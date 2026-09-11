'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { secteurColor } from '@/lib/secteurColor'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

type Technicien = { id: number; username: string }
type BatimentVisite = {
  batiment_id: number
  rapport_id: number
  adresse: string
  secteur: string
  client_nom: string
  type: string
  label_cle: string
  techniciens: Technicien[]
}
type Equipe = { techniciens: Technicien[]; batiments: BatimentVisite[] }
type VisiteJour = { date: string; total: number; equipes: Equipe[] }

// ── Ligne d'une adresse, avec réassignation de techniciens spécifiques ───
// Permet de subdiviser une équipe (ex. 5 techniciens sur toute la journée)
// en assignant chaque adresse à un sous-ensemble précis — un clic ici, et
// cette adresse rejoindra une autre équipe (ou en formera une nouvelle) au
// prochain chargement.
function LigneVisite({
  b, techniciensDisponibles, t, onReassigne,
}: {
  b: BatimentVisite
  techniciensDisponibles: Technicien[]
  t: (c: string) => string
  onReassigne: (rapportId: number, type: string, techniciens: number[]) => void
}) {
  const col = secteurColor(b.secteur)
  const [edition, setEdition] = useState(false)
  const [selection, setSelection] = useState<number[]>(b.techniciens.map(tech => tech.id))

  function toggle(id: number) {
    setSelection(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="rounded-md px-2 py-1.5" style={{ background: '#f8fafc' }}>
      <div className="flex items-center gap-2">
        <i className="ti ti-map-pin text-[12px] flex-shrink-0" style={{ color: col.bg }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate" style={{ color: NAVY }}>{b.adresse}</p>
          <p className="text-[11px] text-gray-400 truncate">{b.client_nom} · {t(b.label_cle)}</p>
        </div>
        {b.secteur && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: col.light, color: col.bg }}>
            {b.secteur}
          </span>
        )}
      </div>
      <button onClick={() => setEdition(v => !v)} title={b.techniciens.map(tech => tech.username).join(', ')}
        className="mt-1.5 ml-[20px] max-w-[calc(100%-20px)] text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full truncate transition-colors hover:opacity-80"
        style={{ background: '#f1f5f9', color: NAVY }}>
        {b.techniciens.length ? b.techniciens.map(tech => tech.username).join(', ') : t('non_assigne')}
      </button>
      {edition && (
        <div className="mt-2 pt-2 border-t border-gray-100">
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
            <button onClick={() => setEdition(false)} className="flex-1 text-[11px] font-semibold py-1.5 rounded border border-gray-200" style={{ color: NAVY }}>
              {t('annuler')}
            </button>
            <button onClick={() => { onReassigne(b.rapport_id, b.type, selection); setEdition(false) }}
              className="flex-1 text-[11px] font-bold py-1.5 rounded text-white" style={{ background: ORANGE }}>
              {t('enregistrer')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Carte d'une journée de visites — une seule par date, avec ses
// équipes (groupes de techniciens différents) affichées à l'intérieur ────
function CarteJour({
  jour, techniciensDisponibles, t, onReassigne,
}: {
  jour: VisiteJour
  techniciensDisponibles: Technicien[]
  t: (c: string) => string
  onReassigne: (rapportId: number, type: string, techniciens: number[]) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const plusieursEquipes = jour.equipes.length > 1

  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button onClick={() => setOuvert(v => !v)} type="button"
        className="w-full flex items-center justify-between gap-2 flex-wrap p-3.5 text-left hover:bg-gray-50/70 transition-colors">
        <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: NAVY }}>
          <i className={`ti ti-chevron-right text-xs transition-transform duration-150 ${ouvert ? 'rotate-90' : ''}`} style={{ color: '#94a3b8' }} />
          <i className="ti ti-calendar-event text-[13px]" style={{ color: ORANGE }} />
          {new Date(jour.date + 'T00:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
          <span className="text-xs font-normal text-gray-300">· {jour.total}</span>
        </p>
        {!plusieursEquipes && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: '#f1f5f9', color: NAVY }}>
            <i className="ti ti-user text-[10px]" />
            {jour.equipes[0]?.techniciens.length ? jour.equipes[0].techniciens.map(tech => tech.username).join(', ') : t('non_assigne')}
          </span>
        )}
        {plusieursEquipes && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: '#f1f5f9', color: NAVY }}>
            <i className="ti ti-users text-[10px]" />
            {jour.equipes.length} {t('equipes_label')}
          </span>
        )}
      </button>
      {ouvert && (
        <div className="px-3.5 pb-3.5 flex flex-col gap-4">
          {jour.equipes.map((equipe, i) => (
            <div key={i}>
              {plusieursEquipes && (
                <div className="flex items-center gap-2 mb-1.5">
                  <i className="ti ti-user text-[11px] flex-shrink-0" style={{ color: NAVY }} />
                  <p className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: NAVY }}>
                    {equipe.techniciens.length ? equipe.techniciens.map(tech => tech.username).join(', ') : t('non_assigne')}
                    <span className="text-gray-300 font-normal normal-case"> · {equipe.batiments.length}</span>
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                {equipe.batiments.map(b => (
                  <LigneVisite key={`${b.batiment_id}-${b.type}`} b={b} techniciensDisponibles={techniciensDisponibles} t={t} onReassigne={onReassigne} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VisitesPlanifieesPage() {
  const router = useRouter()
  const t = useT()
  const [visites, setVisites] = useState<VisiteJour[]>([])
  const [techniciensDisponibles, setTechniciensDisponibles] = useState<Technicien[]>([])
  const [recherche, setRecherche] = useState('')
  const [loading, setLoading] = useState(true)

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    const headers = { Authorization: `Bearer ${token}` }
    // Ne montre l'écran de chargement plein-page qu'au tout premier appel —
    // sinon chaque réassignement remplace toute la liste par le spinner,
    // ce qui fait revenir la page en haut à chaque action.
    if (visites.length === 0) setLoading(true)
    Promise.all([
      fetch(`${API_URL}/api/planification/planifiees/`, { headers }).then(res => (res.status === 401 ? (router.push('/login'), null) : res.json())),
      fetch(`${API_URL}/api/utilisateurs/?role=technicien`, { headers }).then(res => (res.status === 401 ? null : res.json())),
    ]).then(([visitesData, techData]) => {
      if (visitesData) setVisites(visitesData.visites || [])
      if (techData) setTechniciensDisponibles(Array.isArray(techData) ? techData : (techData.results || []))
    }).finally(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

  async function reassigner(rapportId: number, type: string, techniciens: number[]) {
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/calendrier/${type}/${rapportId}/reassigner/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ techniciens }),
    })
    charger()
  }

  const r = recherche.trim().toLowerCase()
  const visitesFiltrees = r
    ? visites
        .map(jour => ({
          ...jour,
          equipes: jour.equipes
            .map(equipe => ({ ...equipe, batiments: equipe.batiments.filter(b => `${b.adresse} ${b.client_nom} ${b.secteur}`.toLowerCase().includes(r)) }))
            .filter(equipe => equipe.batiments.length > 0),
        }))
        .filter(jour => jour.equipes.length > 0)
    : visites

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{t('visites_planifiees_titre')}</h1>
        <p className="text-gray-400 text-sm mt-1">{t('visites_planifiees_sous_titre')}</p>
      </div>

      {visites.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <i className="ti ti-search text-[13px] text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder={t('rechercher_placeholder')}
            className="w-full border border-gray-200 rounded-md pl-8 pr-2.5 py-2 text-xs focus:outline-none focus:border-[#e11324]" />
        </div>
      )}

      {visitesFiltrees.length === 0 ? (
        <p className="text-sm text-gray-300 italic">{visites.length === 0 ? t('aucune_visite_planifiee') : t('aucun_resultat_filtre')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visitesFiltrees.map(jour => (
            <CarteJour key={jour.date} jour={jour} techniciensDisponibles={techniciensDisponibles} t={t} onReassigne={reassigner} />
          ))}
        </div>
      )}
    </div>
  )
}
