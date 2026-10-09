'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clientColor } from '@/lib/clientColor'
import Pagination from '@/components/dashboard/Pagination'
import { useT } from '@/lib/i18n'
import { CHAMP } from '@/lib/styles'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'
const PAGE_SIZE = 25

function ClientModal({ client, onClose, onSaved }: { client: any; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  // Entreprise (ex. Actionéo) ou particulier (ex. propriétaire d'une maison).
  const [typeClient, setTypeClient] = useState<'entreprise' | 'particulier'>(client?.type_client || 'entreprise')
  const [nom, setNom] = useState(client?.type_client === 'particulier' ? '' : client?.nom || '')
  const [prenom, setPrenom] = useState(client?.prenom || '')
  const [nomFamille, setNomFamille] = useState(client?.nom_famille || '')
  const [contactNom, setContactNom] = useState(client?.contact_nom || '')
  const [email, setEmail] = useState(client?.contact_email || '')
  const [telephone, setTelephone] = useState(client?.contact_telephone || '')
  const [adresse, setAdresse] = useState(client?.adresse || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const particulier = typeClient === 'particulier'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('access_token')
      const url = client ? `${API_URL}/api/clients/${client.id}/` : `${API_URL}/api/clients/`
      const res = await fetch(url, {
        method: client ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type_client: typeClient,
          ...(particulier ? { prenom, nom_famille: nomFamille } : { nom, contact_nom: contactNom }),
          contact_email: email, contact_telephone: telephone, adresse,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) {
        const brut = data.error ?? (Object.values(data) as any[])?.[0]
        throw new Error((Array.isArray(brut) ? brut[0] : brut) || 'Erreur.')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const etiquette = 'text-xs font-bold uppercase tracking-widest mb-1.5 block'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>
            {client ? t('modifier_client') : t('nouveau_client')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Type de client */}
          <div>
            <label className={etiquette} style={{ color: NAVY }}>{t('type_client')}</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { cle: 'entreprise', icone: 'ti-building', libelle: t('type_entreprise'), aide: t('type_entreprise_aide') },
                { cle: 'particulier', icone: 'ti-user', libelle: t('type_particulier'), aide: t('type_particulier_aide') },
              ] as const).map(o => {
                const actif = typeClient === o.cle
                return (
                  <button key={o.cle} type="button" onClick={() => setTypeClient(o.cle)} aria-pressed={actif}
                    className="text-left rounded-lg border-2 px-3 py-2.5 shadow-sm transition-all"
                    style={actif ? { borderColor: NAVY, background: NAVY, color: '#fff' } : { borderColor: '#94a3b8', background: '#f8fafc', color: NAVY }}>
                    <span className="flex items-center gap-1.5 text-sm font-extrabold">
                      <i className={`ti ${o.icone} text-base`} /> {o.libelle}
                    </span>
                    <span className={`block text-[11px] leading-snug mt-0.5 ${actif ? 'text-white/70' : 'text-gray-500'}`}>{o.aide}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {particulier ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={etiquette} style={{ color: NAVY }}>{t('prenom_label')}</label>
                <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Jean" className={CHAMP} required />
              </div>
              <div>
                <label className={etiquette} style={{ color: NAVY }}>{t('nom_label')}</label>
                <input value={nomFamille} onChange={e => setNomFamille(e.target.value)} placeholder="Tremblay" className={CHAMP} required />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className={etiquette} style={{ color: NAVY }}>{t('nom_entreprise')}</label>
                <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Actionéo" className={CHAMP} required />
              </div>
              <div>
                <label className={etiquette} style={{ color: NAVY }}>{t('personne_ressource')}</label>
                <input value={contactNom} onChange={e => setContactNom(e.target.value)} placeholder="Jean Dupont" className={CHAMP} />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiquette} style={{ color: NAVY }}>{t('email_label')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder={particulier ? 'jean.tremblay@courriel.com' : 'contact@entreprise.com'} className={CHAMP} />
            </div>
            <div>
              <label className={etiquette} style={{ color: NAVY }}>{t('telephone_label')}</label>
              <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="514-000-0000" className={CHAMP} />
            </div>
          </div>
          <div>
            <label className={etiquette} style={{ color: NAVY }}>{t('adresse_label')}</label>
            <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="123 rue Principale, Montréal, QC" className={CHAMP} />
          </div>

          <button type="submit" disabled={loading}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-50 mt-2"
            style={{ background: ORANGE }}>
            {loading ? t('enregistrement_en_cours') : client ? t('enregistrer') : t('creer_le_client')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ClientsPage() {
  const router = useRouter()
  const t = useT()
  const [clients, setClients] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const [rechercheDebouncee, setRechercheDebouncee] = useState('')
  const [filtreType, setFiltreType] = useState<'' | 'entreprise' | 'particulier'>('')
  const [modalClient, setModalClient] = useState<any>(undefined)
  const [supprimerId, setSupprimerId] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  function chargerCompteurs() {
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/clients/compteurs/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data) setTotal(data.total) })
      .catch(() => {})
  }

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    const params = new URLSearchParams({ page: String(page) })
    if (rechercheDebouncee.trim()) params.set('q', rechercheDebouncee.trim())
    if (filtreType) params.set('type', filtreType)
    fetch(`${API_URL}/api/clients/?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        setClients(data.results || [])
        setCount(data.count ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    chargerCompteurs()
  }

  useEffect(() => { charger() }, [page, rechercheDebouncee, filtreType])

  useEffect(() => {
    const id = setTimeout(() => setRechercheDebouncee(recherche), 300)
    return () => clearTimeout(id)
  }, [recherche])

  useEffect(() => { setPage(1) }, [rechercheDebouncee, filtreType])

  async function supprimer(id: number) {
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/clients/${id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setSupprimerId(null)
    setSuccessMsg(t('client_supprime'))
    setTimeout(() => setSuccessMsg(''), 2000)
    charger()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      {successMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border border-green-100 px-5 py-3.5">
          <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
            <i className="ti ti-check text-green-600 text-sm" />
          </div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>{successMsg}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{t('clients_titre')}</h1>
          <p className="text-gray-400 text-sm mt-1">{total} {t('entreprise_cliente')}</p>
        </div>
        <button
          onClick={() => setModalClient(null)}
          className="text-white px-5 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-plus" /> {t('nouveau_client')}
        </button>
      </div>

      {total > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm" />
          <input
            type="text"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder={t('rechercher_placeholder')}
            className="w-full pl-8 pr-8 py-2 text-sm border-2 border-[#0a0b0d] rounded-md focus:outline-none focus:border-[#e11324] bg-white"
          />
          {recherche && (
            <button onClick={() => setRecherche('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <i className="ti ti-x text-xs" />
            </button>
          )}
        </div>
        <div className="flex gap-1 p-1 rounded-lg border border-gray-300 bg-gray-100 w-fit">
          {([
            { cle: '', libelle: t('tous'), icone: '' },
            { cle: 'entreprise', libelle: t('filtre_entreprises'), icone: 'ti-building' },
            { cle: 'particulier', libelle: t('filtre_particuliers'), icone: 'ti-user' },
          ] as const).map(f => (
            <button key={f.cle || 'tous'} onClick={() => setFiltreType(f.cle)} aria-pressed={filtreType === f.cle}
              className="px-3 py-1.5 rounded text-xs font-bold shadow-sm transition-all hover:shadow hover:ring-1 hover:ring-[#0a0b0d] active:scale-[0.97] flex items-center gap-1.5 whitespace-nowrap"
              style={{ background: filtreType === f.cle ? NAVY : '#fff', color: filtreType === f.cle ? '#fff' : NAVY }}>
              {f.icone && <i className={`ti ${f.icone}`} />} {f.libelle}
            </button>
          ))}
        </div>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-100 text-center py-16">
          <p className="text-gray-300 text-sm mb-3">{recherche ? t('aucun_resultat_recherche') : t('aucun_client_moment')}</p>
          {!recherche && (
            <button onClick={() => setModalClient(null)} className="text-sm font-bold hover:underline" style={{ color: ORANGE }}>
              {t('creer_premier_client')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clients.map((c: any) => {
            const col = clientColor(c.id)
            return (
              <div key={c.id}
                onClick={() => router.push(`/superviseur/batiments?client=${c.id}`)}
                className="bg-white rounded-md border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md hover:border-[#e11324] transition-all duration-200 cursor-pointer">
                <i className="ti ti-building-skyscraper text-xl flex-shrink-0 mt-0.5" style={{ color: col.bg }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: NAVY }}>{c.nom}</p>
                  {c.type_client !== 'particulier' && c.contact_nom && <p className="text-xs text-gray-500 mt-0.5">{c.contact_nom}</p>}
                  {c.type_client === 'particulier' && c.adresse && <p className="text-xs text-gray-500 mt-0.5">{c.adresse}</p>}
                  {c.contact_email && <p className="text-xs text-gray-400">{c.contact_email}</p>}
                  {c.contact_telephone && <p className="text-xs text-gray-400">{c.contact_telephone}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <p className="text-xs font-semibold" style={{ color: col.bg }}>{c.nb_batiments || 0} {t('batiment_s')}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={c.type_client === 'particulier' ? { background: '#ede9fe', color: '#5b21b6' } : { background: '#f1f5f9', color: NAVY }}>
                      <i className={`ti ${c.type_client === 'particulier' ? 'ti-user' : 'ti-building'} text-[11px]`} />
                      {c.type_client === 'particulier' ? t('type_particulier') : t('type_entreprise')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setModalClient(c) }} className="p-2 rounded-md hover:bg-gray-100 text-gray-500" title={t('modifier')}>
                    <i className="ti ti-edit text-base" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setSupprimerId(c.id) }} className="p-2 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-500" title={t('supprimer')}>
                    <i className="ti ti-trash text-base" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />

      {modalClient !== undefined && (
        <ClientModal client={modalClient} onClose={() => setModalClient(undefined)} onSaved={charger} />
      )}

      {supprimerId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSupprimerId(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-alert-triangle text-red-500 text-xl" />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: NAVY }}>{t('supprimer_client_titre')}</h3>
            <p className="text-xs text-gray-400 mb-5">{t('supprimer_client_texte')}</p>
            <div className="flex gap-2">
              <button onClick={() => setSupprimerId(null)} className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200" style={{ color: NAVY }}>{t('annuler')}</button>
              <button onClick={() => supprimer(supprimerId)} className="flex-1 py-2.5 rounded-md text-sm font-bold text-white bg-red-500">{t('supprimer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
