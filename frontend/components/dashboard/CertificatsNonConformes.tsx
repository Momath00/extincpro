'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useT, useLangue } from '@/lib/i18n'

// Tableau de bord : les certificats non conformes, tous bâtiments confondus —
// les clients à relancer. Chaque ligne ouvre le dossier du bâtiment, d'où
// partent tous les envois.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const RED = '#dc2626'
const AFFICHES = 8

export default function CertificatsNonConformes() {
  const t = useT()
  const langue = useLangue()
  const [lignes, setLignes] = useState<any[] | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/certificats/?conforme=non&page=1&tri=date_emission&direction=desc`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(d => {
        const res = Array.isArray(d) ? d : d?.results || []
        setLignes(res.slice(0, AFFICHES))
        setTotal(Array.isArray(d) ? d.length : d?.count ?? res.length)
      })
      .catch(() => setLignes([]))
  }, [])

  if (!lignes || lignes.length === 0) return null

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(langue === 'en' ? 'en-CA' : 'fr-CA', { dateStyle: 'medium' })

  return (
    <div className="bg-white rounded-md border border-red-100 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-red-100 flex items-center gap-2" style={{ background: '#fef2f2' }}>
        <i className="ti ti-certificate-off text-sm" style={{ color: RED }} />
        <h2 className="text-xs font-bold uppercase tracking-widest flex-1" style={{ color: '#7f1d1d' }}>
          {t('certificats_non_conformes_titre')} ({total})
        </h2>
        <span className="text-[11px] text-gray-500 hidden sm:inline">{t('certificats_non_conformes_aide')}</span>
      </div>
      <div className="p-4 flex flex-col gap-2">
        {lignes.map(c => (
          <Link
            key={c.cle}
            href={c.batiment_id ? `/superviseur/batiments/${c.batiment_id}` : c.url_rapport}
            className="flex items-center gap-3 p-3 pl-3.5 rounded-md border-l-4 hover:shadow-sm transition-all"
            style={{ borderLeftColor: RED, background: '#fffbfb' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: NAVY }}>{c.adresse}</p>
              <p className="text-xs text-gray-500 truncate">
                {c.client_nom} · {c.type_display} · <span className="font-mono">{c.numero}</span> · {dateFmt(c.date_emission)}
              </p>
            </div>
            <span className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-xs font-bold border-2 border-[#0a0b0d] bg-white flex-shrink-0" style={{ color: NAVY }}>
              <i className="ti ti-folders text-sm" /> {t('dossier_bouton')}
            </span>
          </Link>
        ))}
        {total > lignes.length && (
          <p className="text-xs text-gray-500 text-center pt-1">
            + {total - lignes.length} {t('certificats_non_conformes_autres')}
          </p>
        )}
      </div>
    </div>
  )
}
