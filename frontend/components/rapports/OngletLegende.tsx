'use client'

import { useState, useEffect } from 'react'
import { useT, useLangue } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

const LEGENDE: { code: string; description: { fr: string; en: string } }[] = [
  { code: 'PAI', description: { fr: "Panneau annonciateur d'alarme", en: 'Fire alarm annunciator panel' } },
  { code: 'M', description: { fr: 'Station manuelle', en: 'Manual pull station' } },
  { code: 'S', description: { fr: 'Détecteur de fumée', en: 'Smoke detector' } },
  { code: 'C', description: { fr: 'Cloche', en: 'Bell' } },
  { code: 'K', description: { fr: 'Klaxon', en: 'Horn' } },
  { code: 'RHT', description: { fr: 'Détecteur de chaleur', en: 'Heat detector' } },
  { code: 'FDL', description: { fr: 'Résistance de fin de ligne', en: 'End-of-line resistor' } },
  { code: 'PZ', description: { fr: 'Piézo', en: 'Piezo sounder' } },
  { code: 'ISO', description: { fr: 'Module isolateur', en: 'Isolator module' } },
  { code: 'ANN', description: { fr: "Panneau annonciateur d'alarme", en: 'Fire alarm annunciator panel' } },
  { code: 'DFG', description: { fr: 'Détecteur de fumée gaine ventilation', en: 'Duct smoke detector' } },
  { code: 'TEL', description: { fr: "Téléphone d'urgence (pompier)", en: 'Emergency telephone (fireman)' } },
  { code: 'IDG', description: { fr: 'Gicleur débit', en: 'Sprinkler flow switch' } },
  { code: 'IVG', description: { fr: 'Interrupteur vanne gicleur', en: 'Sprinkler valve switch' } },
  { code: 'IHP', description: { fr: 'Interrupteur haute pression', en: 'High-pressure switch' } },
  { code: 'IBH', description: { fr: 'Interrupteur de basse pression', en: 'Low-pressure switch' } },
  { code: 'K/S', description: { fr: 'Klaxon strobe', en: 'Horn strobe' } },
  { code: 'MA', description: { fr: 'Module adressable', en: 'Addressable module' } },
]

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border px-5 py-3.5"
      style={{ borderColor: type === 'success' ? '#bbf7d0' : '#fecaca' }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: type === 'success' ? '#f0fdf4' : '#fef2f2' }}>
        <i className={`ti ${type === 'success' ? 'ti-check text-green-600' : 'ti-x text-red-500'} text-sm`} />
      </div>
      <p className="text-sm font-semibold" style={{ color: NAVY }}>{msg}</p>
    </div>
  )
}

export default function OngletLegende({
  rapport,
  readOnly,
  onSaved,
}: {
  rapport: any
  readOnly: boolean
  onSaved: () => void
}) {
  const t = useT()
  const langue = useLangue()
  const [lignes, setLignes] = useState<Record<string, { type?: string; modele?: string }>>({})
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    setLignes(rapport.fiche_legende?.dispositifs || {})
  }, [rapport])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  async function patchLigne(code: string, field: 'type' | 'modele', value: string) {
    const updated = { ...lignes, [code]: { ...lignes[code], [field]: value } }
    setLignes(updated)
    const token = localStorage.getItem('access_token')
    try {
      const res = await fetch(`${API_URL}/api/rapports/${rapport.id}/fiche-legende/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispositifs: updated }),
      })
      if (res.ok) {
        onSaved()
      } else {
        showToast(t('erreur_sauvegarde'), 'error')
      }
    } catch {
      showToast(t('erreur_reseau'), 'error')
    }
  }

  return (
    <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold" style={{ color: NAVY }}>{t('legende_dispositifs_titre')}</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {t('legende_dispositifs_sous_titre')}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[37%]" />
            <col className="w-[25%]" />
            <col className="w-[25%]" />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-2 sm:px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">{t('col_dispositif')}</th>
              <th className="px-2 sm:px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">{t('description_label')}</th>
              <th className="px-1.5 sm:px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">{t('col_type')}</th>
              <th className="px-1.5 sm:px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">{t('col_no_modele')}</th>
            </tr>
          </thead>
          <tbody>
            {LEGENDE.map(({ code, description }) => {
              const ligne = lignes[code] || {}
              return (
                <tr key={code} className="border-t border-gray-50">
                  <td className="px-2 sm:px-3 py-2.5 font-mono font-bold text-xs align-top" style={{ color: NAVY }}>
                    {code}
                  </td>
                  <td className="px-2 sm:px-3 py-2.5 text-xs sm:text-sm text-gray-600 leading-snug align-top break-words">
                    {description[langue] ?? description.fr}
                  </td>
                  <td className="px-1 sm:px-2 py-2 align-top">
                    {readOnly ? (
                      <span className="text-xs sm:text-sm break-words" style={{ color: ligne.type ? NAVY : '#cbd5e1' }}>{ligne.type || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        defaultValue={ligne.type || ''}
                        onBlur={e => e.target.value !== (ligne.type || '') && patchLigne(code, 'type', e.target.value)}
                        className="w-full min-w-0 text-xs sm:text-sm border border-gray-200 rounded px-1.5 sm:px-2 py-1.5 focus:outline-none focus:border-[#e11324] bg-white"
                      />
                    )}
                  </td>
                  <td className="px-1 sm:px-2 py-2 align-top">
                    {readOnly ? (
                      <span className="text-xs sm:text-sm break-words" style={{ color: ligne.modele ? NAVY : '#cbd5e1' }}>{ligne.modele || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        defaultValue={ligne.modele || ''}
                        onBlur={e => e.target.value !== (ligne.modele || '') && patchLigne(code, 'modele', e.target.value)}
                        className="w-full min-w-0 text-xs sm:text-sm border border-gray-200 rounded px-1.5 sm:px-2 py-1.5 focus:outline-none focus:border-[#e11324] bg-white"
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
