'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'

// Section « Photos des anomalies » affichée en bas du rapport (même
// présentation que dans Préventex). Les photos apparaissent aussi en annexe du
// rapport imprimable/PDF — voir securiteincendie/inspections/photos.py.

const NAVY = '#0a0b0d'
const RED = '#e11324'

type Photo = {
  id: number
  emplacement: string
  description: string
  ordre: number
  date_ajout: string
  ajoutee_par_nom: string
}

type PhotoEnAttente = {
  cle: string
  fichier: File
  apercu: string
  emplacement: string
  description: string
  etat: 'attente' | 'envoi' | 'erreur'
  progression: number
  erreur: string
}

let _compteurCle = 0

function jeton() {
  return typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null
}

async function appelJson(url: string, options: { method?: string; body?: any } = {}) {
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton()}` },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const data = res.status === 204 ? null : await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

/** Envoi multipart avec progression (XMLHttpRequest — fetch n'expose pas la progression d'envoi). */
function envoyerFormulaire(url: string, form: FormData, onProgression: (pct: number) => void): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${jeton()}`)
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgression(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      let data: any = null
      try { data = JSON.parse(xhr.responseText) } catch {}
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data })
    }
    xhr.onerror = () => resolve({ ok: false, status: 0, data: null })
    xhr.send(form)
  })
}

/** <img> d'une photo protégée par l'authentification (fetch → blob:). */
function ImageProtegee({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const t = useT()
  const [src, setSrc] = useState<string | null>(null)
  const [echec, setEchec] = useState(false)

  useEffect(() => {
    let blobUrl: string | null = null
    let annule = false
    fetch(url, { headers: { Authorization: `Bearer ${jeton()}` } })
      .then(res => (res.ok ? res.blob() : null))
      .then(blob => {
        if (!blob) { if (!annule) setEchec(true); return }
        blobUrl = URL.createObjectURL(blob)
        if (annule) { URL.revokeObjectURL(blobUrl); return }
        setSrc(blobUrl)
      })
      .catch(() => { if (!annule) setEchec(true) })
    return () => { annule = true; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [url])

  if (echec) return <div className="flex items-center justify-center w-full h-full text-xs text-gray-400"><i className="ti ti-photo-off mr-1" />{t('photo_indisponible')}</div>
  if (!src) return <div className="w-full h-full animate-pulse bg-gray-100" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />
}

export default function SectionPhotos({
  photosUrl,
  readOnly,
  suggestionsEmplacement = [],
}: {
  photosUrl: string // ex. `${API_URL}/api/rapports-gicleurs/12/photos/`
  readOnly: boolean
  suggestionsEmplacement?: string[]
}) {
  const t = useT()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [chargement, setChargement] = useState(true)
  // Repliée par défaut pour gagner de l'espace ; un clic sur l'en-tête l'ouvre.
  const [ouvert, setOuvert] = useState(false)
  const [enAttente, setEnAttente] = useState<PhotoEnAttente[]>([])
  const [survol, setSurvol] = useState(false)
  const [avertissement, setAvertissement] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [aSupprimer, setASupprimer] = useState<Photo | null>(null)
  const [enEdition, setEnEdition] = useState<{ id: number; emplacement: string; description: string } | null>(null)
  const [visionneuse, setVisionneuse] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const compteurSurvol = useRef(0)
  const idListe = useRef(`emplacements-${Math.random().toString(36).slice(2)}`).current

  useEffect(() => {
    appelJson(photosUrl).then(res => {
      if (res.ok && Array.isArray(res.data)) setPhotos(res.data)
      setChargement(false)
    })
  }, [photosUrl])

  // Libère les aperçus locaux quand le composant disparaît.
  const enAttenteRef = useRef(enAttente)
  enAttenteRef.current = enAttente
  useEffect(() => () => enAttenteRef.current.forEach(p => URL.revokeObjectURL(p.apercu)), [])

  // Une photo lâchée à côté de la zone ferait naviguer le navigateur vers
  // l'image (et perdre la page) : on bloque ce comportement par défaut.
  useEffect(() => {
    if (readOnly) return
    const bloquer = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    window.addEventListener('dragover', bloquer)
    window.addEventListener('drop', bloquer)
    return () => {
      window.removeEventListener('dragover', bloquer)
      window.removeEventListener('drop', bloquer)
    }
  }, [readOnly])

  const ajouterFichiers = useCallback((fichiers: FileList | File[]) => {
    const liste = Array.from(fichiers)
    const images = liste.filter(f => f.type.startsWith('image/'))
    const refuses = liste.length - images.length
    setAvertissement(refuses ? `${refuses} ${t('photos_fichiers_ignores')}` : '')
    if (!images.length) return
    setEnAttente(prev => [
      ...prev,
      ...images.map(f => ({
        cle: `p${++_compteurCle}`,
        fichier: f,
        apercu: URL.createObjectURL(f),
        emplacement: '',
        description: '',
        etat: 'attente' as const,
        progression: 0,
        erreur: '',
      })),
    ])
  }, [t])

  function majAttente(cle: string, changements: Partial<PhotoEnAttente>) {
    setEnAttente(prev => prev.map(p => (p.cle === cle ? { ...p, ...changements } : p)))
  }

  function retirerAttente(cle: string) {
    setEnAttente(prev => {
      const p = prev.find(x => x.cle === cle)
      if (p) URL.revokeObjectURL(p.apercu)
      return prev.filter(x => x.cle !== cle)
    })
  }

  function copierEmplacementPartout() {
    const premier = enAttente[0]?.emplacement
    if (premier) setEnAttente(prev => prev.map(p => (p.emplacement.trim() ? p : { ...p, emplacement: premier })))
  }

  // Envoi une par une : si le réseau coupe au milieu, seules les photos
  // restantes (en erreur) sont à renvoyer.
  async function envoyerTout() {
    setEnvoiEnCours(true)
    for (const p of enAttente) {
      if (p.etat === 'envoi') continue
      majAttente(p.cle, { etat: 'envoi', progression: 0, erreur: '' })
      const form = new FormData()
      form.append('image', p.fichier)
      form.append('emplacement', p.emplacement.trim())
      form.append('description', p.description.trim())
      const res = await envoyerFormulaire(photosUrl, form, pct => majAttente(p.cle, { progression: pct }))
      if (res.ok) {
        setPhotos(prev => [...prev, res.data])
        retirerAttente(p.cle)
      } else {
        const message = res.data?.image?.[0] || res.data?.emplacement?.[0] || res.data?.error
          || (res.status === 0 ? t('photos_connexion_perdue') : t('photos_echec_enregistrement'))
        majAttente(p.cle, { etat: 'erreur', erreur: message })
      }
    }
    setEnvoiEnCours(false)
  }

  async function supprimer() {
    if (!aSupprimer) return
    const photo = aSupprimer
    setASupprimer(null)
    const res = await appelJson(`${photosUrl}${photo.id}/`, { method: 'DELETE' })
    if (res.ok) setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  async function enregistrerEdition() {
    if (!enEdition || !enEdition.emplacement.trim()) return
    const res = await appelJson(`${photosUrl}${enEdition.id}/`, {
      method: 'PATCH',
      body: { emplacement: enEdition.emplacement.trim(), description: enEdition.description.trim() },
    })
    if (res.ok) {
      setPhotos(prev => prev.map(p => (p.id === res.data.id ? res.data : p)))
      setEnEdition(null)
    }
  }

  // Navigation clavier dans la visionneuse.
  useEffect(() => {
    if (visionneuse === null) return
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisionneuse(null)
      if (e.key === 'ArrowRight') setVisionneuse(i => (i === null ? i : (i + 1) % photos.length))
      if (e.key === 'ArrowLeft') setVisionneuse(i => (i === null ? i : (i - 1 + photos.length) % photos.length))
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [visionneuse, photos.length])

  const emplacementsManquants = enAttente.some(p => !p.emplacement.trim())
  const suggestions = Array.from(new Set(suggestionsEmplacement.map(s => s.trim()).filter(Boolean)))
  const photoVisionneuse = visionneuse !== null ? photos[visionneuse] : null

  return (
    <section className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOuvert(o => !o)}
        // Glisser des photos sur l'en-tête d'une section repliée l'ouvre.
        onDragEnter={e => { if (!readOnly && e.dataTransfer.types.includes('Files')) setOuvert(true) }}
        aria-expanded={ouvert}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/70 transition-colors"
        style={{ borderLeft: `4px solid ${RED}`, borderBottom: ouvert ? '1px solid #f3f4f6' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <i className="ti ti-camera text-lg" style={{ color: RED }} />
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('photos_anomalies_titre')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {enAttente.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
              {enAttente.length} {t('photos_a_enregistrer')}
            </span>
          )}
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-500">
            {chargement ? '…' : `${photos.length} ${photos.length > 1 ? t('photos_pluriel') : t('photo_singulier')}`}
          </span>
          <i className="ti ti-chevron-down text-xl text-[#0a0b0d] transition-transform duration-200" style={{ transform: ouvert ? 'rotate(180deg)' : 'none' }} />
        </div>
      </button>

      {ouvert && <div className="p-4 flex flex-col gap-4">
        {!readOnly && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
            onDragEnter={e => { e.preventDefault(); compteurSurvol.current++; setSurvol(true) }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
            onDragLeave={e => { e.preventDefault(); if (--compteurSurvol.current <= 0) { compteurSurvol.current = 0; setSurvol(false) } }}
            onDrop={e => {
              e.preventDefault()
              compteurSurvol.current = 0
              setSurvol(false)
              if (e.dataTransfer.files?.length) ajouterFichiers(e.dataTransfer.files)
            }}
            className="rounded-lg border-2 border-dashed px-4 py-8 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#e11324]/40"
            style={survol
              ? { borderColor: RED, background: '#fff5f5', transform: 'scale(1.01)' }
              : { borderColor: '#e5e7eb', background: '#fafafa' }}
          >
            <span className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              style={{ background: survol ? RED : '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <i className="ti ti-cloud-upload text-2xl" style={{ color: survol ? '#fff' : RED }} />
            </span>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              {survol ? t('photos_deposez_ici') : t('photos_glissez_deposez')}
            </p>
            <p className="text-xs text-gray-400">
              {t('photos_ou')} <span className="font-semibold underline" style={{ color: RED }}>{t('photos_cliquez_choisir')}</span> — {t('photos_sur_mobile')}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) ajouterFichiers(e.target.files); e.target.value = '' }}
            />
          </div>
        )}

        {avertissement && (
          <p className="text-xs font-medium px-3 py-2 rounded-md bg-amber-50 text-amber-700 flex items-center gap-1.5">
            <i className="ti ti-alert-triangle" /> {avertissement}
          </p>
        )}

        {/* Photos déposées, pas encore envoyées : l'emplacement est demandé ici. */}
        {enAttente.length > 0 && (
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
                {t('photos_a_enregistrer_titre')} ({enAttente.length})
              </p>
              {enAttente.length > 1 && enAttente[0].emplacement.trim() && (
                <button onClick={copierEmplacementPartout} disabled={envoiEnCours}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:border-[#e11324] transition-colors" style={{ color: NAVY }}>
                  <i className="ti ti-copy mr-1" /> {t('photos_meme_emplacement')}
                </button>
              )}
            </div>

            {suggestions.length > 0 && (
              <datalist id={idListe}>
                {suggestions.map(s => <option key={s} value={s} />)}
              </datalist>
            )}

            {enAttente.map(p => (
              <div key={p.cle} className="flex gap-3 bg-white rounded-lg border p-2.5"
                style={{ borderColor: p.etat === 'erreur' ? '#fca5a5' : '#f1f5f9' }}>
                <div className="relative w-24 h-24 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.apercu} alt="" className="w-full h-full object-cover" />
                  {p.etat === 'envoi' && (
                    <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-1.5 px-2">
                      <span className="text-[11px] font-bold text-white">{p.progression}%</span>
                      <div className="w-full h-1 rounded-full bg-white/30 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${p.progression}%`, background: RED }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <input
                    value={p.emplacement}
                    onChange={e => majAttente(p.cle, { emplacement: e.target.value })}
                    disabled={p.etat === 'envoi'}
                    list={suggestions.length ? idListe : undefined}
                    placeholder={t('photos_emplacement_requis')}
                    className="w-full text-sm font-semibold px-2.5 py-1.5 rounded-md border-2 outline-none focus:border-[#e11324]"
                    style={{ color: NAVY, borderColor: p.emplacement.trim() ? '#9ca3af' : '#f59e0b' }}
                  />
                  <input
                    value={p.description}
                    onChange={e => majAttente(p.cle, { description: e.target.value })}
                    disabled={p.etat === 'envoi'}
                    placeholder={t('gic_photo_description')}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border-2 border-gray-400 outline-none focus:border-[#e11324] text-gray-600"
                  />
                  <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
                    <span className="truncate">{p.fichier.name} · {p.fichier.size < 1024 * 1024 ? `${Math.max(1, Math.round(p.fichier.size / 1024))} Ko` : `${(p.fichier.size / 1024 / 1024).toFixed(1)} Mo`}</span>
                    {p.etat === 'erreur' && <span className="text-red-500 font-semibold flex-shrink-0"><i className="ti ti-alert-circle mr-0.5" />{p.erreur}</span>}
                  </div>
                </div>
                {p.etat !== 'envoi' && (
                  <button onClick={() => retirerAttente(p.cle)} title={t('supprimer')}
                    className="self-start flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-red-100 text-red-500 hover:bg-red-50 transition-colors">
                    <i className="ti ti-trash" /> {t('supprimer')}
                  </button>
                )}
              </div>
            ))}

            <div className="flex items-center justify-end gap-3 flex-wrap">
              {emplacementsManquants && (
                <span className="text-xs text-amber-600"><i className="ti ti-map-pin mr-1" />{t('photos_indiquez_emplacement')}</span>
              )}
              <button onClick={envoyerTout} disabled={envoiEnCours || emplacementsManquants}
                className="text-xs font-semibold text-white px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: RED }}>
                <i className={`ti ${envoiEnCours ? 'ti-loader-2 animate-spin' : 'ti-device-floppy'} mr-1`} />
                {envoiEnCours
                  ? t('enregistrement_en_cours')
                  : enAttente.length > 1 ? `${t('photos_enregistrer_les')} ${enAttente.length} ${t('photos_pluriel')}` : t('photos_enregistrer_la')}
              </button>
            </div>
          </div>
        )}

        {/* Photos enregistrées */}
        {chargement ? (
          <p className="text-sm text-gray-400">{t('photos_chargement')}</p>
        ) : photos.length === 0 ? (
          readOnly && <p className="text-sm text-gray-300 italic text-center py-4">{t('gic_aucune_photo')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((photo, index) => {
              const edition = enEdition?.id === photo.id ? enEdition : null
              return (
                <article key={photo.id} className="group rounded-lg border border-gray-100 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <header className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-50">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: RED }}>
                      {index + 1}
                    </span>
                    {edition ? (
                      <input autoFocus value={edition.emplacement}
                        onChange={e => setEnEdition({ ...edition, emplacement: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') enregistrerEdition(); if (e.key === 'Escape') setEnEdition(null) }}
                        list={suggestions.length ? idListe : undefined}
                        className="flex-1 min-w-0 text-sm font-semibold px-2 py-1 rounded-md border-2 border-gray-400 outline-none focus:border-[#e11324]" style={{ color: NAVY }} />
                    ) : (
                      <h3 className="flex-1 min-w-0 text-sm font-bold truncate" style={{ color: NAVY }} title={photo.emplacement}>{photo.emplacement}</h3>
                    )}
                    {!readOnly && !edition && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEnEdition({ id: photo.id, emplacement: photo.emplacement, description: photo.description })}
                          title={t('modifier')} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:text-[#0a0b0d] hover:bg-gray-50">
                          <i className="ti ti-pencil" />
                        </button>
                        <button onClick={() => setASupprimer(photo)} title={t('supprimer')}
                          className="w-7 h-7 flex items-center justify-center rounded-md border border-red-100 text-red-500 hover:bg-red-50">
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    )}
                  </header>
                  <button onClick={() => setVisionneuse(index)} className="relative aspect-[4/3] bg-gray-100 cursor-zoom-in" title={t('photos_agrandir')}>
                    <ImageProtegee url={`${photosUrl}${photo.id}/image/`} alt={photo.emplacement} className="w-full h-full object-contain" />
                  </button>
                  <div className="px-3 py-2.5 flex-1 flex flex-col gap-1">
                    {edition ? (
                      <>
                        <input value={edition.description}
                          onChange={e => setEnEdition({ ...edition, description: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') enregistrerEdition(); if (e.key === 'Escape') setEnEdition(null) }}
                          placeholder={t('gic_photo_description')}
                          className="w-full text-xs px-2 py-1.5 rounded-md border-2 border-gray-400 outline-none focus:border-[#e11324] text-gray-600" />
                        <div className="flex justify-end gap-2 mt-1">
                          <button onClick={() => setEnEdition(null)} className="text-xs font-semibold px-3 py-1 rounded-md border border-gray-200 hover:bg-gray-50" style={{ color: NAVY }}>{t('annuler')}</button>
                          <button onClick={enregistrerEdition} disabled={!edition.emplacement.trim()}
                            className="text-xs font-semibold text-white px-3 py-1 rounded-md hover:opacity-90 disabled:opacity-40" style={{ background: NAVY }}>{t('enregistrer')}</button>
                        </div>
                      </>
                    ) : (
                      photo.description
                        ? <p className="text-sm font-bold leading-relaxed" style={{ color: NAVY }}>{photo.description}</p>
                        : <p className="text-xs text-gray-300 italic">{t('photos_aucune_description')}</p>
                    )}
                    <p className="text-[10px] uppercase tracking-wide text-gray-300 mt-auto pt-1">
                      {new Date(photo.date_ajout).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>}

      {aSupprimer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setASupprimer(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-trash text-red-500 text-xl" />
            </div>
            <p className="text-sm font-semibold mb-5" style={{ color: NAVY }}>
              {t('photos_confirmer_suppression')} « {aSupprimer.emplacement} » ?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setASupprimer(null)} className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200" style={{ color: NAVY }}>{t('annuler')}</button>
              <button onClick={supprimer} className="flex-1 py-2.5 rounded-md text-sm font-bold text-white bg-red-500">{t('supprimer')}</button>
            </div>
          </div>
        </div>
      )}

      {photoVisionneuse && visionneuse !== null && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col" onClick={() => setVisionneuse(null)}>
          <div className="flex items-center justify-between gap-3 px-5 py-3 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: RED }}>{visionneuse + 1}</span>
              <span className="text-sm font-semibold truncate">{photoVisionneuse.emplacement}</span>
              <span className="text-xs text-white/50 flex-shrink-0">{visionneuse + 1} / {photos.length}</span>
            </div>
            <button onClick={() => setVisionneuse(null)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10" title={t('fermer')}>
              <i className="ti ti-x text-xl" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 px-2 pb-2 min-h-0">
            {photos.length > 1 && (
              <button onClick={e => { e.stopPropagation(); setVisionneuse((visionneuse - 1 + photos.length) % photos.length) }}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-white hover:bg-white/10">
                <i className="ti ti-chevron-left text-2xl" />
              </button>
            )}
            <div className="flex-1 h-full flex items-center justify-center min-w-0" onClick={e => e.stopPropagation()}>
              <ImageProtegee key={photoVisionneuse.id} url={`${photosUrl}${photoVisionneuse.id}/image/`} alt={photoVisionneuse.emplacement}
                className="max-w-full max-h-full object-contain rounded-md" />
            </div>
            {photos.length > 1 && (
              <button onClick={e => { e.stopPropagation(); setVisionneuse((visionneuse + 1) % photos.length) }}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-white hover:bg-white/10">
                <i className="ti ti-chevron-right text-2xl" />
              </button>
            )}
          </div>
          {photoVisionneuse.description && (
            <p className="text-center text-base font-bold text-white px-5 pb-4">{photoVisionneuse.description}</p>
          )}
        </div>
      )}
    </section>
  )
}
