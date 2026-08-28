'use client'

import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

const LEGENDE: { code: string; description: string }[] = [
  { code: 'PAI', description: "Panneau annonciateur d'alarme" },
  { code: 'M', description: 'Station manuelle' },
  { code: 'S', description: 'Détecteur de fumée' },
  { code: 'C', description: 'Cloche' },
  { code: 'K', description: 'Klaxon' },
  { code: 'RHT', description: 'Détecteur de chaleur' },
  { code: 'FDL', description: 'Résistance de fin de ligne' },
  { code: 'PZ', description: 'Piézo' },
  { code: 'ISO', description: 'Module isolateur' },
  { code: 'ANN', description: "Panneau annonciateur d'alarme" },
  { code: 'DFG', description: 'Détecteur de fumée gaine ventilation' },
  { code: 'TEL', description: "Téléphone d'urgence (pompier)" },
  { code: 'IDG', description: 'Gicleur débit' },
  { code: 'IVG', description: 'Interrupteur vanne gicleur' },
  { code: 'IHP', description: 'Interrupteur haute pression' },
  { code: 'IBH', description: 'Interrupteur de basse pression' },
  { code: 'K/S', description: 'Klaxon strobe' },
  { code: 'MA', description: 'Module adressable' },
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
        showToast('Erreur lors de la sauvegarde.', 'error')
      }
    } catch {
      showToast('Erreur réseau.', 'error')
    }
  }

  return (
    <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold" style={{ color: NAVY }}>Légende des dispositifs</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Référence des abréviations utilisées à l'onglet E3 — précisez le type et le numéro de modèle réellement installés.
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
              <th className="px-2 sm:px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">Dispositif</th>
              <th className="px-2 sm:px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">Description</th>
              <th className="px-1.5 sm:px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">Type</th>
              <th className="px-1.5 sm:px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">No modèle</th>
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
                    {description}
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
