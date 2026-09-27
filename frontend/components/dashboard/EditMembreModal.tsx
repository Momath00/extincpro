'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n'

// Fenêtre « Modifier le membre » de la page Équipe — même présentation que
// dans Préventex (nom d'utilisateur, prénom/nom, courriel, téléphone, rôle).

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

const CLASSE_CHAMP = 'w-full border-2 border-gray-400 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]'

export default function EditMembreModal({ membre, onClose, onSaved }: { membre: any; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [role, setRole] = useState(membre.role)
  const [username, setUsername] = useState(membre.username || '')
  const [email, setEmail] = useState(membre.email || '')
  const [firstName, setFirstName] = useState(membre.first_name || '')
  const [lastName, setLastName] = useState(membre.last_name || '')
  const [telephone, setTelephone] = useState(membre.telephone || '')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')

  const ROLES = [
    { value: 'technicien', label: t('role_technicien'), icon: 'ti-tool', desc: t('desc_role_technicien') },
    { value: 'superviseur', label: t('role_superviseur'), icon: 'ti-shield-check', desc: t('desc_role_superviseur') },
    { value: 'citoyen', label: t('role_citoyen'), icon: 'ti-user', desc: t('desc_role_citoyen') },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErreur('')
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/utilisateurs/${membre.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        username, email, role, first_name: firstName, last_name: lastName,
        telephone,
      }),
    }).catch(() => null)
    setLoading(false)
    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => ({})) : {}
      setErreur(data?.error || (Object.values(data || {}) as any[])?.[0]?.[0] || t('erreur_modification'))
      return
    }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('modifier_membre_titre')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><i className="ti ti-x text-lg" /></button>
        </div>

        {erreur && <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">{erreur}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>{t('nom_utilisateur_label')}</label>
            <input value={username} onChange={e => setUsername(e.target.value)} required className={CLASSE_CHAMP} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>{t('prenom_label')}</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className={CLASSE_CHAMP} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>{t('nom_label')}</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} className={CLASSE_CHAMP} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>{t('email_label')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={CLASSE_CHAMP} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>{t('telephone_label')}</label>
            <input value={telephone} onChange={e => setTelephone(e.target.value)} className={CLASSE_CHAMP} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>{t('role_label')}</label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => setRole(r.value)}
                  className="flex items-center gap-3 p-3 rounded-md border-2 text-left transition-colors"
                  style={{ borderColor: role === r.value ? ORANGE : '#e5e7eb', background: role === r.value ? '#fff5f5' : '#fff' }}>
                  <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: role === r.value ? ORANGE : '#f1f3f5' }}>
                    <i className={`ti ${r.icon} text-base`} style={{ color: role === r.value ? '#fff' : '#6b7280' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: NAVY }}>{r.label}</p>
                    <p className="text-xs text-gray-400 truncate">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-50 hover:opacity-90"
            style={{ background: ORANGE }}>
            {loading ? t('enregistrement_en_cours') : t('enregistrer_modifications')}
          </button>
        </form>
      </div>
    </div>
  )
}
