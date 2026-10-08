'use client'

import { useT } from '@/lib/i18n'
import PhotosDeficiences from '@/components/rapports/PhotosDeficiences'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const RED = '#dc2626'

/** Une déficience : une unité « Défectueuse » (D), ou dont la remarque est
 *  remplie (même règle que le module extincteur d'ExtincteurGPinc). */
export function estEnDeficience(it: any): boolean {
  return it.etat === 'D' || !!it.remarque?.trim()
}

/** Toutes les déficiences du rapport au même endroit : client, adresse, puis
 *  chaque unité à problème avec son étage, son emplacement et sa remarque. */
export default function OngletDeficiences({ rapport }: { rapport: any }) {
  const t = useT()
  const bat = rapport.batiment || {}
  const items = rapport.eclairages_urgence || []
  const deficiences = items.filter(estEnDeficience)
  const nbDefectueux = deficiences.filter((it: any) => it.etat === 'D').length
  const nbNI = items.filter((it: any) => it.etat === 'NI').length
  const total = deficiences.length

  return (
    <div className="flex flex-col gap-5">
      {/* Client + adresse */}
      <div className="rounded-lg overflow-hidden shadow-sm border border-gray-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4" style={{ background: NAVY }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>
              {bat.client_nom || '—'}
            </p>
            <p className="text-lg font-bold text-white truncate flex items-center gap-1.5">
              <i className="ti ti-map-pin text-base text-white/60" />
              {bat.adresse_complete || '—'}
            </p>
            {bat.code_postal && <p className="text-xs text-white/60">{bat.code_postal}</p>}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-3xl font-extrabold leading-none" style={{ color: total ? '#f87171' : '#4ade80' }}>{total}</p>
              <p className="text-[11px] text-white/60 mt-1">{t('deficience_s')}</p>
            </div>
            <span className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: total ? 'rgba(220,38,38,0.2)' : 'rgba(74,222,128,0.15)' }}>
              <i className={`ti ${total ? 'ti-alert-triangle' : 'ti-circle-check'} text-xl`}
                style={{ color: total ? '#f87171' : '#4ade80' }} />
            </span>
          </div>
        </div>
        {(nbDefectueux > 0 || nbNI > 0) && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-gray-100">
            {nbDefectueux > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-gray-50 border border-gray-100 px-2.5 py-0.5">
                <span className="font-mono font-bold text-[10px] px-1 rounded" style={{ background: '#fee2e2', color: RED }}>D</span>
                <span style={{ color: NAVY }}>{t('defectueux')}</span>
                <strong style={{ color: RED }}>× {nbDefectueux}</strong>
              </span>
            )}
            {nbNI > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-amber-50 border border-amber-100 px-2.5 py-0.5">
                <span className="font-mono font-bold text-[10px] px-1 rounded" style={{ background: '#fef3c7', color: '#b45309' }}>NI</span>
                <span style={{ color: '#b45309' }}>{nbNI} {t('def_non_inspectes_note')}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
          <i className="ti ti-circle-check text-5xl text-green-300" />
          <p className="mt-3 text-sm font-semibold text-gray-500">{t('aucune_deficience')}</p>
        </div>
      ) : (
        <>
          {/* Téléphone : une carte par déficience, sans défilement horizontal. */}
          <div className="md:hidden flex flex-col gap-2">
            {deficiences.map((it: any) => (
              <div key={it.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-3"
                style={{ borderLeft: `4px solid ${it.etat === 'D' ? '#ef4444' : NAVY}` }}>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 text-white" style={{ background: NAVY }}>{it.ordre}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold break-words" style={{ color: NAVY }}>{it.emplacement || '—'}</p>
                    <p className="text-xs text-gray-500">
                      {[it.etage, it.modele, it.voltage].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {it.etat === 'D' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: RED, background: '#fee2e2' }}>{t('defectueux')}</span>
                  )}
                </div>
                {it.remarque && <p className="text-sm font-semibold mt-2 break-words" style={{ color: NAVY }}>{it.remarque}</p>}
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-[10px] font-extrabold uppercase tracking-widest text-white" style={{ background: NAVY }}>
                    <th className="text-center px-3 py-2.5 w-12">{t('col_no')}</th>
                    <th className="text-left px-3 py-2.5">{t('col_etage')}</th>
                    <th className="text-left px-3 py-2.5">{t('col_emplacement')}</th>
                    <th className="text-left px-3 py-2.5">{t('col_modele')}</th>
                    <th className="text-left px-3 py-2.5">{t('col_remarque')}</th>
                  </tr>
                </thead>
                <tbody>
                  {deficiences.map((it: any, i: number) => (
                    <tr key={it.id} className={`border-t border-gray-50 align-top ${i % 2 ? 'bg-gray-50/50' : ''}`}
                      style={it.etat === 'D' ? { borderLeft: '3px solid #ef4444' } : undefined}>
                      <td className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: NAVY }}>{it.ordre}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{it.etage || '—'}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-bold" style={{ color: NAVY }}>{it.emplacement || '—'}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: NAVY }}>
                        {[it.modele, it.voltage].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {it.remarque
                          ? <span className="text-sm font-semibold" style={{ color: NAVY }}>{it.remarque}</span>
                          : <span className="text-xs font-semibold text-red-600">{t('defectueux')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Photos d'anomalies du rapport */}
      <PhotosDeficiences photosUrl={`${API_URL}/api/rapports-eclairage-urgence/${rapport.id}/photos/`} />
    </div>
  )
}
