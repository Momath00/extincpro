'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InviteModal from '@/components/dashboard/InviteModal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  technicien: { label: 'Technicien', bg: '#fff2e8', color: '#9a4a13' },
  citoyen: { label: 'Citoyen', bg: '#eef1f5', color: '#4b5a6a' },
  superviseur: { label: 'Superviseur', bg: '#fdf0e4', color: '#c2410c' },
}

export default function EquipePage() {
  const router = useRouter()
  const [membres, setMembres] = useState<any[]>([])
  const [filtre, setFiltre] = useState<'tous' | 'technicien' | 'citoyen' | 'superviseur'>('tous')
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    fetch(`${API_URL}/api/utilisateurs/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        const liste = Array.isArray(data) ? data : (data.results || [])
        setMembres(liste)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

  async function toggleActif(id: number) {
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/utilisateurs/${id}/desactiver/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    charger()
  }

  const techniciens = membres.filter(m => m.role === 'technicien')
  const citoyens = membres.filter(m => m.role === 'citoyen')
  const superviseurs = membres.filter(m => m.role === 'superviseur')
  const inactifs = membres.filter(m => !m.est_actif)
  const visibles = filtre === 'tous' ? membres : membres.filter(m => m.role === filtre)

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
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Équipe</h1>
          <p className="text-gray-400 text-sm mt-1">{membres.length} membre{membres.length > 1 ? 's' : ''} au total</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="text-white px-5 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-user-plus" /> Inviter
        </button>
      </div>

      {/* Stats — pas de limites, juste des compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { key: 'tous', label: 'Total actifs', value: membres.filter(m => m.est_actif).length, icon: 'ti-users' },
          { key: 'superviseur', label: 'Superviseurs', value: superviseurs.length, icon: 'ti-shield-check' },
          { key: 'technicien', label: 'Techniciens', value: techniciens.length, icon: 'ti-tool' },
          { key: 'citoyen', label: 'Citoyens', value: citoyens.length, icon: 'ti-user' },
          { key: 'inactifs', label: 'Inactifs', value: inactifs.length, icon: 'ti-user-off' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFiltre(s.key === 'inactifs' ? 'tous' : (s.key as any))}
            className="bg-white rounded-md p-5 border text-left transition-colors"
            style={{ borderColor: filtre === s.key ? ORANGE : '#f1f3f5' }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-widest">{s.label}</span>
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: NAVY }}>
                <i className={`ti ${s.icon} text-sm text-white`} />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: NAVY }}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Filtres rapides */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'tous', label: 'Tous' },
          { key: 'superviseur', label: 'Superviseurs' },
          { key: 'technicien', label: 'Techniciens' },
          { key: 'citoyen', label: 'Citoyens' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltre(f.key as any)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: filtre === f.key ? NAVY : '#fff',
              color: filtre === f.key ? '#fff' : '#6b7280',
              border: filtre === f.key ? 'none' : '1px solid #e5e7eb',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibles.length === 0 ? (
          <p className="text-gray-300 text-sm col-span-2 text-center py-10">Aucun membre pour ce filtre</p>
        ) : visibles.map(m => {
          const badge = ROLE_BADGE[m.role] || ROLE_BADGE.citoyen
          return (
            <div key={m.id} className="bg-white rounded-md border border-gray-100 p-4 flex items-center gap-3 hover:shadow-md hover:border-[#dc2626] transition-all duration-200">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: NAVY }}
              >
                {m.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold truncate" style={{ color: NAVY }}>{m.username}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 flex items-center gap-1" style={{ background: badge.bg, color: badge.color }}>
                    <i className={`ti ${m.role === 'technicien' ? 'ti-tool' : m.role === 'superviseur' ? 'ti-shield-check' : 'ti-user'} text-[10px]`} />
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">{m.email}</p>
                {m.role === 'technicien' && m.permis_recq && (
                  <p className="text-xs text-gray-300">Permis R.E.C.Q. {m.permis_recq}</p>
                )}
              </div>
              <button
                onClick={() => toggleActif(m.id)}
                className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0"
                style={{ color: m.est_actif ? '#0d6b4f' : '#9ca3af' }}
                title={m.est_actif ? 'Désactiver ce compte' : 'Réactiver ce compte'}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.est_actif ? '#2fbf6e' : '#c7cfd8' }} />
                {m.est_actif ? 'Actif' : 'Inactif'}
              </button>
            </div>
          )
        })}
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvited={charger} />}
    </div>
  )
}