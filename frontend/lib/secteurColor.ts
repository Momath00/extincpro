const PALETTE = [
  { bg: '#6e4aa8', light: '#f2edfa' }, // violet
  { bg: '#1b8f72', light: '#e9f6f2' }, // sarcelle
  { bg: '#9a4a13', light: '#fff2e8' }, // brun/orange
  { bg: '#164e63', light: '#e6f3f6' }, // bleu-vert
  { bg: '#c0392b', light: '#fdeceb' }, // rouge
  { bg: '#1e5fae', light: '#e8f0fb' }, // bleu
  { bg: '#a8325a', light: '#fbeaf0' }, // magenta
  { bg: '#4d7c0f', light: '#eef6e3' }, // vert olive
]

// Hash déterministe d'une chaîne (nom de secteur) vers une couleur de la
// palette — le même secteur a toujours la même couleur, sans registre à
// maintenir (aucune table de correspondance à synchroniser).
export function secteurColor(secteur: string | null | undefined) {
  const s = secteur || ''
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
