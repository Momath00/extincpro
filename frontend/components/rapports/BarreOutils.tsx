'use client'

import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'

// Barre d'outils commune aux rapports (alarme, extincteurs, éclairage…) :
// même emplacement, même hauteur et mêmes couleurs partout, pour qu'un
// technicien retrouve les boutons au même endroit d'un module à l'autre.
//   gauche : Tout ouvrir / Tout fermer (groupe de boutons)
//   droite : l'action principale (Ajouter…)

const NAVY = '#0a0b0d'
const RED = '#e11324'

export default function BarreOutils({
  onToutOuvrir,
  onToutFermer,
  children,
}: {
  onToutOuvrir?: () => void
  onToutFermer?: () => void
  /** Actions à droite, ex. <BoutonPrincipal>. */
  children?: ReactNode
}) {
  const t = useT()
  const repli = onToutOuvrir && onToutFermer
  if (!repli && !children) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
      {repli ? (
        <div className="inline-flex rounded-md overflow-hidden shadow-sm" role="group">
          <button type="button" onClick={onToutOuvrir}
            className="h-9 flex items-center gap-1.5 px-3.5 text-xs font-bold text-white transition-opacity hover:opacity-85 active:opacity-75"
            style={{ background: NAVY }}>
            <i className="ti ti-chevrons-down text-sm" /> {t('tout_ouvrir')}
          </button>
          <button type="button" onClick={onToutFermer}
            className="h-9 flex items-center gap-1.5 px-3.5 text-xs font-bold text-white transition-opacity hover:opacity-85 active:opacity-75 border-l border-white/20"
            style={{ background: '#475569' }}>
            <i className="ti ti-chevrons-up text-sm" /> {t('tout_fermer')}
          </button>
        </div>
      ) : <span />}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Action principale (rouge) — même taille que les autres boutons de la barre. */
export function BoutonPrincipal({
  onClick,
  disabled,
  icone = 'ti-plus',
  children,
}: {
  onClick: () => void
  disabled?: boolean
  icone?: string
  children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="h-9 flex items-center gap-2 px-4 rounded-md text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50"
      style={{ background: RED }}>
      <i className={`ti ${icone} text-base`} /> {children}
    </button>
  )
}

/** Bouton de filtre : fond, bordure, ombre et case à cocher — se lit
 *  clairement comme un bouton cliquable, actif ou non. */
export function BoutonFiltre({
  actif,
  onClick,
  code,
  libelle,
  nombre,
}: {
  actif: boolean
  onClick: () => void
  code?: string
  libelle: string
  nombre?: number
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={actif} title={code ? `${code} — ${libelle}` : libelle}
      className={`h-9 flex items-center gap-2 pl-2.5 pr-3 rounded-md border text-xs font-bold shadow-sm transition-all active:scale-[0.97] ${actif ? '' : 'hover:border-[#0a0b0d] hover:shadow'}`}
      style={actif
        ? { background: NAVY, borderColor: NAVY, color: '#fff' }
        : { background: '#f8fafc', borderColor: '#94a3b8', color: NAVY }}>
      <i className={`ti ${actif ? 'ti-square-check-filled' : 'ti-square'} text-base`} style={{ color: actif ? '#fff' : '#64748b' }} />
      {code && (
        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded"
          style={actif ? { background: 'rgba(255,255,255,0.18)' } : { background: NAVY, color: '#fff' }}>
          {code}
        </span>
      )}
      <span>{libelle}</span>
      {nombre !== undefined && (
        <span className="min-w-[20px] text-center text-[11px] px-1.5 py-0.5 rounded-full"
          style={actif ? { background: RED, color: '#fff' } : { background: '#e2e8f0', color: NAVY }}>
          {nombre}
        </span>
      )}
    </button>
  )
}
