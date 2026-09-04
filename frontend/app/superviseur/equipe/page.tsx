'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InviteModal from '@/components/dashboard/InviteModal'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

export default function EquipePage() {
  const router = useRouter()
  const t = useT()
  const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    technicien: { label: t('role_technicien'), bg: '#fff2e8', color: '#9a4a13' },
    citoyen: { label: t('role_citoyen'), bg: '#eef1f5', color: '#4b5a6a' },
    superviseur: { label: t('role_superviseur'), bg: '#fdf0e4', color: '#c2410c' },
  }
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
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{t('equipe_titre')}</h1>
          <p className="text-gray-400 text-sm mt-1">{membres.length} {t('membre_s_total')}</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="text-white px-5 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-user-plus" /> {t('inviter')}
        </button>
      </div>

      {/* Stats — pas de limites, juste des compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { key: 'tous', label: t('total_actifs'), value: membres.filter(m => m.est_actif).length, icon: 'ti-users' },
          { key: 'superviseur', label: t('superviseurs_label'), value: superviseurs.length, icon: 'ti-shield-check' },
          { key: 'technicien', label: t('techniciens_label'), value: techniciens.length, icon: 'ti-tool' },
          { key: 'citoyen', label: t('citoyens_label'), value: citoyens.length, icon: 'ti-user' },
          { key: 'inactifs', label: t('inactifs_label'), value: inactifs.length, icon: 'ti-user-off' },
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
          { key: 'tous', label: t('tous') },
          { key: 'superviseur', label: t('superviseurs_label') },
          { key: 'technicien', label: t('techniciens_label') },
          { key: 'citoyen', label: t('citoyens_label') },
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
          <p className="text-gray-300 text-sm col-span-2 text-center py-10">{t('aucun_membre_filtre')}</p>
        ) : visibles.map(m => {
          const badge = ROLE_BADGE[m.role] || ROLE_BADGE.citoyen
          return (
            <div key={m.id} className="bg-white rounded-md border border-gray-100 p-4 flex items-center gap-3 hover:shadow-md hover:border-[#e11324] transition-all duration-200">
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
                  <p className="text-xs text-gray-300">{t('permis_recq_label')} {m.permis_recq}</p>
                )}
              </div>
              <button
                onClick={() => toggleActif(m.id)}
                className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0"
                style={{ color: m.est_actif ? '#0d6b4f' : '#9ca3af' }}
                title={m.est_actif ? t('desactiver_compte') : t('reactiver_compte')}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.est_actif ? '#2fbf6e' : '#c7cfd8' }} />
                {m.est_actif ? t('actif_label') : t('inactif_label')}
              </button>
            </div>
          )
        })}
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvited={charger} />}
    </div>
  )
}
