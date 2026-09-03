'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clientColor } from '@/lib/clientColor'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

export default function NouveauRapportEclairageUrgencePage() {
  const router = useRouter()
  const t = useT()
  const [clients, setClients] = useState<any[]>([])
  const [batiments, setBatiments] = useState<any[]>([])
  const [techniciens, setTechniciens] = useState<any[]>([])

  const [clientId, setClientId] = useState('')
  const [batimentId, setBatimentId] = useState('')
  const [technicienIds, setTechnicienIds] = useState<number[]>([])
  const [dateInspection, setDateInspection] = useState('')
  const [numeroJob, setNumeroJob] = useState('')

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
      fetch(`${API_URL}/api/utilisateurs/?role=technicien`, { headers }),
    ]).then(async ([clientsRes, techRes]) => {
      const [clientsData, techData] = await Promise.all([clientsRes.json(), techRes.json()])
      setClients(Array.isArray(clientsData) ? clientsData : (clientsData.results || []))
      setTechniciens(Array.isArray(techData) ? techData : (techData.results || []))
    })
  }, [])

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
    setSubmitting(true)
    setError('')
    try {
      const t = token()
      const res = await fetch(`${API_URL}/api/rapports-eclairage-urgence/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          batiment: Number(batimentId),
          techniciens: technicienIds,
          date_inspection: dateInspection || null,
          numero_job: numeroJob,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || (Object.values(data) as any[])?.[0]?.[0] || 'Erreur lors de la création.')
      router.push(`/superviseur/rapports-eclairage-urgence/${data.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/superviseur/rapports-eclairage-urgence" className="text-xs text-gray-400 hover:text-[#0a0b0d] flex items-center gap-1 mb-4">
        <i className="ti ti-arrow-left" /> {t('retour_aux_rapports')}
      </Link>
      <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>{t('titre_rapport_eclairage')}</h1>
      <p className="text-gray-400 text-sm mb-8">
        {t('nouveau_eclairage_sous_titre')}
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-md mb-6 border border-red-100">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            {t('etape_client')}
          </label>
          {clients.length === 0 ? (
            <p className="text-xs text-gray-400">{t('aucun_client')}<Link href="/superviseur/clients" className="underline" style={{ color: ORANGE }}>{t('creez_en_un_dabord')}</Link>.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {clients.map((c: any) => {
                const col = clientColor(c.id)
                const selected = clientId === String(c.id)
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setClientId(String(c.id))}
                    className="flex items-center gap-3 p-3 rounded-md border-2 text-left transition-colors"
                    style={{ borderColor: selected ? col.bg : '#e5e7eb', background: selected ? col.light : '#fff' }}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: col.bg }} />
                    <span className="text-sm font-medium truncate" style={{ color: NAVY }}>{c.nom}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

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
            <select
              value={batimentId}
              onChange={e => setBatimentId(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
              required
            >
              <option value="">{t('selectionner')}</option>
              {batiments.map((b: any) => (
                <option key={b.id} value={b.id}>{b.adresse_complete}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            {t('etape_technicien')}
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
                    style={{ borderColor: checked ? ORANGE : '#e5e7eb', background: checked ? '#fff2e8' : '#fff' }}
                  >
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2"
                      style={{ borderColor: checked ? ORANGE : '#d1d5db', background: checked ? ORANGE : 'transparent' }}
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

        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            {t('etape_date_inspection')}
          </label>
          <input
            type="date"
            value={dateInspection}
            onChange={e => setDateInspection(e.target.value)}
            className="w-full sm:w-64 border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
          />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            {t('etape_numero_job')} <span className="text-gray-300 normal-case font-normal">{t('optionnel')}</span>
          </label>
          <input
            type="text"
            value={numeroJob}
            onChange={e => setNumeroJob(e.target.value)}
            className="w-full sm:w-64 border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !batimentId}
          className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-40 transition-opacity"
          style={{ background: ORANGE }}
        >
          {submitting ? t('creation_en_cours') : t('creer_le_rapport')}
        </button>
      </form>
    </div>
  )
}
