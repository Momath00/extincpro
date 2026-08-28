'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ACCENT = '#e11324'

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [organisations, setOrganisations] = useState<any[]>([])
  const [demandes, setDemandes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    Promise.all([
      fetch(`${API_URL}/api/organisations/`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => (res.status === 401 ? null : res.json())),
      fetch(`${API_URL}/api/demandes-essai/`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => (res.ok ? res.json() : [])),
    ])
      .then(([orgData, demandesData]) => {
        if (orgData === null) { router.push('/login'); return }
        setOrganisations(Array.isArray(orgData) ? orgData : (orgData?.results || []))
        setDemandes(Array.isArray(demandesData) ? demandesData : (demandesData?.results || []))
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

  const actives = organisations.filter(o => o.est_active).length
  const inactives = organisations.length - actives
  const totalUtilisateurs = organisations.reduce((acc, o) => acc + (o.nb_utilisateurs || 0), 0)
  const nouvellesDemandes = demandes.filter(d => d.statut === 'nouveau').length

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Tableau de bord</h1>
          <p className="text-gray-400 text-sm mt-1">Vue d'ensemble de la plateforme</p>
        </div>
        <Link
          href="/super-admin/organisations/nouveau"
          className="text-center text-white px-4 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity"
          style={{ background: ACCENT }}
        >
          <i className="ti ti-plus mr-1" /> Nouvelle organisation
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Organisations', value: organisations.length, icon: 'ti-building-skyscraper', bg: '#f1f5f9', color: NAVY, href: '/super-admin/organisations' },
          { label: 'Actives', value: actives, icon: 'ti-circle-check', bg: '#f0fdf4', color: '#16a34a' },
          { label: 'Inactives', value: inactives, icon: 'ti-circle-x', bg: '#fef2f2', color: '#e11324' },
          { label: "Nouvelles demandes", value: nouvellesDemandes, icon: 'ti-inbox', bg: nouvellesDemandes > 0 ? '#fef2f2' : '#f1f5f9', color: nouvellesDemandes > 0 ? ACCENT : NAVY, href: '/super-admin/demandes', pulse: nouvellesDemandes > 0 },
        ].map(stat => {
          const content = (
            <>
              <div className="flex justify-between items-center mb-3">
                <div className="w-9 h-9 rounded-md flex items-center justify-center relative" style={{ background: stat.bg }}>
                  <i className={`ti ${stat.icon} text-base`} style={{ color: stat.color }} />
                  {stat.pulse && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
                  )}
                </div>
              </div>
              <p className="text-3xl font-bold" style={{ color: NAVY }}>{stat.value}</p>
              <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
            </>
          )
          const className = "bg-white rounded-lg p-5 border border-gray-100 shadow-sm block" + (stat.href ? " hover:shadow-md hover:-translate-y-0.5 transition-all" : "")
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className={className}>{content}</Link>
          ) : (
            <div key={stat.label} className={className}>{content}</div>
          )
        })}
      </div>

      <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>Organisations récentes</h2>
          <Link href="/super-admin/organisations" className="text-xs font-semibold hover:underline" style={{ color: ACCENT }}>
            Voir tout →
          </Link>
        </div>
        <div className="p-4 flex flex-col gap-2">
          {organisations.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-300 text-sm mb-3">Aucune organisation pour le moment</p>
              <Link href="/super-admin/organisations/nouveau" className="text-sm font-bold hover:underline" style={{ color: ACCENT }}>
                Créer la première organisation →
              </Link>
            </div>
          ) : organisations.slice(0, 6).map((o: any) => (
            <Link
              href={`/super-admin/organisations/${o.id}`}
              key={o.id}
              className="flex items-center gap-3 p-3 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center" style={{ background: NAVY }}>
                <i className="ti ti-building-skyscraper text-white text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: NAVY }}>{o.nom}</p>
                <p className="text-xs text-gray-400 truncate">
                  {o.nb_utilisateurs} utilisateur{o.nb_utilisateurs !== 1 ? 's' : ''} · {o.modules?.filter((m: any) => m.actif).length || 0} module(s) actif(s)
                </p>
              </div>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
                style={{ background: o.est_active ? '#f0fdf4' : '#fef2f2', color: o.est_active ? '#16a34a' : '#e11324' }}
              >
                {o.est_active ? 'Active' : 'Inactive'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
