'use client'

import { useState, useEffect } from 'react'
import { useT, useLangue, useChoix, TYPE_DISPOSITIF_I18N } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

const SECTIONS_PRESETS: { fr: string; en: string }[] = [
  { fr: 'SOUS-SOL', en: 'BASEMENT' },
  { fr: 'REZ-DE-CHAUSSÉE', en: 'GROUND FLOOR' },
  { fr: '1ER ÉTAGE', en: '1ST FLOOR' },
  { fr: '2E ÉTAGE', en: '2ND FLOOR' },
  { fr: '3E ÉTAGE', en: '3RD FLOOR' },
  { fr: '4E ÉTAGE', en: '4TH FLOOR' },
  { fr: '5E ÉTAGE', en: '5TH FLOOR' },
  { fr: '6E ÉTAGE', en: '6TH FLOOR' },
  { fr: '7E ÉTAGE', en: '7TH FLOOR' },
  { fr: '8E ÉTAGE', en: '8TH FLOOR' },
]
const ESCALIERS_PRESETS: { fr: string; en: string }[] = [
  { fr: 'ESCALIER AVANT NORD', en: 'NORTH FRONT STAIRWELL' },
  { fr: 'ESCALIER AVANT SUD', en: 'SOUTH FRONT STAIRWELL' },
  { fr: 'ESCALIER ARRIÈRE NORD', en: 'NORTH REAR STAIRWELL' },
  { fr: 'ESCALIER ARRIÈRE SUD', en: 'SOUTH REAR STAIRWELL' },
  { fr: 'ESCALIER ARRIÈRE', en: 'REAR STAIRWELL' },
]
const AUTRES_PRESETS: { fr: string; en: string }[] = [
  { fr: 'AVERTISSEUR', en: 'WARNING DEVICE' },
  { fr: 'AVERTISSEURS DE FUMÉE', en: 'SMOKE DETECTORS' },
  { fr: "ÉCLAIRAGE D'URGENCE", en: 'EMERGENCY LIGHTING' },
  { fr: "PANNEAU D'ALARME", en: 'ALARM PANEL' },
]

// ── Ligne dispositif — éditable inline ──────────────────────────────────────
function LigneDispositif({
  dispositif,
  readOnly,
  filtreType,
  typeDispositif,
  onDeleted,
  onUpdate,
}: {
  dispositif: any
  readOnly: boolean
  filtreType: string
  typeDispositif: Record<string, string>
  onDeleted: () => void
  onUpdate: (field: string, value: any) => void
}) {
  const t = useT()
  const [d, setD] = useState<any>(dispositif)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setD(dispositif) }, [dispositif])

  if (filtreType !== 'Tous' && d.type_dispositif !== filtreType) return null

  async function patchField(field: string, value: any) {
    const token = localStorage.getItem('access_token')
    const updated = { ...d, [field]: value }
    setD(updated)
    onUpdate(field, value)
    await fetch(`${API_URL}/api/dispositifs/${d.id}/`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function supprimer() {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/dispositifs/${d.id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok || res.status === 204) onDeleted()
    setConfirmDelete(false)
  }

  const isDefect = d.annonce_statut === 'D'
  const isNI = !isDefect && d.annonce_statut === 'NI'

  return (
    <>
      <tr
        className="border-t border-gray-50 transition-colors"
        style={isDefect ? {
          background: '#fef2f2',
          borderLeft: '3px solid #ef4444',
        } : isNI ? {
          background: '#fffbeb',
          borderLeft: '3px solid #f59e0b',
        } : {}}
      >
        {/* Localisation */}
        <td className="px-3 py-2.5">
          {readOnly ? (
            <span className="text-sm font-semibold" style={{ color: isDefect ? '#e11324' : isNI ? '#b45309' : NAVY }}>
              {d.localisation}
            </span>
          ) : (
            <input
              type="text"
              defaultValue={d.localisation}
              onBlur={e => patchField('localisation', e.target.value)}
              className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-300 rounded px-1 py-0.5 min-w-[80px] font-medium"
              style={{ color: isDefect ? '#e11324' : isNI ? '#b45309' : NAVY }}
            />
          )}
        </td>

        {/* Type */}
        <td className="px-2 py-2.5">
          {readOnly ? (
            d.type_dispositif ? (
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                style={{ background: isDefect ? '#fee2e2' : isNI ? '#fef3c7' : '#f1f5f9', color: isDefect ? '#e11324' : isNI ? '#b45309' : '#475569' }}>
                {d.type_dispositif}
              </span>
            ) : <span className="text-gray-300 text-xs">—</span>
          ) : (
            <select
              value={d.type_dispositif || ''}
              onChange={e => patchField('type_dispositif', e.target.value || null)}
              className="w-full min-w-0 text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-[#e11324] bg-white"
            >
              <option value="">-</option>
              {Object.keys(typeDispositif).sort().map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          )}
        </td>

        {/* A — Installation correcte */}
        <td className="px-2 py-2.5 text-center">
          {readOnly ? (
            d.installation_correcte === true
              ? <i className="ti ti-check text-green-600 text-base" />
              : d.installation_correcte === false
              ? <i className="ti ti-x text-red-500 text-base font-bold" />
              : <span className="text-gray-300 text-xs">—</span>
          ) : (
            <select
              value={d.installation_correcte === true ? 'true' : d.installation_correcte === false ? 'false' : ''}
              onChange={e => patchField('installation_correcte', e.target.value === 'true' ? true : e.target.value === 'false' ? false : null)}
              className="w-full min-w-0 text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-[#e11324] bg-white"
            >
              <option value="">{t('so_abrege')}</option>
              <option value="true">{t('oui')}</option>
              <option value="false">{t('non')}</option>
            </select>
          )}
        </td>

        {/* B — Nécessite entretien */}
        <td className="px-2 py-2.5 text-center">
          {readOnly ? (
            d.necessite_entretien === true
              ? <i className="ti ti-check text-red-500 text-base" />
              : d.necessite_entretien === false
              ? <i className="ti ti-x text-red-500 text-base" />
              : <span className="text-gray-300 text-xs">—</span>
          ) : (
            <select
              value={d.necessite_entretien === true ? 'true' : d.necessite_entretien === false ? 'false' : ''}
              onChange={e => patchField('necessite_entretien', e.target.value === 'true' ? true : e.target.value === 'false' ? false : null)}
              className="w-full min-w-0 text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-[#e11324] bg-white"
            >
              <option value="">{t('so_abrege')}</option>
              <option value="true">{t('oui')}</option>
              <option value="false">{t('non')}</option>
            </select>
          )}
        </td>

        {/* C — Alarme confirmée */}
        <td className="px-2 py-2.5 text-center">
          {readOnly ? (
            d.alarme_confirmee === true
              ? <i className="ti ti-check text-green-600 text-base" />
              : d.alarme_confirmee === false
              ? <i className="ti ti-x text-red-500 text-base" />
              : <span className="text-gray-300 text-xs">—</span>
          ) : (
            <select
              value={d.alarme_confirmee === true ? 'true' : d.alarme_confirmee === false ? 'false' : ''}
              onChange={e => patchField('alarme_confirmee', e.target.value === 'true' ? true : e.target.value === 'false' ? false : null)}
              className="w-full min-w-0 text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-[#e11324] bg-white"
            >
              <option value="">{t('so_abrege')}</option>
              <option value="true">{t('oui')}</option>
              <option value="false">{t('non')}</option>
            </select>
          )}
        </td>

        {/* D — Statut (Défectueux / Inspecté / Non inspecté) */}
        <td className="px-2 py-2.5 text-center">
          {readOnly ? (
            d.annonce_statut ? (
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: d.annonce_statut === 'D' ? '#fee2e2' : d.annonce_statut === 'I' ? '#e9f6f2' : '#fef3c7',
                  color: d.annonce_statut === 'D' ? '#e11324' : d.annonce_statut === 'I' ? '#0d6b4f' : '#b45309',
                }}>
                {d.annonce_statut}
              </span>
            ) : <span className="text-gray-300 text-xs">—</span>
          ) : (
            <select
              value={d.annonce_statut || ''}
              onChange={e => patchField('annonce_statut', e.target.value || null)}
              className="w-full min-w-0 text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-[#e11324] bg-white"
            >
              <option value="">-</option>
              <option value="D">D</option>
              <option value="I">I</option>
              <option value="NI">NI</option>
            </select>
          )}
        </td>

        {/* E — Zone/circuit */}
        <td className="px-2 py-2.5 text-center">
          {readOnly ? (
            <span className="text-xs text-gray-500">{d.zone_circuit || '—'}</span>
          ) : (
            <input
              type="text"
              defaultValue={d.zone_circuit || ''}
              onBlur={e => patchField('zone_circuit', e.target.value)}
              placeholder="Z1"
              className="w-full min-w-0 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-300 rounded px-1 py-0.5 text-center"
            />
          )}
        </td>

        {/* Remarque */}
        <td className="px-2 py-2.5">
          {readOnly ? (
            <span className="text-xs text-gray-400">{d.remarque || '—'}</span>
          ) : (
            <input
              type="text"
              defaultValue={d.remarque || ''}
              onBlur={e => patchField('remarque', e.target.value)}
              placeholder={t('placeholder_remarque')}
              className="w-full min-w-0 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-300 rounded px-1 py-0.5"
            />
          )}
        </td>

        {!readOnly && (
          <td className="px-2 py-2.5 text-center">
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50 transition-colors mx-auto"
            >
              <i className="ti ti-trash text-red-400 text-sm" />
            </button>
          </td>
        )}
      </tr>

      {confirmDelete && (
        <tr>
          <td colSpan={readOnly ? 8 : 9}>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 text-xs border-t border-red-100">
              <i className="ti ti-alert-circle text-red-500" />
              <span className="text-red-700 font-semibold">{t('supprimer_ce_dispositif')}</span>
              <button onClick={supprimer}
                className="px-3 py-1 rounded-md bg-red-500 text-white font-bold hover:bg-red-600 transition-colors">
                {t('confirmer')}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 rounded-md border border-gray-300 font-medium hover:bg-gray-50 transition-colors">
                {t('annuler')}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Modal ajout dispositif ───────────────────────────────────────────────────
function ModalAjoutDispositif({
  sectionId,
  rapportId,
  typeDispositif,
  onClose,
  onAdded,
}: {
  sectionId: number
  rapportId: string | string[]
  typeDispositif: Record<string, string>
  onClose: () => void
  onAdded: () => void
}) {
  const t = useT()
  const [form, setForm] = useState({
    localisation: '',
    type_dispositif: '',
    zone_circuit: '',
  })
  const [nombreLignesInput, setNombreLignesInput] = useState('')
  const nombreLignes = Math.min(100, Math.max(1, parseInt(nombreLignesInput, 10) || 1))
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const [erreurChamp, setErreurChamp] = useState<'localisation' | 'type' | null>(null)

  function signalerErreur(message: string, champ: 'localisation' | 'type' | null) {
    setErreur(message)
    setErreurChamp(champ)
  }

  async function ajouter() {
    const multiple = nombreLignes > 1
    if (!multiple && !form.localisation.trim()) { signalerErreur(t('localisation_obligatoire'), 'localisation'); return }
    signalerErreur('', null)
    setSaving(true)
    const token = localStorage.getItem('access_token')
    try {
      if (multiple) {
        const prefixe = form.localisation.trim()
        for (let i = 1; i <= nombreLignes; i++) {
          const res = await fetch(`${API_URL}/api/rapports/${rapportId}/dispositifs/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              localisation: prefixe ? `${prefixe} ${i}` : String(i),
              type_dispositif: form.type_dispositif || null,
              zone_circuit: form.zone_circuit,
              section: sectionId,
            }),
          })
          if (!res.ok) { const d = await res.json().catch(() => ({})); signalerErreur(d.error || t('erreur_generique'), null); return }
        }
        onAdded(); onClose()
      } else {
        const res = await fetch(`${API_URL}/api/rapports/${rapportId}/dispositifs/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, type_dispositif: form.type_dispositif || null, section: sectionId }),
        })
        if (res.ok) { onAdded(); onClose() }
        else { const d = await res.json().catch(() => ({})); signalerErreur(d.error || t('erreur_generique'), null) }
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold" style={{ color: NAVY }}>{t('ajouter_dispositif_titre')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t('champs_obligatoires_texte')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x text-lg" />
          </button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
              {t('nombre_lignes_creer')}
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={nombreLignesInput}
              onChange={e => setNombreLignesInput(e.target.value)}
              onBlur={() => setNombreLignesInput(String(nombreLignes))}
              placeholder={t('placeholder_nb_lignes')}
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
            />
            {nombreLignes > 1 && (
              <p className="text-xs text-gray-400 mt-1">
                {nombreLignes} {t('lignes_seront_creees_de_1_a')} {nombreLignes}
                {form.localisation.trim() ? ` (ex. "${form.localisation.trim()} 1", "${form.localisation.trim()} 2"...)` : ''}{t('avec_type_dispositif_selectionne')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
              {t('localisation_label')} {nombreLignes <= 1 && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={form.localisation}
              onChange={e => { setForm({ ...form, localisation: e.target.value }); signalerErreur('', null) }}
              placeholder={nombreLignes > 1 ? t('placeholder_multi_localisation') : t('placeholder_single_localisation')}
              autoFocus
              className={`w-full border rounded-md px-3 py-2.5 text-sm focus:outline-none ${
                erreurChamp === 'localisation' ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-[#e11324]'
              }`}
            />
            {erreurChamp === 'localisation' && <p className="text-xs text-red-500 mt-1">{erreur}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
              {t('type_dispositif_label')}
            </label>
            <select
              value={form.type_dispositif}
              onChange={e => setForm({ ...form, type_dispositif: e.target.value })}
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
            >
              <option value="">-</option>
              {Object.entries(typeDispositif).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v}</option>
              ))}
            </select>
          </div>
          {erreur && !erreurChamp && <p className="text-xs text-red-500 -mt-1">{erreur}</p>}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
              {t('zone_circuit_label')}
            </label>
            <input
              type="text"
              value={form.zone_circuit}
              onChange={e => setForm({ ...form, zone_circuit: e.target.value })}
              placeholder={t('placeholder_zone_ex')}
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ color: NAVY }}>
            {t('annuler')}
          </button>
          <button
            onClick={ajouter}
            disabled={saving}
            className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: NAVY }}
          >
            {saving ? t('ajout_en_cours') : nombreLignes > 1 ? `${t('ajouter')} ${nombreLignes} ${t('lignes_mot')}` : t('ajouter')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal ajout section ──────────────────────────────────────────────────────
function ModalAjoutSection({
  rapportId,
  onClose,
  onAdded,
}: {
  rapportId: string | string[]
  onClose: () => void
  onAdded: () => void
}) {
  const t = useT()
  const langue = useLangue()
  const [nom, setNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')

  async function ajouter() {
    if (!nom.trim()) { setErreur(t('section_nom_obligatoire')); return }
    setErreur('')
    setSaving(true)
    const token = localStorage.getItem('access_token')
    try {
      const res = await fetch(`${API_URL}/api/rapports/${rapportId}/sections/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom }),
      })
      if (res.ok) { onAdded(); onClose() }
      else { const d = await res.json().catch(() => ({})); setErreur(d.error || t('erreur_generique')) }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: NAVY }}>{t('nouvelle_section_titre')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x text-lg" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {/* Nom libre */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
              {t('nom_section_label')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={e => { setNom(e.target.value); setErreur('') }}
              placeholder={t('placeholder_nom_section')}
              autoFocus
              className={`w-full border rounded-md px-3 py-2.5 text-sm focus:outline-none ${
                erreur ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-[#e11324]'
              }`}
            />
            {erreur && <p className="text-xs text-red-500 mt-1">{erreur}</p>}
          </div>

          {/* Sélection rapide — Étages */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>{t('etages_label')}</p>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS_PRESETS.map(p => {
                const label = langue === 'en' ? p.en : p.fr
                return (
                  <button key={p.fr} type="button"
                    onClick={() => { setNom(label); setErreur('') }}
                    className="text-[10px] font-semibold px-2 py-1 rounded border transition-colors"
                    style={{ borderColor: nom === label ? NAVY : '#e5e7eb', background: nom === label ? NAVY : '#f9fafb', color: nom === label ? '#fff' : '#374151' }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Escaliers */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>{t('escaliers_label')}</p>
            <div className="flex flex-wrap gap-1.5">
              {ESCALIERS_PRESETS.map(p => {
                const label = langue === 'en' ? p.en : p.fr
                return (
                  <button key={p.fr} type="button"
                    onClick={() => { setNom(label); setErreur('') }}
                    className="text-[10px] font-semibold px-2 py-1 rounded border transition-colors"
                    style={{ borderColor: nom === label ? NAVY : '#e5e7eb', background: nom === label ? NAVY : '#f9fafb', color: nom === label ? '#fff' : '#374151' }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Autres */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>{t('autres_label')}</p>
            <div className="flex flex-wrap gap-1.5">
              {AUTRES_PRESETS.map(p => {
                const label = langue === 'en' ? p.en : p.fr
                return (
                  <button key={p.fr} type="button"
                    onClick={() => { setNom(label); setErreur('') }}
                    className="text-[10px] font-semibold px-2 py-1 rounded border transition-colors"
                    style={{ borderColor: nom === label ? NAVY : '#e5e7eb', background: nom === label ? NAVY : '#f9fafb', color: nom === label ? '#fff' : '#374151' }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ color: NAVY }}>
            {t('annuler')}
          </button>
          <button
            onClick={ajouter}
            disabled={saving}
            className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: NAVY }}
          >
            {saving ? t('ajout_en_cours') : t('creer')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OngletE3 ─────────────────────────────────────────────────────────────────
export default function OngletE3({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const t = useT()
  const langue = useLangue()
  const typeDispositif = useChoix(TYPE_DISPOSITIF_I18N)
  const [sections, setSections] = useState<any[]>(rapport.sections || [])
  const [filtreType, setFiltreType] = useState('Tous')
  const [modalSection, setModalSection] = useState(false)
  const [modalDispositif, setModalDispositif] = useState<number | null>(null)
  const [generateur, setGenerateur] = useState({ nbEtages: 2, aptsParEtage: 4, sousSol: false, escaliers: false })
  const [generating, setGenerating] = useState(false)
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<number | null>(null)

  useEffect(() => { setSections(rapport.sections || []) }, [rapport])

  function updateDispositifLocal(dispositifId: number, field: string, value: any) {
    setSections(prev => prev.map(s => ({
      ...s,
      dispositifs: (s.dispositifs || []).map((d: any) =>
        d.id === dispositifId ? { ...d, [field]: value } : d
      ),
    })))
  }

  const allDispositifs = sections.flatMap(s => s.dispositifs || [])
  const total = allDispositifs.length

  const estDefectueux = (d: any) => d.annonce_statut === 'D'

  const estNonInspecte = (d: any) => !estDefectueux(d) && d.annonce_statut === 'NI'

  const defects = sections.flatMap(s =>
    (s.dispositifs || [])
      .filter(estDefectueux)
      .map((d: any) => ({ d, sectionNom: s.nom }))
  )
  const nonInspectes = sections.flatMap(s =>
    (s.dispositifs || [])
      .filter(estNonInspecte)
      .map((d: any) => ({ d, sectionNom: s.nom }))
  )
  const entretien = defects.length
  const ni = nonInspectes.length
  const conformes = total - entretien - ni

  async function genererSections() {
    setGenerating(true)
    const token = localStorage.getItem('access_token')
    const noms: string[] = []
    if (generateur.sousSol) noms.push(langue === 'en' ? 'BASEMENT' : 'SOUS-SOL')
    for (let i = 1; i <= generateur.nbEtages; i++) {
      noms.push(langue === 'en'
        ? `${i}${i === 1 ? 'ST' : i === 2 ? 'ND' : i === 3 ? 'RD' : 'TH'} FLOOR`
        : `${i}${i === 1 ? 'ER' : 'E'} ÉTAGE`)
    }
    if (generateur.escaliers) {
      noms.push(langue === 'en' ? 'NORTH FRONT STAIRWELL' : 'ESCALIER AVANT NORD')
      noms.push(langue === 'en' ? 'SOUTH FRONT STAIRWELL' : 'ESCALIER AVANT SUD')
      noms.push(langue === 'en' ? 'REAR STAIRWELL' : 'ESCALIER ARRIÈRE')
    }
    noms.push(langue === 'en' ? 'EMERGENCY LIGHTING' : 'ÉCLAIRAGE D\'URGENCE')
    noms.push(langue === 'en' ? 'SMOKE DETECTORS' : 'AVERTISSEURS DE FUMÉE')
    try {
      for (const nom of noms) {
        await fetch(`${API_URL}/api/rapports/${rapport.id}/sections/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom }),
        })
      }
      onRefresh()
    } finally { setGenerating(false) }
  }

  async function supprimerSection(id: number) {
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/sections/${id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setConfirmDeleteSection(null)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-5">
      {modalSection && (
        <ModalAjoutSection rapportId={rapport.id} onClose={() => setModalSection(false)} onAdded={onRefresh} />
      )}
      {modalDispositif !== null && (
        <ModalAjoutDispositif
          sectionId={modalDispositif}
          rapportId={rapport.id}
          typeDispositif={typeDispositif}
          onClose={() => setModalDispositif(null)}
          onAdded={onRefresh}
        />
      )}

      {/* Légende */}
      <div className="bg-gray-50 border border-gray-100 rounded-md px-4 py-3 text-xs text-gray-500 flex flex-wrap gap-x-5 gap-y-1">
        <span><strong style={{ color: NAVY }}>A</strong> — {t('legende_installation_correcte')}</span>
        <span><strong style={{ color: NAVY }}>B</strong> — {t('legende_necessite_entretien')}</span>
        <span><strong style={{ color: NAVY }}>C</strong> — {t('legende_alarme_confirmee')}</span>
        <span><strong style={{ color: NAVY }}>D</strong> — {t('legende_statut_detail')}</span>
        <span><strong style={{ color: NAVY }}>E</strong> — {t('zone_circuit_label')}</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#fee2e2', border: '2px solid #ef4444' }} />
          <span className="text-red-600 font-semibold">{t('ligne_rouge_defaut')}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#fef3c7', border: '2px solid #f59e0b' }} />
          <span className="font-semibold" style={{ color: '#b45309' }}>{t('ligne_jaune_ni')}</span>
        </span>
      </div>

      {/* Sommaire */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: t('total'), value: total, bg: NAVY, color: '#fff', icon: 'ti-device-desktop-analytics' },
          { label: t('conformes'), value: conformes, bg: '#e9f6f2', color: '#0d6b4f', icon: 'ti-check' },
          { label: t('entretien_requis_label'), value: entretien, bg: entretien > 0 ? '#fee2e2' : '#f8fafc', color: entretien > 0 ? '#e11324' : '#94a3b8', icon: 'ti-alert-triangle' },
          { label: t('non_inspectes'), value: ni, bg: ni > 0 ? '#fef3c7' : '#f8fafc', color: ni > 0 ? '#b45309' : '#94a3b8', icon: 'ti-eye-off' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-md border border-gray-100 p-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
              <i className={`ti ${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none" style={{ color: NAVY }}>{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tableau récapitulatif des défauts */}
      {defects.length > 0 && (
        <div className="bg-white rounded-md border border-red-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-red-100 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #fff5f5, #fff8f8)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                <i className="ti ti-alert-triangle text-sm" style={{ color: '#e11324' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#e11324' }}>
                  {defects.length} {defects.length > 1 ? t('defauts_pluriel') : t('defaut_singulier')} {defects.length > 1 ? t('detectes_pluriel') : t('detecte_singulier')}
                </p>
                <p className="text-xs text-red-400">{t('resume_anomalies')}</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-red-400 bg-red-50">
                  <th className="text-left px-4 py-2.5">{t('col_section')}</th>
                  <th className="text-left px-3 py-2.5">{t('localisation_label')}</th>
                  <th className="text-left px-3 py-2.5">{t('col_type')}</th>
                  <th className="text-left px-3 py-2.5">{t('col_probleme')}</th>
                </tr>
              </thead>
              <tbody>
                {defects.map((item: any, idx: number) => (
                  <tr key={item.d.id} className={`border-t border-red-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}`}>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 font-medium">{item.sectionNom}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-bold" style={{ color: '#e11324' }}>
                        {item.d.localisation}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        {item.d.type_dispositif}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {item.d.necessite_entretien && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            <i className="ti ti-tool text-[9px]" /> {t('entretien_requis_label')}
                          </span>
                        )}
                        {item.d.installation_correcte === false && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            <i className="ti ti-x text-[9px]" /> {t('installation_non_conforme')}
                          </span>
                        )}
                        {item.d.alarme_confirmee === false && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            <i className="ti ti-bell-off text-[9px]" /> {t('alarme_non_confirmee')}
                          </span>
                        )}
                        {item.d.annonce_statut === 'D' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            <i className="ti ti-speakerphone text-[9px]" /> {t('dispositif_defectueux_d')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tableau récapitulatif des non inspectés (NI) */}
      {nonInspectes.length > 0 && (
        <div className="bg-white rounded-md border overflow-hidden shadow-sm" style={{ borderColor: '#fde68a' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #fffbeb, #fffdf5)', borderColor: '#fef3c7' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
                <i className="ti ti-eye-off text-sm" style={{ color: '#b45309' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#b45309' }}>
                  {nonInspectes.length} {nonInspectes.length > 1 ? t('dispositifs_pluriel') : t('dispositif_singulier')} {nonInspectes.length > 1 ? t('non_inspectes_pluriel') : t('non_inspecte_singulier')}
                </p>
                <p className="text-xs" style={{ color: '#d0a24c' }}>{t('resume_lignes_ni')}</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest bg-amber-50" style={{ color: '#d0a24c' }}>
                  <th className="text-left px-4 py-2.5">{t('col_section')}</th>
                  <th className="text-left px-3 py-2.5">{t('localisation_label')}</th>
                  <th className="text-left px-3 py-2.5">{t('col_type')}</th>
                  <th className="text-left px-3 py-2.5">{t('statut')}</th>
                </tr>
              </thead>
              <tbody>
                {nonInspectes.map((item: any, idx: number) => (
                  <tr key={item.d.id} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}`} style={{ borderColor: '#fef3c7' }}>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 font-medium">{item.sectionNom}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-bold" style={{ color: '#b45309' }}>
                        {item.d.localisation}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100" style={{ color: '#b45309' }}>
                        {item.d.type_dispositif}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100" style={{ color: '#b45309' }}>
                        <i className="ti ti-eye-off text-[9px]" /> {t('non_inspecte_ni')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bouton ajout section — toujours visible */}
      {!readOnly && (
        <div className="flex justify-end">
          <button onClick={() => setModalSection(true)}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-md text-sm font-bold hover:border-[#0a0b0d] transition-colors"
            style={{ color: NAVY }}>
            <i className="ti ti-plus" /> {t('ajouter_section_btn')}
          </button>
        </div>
      )}

      {/* Générateur — raccourci quand aucune section n'existe encore */}
      {sections.length === 0 && !readOnly && (
        <div className="bg-white rounded-md border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: NAVY }}>
              <i className="ti ti-building text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: NAVY }}>{t('configurer_immeuble')}</h3>
              <p className="text-xs text-gray-400">{t('generer_sections_sous_titre')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
                {t('nombre_etages_label')} <span className="text-red-500">*</span>
              </label>
              <input type="number" min={1} max={20} value={generateur.nbEtages}
                onChange={e => setGenerateur({ ...generateur, nbEtages: Math.min(20, Math.max(1, Number(e.target.value))) })}
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: NAVY }}>
                {t('appartements_etage_label')}
              </label>
              <input type="number" min={1} max={50} value={generateur.aptsParEtage}
                onChange={e => setGenerateur({ ...generateur, aptsParEtage: Math.min(50, Math.max(1, Number(e.target.value))) })}
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324]" />
            </div>
          </div>
          <div className="flex gap-6 mb-5">
            {[
              ['sousSol', t('inclure_sous_sol')],
              ['escaliers', t('inclure_escaliers')],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox"
                  checked={(generateur as any)[key]}
                  onChange={e => setGenerateur({ ...generateur, [key]: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#0a0b0d]" />
                <span className="text-sm text-gray-600">{label}</span>
              </label>
            ))}
          </div>
          <button onClick={genererSections} disabled={generating}
            className="w-full text-white py-3 rounded-md text-sm font-bold uppercase tracking-wide disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: ORANGE }}>
            {generating ? t('generation_en_cours') : t('generer_sections_btn')}
          </button>
        </div>
      )}

      {/* Filtre type */}
      <div className="flex flex-wrap gap-2">
        {['Tous', ...Object.keys(typeDispositif).sort()].map(tp => (
          <button key={tp} onClick={() => setFiltreType(tp)}
            className="px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150"
            style={{ background: filtreType === tp ? NAVY : '#f1f5f9', color: filtreType === tp ? '#fff' : '#64748b' }}>
            {tp === 'Tous' ? t('tous') : tp}
          </button>
        ))}
      </div>

      {sections.length === 0 && readOnly && (
        <p className="text-gray-400 text-sm text-center py-10">{t('aucune_section_creee')}</p>
      )}

      {/* Sections */}
      {sections.map(section => {
        const dispFiltres = (section.dispositifs || []).filter(
          (d: any) => filtreType === 'Tous' || d.type_dispositif === filtreType
        )
        const nbDefectSection = (section.dispositifs || []).filter(
          (d: any) => d.annonce_statut === 'D'
        ).length
        const nbNISection = (section.dispositifs || []).filter(estNonInspecte).length

        return (
          <div key={section.id} className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b flex items-center justify-between"
              style={{ background: nbDefectSection > 0 ? '#fff5f5' : nbNISection > 0 ? '#fffbeb' : '#f2edfa', borderColor: nbDefectSection > 0 ? '#fecaca' : nbNISection > 0 ? '#fde68a' : '#e9e0f8' }}>
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold" style={{ color: nbDefectSection > 0 ? '#e11324' : nbNISection > 0 ? '#b45309' : '#4b2f8c' }}>
                  {section.nom}
                </p>
                <span className="text-xs text-gray-500">
                  {section.dispositifs?.length || 0} {(section.dispositifs?.length || 0) !== 1 ? t('dispositifs_pluriel') : t('dispositif_singulier')}
                </span>
                {nbDefectSection > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    <i className="ti ti-alert-triangle text-[9px]" /> {nbDefectSection} {nbDefectSection > 1 ? t('defauts_pluriel') : t('defaut_singulier')}
                  </span>
                )}
                {nbNISection > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100" style={{ color: '#b45309' }}>
                    <i className="ti ti-eye-off text-[9px]" /> {nbNISection} NI
                  </span>
                )}
              </div>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setModalDispositif(section.id)}
                    className="text-xs px-3 py-1.5 rounded-md font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
                    style={{ background: NAVY, color: '#fff' }}>
                    <i className="ti ti-plus text-xs" /> {t('ajouter')}
                  </button>
                  {confirmDeleteSection === section.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => supprimerSection(section.id)}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-red-500 text-white font-bold">{t('confirmer')}</button>
                      <button onClick={() => setConfirmDeleteSection(null)}
                        className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 font-medium">{t('annuler')}</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteSection(section.id)}
                      className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50 transition-colors">
                      <i className="ti ti-trash text-red-400 text-sm" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {dispFiltres.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                {filtreType !== 'Tous'
                  ? `${t('aucun_dispositif_type_prefix')} ${filtreType} ${t('aucun_dispositif_type_suffix')}`
                  : readOnly ? t('aucun_dispositif_section') : t('aucun_dispositif_cliquez')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed min-w-[820px]">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[7%]" />
                    <col className={readOnly ? 'w-[33%]' : 'w-[28%]'} />
                    {!readOnly && <col className="w-[5%]" />}
                  </colgroup>
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50">
                      <th className="text-left px-3 py-2.5">{t('localisation_label')}</th>
                      <th className="text-left px-2 py-2.5">{t('col_type')}</th>
                      <th className="text-center px-2 py-2.5">A</th>
                      <th className="text-center px-2 py-2.5">B</th>
                      <th className="text-center px-2 py-2.5">C</th>
                      <th className="text-center px-2 py-2.5">D</th>
                      <th className="text-center px-2 py-2.5">E</th>
                      <th className="text-left px-2 py-2.5">{t('col_remarque')}</th>
                      {!readOnly && <th className="px-2 py-2.5" />}
                    </tr>
                  </thead>
                  <tbody>
                    {dispFiltres.map((d: any) => (
                      <LigneDispositif
                        key={d.id}
                        dispositif={d}
                        readOnly={readOnly}
                        filtreType={filtreType}
                        typeDispositif={typeDispositif}
                        onDeleted={onRefresh}
                        onUpdate={(field, value) => updateDispositifLocal(d.id, field, value)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
