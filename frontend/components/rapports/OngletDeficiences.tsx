'use client'

import { useT } from '@/lib/i18n'
import PhotosDeficiences from '@/components/rapports/PhotosDeficiences'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const RED = '#dc2626'

/** Une déficience : un dispositif E3 défectueux (D), qui nécessite un
 *  entretien, mal installé, dont l'alarme n'est pas confirmée, ou dont la
 *  remarque est remplie (même règle que l'éclairage d'urgence). */
export function estEnDeficience(d: any): boolean {
  return d.annonce_statut === 'D'
    || !!d.necessite_entretien
    || d.installation_correcte === false
    || d.alarme_confirmee === false
    || !!d.remarque?.trim()
}

export function compterDeficiences(rapport: any): number {
  return (rapport.sections || []).reduce(
    (n: number, s: any) => n + (s.dispositifs || []).filter(estEnDeficience).length, 0,
  )
}

/** Toutes les déficiences du rapport au même endroit : client, adresse, puis
 *  chaque dispositif à problème avec sa section, sa localisation et sa remarque. */
export default function OngletDeficiences({ rapport }: { rapport: any }) {
  const t = useT()
  const bat = rapport.batiment || {}
  const sections = rapport.sections || []
  const deficiences = sections.flatMap((s: any) =>
    (s.dispositifs || []).filter(estEnDeficience).map((d: any) => ({ d, sectionNom: s.nom })),
  )
  const total = deficiences.length
  const nbNI = sections.reduce(
    (n: number, s: any) => n + (s.dispositifs || []).filter((d: any) => d.annonce_statut === 'NI').length, 0,
  )

  // Nombre de dispositifs par type de problème.
  const parProbleme = [
    { cle: 'D', label: t('dispositif_defectueux_d'), n: deficiences.filter(({ d }: any) => d.annonce_statut === 'D').length },
    { cle: 'entretien', label: t('entretien_requis_label'), n: deficiences.filter(({ d }: any) => d.necessite_entretien).length },
    { cle: 'installation', label: t('installation_non_conforme'), n: deficiences.filter(({ d }: any) => d.installation_correcte === false).length },
    { cle: 'alarme', label: t('alarme_non_confirmee'), n: deficiences.filter(({ d }: any) => d.alarme_confirmee === false).length },
  ].filter(p => p.n > 0)

  const problemes = (d: any) => [
    d.annonce_statut === 'D' && { icone: 'ti-speakerphone', label: t('dispositif_defectueux_d') },
    d.necessite_entretien && { icone: 'ti-tool', label: t('entretien_requis_label') },
    d.installation_correcte === false && { icone: 'ti-x', label: t('installation_non_conforme') },
    d.alarme_confirmee === false && { icone: 'ti-bell-off', label: t('alarme_non_confirmee') },
  ].filter(Boolean) as { icone: string; label: string }[]

  const pastilles = (d: any) => problemes(d).map(p => (
    <span key={p.label} className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
      <i className={`ti ${p.icone} text-[9px]`} /> {p.label}
    </span>
  ))

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
        {(parProbleme.length > 0 || nbNI > 0) && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-gray-100">
            {parProbleme.map(p => (
              <span key={p.cle} className="inline-flex items-center gap-1.5 text-xs rounded-full bg-gray-50 border border-gray-100 px-2.5 py-0.5">
                <span style={{ color: NAVY }}>{p.label}</span>
                <strong style={{ color: RED }}>× {p.n}</strong>
              </span>
            ))}
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
            {deficiences.map(({ d, sectionNom }: any) => (
              <div key={d.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-3"
                style={{ borderLeft: `4px solid ${d.annonce_statut === 'D' ? '#ef4444' : NAVY}` }}>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 bg-red-100 text-red-700">{d.type_dispositif || '—'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold break-words" style={{ color: NAVY }}>{d.localisation || '—'}</p>
                    <p className="text-xs text-gray-500">{sectionNom}</p>
                  </div>
                </div>
                {problemes(d).length > 0 && <div className="flex flex-wrap gap-1 mt-2">{pastilles(d)}</div>}
                {d.remarque && <p className="text-sm font-semibold mt-2 break-words" style={{ color: NAVY }}>{d.remarque}</p>}
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-[10px] font-extrabold uppercase tracking-widest text-white" style={{ background: NAVY }}>
                    <th className="text-left px-3 py-2.5">{t('col_section')}</th>
                    <th className="text-left px-3 py-2.5">{t('localisation_label')}</th>
                    <th className="text-left px-3 py-2.5">{t('col_type')}</th>
                    <th className="text-left px-3 py-2.5">{t('col_probleme')}</th>
                  </tr>
                </thead>
                <tbody>
                  {deficiences.map(({ d, sectionNom }: any, i: number) => (
                    <tr key={d.id} className={`border-t border-gray-50 align-top ${i % 2 ? 'bg-gray-50/50' : ''}`}
                      style={d.annonce_statut === 'D' ? { borderLeft: '3px solid #ef4444' } : undefined}>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-medium">{sectionNom}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-bold" style={{ color: NAVY }}>{d.localisation || '—'}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{d.type_dispositif || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          {problemes(d).length > 0 && <div className="flex flex-wrap gap-1">{pastilles(d)}</div>}
                          {d.remarque && <span className="text-sm font-semibold" style={{ color: NAVY }}>{d.remarque}</span>}
                        </div>
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
      <PhotosDeficiences photosUrl={`${API_URL}/api/rapports/${rapport.id}/photos/`} sections={(rapport.sections || []).map((s: any) => ({ id: s.id, nom: s.nom }))} />
    </div>
  )
}
