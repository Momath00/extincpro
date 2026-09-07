'use client'

import { useState, useRef } from 'react'
import { useT } from '@/lib/i18n'
import { resilientMutate } from '@/lib/offline/resilientFetch'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'

// Même liste et mêmes noms de champs que CHECKLIST_CUISINE côté backend
// (securiteincendie/inspections/views.py) et RapportCuisine.CHAMPS_VERIFICATION.
export const CHAMPS_VERIFICATION: { key: string; label: string }[] = [
  { key: 'appareils_proteges', label: 'Vérifier si les appareils sont protégés de façon adéquate' },
  { key: 'liens_fusibles_remplaces', label: 'Remplacer le(s) lien(s)-fusible(s)' },
  { key: 'installation_conforme_fabricant', label: 'Vérifier si le système est installé selon les normes du fabricant' },
  { key: 'cable_tension_verifie', label: 'Vérifier le câble de tension pour corrosion ou effilochure' },
  { key: 'pression_manometre_verifiee', label: 'Vérifier la pression du manomètre' },
  { key: 'conduits_decharge_verifies', label: 'Vérifier tous les conduits de déchargement et fixations' },
  { key: 'cylindres_supports_inspectes', label: 'Inspecter et nettoyer le(s) cylindre(s) et le(s) support(s)' },
  { key: 'extincteur_portatif_type_k', label: 'Vérifier la présence d’un extincteur portatif conforme (type K)' },
  { key: 'station_manuelle_degagee', label: 'Vérifier l’absence d’obstruction devant la station manuelle' },
  { key: 'etiquettes_verification_apposees', label: 'Apposer les étiquettes de vérification' },
  { key: 'buses_protecteurs_nettoyes', label: 'Nettoyer et vérifier les buses et leurs protecteurs' },
  { key: 'systeme_condition_normale', label: 'Laisser le système en condition d’opération normale' },
  { key: 'liens_fusibles_nettoyes', label: 'Nettoyer et vérifier le(s) lien(s)-fusible(s)' },
]

export default function ChecklistCuisine({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const t = useT()
  const [form, setForm] = useState<Record<string, boolean | null>>(() => {
    const init: Record<string, boolean | null> = {}
    for (const c of CHAMPS_VERIFICATION) init[c.key] = rapport[c.key] ?? null
    return init
  })
  const [commentaires, setCommentaires] = useState(rapport.commentaires || '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const nbConformes = Object.values(form).filter(v => v === true).length
  const total = CHAMPS_VERIFICATION.length
  const conforme = nbConformes === total

  async function sauvegarder(payload: Record<string, any>) {
    setError('')
    const res = await resilientMutate('PATCH', `${API_URL}/api/rapports-cuisine/${rapport.id}/`, payload)
    if (res.ok) {
      setSaved(true)
      if (!res.queued) onRefresh()
      setTimeout(() => setSaved(false), 2000)
    } else {
      setError(t('erreur_sauvegarde'))
    }
  }

  function toggle(key: string) {
    const val = form[key] === true ? false : true
    setForm(prev => ({ ...prev, [key]: val }))
    sauvegarder({ [key]: val })
  }

  function onCommentairesChange(value: string) {
    setCommentaires(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => sauvegarder({ commentaires: value }), 600)
  }

  return (
    <div className="bg-white rounded-md border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('liste_verifications')}</h3>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs font-semibold text-green-600 flex items-center gap-1"><i className="ti ti-check" /> {t('sauvegarde_ok')}</span>}
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={conforme ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#64748b' }}
          >
            {nbConformes}/{total} {t('conformes_sur')}
          </span>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-md mb-4 border border-red-100">{error}</div>}

      <div className="flex flex-col">
        {CHAMPS_VERIFICATION.map(c => {
          const val = form[c.key]
          return (
            <button
              key={c.key}
              type="button"
              disabled={readOnly}
              onClick={() => toggle(c.key)}
              className="flex items-start gap-3 py-2.5 border-b border-gray-50 text-left disabled:cursor-default w-full"
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border-2"
                style={val === true ? { background: '#dcfce7', borderColor: '#16a34a' } : { background: '#fff', borderColor: '#cbd5e1' }}
              >
                {val === true && <i className="ti ti-check text-green-600 text-xs" />}
              </span>
              <span className="text-sm flex-1 min-w-0 whitespace-normal break-words" style={{ color: '#334155' }}>{c.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">{t('commentaires_label')}</label>
        <textarea
          disabled={readOnly}
          value={commentaires}
          onChange={e => onCommentairesChange(e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
    </div>
  )
}
