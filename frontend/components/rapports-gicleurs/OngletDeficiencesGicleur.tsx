'use client'

import { useEffect, useState } from 'react'
import { useLangue, useT } from '@/lib/i18n'
import { ImageProtegee } from '@/components/rapports/SectionPhotos'
import type { DebitsValves } from './SectionDebitsValves'
import {
  ICONES_FICHES, deficiencesSousRapport, titreSousRapport, useFicheIdentification, useFichesGicleur,
  type Identification, type SousRapport,
} from '@/lib/gicleurFiches'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const RED = '#dc2626'

type RapportEntete = { id: number; batiment?: { client_nom?: string; adresse_complete?: string; code_postal?: string } }
type Photo = {
  id: number
  emplacement: string
  description: string
  sous_rapport_gicleur?: number | null
  section_fiche?: string
}
/** Une déficience affichée : son groupe (identification, fiche, débits et
 *  valves), sa section, son texte et la clé de ses photos. */
type Ligne = { cle: string; section: string; remarque: string }

/** Clé qui relie une photo à sa section : « <id de fiche>:<section> », ou
 *  « r:<section> » pour une section du rapport lui-même (hors fiche). */
const clePhoto = (p: Photo) => `${p.sous_rapport_gicleur ?? 'r'}:${p.section_fiche || ''}`

/** Vignettes des photos d'une déficience — un clic ouvre la visionneuse. */
function Vignettes({ liste, photosUrl, ouvrir }: { liste: Photo[]; photosUrl: string; ouvrir: (liste: Photo[], i: number) => void }) {
  if (liste.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2.5">
      {liste.map((p, i) => (
        <button key={p.id} type="button" onClick={() => ouvrir(liste, i)} title={p.emplacement}
          className="w-28 rounded-md border border-gray-200 overflow-hidden bg-white hover:border-[#e11324] transition-colors text-left">
          <div className="aspect-[4/3] bg-gray-100">
            <ImageProtegee url={`${photosUrl}${p.id}/image/`} alt={p.emplacement} className="w-full h-full object-cover" />
          </div>
          <p className="px-1.5 py-1 text-[10px] font-bold truncate" style={{ color: NAVY }}>{p.emplacement}</p>
        </button>
      ))}
    </div>
  )
}

/** Toutes les déficiences du rapport gicleur au même endroit : client,
 *  adresse, puis chaque partie du rapport (identification, fiches, débits et
 *  valves) avec ses déficiences et, sous chacune, les photos d'anomalies de
 *  sa section. Les photos qui ne se rattachent à aucune déficience suivent. */
export default function OngletDeficiencesGicleur({ rapport, sousRapports, debitsValves, identification }: {
  rapport: RapportEntete; sousRapports: SousRapport[]; debitsValves: DebitsValves | null; identification: Identification
}) {
  const t = useT()
  const langue = useLangue()
  const fiches = useFichesGicleur()
  const ficheIdent = useFicheIdentification()
  const bat = rapport.batiment || {}
  const photosUrl = `${API_URL}/api/rapports-gicleurs/${rapport.id}/photos/`
  const [photos, setPhotos] = useState<Photo[]>([])
  const [visionneuse, setVisionneuse] = useState<{ liste: Photo[]; i: number } | null>(null)

  useEffect(() => {
    let annule = false
    fetch(photosUrl, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } })
      .then(res => (res.ok ? res.json() : []))
      .then(data => { if (!annule) setPhotos(Array.isArray(data) ? data : []) })
      .catch(() => {})
    return () => { annule = true }
  }, [photosUrl])

  // Navigation clavier dans la visionneuse.
  useEffect(() => {
    if (!visionneuse) return
    const n = visionneuse.liste.length
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisionneuse(null)
      if (e.key === 'ArrowRight') setVisionneuse(v => (v ? { ...v, i: (v.i + 1) % n } : v))
      if (e.key === 'ArrowLeft') setVisionneuse(v => (v ? { ...v, i: (v.i - 1 + n) % n } : v))
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [visionneuse])

  // Groupes de déficiences, dans l'ordre du rapport.
  const groupes: { cle: string; icone: string; titre: string; lignes: Ligne[] }[] = []
  if (ficheIdent) {
    const lignes = deficiencesSousRapport(ficheIdent, { id: 0, type_fiche: 'identification', numero_systeme: '', ordre: 0, ...identification })
      .map(d => ({ cle: `r:${d.section.code}`, section: d.section[langue], remarque: d.remarque }))
    if (lignes.length) groupes.push({ cle: 'identification', icone: 'ti-building', titre: ficheIdent[langue], lignes })
  }
  for (const sr of sousRapports) {
    const lignes = deficiencesSousRapport(fiches?.[sr.type_fiche], sr)
      .map(d => ({ cle: `${sr.id}:${d.section.code}`, section: d.section[langue], remarque: d.remarque }))
    if (lignes.length) {
      groupes.push({ cle: `sr-${sr.id}`, icone: ICONES_FICHES[sr.type_fiche] || 'ti-file-text', titre: titreSousRapport(fiches, sr, langue), lignes })
    }
  }
  const defDebitsValves = (debitsValves?.deficiences || '').trim()
  if (defDebitsValves) {
    groupes.push({ cle: 'debits-valves', icone: 'ti-gauge', titre: t('dv_titre'),
      lignes: [{ cle: 'r:debits_valves', section: t('dv_titre'), remarque: defDebitsValves }] })
  }
  const total = groupes.reduce((n, g) => n + g.lignes.length, 0)

  const photosDe = (cle: string) => photos.filter(p => clePhoto(p) === cle)
  const clesAffichees = new Set(groupes.flatMap(g => g.lignes.map(l => l.cle)))
  const autresPhotos = photos.filter(p => !clesAffichees.has(clePhoto(p)))

  const ouvrir = (liste: Photo[], i: number) => setVisionneuse({ liste, i })

  const photoOuverte = visionneuse ? visionneuse.liste[visionneuse.i] : null

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
        {groupes.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-gray-100">
            {groupes.map(g => (
              <span key={g.cle} className="inline-flex items-center gap-1.5 text-xs rounded-full bg-gray-50 border border-gray-100 pl-2 pr-2.5 py-0.5">
                <i className={`ti ${g.icone}`} style={{ color: NAVY }} />
                <span style={{ color: NAVY }}>{g.titre}</span>
                <strong style={{ color: RED }}>× {g.lignes.length}</strong>
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
      ) : groupes.map(g => (
        <div key={g.cle} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100" style={{ borderLeft: `4px solid ${RED}` }}>
            <i className={`ti ${g.icone} text-lg`} style={{ color: NAVY }} />
            <h3 className="flex-1 text-sm font-bold" style={{ color: NAVY }}>{g.titre}</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: RED, background: '#fee2e2' }}>{g.lignes.length}</span>
          </div>
          <ol className="divide-y divide-gray-50">
            {g.lignes.map((l, i) => (
              <li key={l.cle} className="flex items-start gap-3 px-4 py-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 mt-0.5"
                  style={{ background: RED }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{l.section}</p>
                  <p className="text-sm font-semibold whitespace-pre-line" style={{ color: NAVY }}>{l.remarque}</p>
                  <Vignettes liste={photosDe(l.cle)} photosUrl={photosUrl} ouvrir={ouvrir} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {autresPhotos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100" style={{ borderLeft: `4px solid ${NAVY}` }}>
            <i className="ti ti-camera text-lg" style={{ color: NAVY }} />
            <h3 className="flex-1 text-sm font-bold" style={{ color: NAVY }}>{t('gic_autres_photos')}</h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-500">{autresPhotos.length}</span>
          </div>
          <div className="px-4 pb-3"><Vignettes liste={autresPhotos} photosUrl={photosUrl} ouvrir={ouvrir} /></div>
        </div>
      )}

      {photoOuverte && visionneuse && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4" onClick={() => setVisionneuse(null)}>
          <div className="max-w-5xl w-full flex-1 min-h-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <ImageProtegee key={photoOuverte.id} url={`${photosUrl}${photoOuverte.id}/image/`} alt={photoOuverte.emplacement}
              className="max-w-full max-h-[80vh] object-contain rounded" />
          </div>
          <div className="text-center text-white mt-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold">{photoOuverte.emplacement}</p>
            {photoOuverte.description && <p className="text-xs text-white/70 mt-0.5">{photoOuverte.description}</p>}
            <p className="text-[11px] text-white/50 mt-1">{visionneuse.i + 1} / {visionneuse.liste.length}</p>
          </div>
          {visionneuse.liste.length > 1 && (
            <>
              <button type="button" aria-label="←" onClick={e => { e.stopPropagation(); setVisionneuse(v => (v ? { ...v, i: (v.i - 1 + v.liste.length) % v.liste.length } : v)) }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                <i className="ti ti-chevron-left text-2xl" />
              </button>
              <button type="button" aria-label="→" onClick={e => { e.stopPropagation(); setVisionneuse(v => (v ? { ...v, i: (v.i + 1) % v.liste.length } : v)) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                <i className="ti ti-chevron-right text-2xl" />
              </button>
            </>
          )}
          <button type="button" onClick={() => setVisionneuse(null)} aria-label={t('fermer')}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
            <i className="ti ti-x text-xl" />
          </button>
        </div>
      )}
    </div>
  )
}
