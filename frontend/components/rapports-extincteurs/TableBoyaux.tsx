'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useT, useChoix, LONGUEUR_CHOICES_I18N } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'

// ── Saisie d'année auto-formatée AAAA (4 chiffres, pas de jour/mois) ────────
function AnneeMaskInput({
  value,
  readOnly,
  onCommit,
}: {
  value: string
  readOnly: boolean
  onCommit: (annee: string | null) => void
}) {
  const [text, setText] = useState(value || '')

  useEffect(() => { setText(value || '') }, [value])

  if (readOnly) {
    return <span className="text-xs text-gray-500">{value || '—'}</span>
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
    setText(digits)
    if (digits.length === 4) onCommit(digits)
    else if (digits.length === 0) onCommit(null)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={handleChange}
      placeholder="AAAA"
      maxLength={4}
      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#e11324] bg-white w-[70px]"
    />
  )
}

// ── Ligne éditable ───────────────────────────────────────────────────────────
function LigneBoyau({
  item,
  readOnly,
  onDeleted,
  onUpdate,
}: {
  item: any
  readOnly: boolean
  onDeleted: () => void
  onUpdate: (field: string, value: any) => void
}) {
  const t = useT()
  const LONGUEUR_CHOICES = useChoix(LONGUEUR_CHOICES_I18N)
  const [it, setIt] = useState<any>(item)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [erreurChamp, setErreurChamp] = useState<string | null>(null)

  useEffect(() => { setIt(item) }, [item])

  async function patchField(field: string, value: any) {
    const ancienneValeur = it[field]
    const token = localStorage.getItem('access_token')
    const updated = { ...it, [field]: value }
    setIt(updated)
    onUpdate(field, value)
    setErreurChamp(null)
    try {
      const res = await fetch(`${API_URL}/api/boyaux/${it.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) {
        setIt((prev: any) => ({ ...prev, [field]: ancienneValeur }))
        onUpdate(field, ancienneValeur)
        setErreurChamp(t('non_enregistre_reessayez'))
      }
    } catch {
      setIt((prev: any) => ({ ...prev, [field]: ancienneValeur }))
      onUpdate(field, ancienneValeur)
      setErreurChamp(t('erreur_reseau_non_enregistre'))
    }
  }

  async function supprimer() {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/boyaux/${it.id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok || res.status === 204) onDeleted()
    setConfirmDelete(false)
  }

  const textInput = (field: string, placeholder = '', width = '') => (
    readOnly ? (
      <span className="text-xs" style={{ color: NAVY }}>{it[field] || '—'}</span>
    ) : (
      <input
        type="text"
        defaultValue={it[field] || ''}
        onBlur={e => patchField(field, e.target.value)}
        placeholder={placeholder}
        className={`${width} text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-300 rounded px-1 py-0.5`}
        style={{ color: NAVY }}
      />
    )
  )

  const anneeInput = (field: string) => (
    <AnneeMaskInput
      value={it[field] || ''}
      readOnly={readOnly}
      onCommit={annee => patchField(field, annee)}
    />
  )

  const isDefect = it.etat === 'D'
  const isNI = !isDefect && it.etat === 'NI'
  const isConforme = !isDefect && !isNI && it.etat === 'C'

  const etatInput = () => (
    readOnly ? (
      it.etat ? (
        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
          style={{
            background: it.etat === 'D' ? '#fee2e2' : it.etat === 'C' ? '#dcfce7' : '#fef3c7',
            color: it.etat === 'D' ? '#e11324' : it.etat === 'C' ? '#16a34a' : '#b45309',
          }}>
          {it.etat}
        </span>
      ) : <span className="text-gray-300 text-xs">—</span>
    ) : (
      <select
        value={it.etat || ''}
        onChange={e => patchField('etat', e.target.value || null)}
        className="text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#e11324] bg-white w-full min-w-[64px]"
      >
        <option value="">-</option>
        <option value="D">D</option>
        <option value="C">C</option>
        <option value="NI">NI</option>
      </select>
    )
  )

  const selectInput = (field: string, choices: Record<string, string>) => (
    readOnly ? (
      <span className="text-xs" style={{ color: NAVY }}>{it[field] ? choices[it[field]] || it[field] : '—'}</span>
    ) : (
      <select
        value={it[field] || ''}
        onChange={e => patchField(field, e.target.value)}
        className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-[#e11324] bg-white w-full"
      >
        <option value="">—</option>
        {Object.entries(choices).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    )
  )

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
        } : isConforme ? {
          background: '#f0fdf4',
          borderLeft: '3px solid #22c55e',
        } : {}}
      >
        <td className="px-2 py-2 text-center text-xs text-gray-400">{it.ordre}</td>
        <td className="px-2 py-2">{textInput('etage', t('col_etage'), 'w-full min-w-[70px]')}</td>
        <td className="px-2 py-2">{textInput('emplacement', t('col_emplacement'), 'w-full min-w-[110px]')}</td>
        <td className="px-2 py-2">{selectInput('longueur', LONGUEUR_CHOICES)}</td>
        <td className="px-2 py-2">{anneeInput('date_fabrication')}</td>
        <td className="px-2 py-2">{anneeInput('prochain_test_hydrostatique')}</td>
        <td className="px-2 py-2">{etatInput()}</td>
        <td className="px-2 py-2">{textInput('remarque', t('col_remarque') + '...', 'w-full min-w-[120px]')}</td>
        {!readOnly && (
          <td className="px-2 py-2 text-center">
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
              <span className="text-red-700 font-semibold">{t('supprimer_cette_ligne')}</span>
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
      {erreurChamp && (
        <tr>
          <td colSpan={readOnly ? 8 : 9}>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 text-[11px] border-t border-red-100 text-red-600 font-semibold">
              <i className="ti ti-alert-triangle text-red-500" /> {erreurChamp}
              <button onClick={() => setErreurChamp(null)} className="ml-auto text-red-400 hover:text-red-600">
                <i className="ti ti-x" />
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Table principale ─────────────────────────────────────────────────────────
export default function TableBoyaux({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const t = useT()
  const [items, setItems] = useState<any[]>(rapport.boyaux || [])
  const [adding, setAdding] = useState(false)

  useEffect(() => { setItems(rapport.boyaux || []) }, [rapport])

  function updateLocal(id: number, field: string, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  const total = items.length
  const estDefectueux = (it: any) => it.etat === 'D'
  const estNonInspecte = (it: any) => !estDefectueux(it) && it.etat === 'NI'
  const defectueux = items.filter(estDefectueux).length
  const ni = items.filter(estNonInspecte).length
  const conformes = total - defectueux - ni

  async function ajouterLigne() {
    setAdding(true)
    const token = localStorage.getItem('access_token')
    try {
      await fetch(`${API_URL}/api/rapports-extincteurs/${rapport.id}/boyaux/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      onRefresh()
    } finally { setAdding(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: NAVY }}>{t('boyaux_incendie')}</h3>
        {!readOnly && (
          <button onClick={ajouterLigne} disabled={adding}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-md text-sm font-bold hover:border-[#0a0b0d] transition-colors disabled:opacity-50"
            style={{ color: NAVY }}>
            <i className="ti ti-plus" /> {adding ? t('ajout_en_cours') : t('ajouter_un_boyau')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
        <span><strong style={{ color: NAVY }}>{t('total')} :</strong> {total}</span>
        <span className="font-semibold text-green-600">{t('conformes')} : {conformes}</span>
        <span className="font-semibold" style={{ color: defectueux > 0 ? '#e11324' : '#94a3b8' }}>{t('defectueux')} : {defectueux}</span>
        <span className="font-semibold" style={{ color: ni > 0 ? '#b45309' : '#94a3b8' }}>{t('non_inspectes')} : {ni}</span>
      </div>

      <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-400">
            {readOnly ? t('aucun_boyau_enregistre') : t('aucun_boyau_cliquez')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50">
                  <th className="text-center px-2 py-2.5 w-10">{t('col_no')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_etage')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_emplacement')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_longueur')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_date_fabrication')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_prochain_test_hydro')}</th>
                  <th className="text-center px-2 py-2.5 w-16" title={t('etat_legende')}>{t('col_etat')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_remarque')}</th>
                  {!readOnly && <th className="px-2 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <LigneBoyau
                    key={it.id}
                    item={it}
                    readOnly={readOnly}
                    onDeleted={onRefresh}
                    onUpdate={(field, value) => updateLocal(it.id, field, value)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
