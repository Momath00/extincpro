'use client'

import { useT, useLangue } from '@/lib/i18n'
import PhotosDeficiences from '@/components/rapports/PhotosDeficiences'
import { LEGENDE_NON_CONFORMITES, libelleNC, estEnDeficience } from '@/lib/nonConformites'
import { PastilleNC } from './TableExtincteurs'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const RED = '#dc2626'

/** Toutes les déficiences du rapport au même endroit : client, adresse, puis
 *  chaque extincteur / boyau à problème avec son emplacement et sa remarque. */
export default function OngletDeficiences({ rapport }: { rapport: any }) {
  const t = useT()
  const langue = useLangue()
  const bat = rapport.batiment || {}
  const extincteurs = (rapport.extincteurs || []).filter(estEnDeficience)
  const boyaux = (rapport.boyaux || []).filter(estEnDeficience)
  const total = extincteurs.length + boyaux.length

  // Nombre d'extincteurs par code de non-conformité.
  const parCode = LEGENDE_NON_CONFORMITES
    .map(l => ({ ...l, n: extincteurs.filter((it: any) => it.non_conformites?.includes(l.code)).length }))
    .filter(l => l.n > 0)
  const nbDefectueux = [...extincteurs, ...boyaux].filter((it: any) => it.etat === 'D').length

  const codes = (it: any) => (it.non_conformites || []).map((c: string) => (
    <span key={c} className="flex items-center gap-1.5 text-xs">
      <PastilleNC code={c} /><span className="font-semibold" style={{ color: NAVY }}>{libelleNC(c, langue)}</span>
    </span>
  ))

  const badgeDefectueux = (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: RED, background: '#fee2e2' }}>{t('defectueux')}</span>
  )

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
        {(nbDefectueux > 0 || parCode.length > 0) && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-gray-100">
            {nbDefectueux > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-gray-50 border border-gray-100 pl-1 pr-2.5 py-0.5">
                <span className="font-mono font-bold text-[10px] px-1.5 rounded-full" style={{ background: '#fee2e2', color: RED }}>D</span>
                <span style={{ color: NAVY }}>{t('defectueux')}</span>
                <strong style={{ color: RED }}>× {nbDefectueux}</strong>
              </span>
            )}
            {parCode.map(l => (
              <span key={l.code} className="inline-flex items-center gap-1.5 text-xs rounded-full bg-gray-50 border border-gray-100 pl-1 pr-2.5 py-0.5">
                <PastilleNC code={l.code} />
                <span style={{ color: NAVY }}>{l[langue]}</span>
                <strong style={{ color: RED }}>× {l.n}</strong>
              </span>
            ))}
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
            {[...extincteurs.map((it: any) => ({ it, boyau: false })), ...boyaux.map((it: any) => ({ it, boyau: true }))].map(({ it, boyau }) => (
              <div key={`${boyau ? 'b' : 'e'}-${it.id}`} className="bg-white rounded-lg border border-gray-200 shadow-sm p-3"
                style={{ borderLeft: `4px solid ${it.etat === 'D' ? '#ef4444' : NAVY}` }}>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 text-white" style={{ background: NAVY }}>{it.ordre}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold break-words" style={{ color: NAVY }}>{it.emplacement || '—'}</p>
                    <p className="text-xs text-gray-500">
                      {[boyau ? t('boyau_incendie') : null, it.etage].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {it.etat === 'D' && badgeDefectueux}
                </div>
                {(it.non_conformites || []).length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">{codes(it)}</div>
                )}
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
                    <th className="text-left px-3 py-2.5">{t('col_non_conformites')}</th>
                  </tr>
                </thead>
                <tbody>
                  {extincteurs.map((it: any, i: number) => (
                    <tr key={`e-${it.id}`} className={`border-t border-gray-50 align-top ${i % 2 ? 'bg-gray-50/50' : ''}`}
                      style={it.etat === 'D' ? { borderLeft: '3px solid #ef4444' } : undefined}>
                      <td className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: NAVY }}>{it.ordre}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{it.etage || '—'}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-bold" style={{ color: NAVY }}>{it.emplacement || '—'}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          {codes(it)}
                          {it.remarque && <span className="text-sm font-semibold" style={{ color: NAVY }}>{it.remarque}</span>}
                          {it.etat === 'D' && !(it.non_conformites || []).length && !it.remarque && (
                            <span className="text-xs font-semibold text-red-600">{t('defectueux')}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {boyaux.length > 0 && (
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td colSpan={4} className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>
                        <i className="ti ti-ripple mr-1" /> {t('boyaux_incendie')}
                      </td>
                    </tr>
                  )}
                  {boyaux.map((b: any) => (
                    <tr key={`b-${b.id}`} className="border-t border-gray-50 align-top"
                      style={b.etat === 'D' ? { borderLeft: '3px solid #ef4444' } : undefined}>
                      <td className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: NAVY }}>{b.ordre}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{b.etage || '—'}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-bold" style={{ color: NAVY }}>{b.emplacement || '—'}</p>
                      </td>
                      <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: NAVY }}>
                        {b.remarque || (b.etat === 'D' ? <span className="text-xs text-red-600">{t('defectueux')}</span> : '—')}
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
      <PhotosDeficiences photosUrl={`${API_URL}/api/rapports-extincteurs/${rapport.id}/photos/`} />
    </div>
  )
}
