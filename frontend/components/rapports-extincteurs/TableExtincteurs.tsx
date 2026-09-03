'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useT, useChoix, FORMAT_CHOICES_I18N, TYPE_EXTINCTEUR_CHOICES_I18N, MARQUE_CHOICES_I18N } from '@/lib/i18n'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

const LEGENDE = [
  ['HT', 'legende_ht'],
  ['T/O', 'legende_to'],
  ['MQ', 'legende_mq'],
  ['RM', 'legende_rm'],
  ['D', 'legende_d'],
  ['MT', 'legende_mt'],
]

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

// ── Conteneur scrollable avec indicateur visuel (fondu + flèche) ────────────
function ScrollableTable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateFade() {
    const el = ref.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateFade()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(updateFade)
    ro.observe(el)
    window.addEventListener('resize', updateFade)
    return () => { ro.disconnect(); window.removeEventListener('resize', updateFade) }
  }, [children])

  return (
    <div className="relative">
      {canScrollRight && (
        <>
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-10 z-10"
            style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.95))' }} />
          <div className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 z-20 w-6 h-6 rounded-full flex items-center justify-center shadow-sm animate-pulse"
            style={{ background: NAVY }}>
            <i className="ti ti-chevron-right text-white text-sm" />
          </div>
        </>
      )}
      {canScrollLeft && (
        <div className="pointer-events-none absolute top-0 left-0 bottom-0 w-10 z-10"
          style={{ background: 'linear-gradient(to left, transparent, rgba(255,255,255,0.95))' }} />
      )}
      <div ref={ref} onScroll={updateFade} className="overflow-x-auto">
        {children}
      </div>
    </div>
  )
}

// ── Ligne éditable ───────────────────────────────────────────────────────────
function LigneExtincteur({
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
  const FORMAT_CHOICES = useChoix(FORMAT_CHOICES_I18N)
  const TYPE_CHOICES = useChoix(TYPE_EXTINCTEUR_CHOICES_I18N)
  const MARQUE_CHOICES = useChoix(MARQUE_CHOICES_I18N)
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
      const res = await fetch(`${API_URL}/api/extincteurs/${it.id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) {
        // L'enregistrement a échoué côté serveur — on revient à la dernière
        // valeur confirmée plutôt que de laisser l'écran mentir sur ce qui
        // est réellement sauvegardé.
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
    const res = await fetch(`${API_URL}/api/extincteurs/${it.id}/`, {
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
        <td className="px-2 py-2">{selectInput('type_extincteur', TYPE_CHOICES)}</td>
        <td className="px-2 py-2">{selectInput('format', FORMAT_CHOICES)}</td>
        <td className="px-2 py-2">{selectInput('marque', MARQUE_CHOICES)}</td>
        <td className="px-2 py-2">{anneeInput('date_fabrication')}</td>
        <td className="px-2 py-2">{anneeInput('prochaine_maintenance')}</td>
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
          <td colSpan={readOnly ? 11 : 12}>
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
          <td colSpan={readOnly ? 11 : 12}>
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
export default function TableExtincteurs({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const t = useT()
  const [items, setItems] = useState<any[]>(rapport.extincteurs || [])
  const [adding, setAdding] = useState(false)

  useEffect(() => { setItems(rapport.extincteurs || []) }, [rapport])

  function updateLocal(id: number, field: string, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  const total = items.length
  const estDefectueux = (it: any) => it.etat === 'D'
  const estNonInspecte = (it: any) => !estDefectueux(it) && it.etat === 'NI'
  const defects = items.filter(estDefectueux)
  const nonInspectes = items.filter(estNonInspecte)
  const defectueux = defects.length
  const ni = nonInspectes.length
  const inspectes = total - defectueux - ni

  async function ajouterLigne() {
    setAdding(true)
    const token = localStorage.getItem('access_token')
    try {
      await fetch(`${API_URL}/api/rapports-extincteurs/${rapport.id}/extincteurs/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      onRefresh()
    } finally { setAdding(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Légende */}
      <div className="bg-gray-50 border border-gray-100 rounded-md px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{t('legende_titre')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {LEGENDE.map(([code, descKey]) => (
            <div key={code} className="text-xs text-gray-500">
              <strong style={{ color: NAVY }}>{code}</strong> — {t(descKey)}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
          <span><strong style={{ color: NAVY }}>{t('col_etat')}</strong> — {t('etat_legende')}</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#fee2e2', border: '2px solid #ef4444' }} />
            <span className="text-red-600 font-semibold">{t('ligne_rouge_defectueux')}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#fef3c7', border: '2px solid #f59e0b' }} />
            <span className="font-semibold" style={{ color: '#b45309' }}>{t('ligne_jaune_ni')}</span>
          </span>
        </div>
      </div>

      {/* Sommaire */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: t('total'), value: total, bg: NAVY, color: '#fff', icon: 'ti-fire-extinguisher' },
          { label: t('conformes'), value: inspectes, bg: '#dcfce7', color: '#16a34a', icon: 'ti-check' },
          { label: t('defectueux'), value: defectueux, bg: defectueux > 0 ? '#fee2e2' : '#f8fafc', color: defectueux > 0 ? '#e11324' : '#94a3b8', icon: 'ti-alert-triangle' },
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

      {/* Tableau récapitulatif des défectueux */}
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
                  {defects.length} {t('col_extincteurs').toLowerCase()} {t('extincteur_defectueux_plur')}
                </p>
                <p className="text-xs text-red-400">{t('resume_anomalies')}</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-red-400 bg-red-50">
                  <th className="text-left px-4 py-2.5">{t('col_no')}</th>
                  <th className="text-left px-3 py-2.5">{t('col_etage')}</th>
                  <th className="text-left px-3 py-2.5">{t('col_emplacement')}</th>
                  <th className="text-left px-3 py-2.5">{t('col_remarque')}</th>
                </tr>
              </thead>
              <tbody>
                {defects.map((it: any, idx: number) => (
                  <tr key={it.id} className={`border-t border-red-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}`}>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 font-medium">{it.ordre}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-gray-500">{it.etage || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-bold" style={{ color: '#e11324' }}>{it.emplacement || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-gray-500">{it.remarque || '—'}</span>
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
                  {nonInspectes.length} {t('col_extincteurs').toLowerCase()} {t('extincteur_non_inspecte_plur')}
                </p>
                <p className="text-xs" style={{ color: '#d0a24c' }}>{t('resume_lignes_ni')}</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest bg-amber-50" style={{ color: '#d0a24c' }}>
                  <th className="text-left px-4 py-2.5">{t('col_no')}</th>
                  <th className="text-left px-3 py-2.5">{t('col_etage')}</th>
                  <th className="text-left px-3 py-2.5">{t('col_emplacement')}</th>
                  <th className="text-left px-3 py-2.5">{t('statut')}</th>
                </tr>
              </thead>
              <tbody>
                {nonInspectes.map((it: any, idx: number) => (
                  <tr key={it.id} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}`} style={{ borderColor: '#fef3c7' }}>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 font-medium">{it.ordre}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-gray-500">{it.etage || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-bold" style={{ color: '#b45309' }}>{it.emplacement || '—'}</span>
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

      {/* Bouton ajout */}
      {!readOnly && (
        <div className="flex justify-end">
          <button onClick={ajouterLigne} disabled={adding}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-md text-sm font-bold hover:border-[#0a0b0d] transition-colors disabled:opacity-50"
            style={{ color: NAVY }}>
            <i className="ti ti-plus" /> {adding ? t('ajout_en_cours') : t('ajouter_ligne')}
          </button>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-400">
            {readOnly ? t('aucun_extincteur_enregistre') : t('aucun_extincteur_cliquez')}
          </div>
        ) : (
          <ScrollableTable>
            <table className="w-full text-sm min-w-[1180px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50">
                  <th className="text-center px-2 py-2.5 w-10">{t('col_no')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_etage')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_emplacement')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_type')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_format')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_marque')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_date_fabrication')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_prochaine_maintenance')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_prochain_test_hydro')}</th>
                  <th className="text-center px-2 py-2.5 w-16" title={t('etat_legende')}>{t('col_etat')}</th>
                  <th className="text-left px-2 py-2.5">{t('col_remarque')}</th>
                  {!readOnly && <th className="px-2 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <LigneExtincteur
                    key={it.id}
                    item={it}
                    readOnly={readOnly}
                    onDeleted={onRefresh}
                    onUpdate={(field, value) => updateLocal(it.id, field, value)}
                  />
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        )}
      </div>
    </div>
  )
}
