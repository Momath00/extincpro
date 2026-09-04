'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT, useLangue } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const RED = '#0a0b0d'
const ACCENT = '#e11324'

export default function SuperviseurDashboard() {
  const router = useRouter()
  const t = useT()
  const langue = useLangue()
  const STATUT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    ouvert: { label: t('ouvert'), bg: '#fef2f2', color: '#9a4a13' },
    ferme: { label: t('ferme'), bg: '#e9f6f2', color: '#0d6b4f' },
  }
  const MODULE_STYLES: Record<string, { href: string; icon: string; accent: string; bg: string; color: string; rowBg: string }> = {
    incendie: { href: '/superviseur/rapports', icon: 'ti-clipboard-check', accent: '#6366f1', bg: '#eef2ff', color: '#4338ca', rowBg: '#f5f6ff' },
    extincteur: { href: '/superviseur/rapports-extincteurs', icon: 'ti-fire-extinguisher', accent: '#f97316', bg: '#fff2e8', color: '#9a4a13', rowBg: '#fffaf5' },
    eclairage: { href: '/superviseur/rapports-eclairage-urgence', icon: 'ti-bulb', accent: '#06b6d4', bg: '#ecfeff', color: '#0e7490', rowBg: '#f0fdfe' },
  }
  const [rapports, setRapports] = useState<any[]>([])
  const [nbClients, setNbClients] = useState(0)
  const [nbTechniciens, setNbTechniciens] = useState(0)
  const [nbCitoyens, setNbCitoyens] = useState(0)
  const [loading, setLoading] = useState(true)

  function chargerDonnees() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    const headers = { Authorization: `Bearer ${token}` }

    const parseListe = async (res: Response) => {
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : (data.results || [])
    }

    Promise.all([
      fetch(`${API_URL}/api/rapports/`, { headers }),
      fetch(`${API_URL}/api/rapports-extincteurs/`, { headers }),
      fetch(`${API_URL}/api/rapports-eclairage-urgence/`, { headers }),
      fetch(`${API_URL}/api/clients/`, { headers }),
      fetch(`${API_URL}/api/utilisateurs/?role=technicien`, { headers }),
      fetch(`${API_URL}/api/utilisateurs/?role=citoyen`, { headers }),
    ])
      .then(async ([incendieRes, extincteurRes, eclairageRes, clientsRes, techRes, citRes]) => {
        if (extincteurRes.status === 401) { router.push('/login'); return }

        const [incendieList, extincteurList, eclairageList, clientsList, techList, citList] = await Promise.all([
          parseListe(incendieRes), parseListe(extincteurRes), parseListe(eclairageRes),
          parseListe(clientsRes), parseListe(techRes), parseListe(citRes),
        ])

        const rapportsTagged = [
          ...incendieList.map((r: any) => ({ ...r, _module: 'incendie' })),
          ...extincteurList.map((r: any) => ({ ...r, _module: 'extincteur' })),
          ...eclairageList.map((r: any) => ({ ...r, _module: 'eclairage' })),
        ]

        setRapports(rapportsTagged)
        setNbClients(clientsList.length)
        setNbTechniciens(techList.length)
        setNbCitoyens(citList.length)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    chargerDonnees()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: RED, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const ouverts = rapports.filter(r => r.statut === 'ouvert').length
  const fermes = rapports.filter(r => r.statut === 'ferme').length
  const recents = [...rapports]
    .sort((a, b) => new Date(b.date_derniere_sauvegarde || 0).getTime() - new Date(a.date_derniere_sauvegarde || 0).getTime())
    .slice(0, 6)

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: RED }}>{t('nav_dashboard')}</h1>
        <p className="text-gray-400 text-sm mt-1">
          {new Date().toLocaleDateString(langue === 'en' ? 'en-CA' : 'fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: t('stat_rapports_ouverts'), value: ouverts, icon: 'ti-file-alert', bg: '#fef2f2', color: '#e11324' },
          { label: t('stat_rapports_fermes'), value: fermes, icon: 'ti-file-check', bg: '#f0fdf4', color: '#16a34a' },
          { label: t('stat_clients_actifs'), value: nbClients, icon: 'ti-building', bg: '#f1f5f9', color: '#0a0b0d' },
          { label: t('stat_techniciens_actifs'), value: nbTechniciens, icon: 'ti-tool', bg: '#fffbeb', color: '#b45309' },
          { label: t('stat_citoyens_enregistres'), value: nbCitoyens, icon: 'ti-users', bg: '#f8fafc', color: '#475569' },
        ].map(stat => (
          <div
            key={stat.label}
            className="bg-white rounded-lg overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="h-1" style={{ background: stat.color }} />
            <div className="p-5">
              <div className="flex justify-between items-center mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: stat.bg }}>
                  <i className={`ti ${stat.icon} text-lg`} style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-3xl font-bold" style={{ color: RED }}>{stat.value}</p>
              <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rapports récents */}
      <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: RED }}>{t('rapports_recents')}</h2>
        </div>
        <div className="p-4 flex flex-col gap-2">
          {recents.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-300 text-sm mb-3">{t('aucun_rapport')}</p>
              <Link href="/superviseur/rapports-extincteurs/nouveau" className="text-sm font-bold hover:underline" style={{ color: ACCENT }}>
                {t('creer_premier_rapport')}
              </Link>
            </div>
          ) : recents.map((r: any) => {
            const badge = STATUT_BADGE[r.statut] || STATUT_BADGE.ouvert
            const mod = MODULE_STYLES[r._module] || MODULE_STYLES.extincteur
            return (
              <Link
                href={`${mod.href}/${r.id}`}
                key={`${r._module}-${r.id}`}
                className="flex items-center gap-3 p-3 pl-3.5 rounded-md border-l-4 hover:shadow-sm transition-all"
                style={{ borderLeftColor: mod.accent, background: mod.rowBg }}
              >
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: mod.bg }}>
                  <i className={`ti ${mod.icon} text-base`} style={{ color: mod.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: RED }}>
                    {r.batiment?.adresse_complete || '—'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {r.batiment?.client_nom} · {r.techniciens?.map((tc: any) => tc.username).join(', ') || t('non_assigne')}
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: badge.bg, color: badge.color }}>
                  {badge.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
