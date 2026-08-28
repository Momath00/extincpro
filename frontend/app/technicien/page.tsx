'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ACCENT = '#e11324'

const STATUT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  ouvert: { label: 'Ouvert', bg: '#fff2e8', color: '#9a4a13' },
  ferme: { label: 'Fermé', bg: '#e9f6f2', color: '#0d6b4f' },
}

export default function TechnicienDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({ total: 0, ouverts: 0, fermes: 0 })
  const [rapportsAujourdhui, setRapportsAujourdhui] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    const headers = { Authorization: `Bearer ${token}` }

    Promise.all([
      fetch(`${API_URL}/api/rapports/stats/`, { headers }),
      fetch(`${API_URL}/api/rapports/aujourdhui/`, { headers }),
    ])
      .then(async ([statsRes, aujourdhuiRes]) => {
        if (statsRes.status === 401) { router.push('/login'); return }
        const [statsData, aujourdhuiData] = await Promise.all([
          statsRes.json(),
          aujourdhuiRes.json(),
        ])
        setStats(statsData)
        const list = Array.isArray(aujourdhuiData) ? aujourdhuiData : (aujourdhuiData.results || [])
        setRapportsAujourdhui(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Tableau de bord</h1>
          <p className="text-gray-400 text-sm mt-1">
            {new Date().toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/technicien/rapports"
          className="text-center text-white px-4 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity"
          style={{ background: NAVY }}
        >
          <i className="ti ti-clipboard-list mr-1" /> Voir tous mes rapports
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Rapports assignés', value: stats.total, icon: 'ti-clipboard', bg: NAVY, color: '#fff' },
          { label: 'En cours', value: stats.ouverts, icon: 'ti-file-alert', bg: '#fff2e8', color: '#9a4a13' },
          { label: 'Terminés', value: stats.fermes, icon: 'ti-file-check', bg: '#e9f6f2', color: '#0d6b4f' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-md p-5 border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-widest">{stat.label}</span>
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: stat.bg }}>
                <i className={`ti ${stat.icon} text-sm`} style={{ color: stat.color }} />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: NAVY }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Rapports du jour */}
      <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: ACCENT }}>
              <i className="ti ti-calendar-today text-white text-sm" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
              Inspections d'aujourd'hui
            </h2>
          </div>
          <span className="text-xs text-gray-400">{rapportsAujourdhui.length} rapport{rapportsAujourdhui.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {rapportsAujourdhui.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f8f9fa' }}>
                <i className="ti ti-calendar-off text-xl text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm font-medium">Aucune inspection prévue aujourd'hui</p>
              <p className="text-gray-300 text-xs mt-1">Les rapports assignés pour aujourd'hui apparaîtront ici.</p>
            </div>
          ) : rapportsAujourdhui.map((r: any) => {
            const badge = STATUT_BADGE[r.statut] || STATUT_BADGE.ouvert
            return (
              <Link
                key={r.id}
                href={`/technicien/rapports/${r.id}`}
                className="flex items-center gap-3 p-3 rounded-md border border-gray-100 hover:shadow-md hover:border-[#e11324] transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center" style={{ background: NAVY }}>
                  <i className="ti ti-building text-white text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: NAVY }}>
                    {r.batiment?.adresse_complete || '—'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {r.batiment?.client_nom || '—'}
                    {r.date_inspection
                      ? ` · ${new Date(r.date_inspection).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                  <i className="ti ti-chevron-right text-gray-300 text-sm" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
