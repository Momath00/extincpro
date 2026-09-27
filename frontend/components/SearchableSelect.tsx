'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'

const NAVY = '#0a0b0d'
const ORANGE = '#e11324'

export type OptionCombobox = { id: string | number; label: string; sublabel?: string }

/**
 * Liste déroulante avec recherche « à la volée » (reprise de Préventex) —
 * remplace un `<select>` natif quand la liste peut compter des centaines
 * d'éléments (clients, bâtiments). Filtre côté navigateur sur les options
 * déjà chargées ; aucun appel réseau par frappe.
 */
export default function SearchableSelect({
  options, value, onChange, placeholder, vide, disabled,
}: {
  options: OptionCombobox[]
  value: string | number
  onChange: (id: string) => void
  placeholder?: string
  vide?: string
  disabled?: boolean
}) {
  const t = useT()
  const [ouvert, setOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [survol, setSurvol] = useState(0)
  const conteneurRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectionne = options.find(o => String(o.id) === String(value))

  useEffect(() => {
    function onClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', onClicExterieur)
    return () => document.removeEventListener('mousedown', onClicExterieur)
  }, [])

  const filtres = recherche.trim()
    ? options.filter(o => `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(recherche.trim().toLowerCase()))
    : options

  useEffect(() => { setSurvol(0) }, [recherche])

  function choisir(o: OptionCombobox) {
    onChange(String(o.id))
    setOuvert(false)
  }

  return (
    <div className="relative" ref={conteneurRef}>
      <button type="button" disabled={disabled}
        onClick={() => { setOuvert(v => !v); setRecherche(''); setTimeout(() => inputRef.current?.focus(), 0) }}
        className="w-full text-left border-2 border-[#0a0b0d] rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#e11324] bg-white disabled:bg-gray-50 disabled:text-gray-300 flex items-center justify-between gap-2">
        <span className={selectionne ? 'truncate font-medium' : 'text-gray-400'} style={selectionne ? { color: NAVY } : undefined}>
          {selectionne ? selectionne.label : (vide ?? t('selectionner'))}
        </span>
        <i className={`ti ti-chevron-down text-gray-500 text-sm flex-shrink-0 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>

      {ouvert && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white border-2 border-[#0a0b0d] rounded-md shadow-lg max-h-72 flex flex-col">
          <div className="p-2 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input ref={inputRef} type="text" value={recherche} onChange={e => setRecherche(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSurvol(i => Math.min(i + 1, filtres.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSurvol(i => Math.max(i - 1, 0)) }
                  if (e.key === 'Enter') { e.preventDefault(); if (filtres[survol]) choisir(filtres[survol]) }
                  if (e.key === 'Escape') setOuvert(false)
                }}
                placeholder={placeholder ?? t('rechercher_placeholder')}
                className="w-full text-sm border-2 border-[#0a0b0d] rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-[#e11324]" />
            </div>
          </div>
          <div className="overflow-y-auto">
            {filtres.length === 0 && <p className="px-3 py-2.5 text-xs text-gray-400">{t('combo_aucun_resultat')}</p>}
            {filtres.map((o, i) => (
              <button type="button" key={o.id} onClick={() => choisir(o)} onMouseEnter={() => setSurvol(i)}
                className="w-full text-left px-3 py-2 text-sm flex flex-col"
                style={{ color: String(o.id) === String(value) ? ORANGE : NAVY, background: i === survol ? '#f8fafc' : '#fff' }}>
                <span className="font-medium truncate">{o.label}</span>
                {o.sublabel && <span className="text-xs text-gray-400 truncate">{o.sublabel}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
