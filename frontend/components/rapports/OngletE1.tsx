'use client'

import { useState, useEffect } from 'react'
import { useT, useLangue } from '@/lib/i18n'

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

const CHAMPS: { key: string; lettre: string; label: { fr: string; en: string } }[] = [
  { key: 'fonctionnement_une_etape',    lettre: 'A', label: { fr: 'Fonctionnement en une étape', en: 'One-stage operation' } },
  { key: 'fonctionnement_deux_etapes',  lettre: 'B', label: { fr: 'Fonctionnement en deux étapes', en: 'Two-stage operation' } },
  { key: 'inspection_essai_conforme',   lettre: 'C', label: { fr: "Inspection et mise à l'essai conforme (CAN/ULC-S536)", en: 'Inspection and testing compliant (CAN/ULC-S536)' } },
  { key: 'documentation_sur_place',     lettre: 'D', label: { fr: 'Documentation du réseau sur place', en: 'System documentation on site' } },
  { key: 'reseau_fonctionnel',          lettre: 'E', label: { fr: 'Réseau surveillé complètement fonctionnel', en: 'Supervised system fully functional' } },
  { key: 'lacunes_constatees',          lettre: 'F', label: { fr: 'Le réseau présente des lacunes', en: 'The system has deficiencies' } },
  { key: 'copie_remise_responsable',    lettre: 'H', label: { fr: 'Copie remise au responsable du bâtiment', en: 'Copy handed to the building manager' } },
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
  const t = useT()
  const langue = useLangue()
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
      errs.push(t('erreur_mode_fonctionnement'))
    if (form.inspection_essai_conforme === null)
      errs.push(t('erreur_inspection_conforme'))
    if (form.reseau_fonctionnel === null)
      errs.push(t('erreur_reseau_fonctionnel'))
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
        showToast(t('fiche_e1_sauvegardee'), 'success')
        onSaved()
      } else {
        const d = await res.json().catch(() => ({}))
        showToast(d.error || t('erreur_sauvegarde'), 'error')
      }
    } catch {
      showToast(t('erreur_reseau'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="bg-white rounded-md border border-gray-100 p-5">
        <h3 className="text-sm font-bold mb-4" style={{ color: NAVY }}>
          {t('rapport_annuel_titre')}
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
                <p className="text-xs text-gray-500 leading-relaxed mb-1.5">{label[langue] ?? label.fr}</p>
                {readOnly ? (
                  <p className="text-xs font-semibold"
                    style={{
                      color: form[key] === true ? '#0d6b4f'
                        : form[key] === false ? '#c0392b'
                        : '#9ca3af',
                    }}>
                    {form[key] === true ? t('oui') : form[key] === false ? t('non') : '—'}
                  </p>
                ) : (
                  <select
                    value={boolToStr(form[key])}
                    onChange={e => { setForm({ ...form, [key]: strToBool(e.target.value) }); setErreurs([]) }}
                    className="border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#e11324]"
                  >
                    <option value="">—</option>
                    <option value="true">{t('oui')}</option>
                    <option value="false">{t('non')}</option>
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
              <p className="text-xs text-gray-500 leading-relaxed mb-1.5">{t('commentaires_label')}</p>
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
                  placeholder={t('saisir_commentaires_placeholder')}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#e11324] resize-none"
                />
              )}
            </div>
          </div>
        </div>

        {rapport.fiche_e1?.signataire && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
            <i className="ti ti-writing text-xs text-gray-400" />
            <p className="text-xs text-gray-400">
              {t('signe_par')} <strong style={{ color: NAVY }}>{rapport.fiche_e1.signataire.username}</strong>{' '}
              {t('le_prefix')} {new Date(rapport.fiche_e1.date_signature).toLocaleDateString(langue === 'en' ? 'en-CA' : 'fr-CA')}
            </p>
          </div>
        )}

        {erreurs.length > 0 && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="ti ti-alert-circle text-red-500 text-sm" />
              <p className="text-xs font-bold text-red-700">{t('champs_obligatoires_manquants')}</p>
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
            {saving ? t('sauvegarde_en_cours') : t('sauvegarder_e1')}
          </button>
        )}
      </div>
    </div>
  )
}
