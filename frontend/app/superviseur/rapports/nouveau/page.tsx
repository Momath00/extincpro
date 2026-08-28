'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clientColor } from '@/lib/clientColor'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

export default function NouveauRapportPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [batiments, setBatiments] = useState<any[]>([])
  const [citoyens, setCitoyens] = useState<any[]>([])
  const [techniciens, setTechniciens] = useState<any[]>([])

  const [clientId, setClientId] = useState('')
  const [batimentId, setBatimentId] = useState('')
  const [citoyenId, setCitoyenId] = useState('')
  const [technicienIds, setTechnicienIds] = useState<number[]>([])
  const [dateInspection, setDateInspection] = useState('')

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
    ]).then(async ([clientsRes, citRes, techRes]) => {
      const [clientsData, citData, techData] = await Promise.all([clientsRes.json(), citRes.json(), techRes.json()])
      setClients(Array.isArray(clientsData) ? clientsData : (clientsData.results || []))
      setCitoyens(Array.isArray(citData) ? citData : (citData.results || []))
      setTechniciens(Array.isArray(techData) ? techData : (techData.results || []))
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
    if (!batimentId) { setError('Choisissez un bâtiment.'); return }
    if (!dateInspection) { setError("La date d'inspection est obligatoire."); return }
    setSubmitting(true)
    setError('')
    try {
      const t = token()
      const res = await fetch(`${API_URL}/api/rapports/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          batiment: Number(batimentId),
          citoyen: citoyenId ? Number(citoyenId) : null,
          techniciens: technicienIds,
          date_inspection: dateInspection || null,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || (Object.values(data) as any[])?.[0]?.[0] || 'Erreur lors de la création.')
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
        <i className="ti ti-arrow-left" /> Retour aux rapports
      </Link>
      <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>Nouveau rapport</h1>
      <p className="text-gray-400 text-sm mb-8">Les fiches E1 et E2 seront créées automatiquement, prêtes à être remplies.</p>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-md mb-6 border border-red-100">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Étape 1 — Client */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            1. Client
          </label>
          {clients.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun client — <Link href="/superviseur/clients" className="underline" style={{ color: ORANGE }}>créez-en un d'abord</Link>.</p>
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

        {/* Étape 2 — Bâtiment (dynamique) */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            2. Bâtiment
          </label>
          {!clientId ? (
            <p className="text-xs text-gray-300 italic">Choisissez d'abord un client</p>
          ) : loadingBatiments ? (
            <p className="text-xs text-gray-400">Chargement des bâtiments...</p>
          ) : batiments.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun bâtiment pour ce client — <Link href="/superviseur/batiments" className="underline" style={{ color: ORANGE }}>ajoutez-en un</Link>.</p>
          ) : (
            <select
              value={batimentId}
              onChange={e => setBatimentId(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
              required
            >
              <option value="">— Sélectionner —</option>
              {batiments.map((b: any) => (
                <option key={b.id} value={b.id}>{b.adresse_complete}</option>
              ))}
            </select>
          )}
        </div>

        {/* Étape 3 — Citoyen */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            3. Citoyen <span className="text-gray-300 normal-case font-normal">(optionnel)</span>
          </label>
          <select
            value={citoyenId}
            onChange={e => setCitoyenId(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
          >
            <option value="">— Aucun —</option>
            {citoyens.map((c: any) => (
              <option key={c.id} value={c.id}>{c.username} — {c.email}</option>
            ))}
          </select>
        </div>

        {/* Étape 4 — Techniciens (plusieurs) */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            4. Technicien(s) assigné(s)
          </label>
          {techniciens.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun technicien — invitez-en un depuis la page Équipe.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {techniciens.map((t: any) => {
                const checked = technicienIds.includes(t.id)
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggleTechnicien(t.id)}
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
                      <p className="text-sm font-medium truncate" style={{ color: NAVY }}>{t.username}</p>
                      {t.permis_recq && <p className="text-xs text-gray-400">Permis R.E.C.Q. {t.permis_recq}</p>}
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
            5. Date d'inspection prévue <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={dateInspection}
            onChange={e => setDateInspection(e.target.value)}
            required
            className="w-full sm:w-64 border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
          />
          <p className="text-xs text-gray-400 mt-1.5">Obligatoire — sert au filtre « aujourd'hui » du technicien.</p>
        </div>

        <button
          type="submit"
          disabled={submitting || !batimentId || !dateInspection}
          className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-40 transition-opacity"
          style={{ background: ORANGE }}
        >
          {submitting ? 'Création...' : 'Créer le rapport'}
        </button>
      </form>
    </div>
  )
}