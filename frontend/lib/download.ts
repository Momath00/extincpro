const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Télécharge un document HTML protégé par jeton et l'ouvre dans un nouvel
 * onglet — utilisé par tous les boutons "Rapport"/"Certificat" (rapports
 * incendie, extincteur, éclairage, cuisine, citoyen, certificats).
 *
 * Sur un jeton expiré (401), redirige vers /login plutôt que d'échouer en
 * silence — sans ça le bouton semble juste "ne pas marcher" (rien ne se
 * passe, aucune erreur visible) une fois la session expirée.
 *
 * L'onglet est ouvert AVANT le fetch, pendant le clic : Safari (iPad/iPhone)
 * bloque comme fenêtre surgissante tout `window.open` fait après un
 * `await`. Doit donc rester appelé directement depuis le gestionnaire de
 * clic, sans `await` avant.
 *
 * L'URL blob n'est volontairement PAS révoquée : Safari (macOS/iPad)
 * recharge le document depuis son URL au moment d'imprimer / exporter en
 * PDF — une URL révoquée donne alors une page blanche. Le blob est libéré
 * quand l'onglet de l'application se ferme ou se recharge.
 */
export async function downloadHtml(url: string): Promise<boolean> {
  const fenetre = window.open('', '_blank')
  const token = localStorage.getItem('access_token')
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) {
      fenetre?.close()
      window.location.href = '/login'
      return false
    }
    if (!res.ok) {
      fenetre?.close()
      return false
    }
    const html = await res.text()
    const blob = new Blob([html], { type: 'text/html' })
    const blobUrl = URL.createObjectURL(blob)
    // Onglet bloqué malgré tout : ouvre le document dans l'onglet courant
    // plutôt que de ne rien faire.
    if (fenetre) fenetre.location.href = blobUrl
    else window.location.href = blobUrl
    return true
  } catch {
    fenetre?.close()
    return false
  }
}

/** Le même document que `downloadHtml`, mais en vrai fichier PDF généré par
 * le serveur (?fichier=pdf) — ne dépend pas de l'impression du navigateur. */
export function downloadPdf(url: string, nomFichier: string): Promise<boolean> {
  const nom = nomFichier.replace(/[\\/:*?"<>|]+/g, '-').trim() + '.pdf'
  return downloadFichier(`${url}${url.includes('?') ? '&' : '?'}fichier=pdf`, nom)
}

/** Équivalent de `downloadHtml` pour un fichier binaire (Excel, etc.). */
export async function downloadFichier(url: string, nomFichier: string): Promise<boolean> {
  const token = localStorage.getItem('access_token')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    window.location.href = '/login'
    return false
  }
  if (!res.ok) return false
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = nomFichier
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
  return true
}
