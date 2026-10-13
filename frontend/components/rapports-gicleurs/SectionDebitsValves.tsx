'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n'
import { resilientMutate } from '@/lib/offline/resilientFetch'
import SectionPhotos from '@/components/rapports/SectionPhotos'

// Section optionnelle « Débits et valves » du rapport gicleur (onglet de
// l'Excel) : ce n'est pas une fiche de système, on l'ajoute au rapport
// seulement si on en a besoin. Un tableau de lignes libres (zone, endroit,
// commutateur, signal O/N, temps), ses déficiences et ses photos.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const RED = '#e11324'
const VERT = '#0d6b4f'

export type LigneDebitValve = Partial<Record<'zone' | 'endroit' | 'emplacement' | 'type' | 'marque' | 'modele' | 'signal' | 'temps', string>>
export type DebitsValves = { lignes: LigneDebitValve[]; deficiences: string }

// Mêmes colonnes que gicleur_fiches.DEBITS_VALVES côté serveur.
const COLONNES: { code: keyof LigneDebitValve; cle: string; largeur: string }[] = [
  { code: 'zone', cle: 'dv_zone', largeur: 'w-16' },
  { code: 'endroit', cle: 'dv_endroit', largeur: 'min-w-[140px]' },
  { code: 'emplacement', cle: 'dv_emplacement', largeur: 'min-w-[150px]' },
  { code: 'type', cle: 'dv_type', largeur: 'min-w-[120px]' },
  { code: 'marque', cle: 'dv_marque', largeur: 'min-w-[100px]' },
  { code: 'modele', cle: 'dv_modele', largeur: 'min-w-[110px]' },
]

const CLASSE_CHAMP = 'w-full border-2 border-[#0a0b0d] bg-white rounded-md px-2 py-1.5 text-sm font-semibold text-[#0a0b0d] placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:border-[#e11324] disabled:bg-gray-50 disabled:text-gray-500'

/** Champ enregistré à la perte du focus, seulement s'il a changé. */
function Cellule({ valeur, onSave, readOnly, placeholder, multiline }: {
  valeur: string; onSave: (v: string) => void; readOnly: boolean; placeholder?: string; multiline?: boolean
}) {
  const [v, setV] = useState(valeur)
  const [precedente, setPrecedente] = useState(valeur)
  if (valeur !== precedente) { setPrecedente(valeur); setV(valeur) }
  const commit = () => { if (v.trim() !== valeur) onSave(v.trim()) }
  return multiline ? (
    <textarea value={v} onChange={e => setV(e.target.value)} onBlur={commit} disabled={readOnly} rows={3}
      placeholder={placeholder} className={CLASSE_CHAMP} />
  ) : (
    <input value={v} onChange={e => setV(e.target.value)} onBlur={commit} disabled={readOnly}
      placeholder={placeholder} className={CLASSE_CHAMP} />
  )
}

/** Signal Oui / Non — mêmes couleurs que les fiches (Oui vert, Non rouge). */
function Signal({ valeur, onChange, readOnly }: { valeur: string; onChange: (v: string) => void; readOnly: boolean }) {
  const t = useT()
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
      {[{ v: 'oui', l: t('oui'), c: VERT }, { v: 'non', l: t('non'), c: RED }].map(o => {
        const actif = valeur === o.v
        return (
          <button key={o.v} type="button" disabled={readOnly} onClick={() => onChange(actif ? '' : o.v)}
            className="min-w-[44px] px-2.5 py-1.5 text-xs font-bold rounded-md transition-all disabled:cursor-not-allowed"
            style={actif ? { background: o.c, color: '#fff' } : { color: '#6b7280' }}>
            {o.l}
          </button>
        )
      })}
    </div>
  )
}

export default function SectionDebitsValves({ rapportId, valeur, onChange, readOnly, onErreur, ouvert, basculer }: {
  rapportId: number
  valeur: DebitsValves
  onChange: (v: DebitsValves | null) => void
  readOnly: boolean
  onErreur?: (msg: string) => void
  /** Ouverture pilotée par le rapport (« Tout ouvrir / Tout fermer »). */
  ouvert: boolean
  basculer: () => void
}) {
  const t = useT()
  const [confirmRetrait, setConfirmRetrait] = useState(false)
  const lignes = valeur.lignes || []
  const aDeficiences = !!(valeur.deficiences || '').trim()

  async function enregistrer(suite: DebitsValves | null) {
    onChange(suite)
    const res = await resilientMutate('PATCH', `${API_URL}/api/rapports-gicleurs/${rapportId}/`, { debits_valves: suite })
    if (!res.ok) onErreur?.(t('erreur_sauvegarde'))
  }

  const majLigne = (i: number, code: keyof LigneDebitValve, v: string) =>
    enregistrer({ ...valeur, lignes: lignes.map((l, j) => (j === i ? { ...l, [code]: v } : l)) })

  return (
    <section className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden"
      style={{ borderLeft: `4px solid ${aDeficiences ? RED : NAVY}` }}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button type="button" onClick={basculer} aria-expanded={ouvert} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
            <i className="ti ti-gauge text-xl text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold truncate" style={{ color: NAVY }}>{t('dv_titre')}</span>
            <span className="block text-[11px] font-semibold text-gray-400 mt-0.5">
              {lignes.length} {lignes.length > 1 ? t('dv_lignes') : t('dv_ligne')}
            </span>
          </span>
        </button>
        {aDeficiences && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: RED, background: '#fee2e2' }}>
            <i className="ti ti-alert-triangle" /> {t('onglet_deficiences')}
          </span>
        )}
        {!readOnly && (
          <button type="button" onClick={() => setConfirmRetrait(true)} title={t('dv_retirer')}
            className="w-9 h-9 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
            <i className="ti ti-trash" />
          </button>
        )}
        <button type="button" onClick={basculer} className="w-9 h-9 flex items-center justify-center flex-shrink-0" aria-label={t('dv_titre')}>
          <i className="ti ti-chevron-down text-xl transition-transform" style={{ color: NAVY, transform: ouvert ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>

      {ouvert && (
        <div className="border-t border-gray-100 bg-slate-50/60 p-3 sm:p-4 flex flex-col gap-3">
          {/* Ordinateur : tableau comme dans l'Excel. */}
          <div className="hidden md:block bg-white rounded-lg border-2 border-[#0a0b0d] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-extrabold uppercase tracking-widest text-white" style={{ background: NAVY }}>
                  {COLONNES.map(c => <th key={c.code} className="text-left px-2 py-2.5">{t(c.cle)}</th>)}
                  <th className="text-center px-2 py-2.5">{t('dv_signal')}</th>
                  <th className="text-left px-2 py-2.5">{t('dv_temps')}</th>
                  {!readOnly && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr><td colSpan={COLONNES.length + 3} className="px-3 py-6 text-center text-xs text-gray-400">{t('dv_aucune_ligne')}</td></tr>
                )}
                {lignes.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100 align-middle">
                    {COLONNES.map(c => (
                      <td key={c.code} className={`px-1.5 py-1.5 ${c.largeur}`}>
                        <Cellule valeur={l[c.code] || ''} readOnly={readOnly} onSave={v => majLigne(i, c.code, v)} />
                      </td>
                    ))}
                    <td className="px-1.5 py-1.5 text-center"><Signal valeur={l.signal || ''} readOnly={readOnly} onChange={v => majLigne(i, 'signal', v)} /></td>
                    <td className="px-1.5 py-1.5 min-w-[80px]"><Cellule valeur={l.temps || ''} readOnly={readOnly} onSave={v => majLigne(i, 'temps', v)} /></td>
                    {!readOnly && (
                      <td className="px-1 py-1.5">
                        <button type="button" onClick={() => enregistrer({ ...valeur, lignes: lignes.filter((_, j) => j !== i) })} title={t('supprimer')}
                          className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <i className="ti ti-x" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Téléphone : une carte par ligne. */}
          <div className="md:hidden flex flex-col gap-2">
            {lignes.length === 0 && <p className="text-xs text-gray-400 text-center py-4">{t('dv_aucune_ligne')}</p>}
            {lignes.map((l, i) => (
              <div key={i} className="bg-white rounded-lg border-2 border-[#0a0b0d] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black" style={{ color: NAVY }}>#{i + 1}</span>
                  {!readOnly && (
                    <button type="button" onClick={() => enregistrer({ ...valeur, lignes: lignes.filter((_, j) => j !== i) })}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600"><i className="ti ti-x" /></button>
                  )}
                </div>
                {COLONNES.map(c => (
                  <label key={c.code} className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{t(c.cle)}</span>
                    <Cellule valeur={l[c.code] || ''} readOnly={readOnly} onSave={v => majLigne(i, c.code, v)} />
                  </label>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{t('dv_signal')}</span>
                  <Signal valeur={l.signal || ''} readOnly={readOnly} onChange={v => majLigne(i, 'signal', v)} />
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{t('dv_temps')}</span>
                  <Cellule valeur={l.temps || ''} readOnly={readOnly} onSave={v => majLigne(i, 'temps', v)} />
                </label>
              </div>
            ))}
          </div>

          {!readOnly && (
            <button type="button" onClick={() => enregistrer({ ...valeur, lignes: [...lignes, {}] })}
              className="self-start inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md border-2 border-dashed border-gray-300 hover:border-[#0a0b0d] bg-white"
              style={{ color: NAVY }}>
              <i className="ti ti-plus" /> {t('dv_ajouter_ligne')}
            </button>
          )}

          <div className="rounded-lg border-2 p-3 flex flex-col gap-1.5" style={{ borderColor: aDeficiences ? RED : '#e5e7eb', background: aDeficiences ? '#fff7f7' : '#fff' }}>
            <label className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: aDeficiences ? RED : '#6b7280' }}>
              <i className="ti ti-alert-triangle" /> {t('gic_deficiences_section')}
            </label>
            <Cellule multiline valeur={valeur.deficiences || ''} readOnly={readOnly} placeholder={t('gic_deficiences_placeholder')}
              onSave={v => enregistrer({ ...valeur, deficiences: v })} />
          </div>

          <SectionPhotos photosUrl={`${API_URL}/api/rapports-gicleurs/${rapportId}/photos/`} readOnly={readOnly}
            filtre={{ sous_rapport: 'aucune', section_fiche: 'debits_valves' }} titre={`${t('gic_photos')} — ${t('dv_titre')}`} />
        </div>
      )}

      {confirmRetrait && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmRetrait(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold" style={{ color: NAVY }}>{t('dv_retirer_titre')}</p>
            <p className="text-xs text-gray-500 mt-1">{t('dv_retirer_texte')}</p>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setConfirmRetrait(false)}
                className="px-4 py-2 text-xs font-bold rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">{t('annuler')}</button>
              <button type="button" onClick={() => { setConfirmRetrait(false); enregistrer(null) }}
                className="px-4 py-2 text-xs font-bold rounded-md text-white" style={{ background: RED }}>{t('dv_retirer')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
