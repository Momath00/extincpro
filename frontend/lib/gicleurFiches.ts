'use client'

// Fiches d'inspection des sous-rapports gicleur (sous eau, sous air…).
// La description (sections, champs, libellés FR/EN) vient de l'API — même
// source que la validation et le PDF côté serveur (gicleur_fiches.py).

import { useEffect, useState } from 'react'
import { fetchWithCache } from '@/lib/offline/reportCache'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type Libelle = { fr: string; en: string }

export type ChampFiche = Libelle & {
  code: string
  type: 'question' | 'oui_non' | 'choix' | 'texte' | 'duree' | 'liste' | 'texte_long'
  na?: boolean
  complement?: Libelle & { code: string; unite?: string }
  unite?: string
  plein?: boolean
  multiple?: boolean
  options?: (Libelle & { v: string })[]
  visible_si?: { code: string; valeur: string }
}

/** `disposition: 'tableau'` : tableau à deux colonnes comme dans l'Excel
 *  (chaque case = intitulé + réponse sur la même ligne). */
export type SectionFiche = Libelle & {
  code: string; champs: ChampFiche[]; disposition?: 'tableau'
  /** Texte fixe sous la section (ex. attestation du vérificateur agréé). */
  note_fr?: string; note_en?: string
}
export type Fiche = Libelle & { sections: SectionFiche[] }
export type Fiches = Record<string, Fiche>

/** Valeur d'un champ : texte, options choisies, lignes de liste ou durée. */
export type Valeur = string | string[] | { min?: string; sec?: string }
export type Reponses = Record<string, Valeur>

export type SousRapport = {
  id: number
  type_fiche: string
  numero_systeme: string
  ordre: number
  reponses: Reponses
  /** Déficiences écrites par section : {code de section: texte}. */
  remarques: Record<string, string>
}

/** Sections de texte libre : pas de champ « Déficiences » ni de photos
 *  (même liste que SECTIONS_SANS_DEFICIENCES côté serveur). */
export const SECTIONS_SANS_DEFICIENCES = ['notes', 'dar_observation', 'id_infos', 'id_notes']

export type Deficience = { section: SectionFiche; remarque: string }

/** Icône Tabler par type de fiche. */
export const ICONES_FICHES: Record<string, string> = {
  eau: 'ti-droplet',
  air: 'ti-wind',
  darpr: 'ti-arrow-back-up',
  dar2cr: 'ti-arrows-left-right',
}

/** Sous-menus du menu Gicleurs : un par type de fiche (liste filtrée
 *  par `?fiche=`). Libellés dans i18n (`cle`). */
export const FICHES_MENU: { code: string; cle: string }[] = [
  { code: 'eau', cle: 'nav_gic_eau' },
  { code: 'air', cle: 'nav_gic_air' },
]

let enMemoire: Fiches | null = null
let identificationEnMemoire: Fiche | null = null

/** Infos et identification du bâtiment (onglets « Client » et
 *  « Identification » de l'Excel) — partie du rapport, pas une fiche. */
export type Identification = { reponses: Reponses; remarques: Record<string, string> }

/** Description des « Infos et identification » — chargée une fois, gardée hors ligne. */
export function useFicheIdentification(): Fiche | null {
  const [fiche, setFiche] = useState<Fiche | null>(identificationEnMemoire)
  useEffect(() => {
    if (identificationEnMemoire) return
    let annule = false
    fetchWithCache(`${API_URL}/api/rapports-gicleurs/fiche-identification/`, localStorage.getItem('access_token'))
      .then(({ data }) => {
        if (data && !annule) { identificationEnMemoire = data; setFiche(data) }
      })
      .catch(() => {})
    return () => { annule = true }
  }, [])
  return fiche
}

/** Nombre de sections de l'identification qui ont des déficiences écrites. */
export function nbDeficiencesIdentification(ident: Identification | null | undefined): number {
  return Object.entries(ident?.remarques || {})
    .filter(([code, texte]) => !SECTIONS_SANS_DEFICIENCES.includes(code) && (texte || '').trim()).length
}


/** Description des fiches — chargée une fois, gardée hors ligne. */
export function useFichesGicleur(): Fiches | null {
  const [fiches, setFiches] = useState<Fiches | null>(enMemoire)
  useEffect(() => {
    if (enMemoire) return
    let annule = false
    fetchWithCache(`${API_URL}/api/rapports-gicleurs/fiches/`, localStorage.getItem('access_token'))
      .then(({ data }) => {
        if (data && !annule) { enMemoire = data; setFiches(data) }
      })
      .catch(() => {})
    return () => { annule = true }
  }, [])
  return fiches
}

export function estVisible(champ: ChampFiche, reponses: Reponses): boolean {
  const c = champ.visible_si
  return !c || reponses[c.code] === c.valeur
}

/** Même règle que `deficiences_sous_rapport` côté serveur : une section
 *  dont le champ « Déficiences » est rempli (un « Non » n'en est pas une). */
export function deficiencesSousRapport(fiche: Fiche | undefined, sr: SousRapport): Deficience[] {
  if (!fiche) return []
  return fiche.sections
    .filter(s => !SECTIONS_SANS_DEFICIENCES.includes(s.code) && (sr.remarques?.[s.code] || '').trim())
    .map(section => ({ section, remarque: sr.remarques[section.code] }))
}

/** Avancement d'une section : questions et Oui/Non visibles répondus. */
export function progressionSection(section: SectionFiche, reponses: Reponses) {
  const champs = section.champs.filter(c => (c.type === 'question' || c.type === 'oui_non') && estVisible(c, reponses))
  return { repondus: champs.filter(c => reponses[c.code]).length, total: champs.length }
}

export function progressionFiche(fiche: Fiche | undefined, reponses: Reponses) {
  let repondus = 0, total = 0
  for (const s of fiche?.sections || []) {
    const p = progressionSection(s, reponses)
    repondus += p.repondus
    total += p.total
  }
  return { repondus, total }
}

export function titreSousRapport(fiches: Fiches | null, sr: SousRapport, langue: 'fr' | 'en'): string {
  const fiche = fiches?.[sr.type_fiche]
  const titre = fiche ? fiche[langue] : sr.type_fiche
  if (!sr.numero_systeme) return titre
  return `${titre} — ${langue === 'en' ? 'system' : 'système'} n° ${sr.numero_systeme}`
}
