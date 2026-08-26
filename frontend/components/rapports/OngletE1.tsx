'use client'

import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

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

const CHAMPS: { key: string; lettre: string; label: string }[] = [
  { key: 'fonctionnement_une_etape',    lettre: 'A', label: 'Fonctionnement en une étape' },
  { key: 'fonctionnement_deux_etapes',  lettre: 'B', label: 'Fonctionnement en deux étapes' },
  { key: 'inspection_essai_conforme',   lettre: 'C', label: "Inspection et mise à l'essai conforme (CAN/ULC-S536)" },
  { key: 'documentation_sur_place',     lettre: 'D', label: 'Documentation du réseau sur place' },
  { key: 'reseau_fonctionnel',          lettre: 'E', label: 'Réseau surveillé complètement fonctionnel' },
  { key: 'lacunes_constatees',          lettre: 'F', label: 'Le réseau présente des lacunes' },
  { key: 'copie_remise_responsable',    lettre: 'H', label: 'Copie remise au responsable du bâtiment' },
]

export default function OngletE1({
  rapport,
  readOnly,
  onSaved,
}: {
  rapport: any
  readOnly: boolean
  onSaved: () => void
}) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [erreurs, setErreurs] = useState<string[]>([])

  useEffect(() => {
    const e1 = rapport.fiche_e1 || {}
    setForm({
      fonctionnement_une_etape:   e1.fonctionnement_une_etape   ?? null,
      fonctionnement_deux_etapes: e1.fonctionnement_deux_etapes ?? null,
      inspection_essai_conforme:  e1.inspection_essai_conforme  ?? null,
      documentation_sur_place:    e1.documentation_sur_place    ?? null,
      reseau_fonctionnel:         e1.reseau_fonctionnel         ?? null,
      lacunes_constatees:         e1.lacunes_constatees         ?? null,
      commentaires:               e1.commentaires || '',
      copie_remise_responsable:   e1.copie_remise_responsable   ?? null,
    })
  }, [rapport])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function boolToStr(v: boolean | null): string {
    if (v === true)  return 'true'
    if (v === false) return 'false'
    return ''
  }

  function strToBool(v: string): boolean | null {
    if (v === 'true')  return true
    if (v === 'false') return false
    return null
  }

  async function sauvegarder() {
    const errs: string[] = []
    if (form.fonctionnement_une_etape === null && form.fonctionnement_deux_etapes === null)
      errs.push('A ou B — Indiquez le mode de fonctionnement.')
    if (form.inspection_essai_conforme === null)
      errs.push('C — Indiquez si l\'inspection est conforme.')
    if (form.reseau_fonctionnel === null)
      errs.push('E — Indiquez si le réseau est fonctionnel.')
    if (errs.length > 0) { setErreurs(errs); return }
    setErreurs([])
    setSaving(true)
    const token = localStorage.getItem('access_token')
    try {
      const res = await fetch(`${API_URL}/api/rapports/${rapport.id}/fiche-e1/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        showToast('Fiche E1 sauvegardée.', 'success')
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

  return (
    <div className="max-w-2xl">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="bg-white rounded-md border border-gray-100 p-5">
        <h3 className="text-sm font-bold mb-4" style={{ color: NAVY }}>
          Rapport annuel de mise à l'essai et d'inspection
        </h3>

        <div className="flex flex-col gap-3">
          {CHAMPS.map(({ key, lettre, label }) => (
            <div key={key} className="flex items-start gap-3">
              <span
                className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                style={{ background: `${NAVY}18`, color: NAVY }}
              >
                {lettre}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 leading-relaxed mb-1.5">{label}</p>
                {readOnly ? (
                  <p className="text-xs font-semibold"
                    style={{
                      color: form[key] === true ? '#0d6b4f'
                        : form[key] === false ? '#c0392b'
                        : '#9ca3af',
                    }}>
                    {form[key] === true ? 'Oui' : form[key] === false ? 'Non' : '—'}
                  </p>
                ) : (
                  <select
                    value={boolToStr(form[key])}
                    onChange={e => { setForm({ ...form, [key]: strToBool(e.target.value) }); setErreurs([]) }}
                    className="border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#dc2626]"
                  >
                    <option value="">—</option>
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                )}
              </div>
            </div>
          ))}

          {/* G — Commentaires */}
          <div className="flex items-start gap-3">
            <span
              className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
              style={{ background: `${NAVY}18`, color: NAVY }}
            >
              G
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 leading-relaxed mb-1.5">Commentaires</p>
              {readOnly ? (
                <p className="text-sm px-3 py-1.5 bg-gray-50 rounded-md min-h-[60px]"
                  style={{ color: form.commentaires ? '#111827' : '#9ca3af' }}>
                  {form.commentaires || '—'}
                </p>
              ) : (
                <textarea
                  value={form.commentaires}
                  onChange={e => setForm({ ...form, commentaires: e.target.value })}
                  rows={3}
                  placeholder="Saisir vos commentaires..."
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#dc2626] resize-none"
                />
              )}
            </div>
          </div>
        </div>

        {rapport.fiche_e1?.signataire && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
            <i className="ti ti-writing text-xs text-gray-400" />
            <p className="text-xs text-gray-400">
              Signé par <strong style={{ color: NAVY }}>{rapport.fiche_e1.signataire.username}</strong>{' '}
              le {new Date(rapport.fiche_e1.date_signature).toLocaleDateString('fr-CA')}
            </p>
          </div>
        )}

        {erreurs.length > 0 && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="ti ti-alert-circle text-red-500 text-sm" />
              <p className="text-xs font-bold text-red-700">Champs obligatoires manquants</p>
            </div>
            <ul className="flex flex-col gap-1">
              {erreurs.map((e, i) => (
                <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!readOnly && (
          <button
            onClick={sauvegarder}
            disabled={saving}
            className="mt-6 w-full text-white py-3 rounded-md text-sm font-bold uppercase disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: NAVY }}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder E1'}
          </button>
        )}
      </div>
    </div>
  )
}
