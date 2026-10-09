'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

type Parametres = {
  mode_emission: 'auto' | 'manuel'
  regroupement: 'visite' | 'systeme'
  systemes_absents: 'afficher_so' | 'masquer'
  ajustement_manuel: boolean
  non_conformite: 'certificat' | 'avis'
  prefixe_numero: string
  afficher_qr: boolean
  signataire_nom: string
  signataire_titre: string
  signature: string
  normes_citees: string
  texte_legal: string
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-md border border-gray-100 p-5">
      <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: NAVY }}>{titre}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  )
}

function Choix<V extends string>({
  label, valeur, options, onChange,
}: {
  label: string
  valeur: V
  options: { valeur: V; titre: string; description: string; icone: string }[]
  onChange: (v: V) => void
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(o => {
          const actif = o.valeur === valeur
          return (
            <button
              key={o.valeur}
              type="button"
              onClick={() => onChange(o.valeur)}
              className="text-left rounded-md border-2 p-3 flex items-start gap-3 transition-colors"
              style={actif ? { borderColor: ORANGE, background: '#fff5f5' } : { borderColor: '#e5e7eb', background: '#fff' }}
            >
              <span className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: actif ? ORANGE : '#f1f5f9' }}>
                <i className={`ti ${o.icone} text-base`} style={{ color: actif ? '#fff' : '#64748b' }} />
              </span>
              <span>
                <span className="block text-sm font-bold" style={{ color: NAVY }}>{o.titre}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{o.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Interrupteur({ actif, onChange, titre, description }: { actif: boolean; onChange: (v: boolean) => void; titre: string; description: string }) {
  return (
    <button type="button" onClick={() => onChange(!actif)} className="flex items-start gap-3 text-left">
      <span className="w-10 h-6 rounded-full flex-shrink-0 relative transition-colors mt-0.5" style={{ background: actif ? ORANGE : '#cbd5e1' }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: actif ? 18 : 2 }} />
      </span>
      <span>
        <span className="block text-sm font-bold" style={{ color: NAVY }}>{titre}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
      </span>
    </button>
  )
}

export default function ParametresCertificatsPage() {
  const t = useT()
  const [p, setP] = useState<Parametres | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [message, setMessage] = useState('')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/parametres-certificat/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : null))
      .then(d => { if (d) setP(d) })
  }, [])

  function maj<K extends keyof Parametres>(cle: K, valeur: Parametres[K]) {
    setP(prev => (prev ? { ...prev, [cle]: valeur } : prev))
    setMessage('')
  }

  async function enregistrer() {
    if (!p) return
    setEnregistrement(true)
    setErreurs({})
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/parametres-certificat/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(p),
    })
    const d = await res.json().catch(() => ({}))
    setEnregistrement(false)
    if (res.ok) {
      setP(d)
      setMessage(t('pc_enregistre'))
    } else {
      const e: Record<string, string> = {}
      for (const [cle, val] of Object.entries(d)) e[cle] = Array.isArray(val) ? String(val[0]) : String(val)
      setErreurs(e)
    }
  }

  if (!p) return null

  const champ = 'w-full border-2 border-[#0a0b0d] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#e11324]'
  const etiquette = 'text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1 block'

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{t('pc_titre')}</h1>
        <p className="text-gray-400 text-sm mt-1">{t('pc_sous_titre')}</p>
      </div>

      <div className="flex flex-col gap-5">
        <Section titre={t('pc_emission')}>
          <Choix label={t('pc_emission')} valeur={p.mode_emission} onChange={v => maj('mode_emission', v)} options={[
            { valeur: 'auto', titre: t('pc_emission_auto'), description: t('pc_emission_auto_desc'), icone: 'ti-bolt' },
            { valeur: 'manuel', titre: t('pc_emission_manuel'), description: t('pc_emission_manuel_desc'), icone: 'ti-user-check' },
          ]} />
          <Choix label={t('pc_regroupement')} valeur={p.regroupement} onChange={v => maj('regroupement', v)} options={[
            { valeur: 'visite', titre: t('pc_regroupement_visite'), description: t('pc_regroupement_visite_desc'), icone: 'ti-stack-2' },
            { valeur: 'systeme', titre: t('pc_regroupement_systeme'), description: t('pc_regroupement_systeme_desc'), icone: 'ti-layout-columns' },
          ]} />
          <Choix label={t('pc_absents')} valeur={p.systemes_absents} onChange={v => maj('systemes_absents', v)} options={[
            { valeur: 'afficher_so', titre: t('pc_absents_so'), description: t('pc_absents_so_desc'), icone: 'ti-list-check' },
            { valeur: 'masquer', titre: t('pc_absents_masquer'), description: t('pc_absents_masquer_desc'), icone: 'ti-eye-off' },
          ]} />
          <Choix label={t('pc_non_conformite')} valeur={p.non_conformite} onChange={v => maj('non_conformite', v)} options={[
            { valeur: 'certificat', titre: t('pc_nc_certificat'), description: t('pc_nc_certificat_desc'), icone: 'ti-certificate' },
            { valeur: 'avis', titre: t('pc_nc_avis'), description: t('pc_nc_avis_desc'), icone: 'ti-alert-triangle' },
          ]} />
          <Interrupteur actif={p.ajustement_manuel} onChange={v => maj('ajustement_manuel', v)} titre={t('pc_ajustement')} description={t('pc_ajustement_desc')} />
        </Section>

        <Section titre={t('pc_contenu')}>
          <div>
            <label className={etiquette}>{t('pc_normes')}</label>
            <input className={champ} value={p.normes_citees} maxLength={300} onChange={e => maj('normes_citees', e.target.value)} />
          </div>
          <div>
            <label className={etiquette}>{t('pc_texte_legal')}</label>
            <textarea className={champ} rows={3} value={p.texte_legal} placeholder={t('pc_texte_legal_placeholder')}
              onChange={e => maj('texte_legal', e.target.value)} />
          </div>
          <Interrupteur actif={p.afficher_qr} onChange={v => maj('afficher_qr', v)} titre={t('pc_qr')} description={t('pc_qr_desc')} />
        </Section>

        <div className="flex items-center gap-3 flex-wrap sticky bottom-0 bg-[#f8fafc]/90 backdrop-blur py-3">
          <button type="button" onClick={enregistrer} disabled={enregistrement}
            className="text-sm font-bold px-5 py-2.5 rounded-md text-white disabled:opacity-50 hover:opacity-90"
            style={{ background: ORANGE }}>
            <i className="ti ti-device-floppy" /> {t('pc_enregistrer')}
          </button>
          {message && <span className="text-sm font-semibold text-green-600"><i className="ti ti-check" /> {message}</span>}
          {Object.keys(erreurs).length > 0 && <span className="text-sm font-semibold text-red-600"><i className="ti ti-alert-triangle" /> {Object.values(erreurs).join(' — ')}</span>}
          <span className="text-xs text-gray-400 w-full sm:w-auto sm:ml-auto">{t('pc_note_existants')}</span>
        </div>
      </div>
    </div>
  )
}
