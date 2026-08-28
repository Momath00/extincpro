'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ACCENT = '#e11324'

export default function OrganisationsPage() {
  const router = useRouter()
  const [organisations, setOrganisations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    fetch(`${API_URL}/api/organisations/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        setOrganisations(Array.isArray(data) ? data : (data.results || []))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Organisations</h1>
          <p className="text-gray-400 text-sm mt-1">{organisations.length} organisation{organisations.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/super-admin/organisations/nouveau"
          className="text-center text-white px-4 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity"
          style={{ background: ACCENT }}
        >
          <i className="ti ti-plus mr-1" /> Nouvelle organisation
        </Link>
      </div>

      {organisations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-md border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Aucune organisation pour le moment.</p>
          <Link href="/super-admin/organisations/nouveau" className="text-sm font-bold hover:underline mt-2 inline-block" style={{ color: ACCENT }}>
            Créer le premier client →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-400">Organisation</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-400">Utilisateurs</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-400">Modules actifs</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-400">Statut</th>
              </tr>
            </thead>
            <tbody>
              {organisations.map((o: any) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/super-admin/organisations/${o.id}`)}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm transition-transform group-hover:scale-105"
                        style={{ background: `linear-gradient(135deg, ${NAVY}, #1e293b)` }}
                      >
                        {o.nom[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold" style={{ color: NAVY }}>{o.nom}</p>
                        <p className="text-xs text-gray-400 truncate">{o.adresse || o.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{o.nb_utilisateurs}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {(o.modules || []).map((m: any) => (
                        <span
                          key={m.code}
                          title={m.nom}
                          className="w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ background: m.actif ? '#fef2f2' : '#f1f5f9', color: m.actif ? ACCENT : '#cbd5e1' }}
                        >
                          <i className={`ti ${m.code === 'rapport_incendie' ? 'ti-clipboard-check' : 'ti-fire-extinguisher'} text-xs`} />
                        </span>
                      ))}
                      <span className="text-xs text-gray-400 ml-1">
                        {o.modules?.filter((m: any) => m.actif).length || 0} / {o.modules?.length || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1.5"
                      style={{ background: o.est_active ? '#f0fdf4' : '#fef2f2', color: o.est_active ? '#16a34a' : '#e11324' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: o.est_active ? '#16a34a' : '#e11324' }} />
                      {o.est_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
