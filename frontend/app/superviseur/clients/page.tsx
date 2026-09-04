'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clientColor } from '@/lib/clientColor'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

function ClientModal({ client, onClose, onSaved }: { client: any; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [nom, setNom] = useState(client?.nom || '')
  const [contactNom, setContactNom] = useState(client?.contact_nom || '')
  const [email, setEmail] = useState(client?.contact_email || '')
  const [telephone, setTelephone] = useState(client?.contact_telephone || '')
  const [adresse, setAdresse] = useState(client?.adresse || '')
  const [modeLivraison, setModeLivraison] = useState(client?.mode_livraison || 'plateforme')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const nbBatiments = client?.nb_batiments || 0
  const suggereDirect = client && nbBatiments > 0 && nbBatiments < 5

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
          nom, contact_nom: contactNom, contact_email: email,
          contact_telephone: telephone, adresse, mode_livraison: modeLivraison,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || (Object.values(data) as any[])?.[0]?.[0] || 'Erreur.')
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
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
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('nom_entreprise')}</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Actionéo"
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" required />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('personne_ressource')}</label>
            <input value={contactNom} onChange={e => setContactNom(e.target.value)} placeholder="Jean Dupont"
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('email_label')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@entreprise.com"
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('telephone_label')}</label>
              <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="514-000-0000"
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('adresse_label')}</label>
            <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="123 rue Principale, Montréal, QC"
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>{t('mode_livraison_titre')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModeLivraison('plateforme')}
                className="text-left rounded-lg border-2 px-3 py-2.5 transition-colors"
                style={modeLivraison === 'plateforme'
                  ? { borderColor: NAVY, background: '#f8fafc' }
                  : { borderColor: '#e5e7eb', background: '#fff' }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <i className="ti ti-users text-sm" style={{ color: modeLivraison === 'plateforme' ? NAVY : '#9ca3af' }} />
                  <span className="text-xs font-bold" style={{ color: NAVY }}>{t('mode_livraison_plateforme')}</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-snug">{t('mode_livraison_plateforme_desc')}</p>
              </button>
              <button
                type="button"
                onClick={() => setModeLivraison('direct')}
                className="text-left rounded-lg border-2 px-3 py-2.5 transition-colors"
                style={modeLivraison === 'direct'
                  ? { borderColor: ORANGE, background: '#fef2f2' }
                  : { borderColor: '#e5e7eb', background: '#fff' }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <i className="ti ti-mail-forward text-sm" style={{ color: modeLivraison === 'direct' ? ORANGE : '#9ca3af' }} />
                  <span className="text-xs font-bold" style={{ color: NAVY }}>{t('mode_livraison_direct')}</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-snug">{t('mode_livraison_direct_desc')}</p>
              </button>
            </div>
            {suggereDirect && modeLivraison !== 'direct' && (
              <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: ORANGE }}>
                <i className="ti ti-bulb" /> {nbBatiments} {t('mode_livraison_suggestion')}
              </p>
            )}
            {modeLivraison === 'direct' && !email && (
              <p className="text-[11px] mt-2 flex items-center gap-1 text-red-500">
                <i className="ti ti-alert-triangle" /> {t('mode_livraison_email_requis')}
              </p>
            )}
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
  const [loading, setLoading] = useState(true)
  const [modalClient, setModalClient] = useState<any>(undefined)
  const [supprimerId, setSupprimerId] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    fetch(`${API_URL}/api/clients/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        setClients(Array.isArray(data) ? data : (data.results || []))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

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
          <p className="text-gray-400 text-sm mt-1">{clients.length} {t('entreprise_cliente')}</p>
        </div>
        <button
          onClick={() => setModalClient(null)}
          className="text-white px-5 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-plus" /> {t('nouveau_client')}
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-100 text-center py-16">
          <p className="text-gray-300 text-sm mb-3">{t('aucun_client_moment')}</p>
          <button onClick={() => setModalClient(null)} className="text-sm font-bold hover:underline" style={{ color: ORANGE }}>
            {t('creer_premier_client')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clients.map((c: any) => {
            const col = clientColor(c.id)
            return (
              <div key={c.id} className="bg-white rounded-md border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md hover:border-[#e11324] transition-all duration-200">
                <i className="ti ti-building-skyscraper text-xl flex-shrink-0 mt-0.5" style={{ color: col.bg }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: NAVY }}>{c.nom}</p>
                  {c.contact_nom && <p className="text-xs text-gray-500 mt-0.5">{c.contact_nom}</p>}
                  {c.contact_email && <p className="text-xs text-gray-400">{c.contact_email}</p>}
                  {c.contact_telephone && <p className="text-xs text-gray-400">{c.contact_telephone}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <p className="text-xs font-semibold" style={{ color: col.bg }}>{c.nb_batiments || 0} {t('batiment_s')}</p>
                    {c.mode_livraison === 'direct' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ color: ORANGE, background: '#fef2f2' }}>
                        <i className="ti ti-mail-forward text-[11px]" /> {t('badge_envoi_direct')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-gray-500 bg-gray-100">
                        <i className="ti ti-users text-[11px]" /> {t('badge_espace_client')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setModalClient(c)} className="p-2 rounded-md hover:bg-gray-100 text-gray-500" title={t('modifier')}>
                    <i className="ti ti-edit text-base" />
                  </button>
                  <button onClick={() => setSupprimerId(c.id)} className="p-2 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-500" title={t('supprimer')}>
                    <i className="ti ti-trash text-base" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

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
