'use client'

import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'

// Légende commune à tous les rapports : même cadre, même en-tête noir, même
// pastille de code et même pied « couleurs des lignes » partout, pour qu'un
// technicien lise toutes les légendes de la même façon.

const NAVY = '#0a0b0d'
const RED = '#e11324'

export type ElementLegende = {
  /** Code affiché dans la pastille (ex. « AFE », « TH », « A »). */
  code?: string
  /** Remplace la pastille de code (ex. une icône, un point de couleur). */
  pastille?: ReactNode
  libelle: string
  /** Texte secondaire en gris (ex. la traduction). */
  detail?: string
  /** Couleur de la pastille de code — bleu marine par défaut. */
  couleur?: string
}

/** Pastille de code de légende — partagée pour rester identique partout. */
export function CodeLegende({ code, couleur = NAVY }: { code: string; couleur?: string }) {
  return (
    <span className="min-w-[3.25rem] flex-shrink-0 text-center font-mono text-[11px] font-bold px-1.5 py-0.5 rounded text-white"
      style={{ background: couleur }}>
      {code}
    </span>
  )
}

/** Grille des éléments, utilisable seule (ex. dans un autre cadre). */
export function GrilleLegende({ elements, colonnes = 3 }: { elements: ElementLegende[]; colonnes?: 2 | 3 | 4 }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[colonnes]
  return (
    <div className={`grid grid-cols-1 ${cols} gap-x-6 gap-y-2`}>
      {elements.map((e, i) => (
        <div key={`${e.code ?? ''}-${e.libelle}-${i}`} className="flex items-center gap-2 text-xs min-w-0">
          {e.pastille ?? (e.code ? <CodeLegende code={e.code} couleur={e.couleur} /> : null)}
          <span className="font-bold min-w-0" style={{ color: NAVY }}>
            {e.libelle}
            {e.detail && <span className="font-semibold text-gray-500"> / {e.detail}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Pied de légende : signification des couleurs de lignes du tableau. */
export function LignesCouleurs({ defaut, ni }: { defaut?: string; ni?: string }) {
  const t = useT()
  const items = [
    { fond: '#fee2e2', bord: '#ef4444', texte: defaut ?? t('ligne_rouge_defectueux'), couleur: '#b91c1c' },
    { fond: '#fef3c7', bord: '#f59e0b', texte: ni ?? t('ligne_jaune_ni'), couleur: '#b45309' },
    { fond: '#dcfce7', bord: '#22c55e', texte: t('ligne_verte_conforme'), couleur: '#15803d' },
  ]
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
      {items.map(it => (
        <span key={it.texte} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: it.couleur }}>
          <span className="inline-block w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: it.fond, border: `2px solid ${it.bord}` }} />
          {it.texte}
        </span>
      ))}
    </div>
  )
}

export default function Legende({
  titre,
  sousTitre,
  icone = 'ti-list-details',
  elements,
  colonnes = 3,
  pied,
  compacte = false,
}: {
  titre: string
  sousTitre?: string
  icone?: string
  elements?: ElementLegende[]
  colonnes?: 2 | 3 | 4
  /** Bas de la légende, ex. <LignesCouleurs />. */
  pied?: ReactNode
  /** Éléments sur une seule ligne qui passe à la ligne (petites légendes). */
  compacte?: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2.5" style={{ background: NAVY }}>
        <i className={`ti ${icone} text-base`} style={{ color: RED }} />
        <span className="text-xs font-bold uppercase tracking-widest text-white">{titre}</span>
        {sousTitre && <span className="text-[11px] text-white/50">{sousTitre}</span>}
      </div>
      {elements && elements.length > 0 && (
        <div className="px-4 py-3">
          {compacte ? (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {elements.map((e, i) => (
                <div key={`${e.code ?? ''}-${e.libelle}-${i}`} className="flex items-center gap-2 text-xs">
                  {e.pastille ?? (e.code ? <CodeLegende code={e.code} couleur={e.couleur} /> : null)}
                  <span className="font-bold" style={{ color: NAVY }}>{e.libelle}</span>
                </div>
              ))}
            </div>
          ) : (
            <GrilleLegende elements={elements} colonnes={colonnes} />
          )}
        </div>
      )}
      {pied && <div className={`px-4 py-2.5 bg-gray-50 ${elements?.length ? 'border-t border-gray-100' : ''}`}>{pied}</div>}
    </div>
  )
}
