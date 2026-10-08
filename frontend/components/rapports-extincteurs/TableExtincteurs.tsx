'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useT, useLangue, useChoix, FORMAT_CHOICES_I18N, TYPE_EXTINCTEUR_CHOICES_I18N, MARQUE_CHOICES_I18N } from '@/lib/i18n'
import { LEGENDE_NON_CONFORMITES, libelleNC, estEnDeficience } from '@/lib/nonConformites'
import { resilientMutate, resilientCreate, isTempId } from '@/lib/offline/resilientFetch'
import { onReconciled } from '@/lib/offline/queue'
import GroupesRepliables from '@/components/rapports/GroupesRepliables'
import { BoutonPrincipal } from '@/components/rapports/BarreOutils'
import Legende, { CodeLegende, LignesCouleurs } from '@/components/rapports/Legende'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

// ── Saisie d'année auto-formatée AAAA (4 chiffres, pas de jour/mois) ────────
// ── Pastille d'un code de non-conformité ────────────────────────────────────
export function PastilleNC({ code }: { code: string }) {
  const langue = useLangue()
  return (
    <span title={libelleNC(code, langue)}
      className="inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none"
      style={{ color: '#dc2626', background: '#fee2e2', border: '1px solid #fecaca' }}>
      {code}
    </span>
  )
}

// ── Sélecteur multiple des non-conformités (légende) ───────────────────────
function SelecteurNC({
  valeur,
  readOnly,
  onChange,
}: {
  valeur: string[]
  readOnly: boolean
  onChange: (codes: string[]) => void
}) {
  const t = useT()
  const langue = useLangue()
  // Position écran du menu — `fixed` pour ne pas être coupé par le
  // défilement horizontal du tableau.
  const [ouvert, setOuvert] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    function clicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(null)
    }
    function fermer() { setOuvert(null) }
    document.addEventListener('mousedown', clicExterieur)
    window.addEventListener('scroll', fermer, true)
    window.addEventListener('resize', fermer)
    return () => {
      document.removeEventListener('mousedown', clicExterieur)
      window.removeEventListener('scroll', fermer, true)
      window.removeEventListener('resize', fermer)
    }
  }, [ouvert])

  function basculerMenu(e: React.MouseEvent<HTMLButtonElement>) {
    if (ouvert) { setOuvert(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    const largeur = 256, hauteur = 13 * 34 + 16
    const top = r.bottom + 4 + hauteur > window.innerHeight ? Math.max(8, r.top - 4 - hauteur) : r.bottom + 4
    setOuvert({ top, left: Math.max(8, Math.min(r.right - largeur, window.innerWidth - largeur - 8)) })
  }

  const pastilles = valeur.length
    ? <span className="flex flex-wrap gap-1">{valeur.map(c => <PastilleNC key={c} code={c} />)}</span>
    : <span className="text-gray-300 text-xs">—</span>

  if (readOnly) return valeur.length ? pastilles : null

  function basculer(code: string) {
    const suivant = valeur.includes(code) ? valeur.filter(c => c !== code) : [...valeur, code]
    onChange(LEGENDE_NON_CONFORMITES.map(l => l.code).filter(c => suivant.includes(c)))
  }

  return (
    <div ref={ref}>
      <button type="button" onClick={basculerMenu}
        className="min-w-[90px] w-full flex items-center justify-between gap-1 border-2 border-[#0a0b0d] rounded px-1.5 py-1 bg-white hover:border-[#e11324] transition-colors">
        {pastilles}
        <i className="ti ti-chevron-down text-gray-400 text-xs flex-shrink-0" />
      </button>
      {ouvert && (
        <div className="fixed z-50 w-64 bg-white rounded-lg shadow-xl border border-gray-100 p-1.5"
          style={{ top: ouvert.top, left: ouvert.left }}>
          <button type="button" onClick={() => { onChange([]); setOuvert(null) }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-50 transition-colors border-b border-gray-100 mb-1">
            <span className="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0"
              style={{ borderColor: valeur.length ? '#cbd5e1' : NAVY, background: valeur.length ? '#fff' : NAVY }}>
              {!valeur.length && <i className="ti ti-check text-white text-[10px]" />}
            </span>
            <span className="w-10 text-[11px] font-extrabold text-gray-400">—</span>
            <span className="text-xs font-semibold" style={{ color: NAVY }}>{t('aucune_non_conformite')}</span>
          </button>
          {LEGENDE_NON_CONFORMITES.map(l => {
            const coche = valeur.includes(l.code)
            return (
              <button key={l.code} type="button" onClick={() => basculer(l.code)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-50 transition-colors">
                <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: coche ? '#dc2626' : '#cbd5e1', background: coche ? '#dc2626' : '#fff' }}>
                  {coche && <i className="ti ti-check text-white text-[10px]" />}
                </span>
                <span className="w-10 text-[11px] font-extrabold" style={{ color: '#dc2626' }}>{l.code}</span>
                <span className="text-xs" style={{ color: NAVY }}>{l[langue]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
      className="text-xs border-2 border-[#0a0b0d] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#e11324] bg-white w-[70px]"
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
    const updated = { ...it, [field]: value }
    setIt(updated)
    onUpdate(field, value)
    setErreurChamp(null)
    const res = await resilientMutate('PATCH', `${API_URL}/api/extincteurs/${it.id}/`, { [field]: value })
    if (res.queued) return // mise à jour locale conservée, synchro en arrière-plan
    if (!res.ok) {
      // L'enregistrement a échoué côté serveur — on revient à la dernière
      // valeur confirmée plutôt que de laisser l'écran mentir sur ce qui
      // est réellement sauvegardé.
      setIt((prev: any) => ({ ...prev, [field]: ancienneValeur }))
      onUpdate(field, ancienneValeur)
      setErreurChamp(t('non_enregistre_reessayez'))
    }
  }

  async function supprimer() {
    const res = await resilientMutate('DELETE', `${API_URL}/api/extincteurs/${it.id}/`)
    if (res.ok) onDeleted()
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
        className={`${width} text-xs border-2 border-[#0a0b0d] bg-white focus:outline-none focus:border-[#e11324] rounded px-1.5 py-1`}
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
        className="text-xs border-2 border-[#0a0b0d] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#e11324] bg-white w-full min-w-[64px]"
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
        className="text-xs border-2 border-[#0a0b0d] rounded px-1 py-0.5 focus:outline-none focus:border-[#e11324] bg-white w-full"
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
        <td className="px-2 py-2">
          {/* Codes de la légende + texte libre, comme la case du formulaire Excel. */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <SelecteurNC valeur={it.non_conformites || []} readOnly={readOnly}
              onChange={codes => patchField('non_conformites', codes)} />
            {readOnly
              ? (it.remarque ? <span className="text-xs" style={{ color: NAVY }}>{it.remarque}</span>
                : !(it.non_conformites || []).length && <span className="text-gray-300 text-xs">—</span>)
              : textInput('remarque', t('ecrire_non_conformite'), 'w-full')}
          </div>
        </td>
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
  onItemChange,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
  /** Remonte chaque modification à la page — l'onglet Déficiences reste
   *  ainsi à jour sans recharger. */
  onItemChange?: (id: any, field: string, value: any) => void
}) {
  const t = useT()
  const langue = useLangue()
  const [items, setItems] = useState<any[]>(rapport.extincteurs || [])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    // On garde les lignes temporaires (créées hors ligne, pas encore
    // réconciliées) même quand le rapport est rafraîchi depuis le serveur.
    setItems(prev => {
      const pendingTemp = prev.filter(it => isTempId(it.id))
      return [...(rapport.extincteurs || []), ...pendingTemp]
    })
  }, [rapport])

  useEffect(() => onReconciled((tempId, realId) => {
    setItems(prev => prev.map(it => it.id === tempId ? { ...it, id: realId } : it))
  }), [])

  function updateLocal(id: any, field: string, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
    onItemChange?.(id, field, value)
  }

  function removerLocal(id: any) {
    setItems(prev => prev.filter(it => it.id !== id))
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
    try {
      const res = await resilientCreate(`${API_URL}/api/rapports-extincteurs/${rapport.id}/extincteurs/`, {})
      if (res.queued && res.tempId) {
        setItems(prev => [...prev, { id: res.tempId, ordre: prev.length + 1 }])
      } else {
        onRefresh()
      }
    } finally { setAdding(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Légende des non-conformités */}
      <Legende
        titre={t('legende_non_conformites')}
        sousTitre={`/ ${langue === 'en' ? 'Légende des non-conformités' : 'Deficiencies legend'}`}
        elements={LEGENDE_NON_CONFORMITES.map(l => ({
          code: l.code, couleur: '#dc2626', libelle: l[langue], detail: langue === 'en' ? l.fr : l.en,
        }))}
        pied={
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {[
                { code: 'D', libelle: t('defectueux'), couleur: '#dc2626' },
                { code: 'C', libelle: t('conforme'), couleur: '#16a34a' },
                { code: 'NI', libelle: t('non_inspecte_ni'), couleur: '#d97706' },
              ].map(e => (
                <span key={e.code} className="flex items-center gap-2 text-xs font-bold" style={{ color: NAVY }}>
                  <CodeLegende code={e.code} couleur={e.couleur} /> {e.libelle}
                </span>
              ))}
            </div>
            <LignesCouleurs />
          </div>
        }
      />

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
                      <div className="flex flex-wrap items-center gap-1">
                        {(it.non_conformites || []).map((c: string) => <PastilleNC key={c} code={c} />)}
                        {(it.remarque || !(it.non_conformites || []).length) && (
                          <span className="text-xs text-gray-500">{it.remarque || '—'}</span>
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

      {/* Tableau — regroupé par étage, blocs fermés par défaut */}
      <GroupesRepliables
          actions={!readOnly && (
            <BoutonPrincipal onClick={ajouterLigne} disabled={adding}>
              {adding ? t('ajout_en_cours') : t('ajouter_ligne')}
            </BoutonPrincipal>
          )}
          vide={
            <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
              <div className="text-center py-10 text-xs text-gray-400">
                {readOnly ? t('aucun_extincteur_enregistre') : t('aucun_extincteur_cliquez')}
              </div>
            </div>
          }
          items={items}
          unite={t('unite_extincteurs')}
          estEnDeficience={estEnDeficience}
          rendreTableau={lignes => (
              <ScrollableTable>
                <table className="w-full text-sm min-w-[1180px]">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-white"
                      style={{ background: `linear-gradient(135deg, ${NAVY}, #232733)` }}>
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
                    {lignes.map((it: any) => (
                      <LigneExtincteur
                        key={it.id}
                        item={it}
                        readOnly={readOnly}
                        onDeleted={() => { removerLocal(it.id); onRefresh() }}
                        onUpdate={(field, value) => updateLocal(it.id, field, value)}
                      />
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
          )}
        />
    </div>
  )
}
