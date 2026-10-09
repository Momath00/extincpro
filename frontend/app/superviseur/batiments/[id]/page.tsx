'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import DossierBatiment from '@/components/dossier/DossierBatiment'
import { useT } from '@/lib/i18n'

function Contenu() {
  const t = useT()
  const params = useParams()
  const recherche = useSearchParams()
  const id = Number(params.id)
  // ?cycle=<id>&envoyer=1 : ouvert depuis le bouton d'envoi d'un rapport —
  // on arrive directement sur la fenêtre « Envoyer tous les rapports ».
  const cycle = Number(recherche.get('cycle')) || null
  const envoyer = recherche.get('envoyer') === '1'

  return (
    <div className="flex flex-col gap-4">
      <Link href="/superviseur/batiments" className="text-xs text-gray-500 hover:text-[#0a0b0d] flex items-center gap-1 w-fit">
        <i className="ti ti-arrow-left" /> {t('dossier_retour_batiments')}
      </Link>
      {Number.isFinite(id) && <DossierBatiment batimentId={id} role="superviseur" cycleInitial={cycle} ouvrirEnvoi={envoyer} />}
    </div>
  )
}

export default function DossierBatimentPage() {
  return (
    <Suspense fallback={null}>
      <Contenu />
    </Suspense>
  )
}
