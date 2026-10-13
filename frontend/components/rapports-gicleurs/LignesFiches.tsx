'use client'

import Link from 'next/link'
import { useLangue, useT } from '@/lib/i18n'
import { ICONES_FICHES, titreSousRapport, useFichesGicleur } from '@/lib/gicleurFiches'

const NAVY = '#0a0b0d'
const RED = '#e11324'
const VERT = '#0d6b4f'

export type ResumeFiche = {
  id: number
  type_fiche: string
  numero_systeme: string
  nb_deficiences: number
  repondus: number
  total: number
}

/** Sous-rapports (fiches) d'un rapport gicleur, en lignes imbriquées sous
 *  la ligne du rapport dans le tableau des rapports. Un clic ouvre le
 *  rapport directement sur la fiche. `filtre` (type de fiche du sous-menu)
 *  estompe les fiches d'un autre type. */
export default function LignesFiches({ fiches, debitsValves, lienRapport, filtre }: {
  fiches: ResumeFiche[]
  /** Section « Débits et valves » du rapport (null = non ajoutée). */
  debitsValves?: { nb_lignes: number; nb_deficiences: number } | null
  lienRapport: string // ex. `/technicien/rapports-gicleurs/7`
  filtre?: string
}) {
  const t = useT()
  const langue = useLangue()
  const descriptions = useFichesGicleur()

  if (!fiches.length && !debitsValves) {
    return (
      <div className="pl-5 md:pl-16 pr-5 pb-3 -mt-1">
        <p className="text-xs text-gray-400 italic flex items-center gap-1.5">
          <i className="ti ti-corner-down-right text-gray-300" /> {t('gic_aucune_fiche')}
        </p>
      </div>
    )
  }

  return (
    <div className="pl-5 md:pl-16 pr-5 pb-3 -mt-1 flex flex-col gap-1">
      {fiches.map(f => {
        const pct = f.total ? Math.round((f.repondus / f.total) * 100) : 0
        const estompee = !!filtre && f.type_fiche !== filtre
        return (
          <Link key={f.id} href={`${lienRapport}?fiche=${f.id}`}
            className={`flex items-center gap-3 rounded-md border border-gray-100 bg-slate-50/70 px-3 py-2 hover:border-[#e11324] hover:bg-white transition-colors ${estompee ? 'opacity-40' : ''}`}>
            <i className="ti ti-corner-down-right text-gray-300 flex-shrink-0" />
            <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
              <i className={`ti ${ICONES_FICHES[f.type_fiche] || 'ti-file-text'} text-sm text-white`} />
            </span>
            <span className="flex-1 min-w-0 text-xs font-bold truncate" style={{ color: NAVY }}>
              {titreSousRapport(descriptions, { ...f, ordre: 0, reponses: {}, remarques: {} }, langue)}
            </span>
            <span className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <span className="h-1.5 w-20 rounded-full bg-gray-200 overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? VERT : NAVY }} />
              </span>
              <span className="text-[11px] font-semibold text-gray-400 w-10">{f.repondus}/{f.total}</span>
            </span>
            {f.nb_deficiences > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: RED, background: '#fee2e2' }}>
                <i className="ti ti-alert-triangle" /> {f.nb_deficiences}
              </span>
            ) : pct === 100 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: VERT, background: '#dcfce7' }}>
                <i className="ti ti-circle-check" /> {t('gic_conforme')}
              </span>
            ) : null}
          </Link>
        )
      })}
      {debitsValves && (
        <Link href={lienRapport}
          className={`flex items-center gap-3 rounded-md border border-gray-100 bg-slate-50/70 px-3 py-2 hover:border-[#e11324] hover:bg-white transition-colors ${filtre ? 'opacity-40' : ''}`}>
          <i className="ti ti-corner-down-right text-gray-300 flex-shrink-0" />
          <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
            <i className="ti ti-gauge text-sm text-white" />
          </span>
          <span className="flex-1 min-w-0 text-xs font-bold truncate" style={{ color: NAVY }}>{t('dv_titre')}</span>
          <span className="hidden sm:inline text-[11px] font-semibold text-gray-400">
            {debitsValves.nb_lignes} {debitsValves.nb_lignes > 1 ? t('dv_lignes') : t('dv_ligne')}
          </span>
          {debitsValves.nb_deficiences > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: RED, background: '#fee2e2' }}>
              <i className="ti ti-alert-triangle" /> {debitsValves.nb_deficiences}
            </span>
          )}
        </Link>
      )}
    </div>
  )
}
