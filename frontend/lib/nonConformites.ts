// Légende des non-conformités des extincteurs — mêmes codes que le formulaire
// papier des clients industriels. Doit rester alignée avec
// LEGENDE_NON_CONFORMITES (securiteincendie/inspections/models.py).
export const LEGENDE_NON_CONFORMITES: { code: string; fr: string; en: string }[] = [
  { code: 'TH', fr: 'Test hydrostatique', en: 'Hydrostatic test' },
  { code: '6Y', fr: 'Entretien préventif 6 ans', en: '6 year preventive maintenance' },
  { code: 'RL', fr: 'Déplacer', en: 'Relocate' },
  { code: 'RC', fr: 'Recharger', en: 'To recharge' },
  { code: 'SUPM', fr: 'Support manquant', en: 'Missing support' },
  { code: 'SUPR', fr: 'Réparer support', en: 'Repair support' },
  { code: 'LOCK', fr: 'Serrure pour cabinet', en: 'Cabinet lock' },
  { code: 'MIS', fr: 'Manquant', en: 'Missing' },
  { code: 'PIC', fr: 'Installer un pictogramme', en: 'Install sign' },
  { code: 'RP', fr: 'Remplacer', en: 'To replace' },
  { code: 'REC', fr: 'Recommandé', en: 'Recommendation' },
  { code: 'GAU', fr: 'Réparer manomètre', en: 'Repair gauge' },
]

export function libelleNC(code: string, langue: 'fr' | 'en' = 'fr'): string {
  const l = LEGENDE_NON_CONFORMITES.find(x => x.code === code)
  return l ? l[langue] : code
}

/** Une déficience : un extincteur ou un boyau « Défectueux » (D), ou dont
 *  la case Remarque est remplie (codes cochés ou texte libre, comme sur le
 *  formulaire Excel). */
export function estEnDeficience(it: any): boolean {
  return it.etat === 'D' || (it.non_conformites?.length ?? 0) > 0 || !!it.remarque?.trim()
}
