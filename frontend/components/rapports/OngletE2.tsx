'use client'

import { useState, useEffect } from 'react'
import { E2_STRUCTURE } from '@/lib/e2Structure'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

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

export default function OngletE2({
  rapport,
  readOnly,
  onSaved,
}: {
  rapport: any
  readOnly: boolean
  onSaved: () => void
}) {
  const [sectionActive, setSectionActive] = useState('e2_1')
  const [details, setDetails] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    setDetails(rapport.fiche_e2?.details || {})
  }, [rapport])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function getSectionData(id: string) {
    return details[id] || {}
  }

  function updateSectionField(id: string, field: string, value: any) {
    setDetails(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function sauvegarderSection(sectionId: string) {
    setSaving(true)
    const token = localStorage.getItem('access_token')
    try {
      const res = await fetch(`${API_URL}/api/rapports/${rapport.id}/fiche-e2/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ details }),
      })
      if (res.ok) {
        showToast(`Section ${sectionId.replace('_', '.').toUpperCase()} sauvegardée.`, 'success')
        onSaved()
      } else {
        const d = await res.json().catch(() => ({}))
        showToast(d.error || 'Erreur lors de la sauvegarde.', 'error')
      }
    } catch {
      showToast('Erreur réseau.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const section = E2_STRUCTURE.find(s => s.id === sectionActive)!
  const sectionData = getSectionData(sectionActive)

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Navigation latérale — desktop */}
      <div className="hidden md:flex flex-col w-44 flex-shrink-0 gap-0.5">
        {E2_STRUCTURE.map(s => (
          <button
            key={s.id}
            onClick={() => setSectionActive(s.id)}
            className="text-left px-3 py-2 rounded-md text-xs font-semibold transition-all duration-150"
            style={{
              background: sectionActive === s.id ? 'rgba(16,42,67,0.08)' : 'transparent',
              color: sectionActive === s.id ? NAVY : '#6b7280',
              borderLeft: sectionActive === s.id ? `3px solid ${ORANGE}` : '3px solid transparent',
            }}
          >
            {s.id.replace('_', '.').toUpperCase().replace('E2', 'E2')}
          </button>
        ))}
      </div>

      {/* Navigation mobile — tabs scrollables */}
      <div className="md:hidden w-full overflow-x-auto pb-2 mb-2">
        <div className="flex gap-1 min-w-max">
          {E2_STRUCTURE.map(s => (
            <button
              key={s.id}
              onClick={() => setSectionActive(s.id)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap"
              style={{
                background: sectionActive === s.id ? NAVY : '#f1f5f9',
                color: sectionActive === s.id ? '#fff' : '#6b7280',
              }}
            >
              {s.id.replace('e2_', 'E2.')}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-md border border-gray-100 p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: NAVY }}>{section.titre}</h3>

          {section.hasLocDesc && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 pb-5 border-b border-gray-100">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
                  Localisation
                </label>
                {readOnly ? (
                  <p className="text-sm px-3 py-2 bg-gray-50 rounded-md" style={{ color: sectionData.localisation ? NAVY : '#9ca3af' }}>
                    {sectionData.localisation || '—'}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={sectionData.localisation || ''}
                    onChange={e => updateSectionField(sectionActive, 'localisation', e.target.value)}
                    placeholder="ex. Rez-de-chaussée, local 101"
                    className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
                  Description
                </label>
                {readOnly ? (
                  <p className="text-sm px-3 py-2 bg-gray-50 rounded-md" style={{ color: sectionData.description ? NAVY : '#9ca3af' }}>
                    {sectionData.description || '—'}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={sectionData.description || ''}
                    onChange={e => updateSectionField(sectionActive, 'description', e.target.value)}
                    placeholder="ex. Panneau VIGILANT XL"
                    className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
                  />
                )}
              </div>
            </div>
          )}

          {section.isTexteLibre ? (
            <div>
              {readOnly ? (
                <p className="text-sm px-3 py-2 bg-gray-50 rounded-md min-h-[100px]"
                  style={{ color: sectionData.remarques ? NAVY : '#9ca3af' }}>
                  {sectionData.remarques || section.items[0]?.placeholder || '—'}
                </p>
              ) : (
                <textarea
                  value={sectionData.remarques || ''}
                  onChange={e => updateSectionField(sectionActive, 'remarques', e.target.value)}
                  placeholder={section.items[0]?.placeholder || 'Saisir vos remarques...'}
                  rows={5}
                  className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324] resize-none"
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {section.items.map(item => (
                <div key={item.id} className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: `${NAVY}18`, color: NAVY }}>
                    {item.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 leading-relaxed mb-1.5">{item.label}</p>
                    {item.type === 'oui_non_so' ? (
                      readOnly ? (
                        <p className="text-xs font-semibold"
                          style={{ color: sectionData[item.id] === 'oui' ? '#0d6b4f' : sectionData[item.id] === 'non' ? '#c0392b' : '#9ca3af' }}>
                          {sectionData[item.id] === 'oui' ? 'Oui' : sectionData[item.id] === 'non' ? 'Non' : sectionData[item.id] === 'sans_objet' ? 'Sans objet' : '—'}
                        </p>
                      ) : (
                        <select
                          value={sectionData[item.id] || ''}
                          onChange={e => updateSectionField(sectionActive, item.id, e.target.value)}
                          className="border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#e11324]"
                        >
                          <option value="">—</option>
                          <option value="oui">Oui</option>
                          <option value="non">Non</option>
                          <option value="sans_objet">Sans objet</option>
                        </select>
                      )
                    ) : (
                      readOnly ? (
                        <p className="text-sm px-3 py-1.5 bg-gray-50 rounded-md"
                          style={{ color: sectionData[item.id] ? NAVY : '#9ca3af' }}>
                          {sectionData[item.id] || '—'}
                        </p>
                      ) : (
                        <input
                          type="text"
                          value={sectionData[item.id] || ''}
                          onChange={e => updateSectionField(sectionActive, item.id, e.target.value)}
                          placeholder={item.placeholder || ''}
                          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#e11324]"
                        />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!readOnly && (
            <button
              onClick={() => sauvegarderSection(sectionActive)}
              disabled={saving}
              className="mt-6 w-full text-white py-3 rounded-md text-sm font-bold uppercase disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: NAVY }}
            >
              {saving ? 'Sauvegarde...' : `Sauvegarder ${sectionActive.replace('_', '.').toUpperCase()}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
