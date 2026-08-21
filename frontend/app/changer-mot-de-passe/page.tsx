'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const gradientStyle = { background: 'linear-gradient(135deg, #0f172a, #000000)' }
const NAVY = '#0f172a'

const ROUTES_PAR_ROLE: Record<string, string> = {
  superviseur: '/superviseur',
  technicien: '/technicien',
  citoyen: '/citoyen',
}

export default function ChangerMotDePassePage() {
  const router = useRouter()

  const [ancienMdp, setAncienMdp] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmerMdp, setConfirmerMdp] = useState('')
  const [showAncien, setShowAncien] = useState(false)
  const [showNouveau, setShowNouveau] = useState(false)
  const [showConfirmer, setShowConfirmer] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (nouveauMdp !== confirmerMdp) { setError('Les mots de passe ne correspondent pas.'); return }
    if (nouveauMdp.length < 8) { setError('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return }
    if (nouveauMdp === ancienMdp) { setError('Le nouveau mot de passe doit être différent de l\'actuel.'); return }

    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) { router.push('/login'); return }

      const res = await fetch(`${API_URL}/api/changer-mot-de-passe/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ancien_mot_de_passe: ancienMdp,
          nouveau_mot_de_passe: nouveauMdp,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) {
        throw new Error(data.error || (Object.values(data) as any[])[0]?.toString() || 'Erreur lors du changement de mot de passe.')
      }

      const role = localStorage.getItem('user_role') || ''
      router.push(ROUTES_PAR_ROLE[role] || '/login')
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl overflow-hidden shadow-md">

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
              EXTINCTEURS<br /><span className="text-white/70">NATIONEX</span>
            </h1>
          </div>

          <div className="bg-white px-8 pt-8 pb-10 -mt-5 rounded-t-3xl relative z-10">
            <h2 className="text-center text-sm font-bold tracking-widest uppercase mb-2" style={{ color: NAVY }}>
              Nouveau mot de passe
            </h2>
            <p className="text-xs text-gray-400 text-center mb-6 leading-relaxed">
              Votre mot de passe est temporaire. Choisissez-en un nouveau avant de continuer.
            </p>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-xl mb-4 border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: NAVY }}>
                  Mot de passe actuel (temporaire)
                </label>
                <div className="relative">
                  <input type={showAncien ? 'text' : 'password'} value={ancienMdp}
                    onChange={e => setAncienMdp(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm text-gray-800 focus:outline-none transition-colors placeholder-gray-300"
                    onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="••••••••" required autoFocus />
                  <button type="button" onClick={() => setShowAncien(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0f172a] transition-colors">
                    <i className={`ti ${showAncien ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: NAVY }}>
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input type={showNouveau ? 'text' : 'password'} value={nouveauMdp}
                    onChange={e => setNouveauMdp(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm text-gray-800 focus:outline-none transition-colors placeholder-gray-300"
                    onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowNouveau(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0f172a] transition-colors">
                    <i className={`ti ${showNouveau ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">Minimum 8 caractères.</p>
              </div>

              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: NAVY }}>
                  Confirmer le nouveau mot de passe
                </label>
                <div className="relative">
                  <input type={showConfirmer ? 'text' : 'password'} value={confirmerMdp}
                    onChange={e => setConfirmerMdp(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm text-gray-800 focus:outline-none transition-colors placeholder-gray-300"
                    onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowConfirmer(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0f172a] transition-colors">
                    <i className={`ti ${showConfirmer ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="text-white py-3.5 rounded-2xl text-xs font-bold tracking-widest uppercase hover:opacity-90 hover:scale-105 disabled:opacity-50 transition-all duration-300 mt-2"
                style={gradientStyle}>
                {loading ? 'Enregistrement...' : 'Continuer →'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Extincteurs Nationex
        </p>
      </div>
    </div>
  )
}
