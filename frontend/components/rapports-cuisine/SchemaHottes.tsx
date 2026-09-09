'use client'

import { useRef, useState, useEffect } from 'react'
import { useT } from '@/lib/i18n'
import { resilientMutate, resilientCreate, isTempId } from '@/lib/offline/resilientFetch'
import { onReconciled } from '@/lib/offline/queue'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

// ── Icônes d'appareils (monoline, style Tabler) ─────────────────────────────
// 'G' et 'R' sont les anciens codes plaque/cuisinière (avant l'introduction
// des variantes P/R2/R4/R6) — conservés en repli visuel (P / R4) pour que
// les hottes déjà enregistrées avec ces codes continuent de s'afficher.
function AppareilIcon({ code, color = '#dc2626', size = 15 }: { code: string; color?: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (code) {
    case 'F': // Friteuse — rectangle, panier intérieur, tige relevée
      return <svg {...common}><rect x="5" y="4" width="14" height="16" /><rect x="9" y="6.5" width="6" height="7" /><path d="M12 20v-6.5" /><path d="M9.7 15.7L12 13.5l2.3 2.2" /></svg>
    case 'B': // Friteuse sous pression — panier + jauge
      return <svg {...common}><path d="M5 10h11l-1.2 8a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7L5 10Z" /><path d="M9 13h5" /><circle cx="18.5" cy="7.5" r="2.5" /><path d="M18.5 6v1.5l1 1" /></svg>
    case 'P': case 'G': // Plaque chauffante — surface unie, rectangle net et allongé
      return <svg {...common}><rect x="2" y="8" width="20" height="8" /></svg>
    case 'R2': // Cuisinière 2 feux — rectangle vertical, 1 colonne
      return <svg {...common}><rect x="7" y="3" width="10" height="18" rx="1.5" /><circle cx="12" cy="8" r="2" /><circle cx="12" cy="16" r="2" /></svg>
    case 'R4': case 'R': // Cuisinière 4 feux — carré, 2×2
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="1.5" /><circle cx="9" cy="9" r="1.8" /><circle cx="15" cy="9" r="1.8" /><circle cx="9" cy="15" r="1.8" /><circle cx="15" cy="15" r="1.8" /></svg>
    case 'R6': // Cuisinière 6 feux — rectangle large, 2×3
      return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="1.5" /><circle cx="7" cy="10" r="1.4" /><circle cx="12" cy="10" r="1.4" /><circle cx="17" cy="10" r="1.4" /><circle cx="7" cy="14" r="1.4" /><circle cx="12" cy="14" r="1.4" /><circle cx="17" cy="14" r="1.4" /></svg>
    case 'C': // Grille charbon — rectangle net, hachures quasi verticales
      return <svg {...common}><rect x="4" y="5" width="16" height="14" /><path d="M6 19l1.5-14M9.5 19l1.5-14M13 19l1.5-14M16.5 19l1.5-14" /></svg>
    case 'S': // Salamandre — élément chauffant suspendu (peigne), rectangle net
      return <svg {...common}><rect x="4" y="9" width="16" height="9" /><path d="M6.5 9v-3M10 9v-3M13.5 9v-3M17 9v-3" /></svg>
    case 'SP': // Marmite (Stock pot) — brûleur haute puissance en éclat
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="1.5" /><circle cx="12" cy="12" r="1.4" fill={color} /><path d="M12 6.5v2.2M12 15.3v2.2M5.5 12h2.2M16.3 12h2.2M8 8l1.5 1.5M14.5 14.5L16 16M8 16l1.5-1.5M14.5 9.5L16 8" /></svg>
    case 'BP': // Bassin à frire
      return <svg {...common}><path d="M4 10c1.5 1 3 1.5 8 1.5s6.5-.5 8-1.5" /><path d="M4 10v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3" /></svg>
    case 'W': // Wok
      return <svg {...common}><path d="M3 12a9 9 0 0 0 18 0" /><path d="M3 12h18M5 9l-2-1.5M19 9l2-1.5" /></svg>
    default: // Autre
      return <svg {...common}><rect x="5" y="5" width="14" height="14" rx="2.5" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
  }
}

const CUISINIERE_DIMS: Record<string, { w: number; h: number; cols: number; rows: number }> = {
  R2: { w: 16, h: 30, cols: 1, rows: 2 },
  R4: { w: 26, h: 26, cols: 2, rows: 2 },
  R6: { w: 40, h: 26, cols: 3, rows: 2 },
}

// ── Unité d'appareil avec quantité — rendu réaliste (batterie de friteuses,
// cuisinière à feux fixes, plaque/grille sur N sections) plutôt qu'un simple
// badge. Les anciens codes 'G' et 'R' (avant les variantes P/R2/R4/R6) sont
// ramenés vers 'P' et 'R4' pour que les hottes déjà enregistrées s'affichent
// toujours correctement. ──
let clipSeq = 0
function AppareilUnit({ code: codeBrut, qty, x, y }: { code: string; qty: number; x: number; y: number }) {
  const code = codeBrut === 'G' ? 'P' : codeBrut === 'R' ? 'R4' : codeBrut
  const n = Math.max(1, qty)
  const step = 15
  const w = 22 + (n - 1) * step
  const h = 26
  const stroke = '#334155'
  const clipId = useRef(`grillClip${clipSeq++}`).current

  if (CUISINIERE_DIMS[code]) {
    const dims = CUISINIERE_DIMS[code]
    const gap = 6
    const totalW = dims.w * n + gap * (n - 1)
    return (
      <g>
        {Array.from({ length: n }).map((_, i) => {
          const bx = x - totalW / 2 + dims.w / 2 + i * (dims.w + gap)
          const cellW = dims.w / (dims.cols + 1)
          const cellH = dims.h / (dims.rows + 1)
          return (
            <g key={i}>
              <rect x={bx - dims.w / 2} y={y - dims.h / 2} width={dims.w} height={dims.h} rx={3} fill="#fff" stroke={stroke} strokeWidth={1.4} />
              {Array.from({ length: dims.rows }).flatMap((_, r) =>
                Array.from({ length: dims.cols }).map((_, c) => (
                  <circle
                    key={`${r}-${c}`}
                    cx={bx - dims.w / 2 + cellW * (c + 1)}
                    cy={y - dims.h / 2 + cellH * (r + 1)}
                    r={Math.min(cellW, cellH) * 0.32}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1.1}
                  />
                ))
              )}
            </g>
          )
        })}
      </g>
    )
  }
  if (code === 'P') {
    // Plaque — rectangle net, plus long que les autres appareils.
    const wPlaque = 46 + (n - 1) * step
    return (
      <g>
        <rect x={x - wPlaque / 2} y={y - h / 2} width={wPlaque} height={h} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        {Array.from({ length: n - 1 }).map((_, i) => (
          <line key={i} x1={x - wPlaque / 2 + (i + 1) * (wPlaque / n)} y1={y - h / 2 + 4} x2={x - wPlaque / 2 + (i + 1) * (wPlaque / n)} y2={y + h / 2 - 4} stroke={stroke} strokeWidth={1} />
        ))}
      </g>
    )
  }
  if (code === 'C') {
    // Rectangle net (coins non arrondis) rempli de traits quasi verticaux
    // (léger biais), serrés, comme une grille de charbon vue de face.
    const slant = 6
    const spacing = 6
    const diagLines = []
    for (let dx = -slant; dx <= w + slant; dx += spacing) {
      const lx1 = x - w / 2 + dx
      const ly1 = y + h / 2
      const lx2 = lx1 + slant
      const ly2 = y - h / 2
      diagLines.push(<line key={dx} x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={stroke} strokeWidth={1} />)
    }
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            <rect x={x - w / 2} y={y - h / 2} width={w} height={h} />
          </clipPath>
        </defs>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        <g clipPath={`url(#${clipId})`}>{diagLines}</g>
      </g>
    )
  }
  if (code === 'S') {
    const tickCount = Math.max(3, Math.round(w / 8))
    const ticks = Array.from({ length: tickCount }).map((_, i) => {
      const tx = x - w / 2 + 4 + (i * (w - 8)) / (tickCount - 1)
      return <line key={i} x1={tx} y1={y - h / 2} x2={tx} y2={y - h / 2 + 6} stroke={stroke} strokeWidth={1} />
    })
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        {ticks}
      </g>
    )
  }
  if (code === 'F') {
    // Rectangle net avec panier intérieur et tige relevée (poignée) —
    // comme la friteuse dessinée à la main.
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        {Array.from({ length: n }).map((_, i) => {
          const cx = x - w / 2 + 11 + i * step
          const innerW = 10, innerH = 12
          return (
            <g key={i}>
              <rect x={cx - innerW / 2} y={y - innerH / 2 - 1} width={innerW} height={innerH} fill="none" stroke={stroke} strokeWidth={1.1} />
              <path d={`M ${cx} ${y + h / 2 - 2} V ${y - innerH / 2 + 3}`} fill="none" stroke={stroke} strokeWidth={1.1} />
              <path d={`M ${cx - 2} ${y - innerH / 2 + 5.5} L ${cx} ${y - innerH / 2 + 2.5} L ${cx + 2} ${y - innerH / 2 + 5.5}`} fill="none" stroke={stroke} strokeWidth={1.1} />
            </g>
          )
        })}
      </g>
    )
  }
  if (code === 'B') {
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={5} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        {Array.from({ length: n }).map((_, i) => {
          const cx = x - w / 2 + 11 + i * step
          return (
            <g key={i}>
              <path d={`M ${cx - 5} ${y - 6} h 10 l -1.4 9 a 1.6 1.6 0 0 1 -1.6 1.4 h -3.6 a 1.6 1.6 0 0 1 -1.6 -1.4 Z`} fill="none" stroke={stroke} strokeWidth={1.1} />
              <path d={`M ${cx - 3.2} ${y - 6} v -1.6 h 6.4 v 1.6`} fill="none" stroke={stroke} strokeWidth={1.1} />
            </g>
          )
        })}
      </g>
    )
  }

  // Même boîte arrondie que friteuse/cuisinière/grille — la quantité est une
  // pastille ×N plutôt qu'une icône répétée, pour rester lisible.
  const wBadge = 34
  return (
    <g>
      <rect x={x - wBadge / 2} y={y - h / 2} width={wBadge} height={h} rx={6} fill="#fff" stroke={stroke} strokeWidth={1.4} />
      <g transform={`translate(${x - 8.5}, ${y - 8.5})`}>
        <AppareilIcon code={code} color={stroke} size={17} />
      </g>
      {n > 1 && (
        <g>
          <circle cx={x + wBadge / 2 - 3} cy={y + h / 2 - 3} r={7} fill="#dc2626" />
          <text x={x + wBadge / 2 - 3} y={y + h / 2 - 2.5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={800}>×{n}</text>
        </g>
      )}
    </g>
  )
}

function useCodes() {
  const t = useT()
  const CODES: { code: string; label: string }[] = [
    { code: 'F', label: t('appareil_friteuse') },
    { code: 'B', label: t('appareil_friteuse_pression') },
    { code: 'P', label: t('appareil_plaque_chauffante') },
    { code: 'R2', label: t('appareil_cuisiniere_2feux') },
    { code: 'R4', label: t('appareil_cuisiniere_4feux') },
    { code: 'R6', label: t('appareil_cuisiniere_6feux') },
    { code: 'C', label: t('appareil_grille_charbon') },
    { code: 'S', label: t('appareil_salamandre') },
    { code: 'SP', label: t('appareil_marmite') },
    { code: 'BP', label: t('appareil_bassin_frire') },
    { code: 'W', label: t('appareil_wok') },
    { code: 'O', label: t('appareil_autre') },
  ]
  // 'G' et 'R' : anciens codes (avant les variantes P/R2/R4/R6), gardés
  // uniquement pour que la popup d'édition d'une hotte déjà enregistrée
  // avec ces codes affiche un nom au lieu d'un vide — jamais proposés dans
  // la palette d'ajout (CODES) ni dans la légende.
  const CODE_LABEL: Record<string, string> = {
    ...Object.fromEntries(CODES.map(c => [c.code, c.label])),
    G: t('appareil_plaque_chauffante'),
    R: t('appareil_cuisiniere'),
  }
  const QTY_LABEL: Record<string, string> = {
    F: t('qty_bassins'), B: t('qty_bassins'),
    R2: t('qty_nombre_appareils'), R4: t('qty_nombre_appareils'), R6: t('qty_nombre_appareils'),
    P: t('qty_sections'),
    G: t('qty_sections'), R: t('qty_feux'),
  }
  return { CODES, CODE_LABEL, QTY_LABEL }
}

const BOX = { x0: 34, x1: 456, topY: 92, botY: 132 }
const DIVIDER_SNAP = 18

type Appareil = { code: string; x: number; side: 'above' | 'below'; qty?: number }

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

let gradientSeq = 0

function HotteEditor({
  hotte,
  readOnly,
  onPatch,
  onDelete,
  panneau,
}: {
  hotte: any
  readOnly: boolean
  onPatch: (id: any, patch: any) => void
  onDelete: (id: any) => void
  panneau?: React.ReactNode
}) {
  const t = useT()
  const { CODES, CODE_LABEL, QTY_LABEL } = useCodes()
  const svgRef = useRef<SVGSVGElement>(null)
  const gradId = useRef(`hotteGrad${gradientSeq++}`)
  const [label, setLabel] = useState(hotte.label || '')
  const [palette, setPalette] = useState<{ x: number; side: 'above' | 'below'; clientX: number; clientY: number } | null>(null)
  const [drag, setDrag] = useState<{ index: number; x: number; moved: boolean } | null>(null)
  const [edition, setEdition] = useState<{ index: number; clientX: number; clientY: number } | null>(null)
  const [dragBuse, setDragBuse] = useState<{ index: number; x: number; moved: boolean } | null>(null)

  const appareils: Appareil[] = hotte.appareils || []
  const dividers: number[] = hotte.dividers || []
  // Placement manuel des buses (comme les appareils) — repli sur l'ancien
  // compteur uniquement pour une hotte créée avant ce changement et jamais
  // encore modifiée (`buses` toujours vide dans ce cas).
  const buses: number[] = hotte.buses && hotte.buses.length > 0
    ? hotte.buses.map((pos: any) => pos.x)
    : (() => {
        const nbBuses = Number(hotte.nombre_buses) || 0
        if (nbBuses === 0) return []
        const marge = 26
        const largeur = (BOX.x1 - BOX.x0) - marge * 2
        return Array.from({ length: nbBuses }, (_, i) =>
          nbBuses === 1 ? BOX.x0 + (BOX.x1 - BOX.x0) / 2 : BOX.x0 + marge + (largeur * i) / (nbBuses - 1)
        )
      })()
  const busesX: number[] = buses.map((x, i) => (dragBuse?.index === i ? dragBuse.x : x))

  function ajouterBuse(e: React.MouseEvent<SVGRectElement>) {
    if (readOnly || !svgRef.current) return
    const p = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    const next = [...buses, Math.round(p.x)].sort((a, b) => a - b).map(x => ({ x }))
    onPatch(hotte.id, { buses: next })
  }

  function retirerBuse(index: number) {
    if (readOnly) return
    const next = buses.filter((_, i) => i !== index).map(x => ({ x }))
    onPatch(hotte.id, { buses: next })
  }

  function demarrerGlisserBuse(e: React.PointerEvent, index: number) {
    if (readOnly || !svgRef.current) return
    e.stopPropagation()
    const svg = svgRef.current
    const startP = toSvgPoint(svg, e.clientX, e.clientY)
    setDragBuse({ index, x: buses[index], moved: false })

    function onMove(ev: PointerEvent) {
      const p = toSvgPoint(svg, ev.clientX, ev.clientY)
      const nx = Math.min(BOX.x1 - 8, Math.max(BOX.x0 + 8, Math.round(p.x)))
      setDragBuse(prev => (prev && prev.index === index ? { ...prev, x: nx, moved: prev.moved || Math.abs(p.x - startP.x) > 3 } : prev))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDragBuse(current => {
        if (current && current.index === index) {
          if (current.moved) {
            const next = buses.map((x, i) => (i === index ? current.x : x)).sort((a, b) => a - b).map(x => ({ x }))
            onPatch(hotte.id, { buses: next })
          } else {
            retirerBuse(index)
          }
        }
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function ouvrirPalette(e: React.MouseEvent<SVGRectElement>, side: 'above' | 'below') {
    if (readOnly || !svgRef.current) return
    const p = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    setPalette({ x: Math.round(p.x), side, clientX: e.clientX, clientY: e.clientY })
  }

  function ajouterAppareil(code: string) {
    if (!palette) return
    const next = [...appareils, { code, x: palette.x, side: palette.side }]
    onPatch(hotte.id, { appareils: next })
    setPalette(null)
  }

  function retirerAppareil(index: number) {
    if (readOnly) return
    const next = appareils.filter((_, i) => i !== index)
    onPatch(hotte.id, { appareils: next })
    setEdition(null)
  }

  function changerQuantite(index: number, qty: number) {
    if (readOnly) return
    const next = appareils.map((a, i) => (i === index ? { ...a, qty: Math.max(1, qty) } : a))
    onPatch(hotte.id, { appareils: next })
  }

  function clicSurConduit(e: React.MouseEvent<SVGRectElement>) {
    if (readOnly || !svgRef.current) return
    const p = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    const x = Math.round(p.x)
    const proche = dividers.find(d => Math.abs(d - x) < DIVIDER_SNAP)
    const next = proche !== undefined
      ? dividers.filter(d => d !== proche)
      : [...dividers, x].sort((a, b) => a - b)
    onPatch(hotte.id, { dividers: next })
  }

  function reinitialiser() {
    if (readOnly) return
    onPatch(hotte.id, { appareils: [], dividers: [] })
  }

  function sauvegarderEntete() {
    if (readOnly) return
    onPatch(hotte.id, { label })
  }

  function demarrerGlisser(e: React.PointerEvent, index: number) {
    if (readOnly || !svgRef.current) return
    e.stopPropagation()
    const svg = svgRef.current
    const startP = toSvgPoint(svg, e.clientX, e.clientY)
    const clientX = e.clientX, clientY = e.clientY
    setDrag({ index, x: appareils[index].x, moved: false })

    function onMove(ev: PointerEvent) {
      const p = toSvgPoint(svg, ev.clientX, ev.clientY)
      const nx = Math.min(BOX.x1 - 8, Math.max(BOX.x0 + 8, Math.round(p.x)))
      setDrag(prev => (prev && prev.index === index ? { ...prev, x: nx, moved: prev.moved || Math.abs(p.x - startP.x) > 3 } : prev))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDrag(current => {
        if (current && current.index === index) {
          if (current.moved) {
            const next = appareils.map((a, i) => (i === index ? { ...a, x: current.x } : a))
            onPatch(hotte.id, { appareils: next })
          } else {
            setEdition({ index, clientX, clientY })
          }
        }
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="border border-gray-100 rounded-md p-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input
          type="text"
          disabled={readOnly}
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={sauvegarderEntete}
          className="text-sm font-bold border-b border-transparent hover:border-gray-200 focus:border-[#dc2626] focus:outline-none px-1 py-0.5 disabled:bg-transparent"
          style={{ color: NAVY }}
        />
        <span className="text-xs text-gray-400">{buses.length} {t('buses_label')}</span>
        {!readOnly && (
          <button onClick={() => onDelete(hotte.id)} className="ml-auto text-xs text-gray-300 hover:text-red-500 flex items-center gap-1">
            <i className="ti ti-trash" /> {t('supprimer_hotte_bouton')}
          </button>
        )}
      </div>

      <div className="flex items-stretch gap-3">
      {panneau}
      <div className="relative flex-1 min-w-0" style={{ background: '#f8fafc', borderRadius: 10, order: 1 }}>
        <svg
          ref={svgRef}
          viewBox="0 0 512 220"
          preserveAspectRatio="none"
          className="w-full block"
          style={{ height: 185, overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradId.current} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="45%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <pattern id={`${gradId.current}-slats`} x={BOX.x0} y="0" width="10" height={BOX.botY - BOX.topY} patternUnits="userSpaceOnUse">
              <rect width="10" height={BOX.botY - BOX.topY} fill="#e2e8f0" />
              <rect width="4" height={BOX.botY - BOX.topY} fill="#cbd5e1" />
            </pattern>
          </defs>

          {/* Conduit d'évacuation vertical (raccord vers le toit) */}
          <rect x={(BOX.x0 + BOX.x1) / 2 - 16} y={44} width={32} height={34} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={0.75} />

          {/* Corps de la hotte — canopée métallique */}
          <polygon points={`${BOX.x0},${BOX.topY} ${BOX.x1},${BOX.topY} ${BOX.x1 + 20},${BOX.topY - 14} ${BOX.x0 + 20},${BOX.topY - 14}`} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={0.5} />
          <polygon points={`${BOX.x1},${BOX.topY} ${BOX.x1 + 20},${BOX.topY - 14} ${BOX.x1 + 20},${BOX.botY - 14} ${BOX.x1},${BOX.botY}`} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.5} />
          <rect x={BOX.x0} y={BOX.topY} width={BOX.x1 - BOX.x0} height={BOX.botY - BOX.topY} fill={`url(#${gradId.current}-slats)`} stroke="#94a3b8" strokeWidth={0.75} />
          <rect x={BOX.x0} y={BOX.topY} width={BOX.x1 - BOX.x0} height={5} fill={`url(#${gradId.current})`} />
          <rect x={BOX.x0} y={BOX.botY - 4} width={BOX.x1 - BOX.x0} height={4} fill="#94a3b8" />

          <text x={(BOX.x0 + BOX.x1) / 2} y={(BOX.topY + BOX.botY) / 2 + 4} textAnchor="middle" fill="#334155" fontSize="10.5" fontWeight={800} letterSpacing="1"
            style={{ textTransform: 'uppercase', fontFamily: 'Arial,Helvetica,sans-serif', pointerEvents: 'none' }}>
            {label || t('hottes_label')}
          </text>

          {dividers.map((d, i) => (
            <line key={i} x1={d} y1={BOX.topY} x2={d} y2={BOX.botY} stroke="#dc2626" strokeWidth={1.4} strokeDasharray="3 2" style={{ pointerEvents: 'none' }} />
          ))}

          {/* Zone des buses — cliquer sous la hotte, juste au-dessus des
              appareils, place une buse à cet endroit (flèche rouge). Distincte
              de la zone des appareils, plus bas. */}
          <rect x={0} y={BOX.botY} width={512} height={178 - BOX.botY} fill="transparent" style={{ cursor: readOnly ? 'default' : 'copy' }}
            onClick={ajouterBuse} />
          <rect x={0} y={178} width={512} height={220 - 178} fill="transparent" style={{ cursor: readOnly ? 'default' : 'copy' }}
            onClick={e => ouvrirPalette(e, 'below')} />
          <rect x={BOX.x0} y={BOX.topY} width={BOX.x1 - BOX.x0} height={BOX.botY - BOX.topY} fill="transparent"
            style={{ cursor: readOnly ? 'default' : 'pointer' }} onClick={clicSurConduit} />

          {/* Buses — flèches rouges placées manuellement, indépendantes du
              nombre d'appareils (glisser pour déplacer, cliquer sans glisser
              pour retirer) — même rendu que le PDF (_rendu_hotte_html). */}
          {busesX.map((x, i) => {
            const enTrain = dragBuse?.index === i
            return (
              <g key={i} style={{ cursor: readOnly ? 'default' : (enTrain ? 'grabbing' : 'grab') }} onPointerDown={e => demarrerGlisserBuse(e, i)}>
                <line x1={x} y1={BOX.botY + 6} x2={x} y2={169} stroke="#dc2626" strokeWidth={1.8} />
                <polygon points={`${x - 4.5},169 ${x + 4.5},169 ${x},176`} fill="#dc2626" />
              </g>
            )
          })}

          {/* Appareils — rangée sous la hotte, avec leur position réelle. */}
          {appareils.map((a, i) => {
            const enTrain = drag?.index === i
            const x = enTrain ? drag.x : a.x
            const iconY = 195
            return (
              <g key={i} style={{ cursor: readOnly ? 'default' : (enTrain ? 'grabbing' : 'grab') }} onPointerDown={e => demarrerGlisser(e, i)}>
                <AppareilUnit code={a.code} qty={a.qty || 1} x={x} y={iconY} />
                <text x={x} y={iconY + 24} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight={700} style={{ pointerEvents: 'none' }}>
                  {a.code}
                </text>
              </g>
            )
          })}
        </svg>

        {palette && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPalette(null)} />
            <div
              className="fixed z-50 grid grid-cols-3 gap-1.5 bg-white p-2 rounded-xl shadow-2xl border border-gray-100"
              style={{ left: palette.clientX, top: palette.clientY, transform: 'translate(-50%, -100%)', marginTop: -8 }}
            >
              {CODES.map(c => (
                <button
                  key={c.code}
                  title={c.label}
                  onClick={() => ajouterAppareil(c.code)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center border border-gray-100 hover:border-[#dc2626] hover:bg-red-50 transition-colors"
                >
                  <AppareilIcon code={c.code} color={NAVY} size={17} />
                </button>
              ))}
            </div>
          </>
        )}

        {edition && appareils[edition.index] && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setEdition(null)} />
            <div
              className="fixed z-50 bg-white p-3 rounded-xl shadow-2xl border border-gray-100 flex flex-col gap-2"
              style={{ left: edition.clientX, top: edition.clientY, transform: 'translate(-50%, -100%)', marginTop: -10, minWidth: 170 }}
            >
              <p className="text-xs font-bold" style={{ color: NAVY }}>{CODE_LABEL[appareils[edition.index].code]}</p>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{QTY_LABEL[appareils[edition.index].code] || t('quantite_generique')}</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changerQuantite(edition.index, (appareils[edition.index].qty || 1) - 1)}
                  className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-sm font-bold hover:bg-gray-50"
                >−</button>
                <span className="flex-1 text-center text-sm font-bold" style={{ color: NAVY }}>{appareils[edition.index].qty || 1}</span>
                <button
                  onClick={() => changerQuantite(edition.index, (appareils[edition.index].qty || 1) + 1)}
                  className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-sm font-bold hover:bg-gray-50"
                >+</button>
              </div>
              <button
                onClick={() => retirerAppareil(edition.index)}
                className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center justify-center gap-1 pt-1 border-t border-gray-50"
              >
                <i className="ti ti-trash" /> {t('retirer_appareil')}
              </button>
            </div>
          </>
        )}
      </div>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-gray-400">
          {appareils.length} {t('nb_appareils_suffix')}
          {dividers.length > 0 ? ` · ${dividers.length} ${t('nb_divisions_suffix')}` : ''}
        </span>
        {!readOnly && (
          <button onClick={reinitialiser} className="text-[11px] font-semibold text-gray-400 hover:text-[#dc2626]">
            {t('reinitialiser_schema')}
          </button>
        )}
      </div>
    </div>
  )
}

function PanneauControle() {
  const t = useT()
  const [cote, setCote] = useState<'gauche' | 'droite'>('gauche')
  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 px-2 py-2 rounded-md flex-shrink-0"
      style={{ background: '#f8fafc', order: cote === 'droite' ? 2 : 0, width: 74 }}
      title={t('panneau_controle_tooltip')}
    >
      <svg viewBox="0 0 90 70" width={56} height={44} style={{ overflow: 'visible', transform: cote === 'droite' ? 'scaleX(-1)' : undefined }}>
        {/* Cylindre d'agent extincteur */}
        <rect x={4} y={44} width={13} height={22} rx={4} fill="#fff" stroke="#94a3b8" strokeWidth={1.2} />
        <rect x={7} y={40} width={7} height={5} rx={1} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.75} />
        <rect x={6} y={53} width={11} height={6} fill="#0ea5e9" opacity={0.85} />
        {/* Panneau de contrôle */}
        <rect x={20} y={8} width={38} height={50} rx={2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
        <rect x={27} y={16} width={9} height={9} rx={1.5} fill="#fff" stroke="#94a3b8" strokeWidth={0.75} />
        <rect x={42} y={16} width={9} height={9} rx={1.5} fill="#fff" stroke="#94a3b8" strokeWidth={0.75} />
        <rect x={27} y={30} width={24} height={5} rx={1} fill="#cbd5e1" />
        {/* Câble vers le cylindre */}
        <path d="M27 44 Q17 46 10.5 44" fill="none" stroke="#dc2626" strokeWidth={1.4} />
        {/* Station manuelle */}
        <circle cx={16} cy={62} r={7} fill="#fff" stroke="#dc2626" strokeWidth={2} />
        <path d="M13 62h6M16 59v6" stroke="#dc2626" strokeWidth={1.6} strokeLinecap="round" />
        <path d="M16 55v-6M16 49h20v6" fill="none" stroke="#dc2626" strokeWidth={1.4} />
        <path d="M39 8v-4h20" fill="none" stroke="#dc2626" strokeWidth={1.4} />
      </svg>
      <div className="flex gap-0.5 p-0.5 rounded-md border border-gray-200 bg-white">
        {(['gauche', 'droite'] as const).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCote(c)}
            title={c === 'gauche' ? t('placer_gauche') : t('placer_droite')}
            className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{ background: cote === c ? NAVY : 'transparent', color: cote === c ? '#fff' : '#9ca3af' }}
          >
            <i className={`ti ti-arrow-${c === 'gauche' ? 'left' : 'right'} text-[11px]`} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SchemaHottes({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const t = useT()
  const { CODE_LABEL } = useCodes()
  const [hottes, setHottes] = useState<any[]>(rapport.hottes || [])
  const [ajout, setAjout] = useState(false)

  useEffect(() => {
    setHottes(prev => {
      const pendingTemp = prev.filter(h => isTempId(h.id))
      return [...(rapport.hottes || []), ...pendingTemp]
    })
  }, [rapport])

  useEffect(() => onReconciled((tempId, realId) => {
    setHottes(prev => prev.map(h => h.id === tempId ? { ...h, id: realId } : h))
  }), [])

  async function patchHotte(id: any, patch: any) {
    setHottes(prev => prev.map(h => h.id === id ? { ...h, ...patch } : h))
    const res = await resilientMutate('PATCH', `${API_URL}/api/hottes-cuisine/${id}/`, patch)
    if (!res.queued) onRefresh()
  }

  async function supprimerHotte(id: any) {
    const res = await resilientMutate('DELETE', `${API_URL}/api/hottes-cuisine/${id}/`)
    if (res.ok) {
      setHottes(prev => prev.filter(h => h.id !== id))
      if (!res.queued) onRefresh()
    }
  }

  async function ajouterHotte() {
    setAjout(true)
    try {
      const res = await resilientCreate(`${API_URL}/api/rapports-cuisine/${rapport.id}/hottes/`, {})
      if (res.queued && res.tempId) {
        setHottes(prev => [...prev, { id: res.tempId, appareils: [], dividers: [], buses: [], label: '' }])
      } else {
        onRefresh()
      }
    } finally { setAjout(false) }
  }

  const codesUtilises = Array.from(new Set(hottes.flatMap(h => (h.appareils || []).map((a: Appareil) => a.code))))

  return (
    <div className="bg-white rounded-md border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('schema_installation')}</h3>
        {!readOnly && (
          <button
            onClick={ajouterHotte}
            disabled={ajout}
            className="text-xs font-bold px-3 py-1.5 rounded-md text-white flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: ORANGE }}
          >
            <i className="ti ti-plus" /> {t('ajouter_hotte')}
          </button>
        )}
      </div>
      {!readOnly && (
        <p className="text-[11px] text-gray-400 mb-4">
          {t('aide_schema_hottes')}
        </p>
      )}

      {hottes.length === 0 ? (
        <p className="text-sm text-gray-300 italic py-6 text-center">{t('aucune_hotte')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {hottes.map((h, i) => (
            <HotteEditor
              key={h.id}
              hotte={h}
              readOnly={readOnly}
              onPatch={patchHotte}
              onDelete={supprimerHotte}
              panneau={i === 0 ? <PanneauControle /> : undefined}
            />
          ))}
        </div>
      )}

      {codesUtilises.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-50">
          {codesUtilises.map(code => (
            <div key={code} className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center bg-gray-50">
                <AppareilIcon code={code} color="#64748b" size={13} />
              </span>
              <span className="text-xs text-gray-500">{CODE_LABEL[code] || code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
