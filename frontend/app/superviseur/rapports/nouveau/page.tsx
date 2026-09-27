'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

export default function NouveauRapportPage() {
  const router = useRouter()
  const t = useT()
  const [clients, setClients] = useState<any[]>([])
  const [batiments, setBatiments] = useState<any[]>([])
  const [citoyens, setCitoyens] = useState<any[]>([])
  const [techniciens, setTechniciens] = useState<any[]>([])

  const [clientId, setClientId] = useState('')
  const [batimentId, setBatimentId] = useState('')
  const [citoyenId, setCitoyenId] = useState('')
  const [technicienIds, setTechnicienIds] = useState<number[]>([])
  const [dateInspection, setDateInspection] = useState('')
  const [avecExtincteur, setAvecExtincteur] = useState(false)
  const [avecEclairageUrgence, setAvecEclairageUrgence] = useState(false)
  const [avecGicleur, setAvecGicleur] = useState(false)
  const [modulesActifs, setModulesActifs] = useState<string[]>([])

  const [loadingBatiments, setLoadingBatiments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function token() {
    const t = localStorage.getItem('access_token')
    if (!t) router.push('/login')
    return t
  }

  useEffect(() => {
    const t = token()
    if (!t) return
    const headers = { Authorization: `Bearer ${t}` }

    Promise.all([
      fetch(`${API_URL}/api/clients/`, { headers }),
      fetch(`${API_URL}/api/utilisateurs/?role=citoyen`, { headers }),
      fetch(`${API_URL}/api/utilisateurs/?role=technicien`, { headers }),
      fetch(`${API_URL}/api/me/`, { headers }),
    ]).then(async ([clientsRes, citRes, techRes, meRes]) => {
      const [clientsData, citData, techData] = await Promise.all([clientsRes.json(), citRes.json(), techRes.json()])
      setClients(Array.isArray(clientsData) ? clientsData : (clientsData.results || []))
      setCitoyens(Array.isArray(citData) ? citData : (citData.results || []))
      setTechniciens(Array.isArray(techData) ? techData : (techData.results || []))
      if (meRes.ok) {
        const me = await meRes.json()
        setModulesActifs(me?.organisation?.modules_actifs || [])
      }
    })
  }, [])

  // Bâtiments dynamiques — se recharge à chaque changement de client
  useEffect(() => {
    if (!clientId) { setBatiments([]); setBatimentId(''); return }
    setLoadingBatiments(true)
    const t = token()
    fetch(`${API_URL}/api/batiments/?client=${clientId}`, { headers: { Authorization: `Bearer ${t}` } })
      .then(res => res.json())
      .then(data => {
        const liste = Array.isArray(data) ? data : (data.results || [])
        setBatiments(liste)
        setBatimentId('')
        setLoadingBatiments(false)
      })
      .catch(() => setLoadingBatiments(false))
  }, [clientId])

  function toggleTechnicien(id: number) {
    setTechnicienIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batimentId) { setError(t('choisissez_batiment_erreur')); return }
    if (!dateInspection) { setError(t('date_inspection_obligatoire_erreur')); return }
    setSubmitting(true)
    setError('')
    try {
      const tok = token()
      const res = await fetch(`${API_URL}/api/rapports/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          batiment: Number(batimentId),
          citoyen: citoyenId ? Number(citoyenId) : null,
          techniciens: technicienIds,
          date_inspection: dateInspection || null,
          avec_extincteur: avecExtincteur,
          avec_eclairage_urgence: avecEclairageUrgence,
          avec_gicleur: avecGicleur,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || (Object.values(data) as any[])?.[0]?.[0] || t('erreur_creation'))
      router.push(`/superviseur/rapports/${data.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/superviseur/rapports" className="text-xs text-gray-400 hover:text-[#0a0b0d] flex items-center gap-1 mb-4">
        <i className="ti ti-arrow-left" /> {t('retour_aux_rapports')}
      </Link>
      <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>{t('nouveau_rapport')}</h1>
      <p className="text-gray-400 text-sm mb-8">{t('fiches_e1_e2_sous_titre')}</p>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-md mb-6 border border-red-100">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Étape 1 — Client */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            {t('etape_client')}
          </label>
          {clients.length === 0 ? (
            <p className="text-xs text-gray-400">{t('aucun_client')}<Link href="/superviseur/clients" className="underline" style={{ color: ORANGE }}>{t('creez_en_un_dabord')}</Link>.</p>
          ) : (
            <SearchableSelect
              options={clients.map((c: any) => ({
                id: c.id,
                label: c.nom,
                sublabel: `${c.nb_batiments ?? 0} ${t('batiments_minuscule')}${c.contact_nom ? ` · ${c.contact_nom}` : ''}`,
              }))}
              value={clientId}
              onChange={setClientId}
              placeholder={t('combo_rechercher_client')}
              vide={t('combo_choisir_client')}
            />
          )}
        </div>

        {/* Étape 2 — Bâtiment (dynamique) */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            {t('etape_batiment')}
          </label>
          {!clientId ? (
            <p className="text-xs text-gray-300 italic">{t('choisissez_client_dabord')}</p>
          ) : loadingBatiments ? (
            <p className="text-xs text-gray-400">{t('chargement_batiments')}</p>
          ) : batiments.length === 0 ? (
            <p className="text-xs text-gray-400">{t('aucun_batiment_client')}<Link href="/superviseur/batiments" className="underline" style={{ color: ORANGE }}>{t('ajoutez_en_un')}</Link>.</p>
          ) : (
            <SearchableSelect
              options={batiments.map((b: any) => ({ id: b.id, label: b.adresse_complete, sublabel: b.code_postal || undefined }))}
              value={batimentId}
              onChange={setBatimentId}
              placeholder={t('combo_rechercher_batiment')}
              vide={t('combo_choisir_batiment')}
            />
          )}
        </div>

        {/* Étape 3 — Citoyen */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            {t('etape_citoyen')} <span className="text-gray-300 normal-case font-normal">{t('optionnel')}</span>
          </label>
          <SearchableSelect
              options={[{ id: '', label: t('aucun_tiret') }, ...citoyens.map((c: any) => ({ id: c.id, label: c.username, sublabel: c.email }))]}
              value={citoyenId}
              onChange={setCitoyenId}
              placeholder={t('combo_rechercher_contact')}
              vide={t('aucun_tiret')}
            />
        </div>

        {/* Étape 4 — Techniciens (plusieurs) */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            {t('etape_technicien_4')}
          </label>
          {techniciens.length === 0 ? (
            <p className="text-xs text-gray-400">{t('aucun_technicien')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {techniciens.map((tech: any) => {
                const checked = technicienIds.includes(tech.id)
                return (
                  <button
                    type="button"
                    key={tech.id}
                    onClick={() => toggleTechnicien(tech.id)}
                    className="flex items-center gap-3 p-3 rounded-md border-2 text-left transition-colors"
                    style={{ borderColor: checked ? ORANGE : '#0a0b0d', background: checked ? '#fff2e8' : '#fff' }}
                  >
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2"
                      style={{ borderColor: checked ? ORANGE : '#0a0b0d', background: checked ? ORANGE : 'transparent' }}
                    >
                      {checked && <i className="ti ti-check text-white text-xs" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: NAVY }}>{tech.username}</p>
                      {tech.permis_recq && <p className="text-xs text-gray-400">{t('permis_recq')} {tech.permis_recq}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Étape 5 — Date */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            {t('etape_date_inspection_prevue_5')} <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={dateInspection}
            onChange={e => setDateInspection(e.target.value)}
            required
            className="w-full sm:w-64 border-2 border-[#0a0b0d] rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
          />
          <p className="text-xs text-gray-400 mt-1.5">{t('note_date_obligatoire_filtre')}</p>
        </div>

        {modulesActifs.includes('rapport_extincteur') && (
          <button
            type="button"
            onClick={() => setAvecExtincteur(v => !v)}
            className="flex items-start gap-3 p-3 rounded-md border-2 text-left transition-colors"
            style={{ borderColor: avecExtincteur ? ORANGE : '#0a0b0d', background: avecExtincteur ? '#fff2e8' : '#fff' }}
          >
            <span
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 mt-0.5"
              style={{ borderColor: avecExtincteur ? ORANGE : '#0a0b0d', background: avecExtincteur ? ORANGE : 'transparent' }}
            >
              {avecExtincteur && <i className="ti ti-check text-white text-xs" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>{t('gic_avec_extincteur')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('lie_avec_extincteur_desc')}</p>
            </div>
          </button>
        )}

        {modulesActifs.includes('rapport_eclairage_urgence') && (
          <button
            type="button"
            onClick={() => setAvecEclairageUrgence(v => !v)}
            className="flex items-start gap-3 p-3 rounded-md border-2 text-left transition-colors"
            style={{ borderColor: avecEclairageUrgence ? ORANGE : '#0a0b0d', background: avecEclairageUrgence ? '#fff2e8' : '#fff' }}
          >
            <span
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 mt-0.5"
              style={{ borderColor: avecEclairageUrgence ? ORANGE : '#0a0b0d', background: avecEclairageUrgence ? ORANGE : 'transparent' }}
            >
              {avecEclairageUrgence && <i className="ti ti-check text-white text-xs" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>{t('gic_avec_eclairage')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{avecExtincteur ? t('gic_avec_eclairage_desc') : t('gic_avec_eclairage_seul_desc')}</p>
            </div>
          </button>
        )}

        {modulesActifs.includes('rapport_gicleur') && (
          <button
            type="button"
            onClick={() => setAvecGicleur(v => !v)}
            className="flex items-start gap-3 p-3 rounded-md border-2 text-left transition-colors"
            style={{ borderColor: avecGicleur ? ORANGE : '#0a0b0d', background: avecGicleur ? '#fff2e8' : '#fff' }}
          >
            <span
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 mt-0.5"
              style={{ borderColor: avecGicleur ? ORANGE : '#0a0b0d', background: avecGicleur ? ORANGE : 'transparent' }}
            >
              {avecGicleur && <i className="ti ti-check text-white text-xs" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>{t('lie_avec_gicleur')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('lie_avec_gicleur_desc')}</p>
            </div>
          </button>
        )}

        <button
          type="submit"
          disabled={submitting || !batimentId || !dateInspection}
          className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-40 transition-opacity"
          style={{ background: ORANGE }}
        >
          {submitting ? t('creation_en_cours') : t('creer_le_rapport')}
        </button>
      </form>
    </div>
  )
}