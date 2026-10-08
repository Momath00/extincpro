'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { ImageProtegee } from './SectionPhotos'

const NAVY = '#0a0b0d'
const RED = '#e11324'

type Photo = {
  id: number
  emplacement: string
  description: string
  section: number | null
}

/** Photos d'anomalies affichées dans l'onglet Déficiences (lecture seule) —
 *  elles s'ajoutent dans le rapport, ou dans chaque section E3 pour le
 *  système d'alarme. `sections` (id → nom) regroupe les photos par section. */
export default function PhotosDeficiences({
  photosUrl,
  sections,
}: {
  photosUrl: string // ex. `${API_URL}/api/rapports/12/photos/`
  sections?: { id: number; nom: string }[]
}) {
  const t = useT()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [agrandie, setAgrandie] = useState<number | null>(null)

  useEffect(() => {
    let annule = false
    fetch(photosUrl, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } })
      .then(res => (res.ok ? res.json() : []))
      .then(data => { if (!annule) setPhotos(Array.isArray(data) ? data : []) })
      .catch(() => { if (!annule) setPhotos([]) })
    return () => { annule = true }
  }, [photosUrl])

  // Navigation clavier dans la visionneuse.
  useEffect(() => {
    if (agrandie === null || !photos) return
    const n = photos.length
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAgrandie(null)
      if (e.key === 'ArrowRight') setAgrandie(i => (i === null ? i : (i + 1) % n))
      if (e.key === 'ArrowLeft') setAgrandie(i => (i === null ? i : (i - 1 + n) % n))
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [agrandie, photos])

  if (!photos || photos.length === 0) return null

  const nomSection = (id: number | null) => sections?.find(s => s.id === id)?.nom
  // Ordre des sections du rapport, puis les photos sans section.
  const ordreSection = (id: number | null) => {
    const i = sections?.findIndex(s => s.id === id) ?? -1
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const triees = [...photos].sort((a, b) => ordreSection(a.section) - ordreSection(b.section))
  const photoAgrandie = agrandie !== null ? triees[agrandie] : null

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100"
        style={{ borderLeft: `4px solid ${RED}` }}>
        <div className="flex items-center gap-2">
          <i className="ti ti-camera text-lg" style={{ color: RED }} />
          <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('photos_anomalies_titre')}</h3>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-500">
          {photos.length} {photos.length > 1 ? t('photos_pluriel') : t('photo_singulier')}
        </span>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {triees.map((p, i) => {
          const sec = nomSection(p.section)
          return (
            <button key={p.id} type="button" onClick={() => setAgrandie(i)}
              className="text-left rounded-lg border border-gray-100 overflow-hidden hover:border-[#e11324] transition-colors bg-white">
              <div className="aspect-[4/3] bg-gray-100">
                <ImageProtegee url={`${photosUrl}${p.id}/image/`} alt={p.emplacement} className="w-full h-full object-cover" />
              </div>
              <div className="px-2.5 py-2">
                {sec && <p className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: RED }}>{sec}</p>}
                <p className="text-xs font-bold truncate" style={{ color: NAVY }}>{p.emplacement}</p>
                {p.description && <p className="text-[11px] text-gray-500 line-clamp-2">{p.description}</p>}
              </div>
            </button>
          )
        })}
      </div>

      {photoAgrandie && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4" onClick={() => setAgrandie(null)}>
          <div className="max-w-5xl w-full flex-1 min-h-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <ImageProtegee key={photoAgrandie.id} url={`${photosUrl}${photoAgrandie.id}/image/`} alt={photoAgrandie.emplacement}
              className="max-w-full max-h-[80vh] object-contain rounded" />
          </div>
          <div className="text-center text-white mt-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold">
              {[nomSection(photoAgrandie.section), photoAgrandie.emplacement].filter(Boolean).join(' — ')}
            </p>
            {photoAgrandie.description && <p className="text-xs text-white/70 mt-0.5">{photoAgrandie.description}</p>}
            <p className="text-[11px] text-white/50 mt-1">{(agrandie ?? 0) + 1} / {triees.length}</p>
          </div>
          <button type="button" onClick={() => setAgrandie(null)} aria-label={t('fermer')}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
            <i className="ti ti-x text-xl" />
          </button>
        </div>
      )}
    </div>
  )
}
