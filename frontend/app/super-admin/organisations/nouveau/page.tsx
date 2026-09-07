'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ACCENT = '#e11324'

function dateDansNJours(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function NouvelleOrganisationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const demandeId = searchParams.get('demande')

  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [dateFinEssai, setDateFinEssai] = useState(dateDansNJours(30))
  const [demandeNom, setDemandeNom] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    if (!demandeId) return
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/demandes-essai/${demandeId}/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return
        setNom(data.entreprise || data.nom_complet || '')
        setDemandeNom(data.nom_complet || '')
      })
  }, [demandeId])

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    if (!nom.trim()) { setErreur('Le nom est obligatoire.'); return }

    setEnvoi(true)
    const token = localStorage.getItem('access_token')
    try {
      const res = await fetch(`${API_URL}/api/organisations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nom: nom.trim(), adresse: adresse.trim(), date_fin_essai: dateFinEssai || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErreur(data.nom?.[0] || data.error || 'Erreur lors de la création.')
        setEnvoi(false)
        return
      }
      if (demandeId) {
        await fetch(`${API_URL}/api/demandes-essai/${demandeId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ statut: 'converti', organisation_creee: data.id }),
        })
      }
      router.push(`/super-admin/organisations/${data.id}`)
    } catch {
      setErreur('Erreur réseau.')
      setEnvoi(false)
    }
  }

  return (
    <div className="max-w-lg">
      <Link href="/super-admin/organisations" className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Retour aux organisations
      </Link>
      <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>Nouvelle organisation</h1>
      <p className="text-gray-400 text-sm mb-6">Les modules seront créés désactivés — à activer ensuite depuis la fiche de l'organisation.</p>

      {demandeId && (
        <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-md border text-sm" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <i className="ti ti-inbox flex-shrink-0" style={{ color: '#2563eb' }} />
          <span style={{ color: NAVY }}>
            Pré-rempli à partir de la demande d'essai de <strong>{demandeNom || `#${demandeId}`}</strong>.
          </span>
        </div>
      )}

      <form onSubmit={creer} className="bg-white rounded-md border border-gray-100 p-6 flex flex-col gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Nom de la compagnie</label>
          <input
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Ex. Protection Incendie Laurentides"
            className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Adresse <span className="normal-case font-normal text-gray-300">(optionnel)</span></label>
          <input
            type="text"
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
            placeholder="Ex. 123 rue Principale, Montréal, QC"
            className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
          />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
            Fin de l'essai gratuit <span className="normal-case font-normal text-gray-300">(vide = client payant, pas d'essai)</span>
          </label>
          <input
            type="date"
            value={dateFinEssai}
            onChange={e => setDateFinEssai(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
          />
          <p className="text-[11px] text-gray-300 mt-1">Un courriel d'avis sera envoyé automatiquement 7 jours avant cette date.</p>
        </div>

        {erreur && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ti ti-alert-triangle" /> {erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi}
          className="w-full text-white py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {envoi ? 'Création…' : "Créer l'organisation"}
        </button>
      </form>
    </div>
  )
}
