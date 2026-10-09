'use client'

import { useRef, useState } from 'react'
import { useT } from '@/lib/i18n'

// Fichiers ajoutés à un envoi (facture, bon de travail…). Mêmes limites que
// le serveur (inspections/dossier.py : lire_pieces_jointes).
export const EXTENSIONS_ACCEPTEES = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.xlsx', '.xls', '.docx', '.doc', '.csv', '.txt']
const MAX_FICHIERS = 5
const MAX_OCTETS = 10 * 1024 * 1024
const MAX_TOTAL = 20 * 1024 * 1024

const NAVY = '#0a0b0d'
const RED = '#e11324'

export function tailleLisible(octets: number) {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

export default function ChoixFichiers({ fichiers, onChange, grand = false }: {
  fichiers: File[]
  onChange: (f: File[]) => void
  /** Grande zone « Ajouter la facture » (glisser-déposer). */
  grand?: boolean
}) {
  const t = useT()
  const ref = useRef<HTMLInputElement>(null)
  const [erreur, setErreur] = useState('')
  const [survol, setSurvol] = useState(false)

  function ajouter(liste: FileList | null) {
    if (!liste) return
    const suivants = [...fichiers]
    for (const f of Array.from(liste)) {
      const ext = f.name.includes('.') ? '.' + f.name.split('.').pop()!.toLowerCase() : ''
      if (!EXTENSIONS_ACCEPTEES.includes(ext)) { setErreur(`« ${f.name} » : ${t('pj_type_refuse')}`); continue }
      if (f.size > MAX_OCTETS) { setErreur(`« ${f.name} » : ${t('pj_trop_gros')}`); continue }
      if (suivants.length >= MAX_FICHIERS) { setErreur(t('pj_trop_nombreux')); break }
      suivants.push(f)
    }
    if (suivants.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) { setErreur(t('pj_total_trop_gros')); return }
    if (suivants.length !== fichiers.length) setErreur('')
    onChange(suivants)
  }

  return (
    <div className="flex flex-col gap-2">
      {grand ? (
        <div role="button" tabIndex={0}
          onClick={() => ref.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ref.current?.click() } }}
          onDragOver={e => { e.preventDefault(); setSurvol(true) }}
          onDragLeave={() => setSurvol(false)}
          onDrop={e => { e.preventDefault(); setSurvol(false); ajouter(e.dataTransfer.files) }}
          className="rounded-lg border-2 border-dashed px-4 py-5 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors"
          style={survol ? { borderColor: RED, background: '#fff5f5' } : { borderColor: '#94a3b8', background: '#f8fafc' }}>
          <span className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm" style={{ background: RED }}>
            <i className="ti ti-file-invoice text-xl text-white" />
          </span>
          <span className="text-sm font-extrabold" style={{ color: NAVY }}>{t('pj_ajouter_facture')}</span>
          <span className="text-xs text-gray-500">{t('pj_glisser_ou_cliquer')} — {t('pj_aide')}</span>
          <input ref={ref} type="file" multiple accept={EXTENSIONS_ACCEPTEES.join(',')} className="hidden"
            onClick={e => e.stopPropagation()}
            onChange={e => { ajouter(e.target.files); e.target.value = '' }} />
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => ref.current?.click()}
          className="h-9 flex items-center gap-2 px-3.5 rounded-md text-sm font-bold border-2 border-[#0a0b0d] bg-white hover:bg-gray-50 transition-colors"
          style={{ color: NAVY }}>
          <i className="ti ti-paperclip text-base" /> {t('pj_joindre_fichier')}
        </button>
        <span className="text-[11px] text-gray-500">{t('pj_aide')}</span>
        <input ref={ref} type="file" multiple accept={EXTENSIONS_ACCEPTEES.join(',')} className="hidden"
          onChange={e => { ajouter(e.target.files); e.target.value = '' }} />
      </div>
      )}
      {fichiers.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {fichiers.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-xs">
              <i className="ti ti-file-invoice text-base" style={{ color: RED }} />
              <span className="font-bold truncate flex-1" style={{ color: NAVY }}>{f.name}</span>
              <span className="text-gray-500 flex-shrink-0">{tailleLisible(f.size)}</span>
              <button type="button" onClick={() => onChange(fichiers.filter((_x, j) => j !== i))}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50" aria-label={t('retirer')}>
                <i className="ti ti-x text-sm text-red-500" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {erreur && <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><i className="ti ti-alert-triangle" /> {erreur}</p>}
    </div>
  )
}

/** POST multipart avec les fichiers joints (champ `pieces_jointes`). */
export async function posterAvecFichiers(url: string, fichiers: File[], champs: Record<string, string | string[]> = {}) {
  const token = localStorage.getItem('access_token')
  const form = new FormData()
  fichiers.forEach(f => form.append('pieces_jointes', f))
  for (const [cle, valeur] of Object.entries(champs)) {
    if (Array.isArray(valeur)) valeur.forEach(v => form.append(cle, v))
    else form.append(cle, valeur)
  }
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  if (res.status === 401) { window.location.href = '/login' }
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}
