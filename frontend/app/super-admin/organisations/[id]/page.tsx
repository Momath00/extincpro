'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ACCENT = '#dc2626'

function Switch({ actif, onClick, busy }: { actif: boolean; onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
      style={{ background: actif ? ACCENT : '#e2e8f0' }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
        style={{ transform: actif ? 'translateX(22px)' : 'translateX(4px)' }}
      />
    </button>
  )
}

function ModuleIcon({ code }: { code: string }) {
  const icon = code === 'rapport_incendie' ? 'ti-clipboard-check' : 'ti-fire-extinguisher'
  return <i className={`ti ${icon} text-base`} />
}

export default function OrganisationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [organisation, setOrganisation] = useState<any>(null)
  const [utilisateurs, setUtilisateurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true)
  const [busyModule, setBusyModule] = useState<string | null>(null)
  const [busyStatut, setBusyStatut] = useState(false)

  const [selectionnes, setSelectionnes] = useState<number[]>([])
  const [busyUtilisateur, setBusyUtilisateur] = useState<number | null>(null)
  const [busySelection, setBusySelection] = useState(false)

  const [modalOuvert, setModalOuvert] = useState(false)
  const [formUsername, setFormUsername] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPrenom, setFormPrenom] = useState('')
  const [formNom, setFormNom] = useState('')
  const [formErreur, setFormErreur] = useState('')
  const [formEnvoi, setFormEnvoi] = useState(false)
  const [resultat, setResultat] = useState<{ username: string; mdp: string } | null>(null)

  function token() {
    return localStorage.getItem('access_token')
  }

  function charger() {
    const t = token()
    if (!t) { router.push('/login'); return }

    Promise.all([
      fetch(`${API_URL}/api/organisations/${id}/`, { headers: { Authorization: `Bearer ${t}` } }),
      fetch(`${API_URL}/api/organisations/${id}/utilisateurs/`, { headers: { Authorization: `Bearer ${t}` } }),
    ])
      .then(async ([resOrg, resUsers]) => {
        if (resOrg.status === 401) { router.push('/login'); return null }
        if (resOrg.status === 404) { router.push('/super-admin/organisations'); return null }
        const [orgData, usersData] = await Promise.all([resOrg.json(), resUsers.json()])
        return { orgData, usersData }
      })
      .then(result => {
        if (!result) return
        setOrganisation(result.orgData)
        setUtilisateurs(Array.isArray(result.usersData) ? result.usersData : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { charger() }, [id])

  async function toggleModule(code: string) {
    setBusyModule(code)
    const res = await fetch(`${API_URL}/api/organisations/${id}/modules/${code}/toggle/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    })
    if (res.ok) setOrganisation(await res.json())
    setBusyModule(null)
  }

  async function toggleStatutOrganisation() {
    setBusyStatut(true)
    const res = await fetch(`${API_URL}/api/organisations/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ est_active: !organisation.est_active }),
    })
    if (res.ok) setOrganisation(await res.json())
    setBusyStatut(false)
  }

  async function changerStatutUtilisateurs(ids: number[], estActif: boolean) {
    const res = await fetch(`${API_URL}/api/organisations/${id}/utilisateurs/statut/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ ids, est_actif: estActif }),
    })
    if (res.ok) {
      const data = await res.json()
      setUtilisateurs(data.utilisateurs)
      setSelectionnes(prev => prev.filter(i => !ids.includes(i)))
    }
  }

  async function toggleUnUtilisateur(u: any) {
    setBusyUtilisateur(u.id)
    await changerStatutUtilisateurs([u.id], !u.est_actif)
    setBusyUtilisateur(null)
  }

  async function appliquerSelection(estActif: boolean) {
    setBusySelection(true)
    await changerStatutUtilisateurs(selectionnes, estActif)
    setBusySelection(false)
  }

  function toggleSelection(userId: number) {
    setSelectionnes(prev => prev.includes(userId) ? prev.filter(i => i !== userId) : [...prev, userId])
  }

  function ouvrirModal() {
    setFormUsername(''); setFormEmail(''); setFormPrenom(''); setFormNom(''); setFormErreur(''); setResultat(null)
    setModalOuvert(true)
  }

  async function creerSuperviseur(e: React.FormEvent) {
    e.preventDefault()
    setFormErreur('')
    if (!formUsername.trim() || !formEmail.trim()) { setFormErreur("Le nom d'utilisateur et l'email sont obligatoires."); return }

    setFormEnvoi(true)
    try {
      const res = await fetch(`${API_URL}/api/organisations/${id}/superviseurs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          username: formUsername.trim(),
          email: formEmail.trim(),
          first_name: formPrenom.trim(),
          last_name: formNom.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormErreur(data.username?.[0] || data.email?.[0] || data.error || 'Erreur lors de la création.')
        setFormEnvoi(false)
        return
      }
      setResultat({ username: data.utilisateur.username, mdp: data.mdp_temporaire })
      setFormEnvoi(false)
      charger()
    } catch {
      setFormErreur('Erreur réseau.')
      setFormEnvoi(false)
    }
  }

  if (loading || !organisation) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const nbModulesActifs = organisation.modules.filter((m: any) => m.actif).length

  return (
    <div className="max-w-3xl">
      <Link href="/super-admin/organisations" className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-flex items-center gap-1">
        <i className="ti ti-arrow-left text-xs" /> Retour aux organisations
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xl font-bold shadow-md"
              style={{ background: `linear-gradient(135deg, ${NAVY}, #1e293b)` }}
            >
              {organisation.nom[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate" style={{ color: NAVY }}>{organisation.nom}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{organisation.slug}</p>
              {organisation.adresse && (
                <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                  <i className="ti ti-map-pin text-[11px]" /> {organisation.adresse}
                </p>
              )}
            </div>
          </div>
          <span
            className="text-xs px-3 py-1.5 rounded-full font-bold flex-shrink-0 flex items-center gap-1.5"
            style={{ background: organisation.est_active ? '#f0fdf4' : '#fef2f2', color: organisation.est_active ? '#16a34a' : '#dc2626' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: organisation.est_active ? '#16a34a' : '#dc2626' }} />
            {organisation.est_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex gap-6 pt-4 border-t border-gray-50">
          <div>
            <p className="text-2xl font-bold" style={{ color: NAVY }}>{utilisateurs.length}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Utilisateur{utilisateurs.length !== 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: NAVY }}>{nbModulesActifs} / {organisation.modules.length}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Modules actifs</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: NAVY }}>
              {new Date(organisation.date_creation).toLocaleDateString('fr-CA', { dateStyle: 'medium' })}
            </p>
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Créée le</p>
          </div>
        </div>
      </div>

      {/* Statut global */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: organisation.est_active ? '#f0fdf4' : '#fef2f2' }}>
            <i className="ti ti-power text-base" style={{ color: organisation.est_active ? '#16a34a' : '#dc2626' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>Accès à la plateforme</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Coupe-circuit global — désactiver bloque immédiatement tous les utilisateurs de cette organisation.
            </p>
          </div>
        </div>
        <Switch actif={organisation.est_active} onClick={toggleStatutOrganisation} busy={busyStatut} />
      </div>

      {/* Modules */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <i className="ti ti-apps text-sm" style={{ color: ACCENT }} />
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>Modules</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {organisation.modules.map((m: any) => (
            <div key={m.code} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: m.actif ? '#fef2f2' : '#f1f5f9', color: m.actif ? ACCENT : '#94a3b8' }}
                >
                  <ModuleIcon code={m.code} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: NAVY }}>{m.nom}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.actif ? 'Activé pour cette organisation' : 'Désactivé — inaccessible pour cette organisation'}</p>
                </div>
              </div>
              <Switch actif={m.actif} onClick={() => toggleModule(m.code)} busy={busyModule === m.code} />
            </div>
          ))}
        </div>
      </div>

      {/* Utilisateurs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <i className="ti ti-users text-sm" style={{ color: ACCENT }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>Utilisateurs</h2>
          </div>
          <div className="flex items-center gap-2">
            {selectionnes.length > 0 && (
              <>
                <span className="text-xs text-gray-400">{selectionnes.length} sélectionné{selectionnes.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={() => appliquerSelection(false)}
                  disabled={busySelection}
                  className="text-xs font-bold px-3 py-1.5 rounded-md text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  Désactiver
                </button>
                <button
                  onClick={() => appliquerSelection(true)}
                  disabled={busySelection}
                  className="text-xs font-bold px-3 py-1.5 rounded-md text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  Activer
                </button>
              </>
            )}
            <button
              onClick={ouvrirModal}
              className="text-xs font-bold px-3 py-1.5 rounded-md text-white hover:opacity-90 transition-opacity flex items-center gap-1.5"
              style={{ background: ACCENT }}
            >
              <i className="ti ti-plus text-xs" /> Créer un superviseur
            </button>
          </div>
        </div>

        {utilisateurs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f8f9fa' }}>
              <i className="ti ti-user-off text-xl text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm font-medium">Aucun utilisateur pour le moment.</p>
            <p className="text-gray-300 text-xs mt-1">Créez le premier superviseur pour activer cette organisation.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {utilisateurs.map((u: any) => (
              <div key={u.id} className="px-5 py-3.5 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectionnes.includes(u.id)}
                  onChange={() => toggleSelection(u.id)}
                  className="w-4 h-4 flex-shrink-0 accent-[#dc2626]"
                />
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: NAVY }}
                >
                  {u.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: NAVY }}>{u.first_name || u.username} {u.last_name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <span
                  className="text-[11px] px-2 py-1 rounded-full font-semibold flex-shrink-0"
                  style={{ background: '#f1f5f9', color: '#475569' }}
                >
                  {u.role_display}
                </span>
                {!u.est_actif && (
                  <span className="text-[11px] px-2 py-1 rounded-full font-semibold flex-shrink-0 bg-red-50 text-red-600">Désactivé</span>
                )}
                <Switch actif={u.est_actif} onClick={() => toggleUnUtilisateur(u)} busy={busyUtilisateur === u.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal création superviseur */}
      {modalOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !formEnvoi && setModalOuvert(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            {resultat ? (
              <div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-green-50">
                  <i className="ti ti-check text-xl text-green-600" />
                </div>
                <h3 className="text-base font-bold text-center mb-1" style={{ color: NAVY }}>Superviseur créé</h3>
                <p className="text-xs text-gray-400 text-center mb-4">Un email d'invitation a été envoyé. En secours si l'email n'arrive pas :</p>
                <div className="bg-gray-50 border border-gray-100 rounded-md p-3 mb-4 text-center">
                  <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-1">Nom d'utilisateur</p>
                  <p className="text-sm font-bold mb-3" style={{ color: NAVY }}>{resultat.username}</p>
                  <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-1">Mot de passe temporaire</p>
                  <code className="text-lg font-extrabold tracking-widest" style={{ color: ACCENT }}>{resultat.mdp}</code>
                </div>
                <button
                  onClick={() => setModalOuvert(false)}
                  className="w-full text-white py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity"
                  style={{ background: NAVY }}
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={creerSuperviseur} className="flex flex-col gap-3">
                <h3 className="text-base font-bold mb-1" style={{ color: NAVY }}>Créer un superviseur</h3>
                <p className="text-xs text-gray-400 -mt-2 mb-1">Pour « {organisation.nom} »</p>

                <div className="flex gap-2">
                  <input
                    type="text" placeholder="Prénom" value={formPrenom} onChange={e => setFormPrenom(e.target.value)}
                    className="w-1/2 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626]"
                  />
                  <input
                    type="text" placeholder="Nom" value={formNom} onChange={e => setFormNom(e.target.value)}
                    className="w-1/2 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626]"
                  />
                </div>
                <input
                  type="text" placeholder="Nom d'utilisateur *" value={formUsername} onChange={e => setFormUsername(e.target.value)}
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626]"
                  autoFocus
                />
                <input
                  type="email" placeholder="Email *" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626]"
                />

                {formErreur && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <i className="ti ti-alert-triangle" /> {formErreur}
                  </p>
                )}

                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setModalOuvert(false)}
                    className="flex-1 border border-gray-200 py-2.5 rounded-md text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={formEnvoi}
                    className="flex-1 text-white py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ background: ACCENT }}
                  >
                    {formEnvoi ? 'Création…' : 'Créer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
