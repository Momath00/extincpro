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
 * L'URL blob n'est volontairement PAS révoquée : Safari (macOS/iPad)
 * recharge le document depuis son URL au moment d'imprimer / exporter en
 * PDF — une URL révoquée donne alors une page blanche. Le blob est libéré
 * quand l'onglet de l'application se ferme ou se recharge.
 */
export async function downloadHtml(url: string): Promise<boolean> {
  const token = localStorage.getItem('access_token')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    window.location.href = '/login'
    return false
  }
  if (!res.ok) return false
  const html = await res.text()
  const blob = new Blob([html], { type: 'text/html' })
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank')
  return true
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
