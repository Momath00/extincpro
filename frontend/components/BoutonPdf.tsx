'use client'

import { useState, type CSSProperties } from 'react'
import { downloadPdf } from '@/lib/download'
import { useT } from '@/lib/i18n'

/**
 * Télécharge le rapport/certificat en vrai fichier PDF (généré par le
 * serveur), à côté du bouton qui l'ouvre dans le navigateur. Fiable sur
 * Safari Mac/iPad, où l'impression du document ouvert est capricieuse.
 * La génération prend quelques secondes : le bouton affiche un spinner.
 */
export default function BoutonPdf({
  url, nomFichier, libelle, className, style, onErreur,
}: {
  url: string
  nomFichier: string
  libelle?: string
  className?: string
  style?: CSSProperties
  onErreur?: (message: string) => void
}) {
  const t = useT()
  const [enCours, setEnCours] = useState(false)

  return (
    <button
      type="button"
      disabled={enCours}
      onClick={async () => {
        setEnCours(true)
        const ok = await downloadPdf(url, nomFichier)
        setEnCours(false)
        if (!ok) onErreur?.(t('erreur_telechargement_pdf'))
      }}
      className={className ?? 'h-10 text-sm font-bold px-4 rounded-md flex items-center gap-2 shadow-sm active:scale-[0.97] hover:opacity-90 transition-opacity disabled:opacity-50'}
      style={style ?? { background: '#0a0b0d', color: '#fff' }}
    >
      {enCours
        ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : <i className="ti ti-file-type-pdf" />}
      {' '}{enCours ? t('pdf_generation') : (libelle ?? t('telecharger_pdf'))}
    </button>
  )
}
