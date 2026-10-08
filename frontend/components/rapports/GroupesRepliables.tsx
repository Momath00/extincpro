'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/lib/i18n'
import BarreOutils from './BarreOutils'

const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

/** Regroupe les lignes d'un rapport par étage, dans des blocs repliables
 *  fermés par défaut (comme les sections d'ExtincteurGPinc) — un gros
 *  bâtiment compte plusieurs centaines d'équipements, on n'ouvre que
 *  l'étage sur lequel on travaille. */
export default function GroupesRepliables({
  items,
  rendreTableau,
  estEnDeficience,
  unite,
  actions,
  vide,
}: {
  items: any[]
  rendreTableau: (lignes: any[]) => ReactNode
  estEnDeficience: (it: any) => boolean
  /** Libellé du compteur, ex. « extincteur(s) ». */
  unite: string
  /** Action principale, à droite de la barre d'outils (ex. Ajouter une ligne). */
  actions?: ReactNode
  /** Affiché à la place des blocs quand il n'y a aucune ligne. */
  vide?: ReactNode
}) {
  const t = useT()
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set())

  const cle = (it: any) => (it.etage || '').trim()
  const groupes: { cle: string; lignes: any[] }[] = []
  for (const it of items) {
    const c = cle(it)
    const g = groupes.find(x => x.cle === c)
    if (g) g.lignes.push(it)
    else groupes.push({ cle: c, lignes: [it] })
  }
  // « Sans étage » toujours en dernier.
  groupes.sort((a, b) => (a.cle === '' ? 1 : 0) - (b.cle === '' ? 1 : 0))

  // Une ligne ajoutée : on ouvre son groupe pour qu'elle soit visible.
  const nbPrecedent = useRef(items.length)
  useEffect(() => {
    if (items.length > nbPrecedent.current) {
      const derniere = items[items.length - 1]
      if (derniere) setOuvertes(prev => new Set(prev).add(cle(derniere)))
    }
    nbPrecedent.current = items.length
  }, [items])

  function basculer(c: string) {
    setOuvertes(prev => {
      const s = new Set(prev)
      if (s.has(c)) s.delete(c)
      else s.add(c)
      return s
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <BarreOutils
        onToutOuvrir={groupes.length ? () => setOuvertes(new Set(groupes.map(g => g.cle))) : undefined}
        onToutFermer={groupes.length ? () => setOuvertes(new Set()) : undefined}
      >
        {actions}
      </BarreOutils>
      {groupes.length === 0 && vide}
      {groupes.map((g, i) => {
        const ouverte = ouvertes.has(g.cle)
        const nbDef = g.lignes.filter(estEnDeficience).length
        const nbVerifies = g.lignes.filter(it => it.etat).length
        return (
          <div key={g.cle || '__sans_etage'} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <button type="button" onClick={() => basculer(g.cle)} aria-expanded={ouverte}
              className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3.5 text-left hover:bg-gray-50 transition-colors">
              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-colors"
                style={{ background: ouverte ? ORANGE : NAVY }}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold break-words" style={{ color: NAVY }}>
                  {g.cle ? `${t('col_etage')} : ${g.cle}` : t('sans_etage')}
                </span>
                <span className="block text-xs text-gray-500">{g.lignes.length} {unite}</span>
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                {nbDef > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: ORANGE, background: '#fee2e2' }}>
                    {nbDef} {t('def_abrev')}
                  </span>
                )}
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full text-white" style={{ background: NAVY }}
                  title={t('verifies_info')}>
                  {nbVerifies}/{g.lignes.length}
                </span>
                <i className="ti ti-chevron-down text-xl font-bold transition-transform flex-shrink-0"
                  style={{ color: NAVY, transform: ouverte ? 'rotate(180deg)' : 'none' }} />
              </span>
            </button>
            {ouverte && <div className="border-t border-gray-100">{rendreTableau(g.lignes)}</div>}
          </div>
        )
      })}
    </div>
  )
}
