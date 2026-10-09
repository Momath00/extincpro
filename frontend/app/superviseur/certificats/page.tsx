'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// L'ancienne page « Certificats » est retirée : les envois se font depuis le
// dossier du bâtiment, les certificats non conformes sont sur le tableau de
// bord et l'export Excel est sur la page Bâtiments. On redirige les anciens
// liens et favoris vers le tableau de bord.
export default function AncienneListeCertificats() {
  const router = useRouter()
  useEffect(() => { router.replace('/superviseur') }, [router])
  return null
}
