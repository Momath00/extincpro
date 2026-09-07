'use client'

import { useState, useRef } from 'react'
import { useT } from '@/lib/i18n'
import { resilientMutate } from '@/lib/offline/resilientFetch'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'

const TYPE_AGENT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'liquide', label: 'Liquide (wet chemical)' },
  { value: 'poudre', label: 'À poudre (dry chemical)' },
  { value: 'co2', label: 'CO2' },
  { value: 'autre', label: 'Autre' },
]

const DISPOSITIF_COUPURE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'valve_gaz', label: 'Valve(s) à gaz' },
  { value: 'contacteur', label: 'Contacteur' },
]

const ALIMENTATION_OPTIONS = ['Gaz', 'Électrique']
const RACCORDEMENT_OPTIONS = ["Relié au panneau d'alarme"]

const OUI_NON_OPTIONS = [
  { value: '', label: '—' },
  { value: 'true', label: 'Oui' },
  { value: 'false', label: 'Non' },
]

const CHAMPS_TEXTE: { key: string; label: string; placeholder?: string }[] = [
  { key: 'fabricant', label: 'Fabricant' },
  { key: 'modele', label: 'Modèle' },
  { key: 'numero_serie', label: 'N° de série' },
  { key: 'buses_liens_fusibles', label: 'Buses / liens fusibles (résumé)', placeholder: 'Ex. 6 buses · 360° (remplacés)' },
]

const CHAMPS_NOMBRE: { key: string; label: string }[] = [
  { key: 'nombre_buses', label: 'Nombre de buses' },
  { key: 'liens_fusibles_360f', label: 'Liens fusibles 360°F' },
  { key: 'liens_fusibles_450f', label: 'Liens fusibles 450°F' },
  { key: 'liens_fusibles_500f', label: 'Liens fusibles 500°F' },
]

const CHAMPS_DATE: { key: string; label: string }[] = [
  { key: 'date_inspection', label: 'Date du service' },
  { key: 'prochaine_inspection', label: 'Prochaine inspection (semi-annuelle)' },
  { key: 'date_dernier_essai_hydrostatique', label: 'Dernier essai hydrostatique' },
  { key: 'date_installation', label: "Date d'installation" },
  { key: 'date_derniere_recharge', label: 'Dernière recharge' },
]

function SelectAvecAutre({
  label, value, options, readOnly, onChange,
}: {
  label: string
  value: string
  options: string[]
  readOnly: boolean
  onChange: (v: string) => void
}) {
  const estAutre = value !== '' && !options.includes(value)
  const [autre, setAutre] = useState(estAutre)
  const selectValue = autre ? '__autre__' : value

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">{label}</label>
      <select
        disabled={readOnly}
        value={selectValue || ''}
        onChange={e => {
          if (e.target.value === '__autre__') { setAutre(true); onChange(''); return }
          setAutre(false)
          onChange(e.target.value)
        }}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__autre__">Autre (préciser)</option>
      </select>
      {autre && (
        <input
          type="text"
          disabled={readOnly}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Préciser..."
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mt-1.5 focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
        />
      )}
    </div>
  )
}

export default function InfoSystemeForm({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const t = useT()
  const [form, setForm] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {}
    for (const c of CHAMPS_TEXTE) init[c.key] = rapport[c.key] || ''
    for (const c of CHAMPS_NOMBRE) init[c.key] = rapport[c.key] ?? ''
    for (const c of CHAMPS_DATE) init[c.key] = rapport[c.key] || ''
    init.type_agent = rapport.type_agent || ''
    init.dispositif_coupure = rapport.dispositif_coupure || ''
    init.alimentation = rapport.alimentation || ''
    init.raccordement = rapport.raccordement || ''
    init.liens_fusibles_remplaces = rapport.liens_fusibles_remplaces === true ? 'true' : rapport.liens_fusibles_remplaces === false ? 'false' : ''
    return init
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const CHAMPS_BOOL = ['liens_fusibles_remplaces']
  const CHAMPS_DATE_KEYS = CHAMPS_DATE.map(c => c.key)
  const CHAMPS_NOMBRE_KEYS = CHAMPS_NOMBRE.map(c => c.key)

  async function sauvegarder(champ: string, valeur: any) {
    setError('')
    let val: any = valeur
    if (CHAMPS_DATE_KEYS.includes(champ)) val = valeur || null
    else if (CHAMPS_NOMBRE_KEYS.includes(champ)) val = valeur === '' ? null : Number(valeur)
    else if (CHAMPS_BOOL.includes(champ)) val = valeur === 'true' ? true : valeur === 'false' ? false : null
    const res = await resilientMutate('PATCH', `${API_URL}/api/rapports-cuisine/${rapport.id}/`, { [champ]: val })
    if (res.ok) {
      setSaved(true)
      if (!res.queued) onRefresh()
      setTimeout(() => setSaved(false), 2000)
    } else {
      setError(t('erreur_sauvegarde'))
    }
  }

  function setChamp(key: string, value: any, debounced = false) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (!debounced) {
      sauvegarder(key, value)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => sauvegarder(key, value), 600)
  }

  return (
    <div className="bg-white rounded-md border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('informations_systeme_cuisine')}</h3>
        {saved && <span className="text-xs font-semibold text-green-600 flex items-center gap-1"><i className="ti ti-check" /> {t('sauvegarde_ok')}</span>}
      </div>

      {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-md mb-4 border border-red-100">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHAMPS_TEXTE.slice(0, 2).map(c => (
          <div key={c.key}>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">{c.label}</label>
            <input
              type="text"
              disabled={readOnly}
              value={form[c.key]}
              placeholder={c.placeholder}
              onChange={e => setChamp(c.key, e.target.value, true)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        ))}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">N° de série</label>
          <input
            type="text"
            disabled={readOnly}
            value={form.numero_serie}
            onChange={e => setChamp('numero_serie', e.target.value, true)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Type d'agent</label>
          <select
            disabled={readOnly}
            value={form.type_agent}
            onChange={e => setChamp('type_agent', e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
          >
            {TYPE_AGENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <SelectAvecAutre
          label="Alimentation des appareils"
          value={form.alimentation}
          options={ALIMENTATION_OPTIONS}
          readOnly={readOnly}
          onChange={v => setChamp('alimentation', v)}
        />

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Dispositif de coupure des appareils</label>
          <select
            disabled={readOnly}
            value={form.dispositif_coupure}
            onChange={e => setChamp('dispositif_coupure', e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
          >
            {DISPOSITIF_COUPURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <SelectAvecAutre
          label="Raccordements auxiliaires"
          value={form.raccordement}
          options={RACCORDEMENT_OPTIONS}
          readOnly={readOnly}
          onChange={v => setChamp('raccordement', v)}
        />

        {CHAMPS_NOMBRE.map(c => (
          <div key={c.key}>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">{c.label}</label>
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={form[c.key]}
              onChange={e => setChamp(c.key, e.target.value, true)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        ))}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Liens fusibles remplacés</label>
          <select
            disabled={readOnly}
            value={form.liens_fusibles_remplaces}
            onChange={e => setChamp('liens_fusibles_remplaces', e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
          >
            {OUI_NON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">{CHAMPS_TEXTE[3].label}</label>
          <input
            type="text"
            disabled={readOnly}
            value={form.buses_liens_fusibles}
            placeholder={CHAMPS_TEXTE[3].placeholder}
            onChange={e => setChamp('buses_liens_fusibles', e.target.value, true)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {CHAMPS_DATE.map(c => (
          <div key={c.key}>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">{c.label}</label>
            <input
              type="date"
              disabled={readOnly}
              value={form[c.key]}
              onChange={e => setChamp(c.key, e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
