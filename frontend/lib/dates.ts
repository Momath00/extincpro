/** Date sans heure de l'API (« 2026-10-29 », champ DateField) lue en heure
 *  locale. `new Date('2026-10-29')` la lit à minuit UTC, ce qui l'affiche à
 *  la veille au Québec (UTC−4/−5). Une date avec heure passe telle quelle. */
export function dateLocale(valeur: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(valeur)
}
