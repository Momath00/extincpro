'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const gradientStyle = { background: 'linear-gradient(135deg, #0f172a, #000000)' }
const NAVY = '#0f172a'

type Etape = 'login' | 'oublie_email' | 'oublie_code'

function Spinner({ size = 15 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full animate-spin flex-shrink-0"
      style={{
        width: size,
        height: size,
        border: '2px solid rgba(255,255,255,0.35)',
        borderTopColor: '#fff',
      }}
    />
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [etape, setEtape] = useState<Etape>('login')

  // Login
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Mot de passe oublié
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmerMdp, setConfirmerMdp] = useState('')
  const [showNvMdp, setShowNvMdp] = useState(false)
  const [showCfMdp, setShowCfMdp] = useState(false)
  const [toast, setToast] = useState('')

  function reset() {
    setError('')
    setEmail(''); setCode(''); setNouveauMdp(''); setConfirmerMdp('')
  }

  // ── Connexion + redirection vers le bon tableau de bord ──────────────────
  async function connecterEtRediriger(u: string, p: string) {
    const tokenRes = await fetch(`${API_URL}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    })
    if (!tokenRes.ok) {
      const err = await tokenRes.json()
      throw new Error(err.error || err.detail || 'Identifiants incorrects.')
    }
    const tokenData = await tokenRes.json()
    localStorage.setItem('access_token', tokenData.access)
    localStorage.setItem('refresh_token', tokenData.refresh)

    const meRes = await fetch(`${API_URL}/api/me/`, {
      headers: { Authorization: `Bearer ${tokenData.access}` },
    })
    if (!meRes.ok) throw new Error("Impossible de récupérer votre profil.")
    const user = await meRes.json()

    localStorage.setItem('user_role', user.role)
    localStorage.setItem('user_id', String(user.id))
    localStorage.setItem('user_username', user.username)

    if (user.mdp_temporaire) {
      router.push('/changer-mot-de-passe')
      return
    }

    const routesParRole: Record<string, string> = {
      super_admin: '/super-admin',
      superviseur: '/superviseur',
      technicien: '/technicien',
      citoyen: '/citoyen',
    }
    router.push(routesParRole[user.role] || '/')
  }

  // ── Connexion ──────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await connecterEtRediriger(username, password)
    } catch (err: any) {
      setError(err.message || 'Identifiants incorrects. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // ── Étape 1 : envoyer code par email ─────────────────────────────────
  async function handleEnvoyerCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_URL}/api/mot-de-passe-oublie/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || 'Email introuvable')
      setEtape('oublie_code')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Étape 2 : valider code + nouveau mot de passe ────────────────────
  async function handleReinitialiser(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (nouveauMdp !== confirmerMdp) { setError('Les mots de passe ne correspondent pas'); return }
    if (nouveauMdp.length < 8) { setError('Minimum 8 caractères'); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/reinitialiser-mdp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, nouveau_mot_de_passe: nouveauMdp }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || 'Erreur')

      setToast('Mot de passe mis à jour')
      setTimeout(() => setToast(''), 3000)
      try {
        await connecterEtRediriger(data.username, nouveauMdp)
      } catch {
        // Connexion automatique impossible (rare) — retour au login, username pré-rempli.
        setToast('')
        setUsername(data.username || '')
        reset()
        setEtape('login')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const headerContent = {
    login: { title: 'Connexion' },
    oublie_email: { title: 'Mot de passe oublié' },
    oublie_code: { title: 'Nouveau mot de passe' },
  }[etape]

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl overflow-hidden shadow-md">

          {/* Haut dégradé marine → orange */}
          <div className="px-8 pt-12 pb-16 text-center relative overflow-hidden" style={gradientStyle}>
            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-xl overflow-hidden relative z-10">
              <img
                src="/logo.svg"
                alt="Extincteurs Nationex"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const p = e.currentTarget.parentElement
                  if (p) p.innerHTML = `<span style="font-size:28px;font-weight:700;color:${NAVY};">E<span style="color:${NAVY};">N</span></span>`
                }}
              />
            </div>

            <h1 className="text-white font-bold text-sm tracking-widest relative z-10 leading-tight">
              EXTINCPRO
            </h1>
          </div>

          {/* Bas blanc */}
          <div className="bg-white px-8 pt-8 pb-10 -mt-5 rounded-t-3xl relative z-10">

            <h2 className="text-center text-sm font-bold tracking-widest uppercase mb-6" style={{ color: NAVY }}>
              {headerContent.title}
            </h2>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-xl mb-4 border border-red-100">
                {error}
              </div>
            )}
            {/* ── Formulaire Login ── */}
            {etape === 'login' && (
              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: NAVY }}>
                    Nom d'utilisateur
                  </label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    className="w-full border-0 border-b border-gray-200 pb-2 text-sm text-gray-700 focus:outline-none bg-transparent transition-colors placeholder-gray-300"
                    style={{ borderBottomColor: undefined }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = NAVY)}
                    onBlur={e => (e.currentTarget.style.borderBottomColor = '')}
                    placeholder="votre nom d'utilisateur" required autoComplete="username" />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: NAVY }}>
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full border-0 border-b border-gray-200 pb-2 pr-8 text-sm text-gray-700 focus:outline-none bg-transparent transition-colors placeholder-gray-300"
                      onFocus={e => (e.currentTarget.style.borderBottomColor = NAVY)}
                      onBlur={e => (e.currentTarget.style.borderBottomColor = '')}
                      placeholder="••••••••••" required autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-0 bottom-2 text-gray-300 hover:text-[#0f172a] transition-colors">
                      <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="text-white py-3.5 rounded-2xl text-xs font-bold tracking-widest uppercase hover:opacity-90 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300 mt-2 flex items-center justify-center gap-2.5"
                  style={gradientStyle}>
                  {loading ? <Spinner size={17} /> : 'Connexion'}
                </button>
              </form>
            )}

            {/* ── Étape 1 : saisir email ── */}
            {etape === 'oublie_email' && (
              <form onSubmit={handleEnvoyerCode} className="flex flex-col gap-5">
                <p className="text-xs text-gray-400 text-center -mt-2 mb-1">
                  Entrez votre email. Un code de réinitialisation vous sera envoyé.
                </p>
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: NAVY }}>
                    Adresse email
                  </label>
                  <div className="relative">
                    <i className="ti ti-mail absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full bg-white border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-800 focus:outline-none transition-colors placeholder-gray-300"
                      onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="votre@email.com" required autoFocus autoComplete="email" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Entrez l'email associé à votre compte</p>
                </div>
                <button type="submit" disabled={loading}
                  className="text-white py-3.5 rounded-2xl text-xs font-bold tracking-widest uppercase hover:opacity-90 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300 flex items-center justify-center gap-2.5"
                  style={gradientStyle}>
                  {loading && <Spinner />} {loading ? 'Envoi en cours...' : 'Envoyer le code'}
                </button>
                <button type="button" onClick={() => { reset(); setEtape('login') }}
                  className="text-xs text-gray-400 hover:text-[#0f172a] transition-colors text-center">
                  Retour à la connexion
                </button>
              </form>
            )}

            {/* ── Étape 2 : code + nouveau mot de passe ── */}
            {etape === 'oublie_code' && (
              <form onSubmit={handleReinitialiser} className="flex flex-col gap-4">
                <p className="text-xs text-gray-400 text-center -mt-2 mb-1">
                  Code envoyé à <strong>{email}</strong>. Vérifiez vos emails.
                </p>
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: NAVY }}>
                    Code de vérification
                  </label>
                  <input type="text" value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-center font-mono tracking-[0.4em] font-bold focus:outline-none transition-colors placeholder-gray-300 uppercase"
                    style={{ color: NAVY }}
                    onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="ABC123" maxLength={6} required autoFocus autoComplete="one-time-code" />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: NAVY }}>
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input type={showNvMdp ? 'text' : 'password'} value={nouveauMdp}
                      onChange={e => setNouveauMdp(e.target.value)}
                      className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm text-gray-800 focus:outline-none transition-colors placeholder-gray-300"
                      onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="••••••••" required autoComplete="new-password" />
                    <button type="button" onClick={() => setShowNvMdp(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0f172a] transition-colors">
                      <i className={`ti ${showNvMdp ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: NAVY }}>
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <input type={showCfMdp ? 'text' : 'password'} value={confirmerMdp}
                      onChange={e => setConfirmerMdp(e.target.value)}
                      className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm text-gray-800 focus:outline-none transition-colors placeholder-gray-300"
                      onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="••••••••" required autoComplete="new-password" />
                    <button type="button" onClick={() => setShowCfMdp(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0f172a] transition-colors">
                      <i className={`ti ${showCfMdp ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="text-white py-3 rounded-2xl text-xs font-bold tracking-widest uppercase hover:opacity-90 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300 flex items-center justify-center gap-2.5"
                  style={gradientStyle}>
                  {loading && <Spinner />} {loading ? 'Réinitialisation...' : 'Réinitialiser mon mot de passe →'}
                </button>
                <button type="button" onClick={() => { setError(''); setEtape('oublie_email') }}
                  className="text-xs text-gray-400 hover:text-[#0f172a] transition-colors text-center">
                  Renvoyer un code
                </button>
              </form>
            )}

            {/* Liens bas de page — plus de « Créer une organisation » */}
            {etape === 'login' && (
              <div className="flex flex-col items-center gap-2 mt-6">
                <button type="button"
                  onClick={() => { reset(); setEtape('oublie_email') }}
                  className="text-xs text-gray-300 hover:text-[#0f172a] transition-colors uppercase tracking-widest">
                  Mot de passe oublié ?
                </button>
              </div>
            )}

          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Extincteurs Nationex
        </p>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border border-green-100 px-5 py-3.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-green-50">
            <i className="ti ti-check text-green-600 text-sm" />
          </div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>{toast}</p>
        </div>
      )}
    </div>
  )
}