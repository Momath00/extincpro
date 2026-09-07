'use client'

import { useT } from '@/lib/i18n'

type ModuleType = 'incendie' | 'extincteur' | 'eclairage' | 'cuisine'

const STYLES: Record<ModuleType, { bg: string; color: string; dot: string; icon: string }> = {
  incendie: { bg: '#eef2ff', color: '#4338ca', dot: '#6366f1', icon: 'ti-clipboard-check' },
  extincteur: { bg: '#fff2e8', color: '#9a4a13', dot: '#f97316', icon: 'ti-fire-extinguisher' },
  eclairage: { bg: '#ecfeff', color: '#0e7490', dot: '#06b6d4', icon: 'ti-bulb' },
  cuisine: { bg: '#faf5ff', color: '#7e22ce', dot: '#a855f7', icon: 'ti-tools-kitchen-2' },
}

/** Puce indiquant le module courant (système d'alarme / extincteur / éclairage
 * d'urgence / cuisine) — repère visuel constant en haut à droite des pages de
 * rapport, avec un petit point animé pour signaler "en cours de
 * consultation". */
export default function ModuleBadge({ type, eclairageLie, cuisineLie }: { type: ModuleType; eclairageLie?: boolean; cuisineLie?: boolean }) {
  const t = useT()
  const s = STYLES[type]
  const label = type === 'incendie'
    ? t('incendie')
    : type === 'extincteur'
      ? (eclairageLie && cuisineLie
          ? t('extincteur_eclairage_cuisine')
          : cuisineLie
            ? t('extincteur_cuisine')
            : eclairageLie
              ? t('extincteur_eclairage')
              : t('extincteur'))
      : type === 'cuisine'
        ? t('cuisine_badge')
        : t('eclairage_urgence_badge')

  return (
    <span
      className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: s.dot }} />
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: s.dot }} />
      </span>
      <i className={`ti ${s.icon} text-sm`} />
      {label}
    </span>
  )
}
