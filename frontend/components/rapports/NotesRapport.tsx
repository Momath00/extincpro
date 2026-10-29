'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { resilientMutate } from '@/lib/offline/resilientFetch'

const NAVY = '#0a0b0d'

const CHAMPS = [
  { cle: 'remarques', libelle: 'notes_remarques' },
  { cle: 'recommandations', libelle: 'notes_recommandations' },
  { cle: 'obligations', libelle: 'notes_obligations' },
] as const

/** Remarques / Recommandations / Obligations du bas du rapport (gabarit
 *  Sécurité Incendie National) — enregistrées à la sortie du champ, comme
 *  les lignes du tableau. `url` : action `notes` du rapport. */
export default function NotesRapport({ rapport, url, readOnly }: { rapport: any; url: string; readOnly: boolean }) {
  const t = useT()
  const [valeurs, setValeurs] = useState<Record<string, string>>({})
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    setValeurs(Object.fromEntries(CHAMPS.map(c => [c.cle, rapport[c.cle] || ''])))
  }, [rapport])

  async function enregistrer(cle: string, valeur: string) {
    if ((rapport[cle] || '') === valeur) return
    setErreur(false)
    const res = await resilientMutate('PATCH', url, { [cle]: valeur })
    if (!res.ok && !res.queued) setErreur(true)
    else rapport[cle] = valeur
  }

  return (
    <div className="bg-white rounded-md border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-bold" style={{ color: NAVY }}>{t('notes_rapport')}</p>
        <p className="text-xs text-gray-400">{t('notes_aide')}</p>
      </div>
      {CHAMPS.map(c => (
        <label key={c.cle} className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NAVY }}>{t(c.libelle)}</span>
          {readOnly ? (
            <p className="text-xs whitespace-pre-line" style={{ color: NAVY }}>{valeurs[c.cle] || '—'}</p>
          ) : (
            <textarea
              rows={3}
              value={valeurs[c.cle] || ''}
              onChange={e => setValeurs(v => ({ ...v, [c.cle]: e.target.value }))}
              onBlur={e => enregistrer(c.cle, e.target.value)}
              className="text-xs border-2 border-[#0a0b0d] bg-white focus:outline-none focus:border-[#e11324] rounded px-2 py-1.5"
              style={{ color: NAVY }}
            />
          )}
        </label>
      ))}
      {erreur && <p className="text-[11px] font-semibold text-red-600">{t('non_enregistre_reessayez')}</p>}
    </div>
  )
}
