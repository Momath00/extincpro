'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Fragment } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ACCENT = '#e11324'

const STATUTS: Record<string, { label: string; bg: string; color: string }> = {
  nouveau: { label: 'Nouveau', bg: '#fef2f2', color: '#e11324' },
  contacte: { label: 'Contacté', bg: '#fffbeb', color: '#b45309' },
  converti: { label: 'Converti', bg: '#f0fdf4', color: '#16a34a' },
  rejete: { label: 'Rejeté', bg: '#f1f5f9', color: '#64748b' },
}

const FILTRES = [
  { value: 'tous', label: 'Toutes' },
  { value: 'nouveau', label: 'Nouvelles' },
  { value: 'contacte', label: 'Contactées' },
  { value: 'converti', label: 'Converties' },
  { value: 'rejete', label: 'Rejetées' },
]

// Progression linéaire du traitement d'une demande — "rejeté" est un état
// à part (accessible depuis n'importe quelle étape), pas une 4e étape de la ligne.
const ETAPES = [
  { key: 'nouveau', label: 'Nouveau', icon: 'ti-inbox', color: '#e11324' },
  { key: 'contacte', label: 'Contacté', icon: 'ti-phone-outgoing', color: '#d97706' },
  { key: 'converti', label: 'Converti', icon: 'ti-circle-check', color: '#16a34a' },
]

function Progression({
  statut,
  disabled,
  onChange,
}: {
  statut: string
  disabled: boolean
  onChange: (statut: string) => void
}) {
  if (statut === 'rejete') {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: STATUTS.rejete.bg, color: STATUTS.rejete.color }}>
          <i className="ti ti-circle-x text-sm" /> Rejeté
        </span>
        <button
          disabled={disabled}
          onClick={() => onChange('nouveau')}
          className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          Réactiver
        </button>
      </div>
    )
  }

  const idx = ETAPES.findIndex(e => e.key === statut)

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center">
        {ETAPES.map((etape, i) => {
          const reached = i <= idx
          const isCurrent = i === idx
          return (
            <Fragment key={etape.key}>
              {i > 0 && (
                <div
                  className="w-6 sm:w-10 h-0.5 transition-colors"
                  style={{ background: i <= idx ? ETAPES[i - 1].color : '#e5e7eb' }}
                />
              )}
              <button
                disabled={disabled}
                onClick={() => onChange(etape.key)}
                title={etape.label}
                className="flex flex-col items-center gap-1 group disabled:opacity-50"
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: reached ? etape.color : '#f1f5f9',
                    color: reached ? '#fff' : '#94a3b8',
                    boxShadow: isCurrent ? `0 0 0 3px ${etape.color}33` : 'none',
                  }}
                >
                  <i className={`ti ${etape.icon} text-sm`} />
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide hidden sm:block"
                  style={{ color: reached ? etape.color : '#94a3b8' }}
                >
                  {etape.label}
                </span>
              </button>
            </Fragment>
          )
        })}
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange('rejete')}
        title="Rejeter cette demande"
        className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
      >
        <i className="ti ti-circle-x text-lg" />
      </button>
    </div>
  )
}

export default function DemandesEssaiPage() {
  const router = useRouter()
  const [demandes, setDemandes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('tous')
  const [maj, setMaj] = useState<number | null>(null)

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    fetch(`${API_URL}/api/demandes-essai/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        setDemandes(Array.isArray(data) ? data : (data.results || []))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

  async function changerStatut(id: number, statut: string) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    setMaj(id)
    try {
      const res = await fetch(`${API_URL}/api/demandes-essai/${id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDemandes(prev => prev.map(d => (d.id === id ? updated : d)))
      }
    } finally {
      setMaj(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const visibles = filtre === 'tous' ? demandes : demandes.filter(d => d.statut === filtre)
  const nbNouvelles = demandes.filter(d => d.statut === 'nouveau').length

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Demandes d&apos;essai</h1>
          <p className="text-gray-400 text-sm mt-1">
            {demandes.length} demande{demandes.length !== 1 ? 's' : ''} reçue{demandes.length !== 1 ? 's' : ''} via le site vitrine
            {nbNouvelles > 0 && (
              <span className="ml-2 font-semibold inline-flex items-center gap-1" style={{ color: ACCENT }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
                {nbNouvelles} nouvelle{nbNouvelles !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTRES.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltre(f.value)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={
              filtre === f.value
                ? { background: NAVY, color: '#fff' }
                : { background: '#f1f5f9', color: '#64748b' }
            }
          >
            {f.label}
            {f.value !== 'tous' && (
              <span className="ml-1.5 opacity-60">{demandes.filter(d => d.statut === f.value).length}</span>
            )}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-md border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Aucune demande pour ce filtre.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibles.map((d: any) => {
            const statutInfo = STATUTS[d.statut] || STATUTS.nouveau
            return (
              <div
                key={d.id}
                className="bg-white rounded-md border p-5 transition-colors"
                style={{ borderColor: d.statut === 'nouveau' ? '#fecaca' : '#f1f5f9', borderLeftWidth: 3, borderLeftColor: statutInfo.color }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ background: statutInfo.color }}
                  >
                    {d.nom_complet?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold" style={{ color: NAVY }}>{d.nom_complet}</p>
                      {d.entreprise && <span className="text-sm text-gray-400">· {d.entreprise}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
                      <a href={`mailto:${d.email}`} className="hover:underline" style={{ color: ACCENT }}>
                        <i className="ti ti-mail mr-1" />{d.email}
                      </a>
                      {d.telephone && (
                        <span><i className="ti ti-phone mr-1" />{d.telephone}</span>
                      )}
                      <span>
                        <i className="ti ti-clock mr-1" />
                        {new Date(d.date_creation).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-3 leading-relaxed">{d.message}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end overflow-x-auto min-w-0">
                  <Progression
                    statut={d.statut}
                    disabled={maj === d.id}
                    onChange={statut => changerStatut(d.id, statut)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
