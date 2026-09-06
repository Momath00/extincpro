'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Pagination from '@/components/dashboard/Pagination'
import { downloadHtml, downloadFichier as downloadFile } from '@/lib/download'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'
const PAGE_SIZE = 25

type Certificat = {
  cle: string
  type: 'incendie' | 'extincteur'
  type_display: string
  numero: string
  date_emission: string
  certificat_envoye: boolean
  mode_envoi: 'direct' | 'citoyen' | ''
  date_envoi: string | null
  envoye_a: string
  conforme: boolean
  adresse: string
  client_nom: string
  client_id: number
  rapport_id: number
  statut_rapport: string
  url_rapport: string
  url_certificat_pdf: string
}

type TriChamp = 'date_emission' | 'numero' | 'client_nom' | 'adresse'

export default function CertificatsPage() {
  const router = useRouter()
  const t = useT()
  const TYPE_BADGE: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    incendie: { label: t('incendie'), bg: '#eef2ff', color: '#4338ca', icon: 'ti-clipboard-check' },
    extincteur: { label: t('extincteur_eclairage'), bg: '#fff2e8', color: '#9a4a13', icon: 'ti-fire-extinguisher' },
  }
  const [certificats, setCertificats] = useState<Certificat[]>([])
  const [count, setCount] = useState(0)
  const [compteurs, setCompteurs] = useState({ total: 0, envoyes: 0, conformes: 0, non_conformes: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const [rechercheDebouncee, setRechercheDebouncee] = useState('')
  const [typeFiltre, setTypeFiltre] = useState<'tous' | 'incendie' | 'extincteur'>('tous')
  const [statutFiltre, setStatutFiltre] = useState<'tous' | 'envoye' | 'non_envoye'>('tous')
  const [conformiteFiltre, setConformiteFiltre] = useState<'tous' | 'oui' | 'non'>('tous')
  const [tri, setTri] = useState<{ champ: TriChamp; direction: 'asc' | 'desc' }>({ champ: 'date_emission', direction: 'desc' })
  const [exporting, setExporting] = useState(false)
  const [menuOuvert, setMenuOuvert] = useState<{ cle: string; top: number; right: number } | null>(null)
  const [renvoiPhase, setRenvoiPhase] = useState<'idle' | 'envoi' | 'succes' | 'erreur'>('idle')
  const [renvoiMessage, setRenvoiMessage] = useState('')

  function chargerCompteurs() {
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/certificats/compteurs/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data) setCompteurs(data) })
      .catch(() => {})
  }

  function parametresFiltres() {
    const params = new URLSearchParams({ page: String(page), tri: tri.champ, direction: tri.direction })
    if (typeFiltre !== 'tous') params.set('type', typeFiltre)
    if (statutFiltre !== 'tous') params.set('statut', statutFiltre)
    if (conformiteFiltre !== 'tous') params.set('conforme', conformiteFiltre)
    if (rechercheDebouncee.trim()) params.set('recherche', rechercheDebouncee.trim())
    return params
  }

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    setLoading(true)
    fetch(`${API_URL}/api/certificats/?${parametresFiltres()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (data) {
          setCertificats(data.results || [])
          setCount(data.count ?? 0)
        }
      })
      .finally(() => setLoading(false))
    chargerCompteurs()
  }

  useEffect(() => { charger() }, [page, typeFiltre, statutFiltre, conformiteFiltre, rechercheDebouncee, tri])

  useEffect(() => {
    const id = setTimeout(() => setRechercheDebouncee(recherche), 300)
    return () => clearTimeout(id)
  }, [recherche])

  const premierRendu = useRef(true)
  useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return }
    setPage(1)
  }, [typeFiltre, statutFiltre, conformiteFiltre, rechercheDebouncee, tri])

  function toggleMenu(e: React.MouseEvent, cle: string) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuOuvert(prev => (prev?.cle === cle ? null : { cle, top: rect.bottom + 4, right: window.innerWidth - rect.right }))
  }

  async function renvoyer(c: Certificat) {
    setMenuOuvert(null)
    setRenvoiPhase('envoi')
    const token = localStorage.getItem('access_token')
    const base = c.type === 'incendie' ? 'rapports' : 'rapports-extincteurs'
    const res = await fetch(`${API_URL}/api/${base}/${c.rapport_id}/renvoyer-certificat/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      setRenvoiMessage(d.message || t('certificat_envoye_toast'))
      setRenvoiPhase('succes')
      charger()
      setTimeout(() => setRenvoiPhase('idle'), 2800)
    } else {
      setRenvoiMessage(d.error || t('erreur_envoi'))
      setRenvoiPhase('erreur')
    }
  }

  const filtres = certificats

  function trierPar(champ: TriChamp) {
    setTri(prev => prev.champ === champ ? { champ, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { champ, direction: 'asc' })
  }

  async function exporter() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (typeFiltre !== 'tous') params.set('type', typeFiltre)
      if (statutFiltre !== 'tous') params.set('statut', statutFiltre)
      if (conformiteFiltre !== 'tous') params.set('conforme', conformiteFiltre)
      if (recherche.trim()) params.set('recherche', recherche.trim())
      await downloadFile(`${API_URL}/api/certificats/excel/?${params.toString()}`, 'Certificats.xlsx')
    } finally {
      setExporting(false)
    }
  }

  const nbEnvoyes = compteurs.envoyes
  const nbConformes = compteurs.conformes
  const nbNonConformes = compteurs.non_conformes

  const TriIcone = ({ champ }: { champ: TriChamp }) => (
    <i className={`ti ${tri.champ !== champ ? 'ti-arrows-sort text-gray-300' : tri.direction === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending'} text-xs ml-1`}
      style={tri.champ === champ ? { color: ORANGE } : undefined} />
  )

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{t('titre_certificats')}</h1>
          <p className="text-gray-400 text-sm mt-1">{compteurs.total} {t('certificat').toLowerCase()}{compteurs.total !== 1 ? 's' : ''} {t('certificats_sous_titre')}</p>
        </div>
        <button
          onClick={exporter}
          disabled={exporting || compteurs.total === 0}
          className="text-sm font-bold px-4 py-2.5 rounded-md border-2 flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50 flex-shrink-0"
          style={{ borderColor: NAVY, color: NAVY }}
        >
          <i className="ti ti-file-spreadsheet" /> {exporting ? t('export_en_cours') : t('exporter_excel')}
        </button>
      </div>

      {/* Sommaire */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: t('stat_total'), value: compteurs.total, bg: NAVY, color: '#fff', icon: 'ti-certificate' },
          { label: t('stat_envoyes'), value: nbEnvoyes, bg: '#e9f6f2', color: '#0d6b4f', icon: 'ti-mail-check' },
          { label: t('stat_conformes'), value: nbConformes, bg: '#dcfce7', color: '#16a34a', icon: 'ti-check' },
          { label: t('stat_non_conformes'), value: nbNonConformes, bg: nbNonConformes > 0 ? '#fee2e2' : '#f8fafc', color: nbNonConformes > 0 ? '#e11324' : '#94a3b8', icon: 'ti-alert-triangle' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-md border border-gray-100 p-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
              <i className={`ti ${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: NAVY }}>{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <div className="relative flex-1 lg:max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm" />
          <input
            type="text"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder={t('numero_placeholder')}
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-100 rounded-md focus:outline-none focus:border-[#e11324] bg-white"
          />
          {recherche && (
            <button onClick={() => setRecherche('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <i className="ti ti-x text-xs" />
            </button>
          )}
        </div>

        <div className="flex gap-1 p-1 rounded-md border border-gray-100 bg-white">
          {([
            { key: 'tous', label: t('tous_types') },
            { key: 'incendie', label: t('incendie') },
            { key: 'extincteur', label: t('extincteur') },
          ] as { key: typeof typeFiltre; label: string }[]).map(f => (
            <button key={f.key} onClick={() => setTypeFiltre(f.key)}
              className="px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
              style={{ background: typeFiltre === f.key ? NAVY : 'transparent', color: typeFiltre === f.key ? '#fff' : '#6b7280' }}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 p-1 rounded-md border border-gray-100 bg-white">
          {([
            { key: 'tous', label: t('tous_statuts') },
            { key: 'envoye', label: t('envoyes') },
            { key: 'non_envoye', label: t('non_envoyes') },
          ] as { key: typeof statutFiltre; label: string }[]).map(f => (
            <button key={f.key} onClick={() => setStatutFiltre(f.key)}
              className="px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
              style={{ background: statutFiltre === f.key ? NAVY : 'transparent', color: statutFiltre === f.key ? '#fff' : '#6b7280' }}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 p-1 rounded-md border border-gray-100 bg-white">
          {([
            { key: 'tous', label: t('conformite_filtre') },
            { key: 'oui', label: t('stat_conformes') },
            { key: 'non', label: t('non_conformes_filtre') },
          ] as { key: typeof conformiteFiltre; label: string }[]).map(f => (
            <button key={f.key} onClick={() => setConformiteFiltre(f.key)}
              className="px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
              style={{ background: conformiteFiltre === f.key ? NAVY : 'transparent', color: conformiteFiltre === f.key ? '#fff' : '#6b7280' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      {filtres.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-100 p-12 text-center">
          <i className="ti ti-certificate-off text-4xl text-gray-200" />
          <p className="mt-3 text-sm text-gray-400">{t('aucun_certificat')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => trierPar('numero')}>
                    {t('col_numero')} <TriIcone champ="numero" />
                  </th>
                  <th className="text-left px-4 py-3">{t('col_type')}</th>
                  <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => trierPar('adresse')}>
                    {t('adresse')} <TriIcone champ="adresse" />
                  </th>
                  <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => trierPar('client_nom')}>
                    {t('client')} <TriIcone champ="client_nom" />
                  </th>
                  <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => trierPar('date_emission')}>
                    {t('col_emis_le')} <TriIcone champ="date_emission" />
                  </th>
                  <th className="text-center px-4 py-3">{t('col_conformite')}</th>
                  <th className="text-center px-4 py-3">{t('col_envoye')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtres.map(c => {
                  const badge = TYPE_BADGE[c.type]
                  return (
                    <tr key={c.cle} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold" style={{ color: NAVY }}>{c.numero}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap"
                          style={{ background: badge.bg, color: badge.color }}>
                          <i className={`ti ${badge.icon} text-[11px]`} /> {c.type_display || badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <Link href={c.url_rapport} className="truncate block hover:underline" style={{ color: NAVY }} title={c.adresse}>
                          {c.adresse}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.client_nom}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(c.date_emission).toLocaleDateString('fr-CA', { dateStyle: 'medium' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                          style={c.conforme
                            ? { background: '#dcfce7', color: '#16a34a' }
                            : { background: '#fee2e2', color: '#e11324' }}>
                          {c.conforme ? t('conforme_badge') : t('non_conforme_badge')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.certificat_envoye ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={c.mode_envoi === 'direct'
                              ? { color: ORANGE, background: '#fef2f2' }
                              : { color: '#16a34a', background: '#f0fdf4' }}
                            title={[
                              c.date_envoi ? `${t('envoye_le')} ${new Date(c.date_envoi).toLocaleDateString('fr-CA', { dateStyle: 'long' })}` : '',
                              c.envoye_a ? `${t('destinataire')} : ${c.envoye_a}` : '',
                            ].filter(Boolean).join(' — ')}
                          >
                            <i className={`ti ${c.mode_envoi === 'direct' ? 'ti-mail-forward' : 'ti-user-check'} text-[11px]`} />
                            {c.mode_envoi === 'direct' ? t('badge_envoi_direct') : t('badge_envoye_citoyen')}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => downloadHtml(`${API_URL}${c.url_certificat_pdf}`)}
                            title={t('telecharger_certificat_titre')}
                            className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-[#e11324] hover:bg-orange-50 transition-colors"
                          >
                            <i className="ti ti-certificate text-sm" />
                          </button>
                          <button
                            onClick={(e) => toggleMenu(e, c.cle)}
                            title={t('plus_actions')}
                            className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-[#0a0b0d] hover:bg-gray-100 transition-colors"
                          >
                            <i className="ti ti-dots-vertical text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />

      {menuOuvert && (() => {
        const c = certificats.find(x => x.cle === menuOuvert.cle)
        if (!c) return null
        return (
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setMenuOuvert(null)} />
            <div className="fixed z-[91] bg-white rounded-md border border-gray-100 shadow-lg py-1 w-56"
              style={{ top: menuOuvert.top, right: menuOuvert.right }}>
              <Link
                href={c.url_rapport}
                onClick={() => setMenuOuvert(null)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: NAVY }}
              >
                <i className="ti ti-arrow-up-right text-gray-400" /> {t('voir_rapport_titre')}
              </Link>
              {c.certificat_envoye && (
                <button
                  onClick={() => renvoyer(c)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
                  style={{ color: NAVY }}
                >
                  <i className="ti ti-refresh text-gray-400" /> {t('renvoyer_certificat_action')}
                </button>
              )}
            </div>
          </>
        )
      })()}

      {renvoiPhase !== 'idle' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          onClick={() => renvoiPhase === 'erreur' && setRenvoiPhase('idle')}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            {renvoiPhase === 'envoi' && (
              <>
                <div className="w-14 h-14 rounded-full mx-auto mb-4 animate-spin"
                  style={{ border: '4px solid #fde3cc', borderTopColor: ORANGE }} />
                <p className="text-sm font-bold" style={{ color: NAVY }}>{t('envoi_en_cours')}</p>
              </>
            )}
            {renvoiPhase === 'succes' && (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#e9f6f2' }}>
                  <i className="ti ti-check text-2xl" style={{ color: '#0d6b4f' }} />
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: '#0d6b4f' }}>{t('envoi_reussi_titre')}</p>
                <p className="text-xs text-gray-500">{renvoiMessage}</p>
              </>
            )}
            {renvoiPhase === 'erreur' && (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#fef2f2' }}>
                  <i className="ti ti-x text-2xl" style={{ color: ORANGE }} />
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: ORANGE }}>{t('envoi_echec_titre')}</p>
                <p className="text-xs text-gray-500 mb-4">{renvoiMessage}</p>
                <button onClick={() => setRenvoiPhase('idle')}
                  className="text-sm font-semibold px-4 py-2 rounded-md border border-gray-200" style={{ color: NAVY }}>
                  {t('fermer')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
