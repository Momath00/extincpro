'use client'

import { useEffect, useState } from 'react'
import { useLangue, useT } from '@/lib/i18n'
import { resilientMutate } from '@/lib/offline/resilientFetch'
import BarreOutils, { BoutonPrincipal } from '@/components/rapports/BarreOutils'
import SectionPhotos from '@/components/rapports/SectionPhotos'
import { downloadHtml } from '@/lib/download'
import SectionDebitsValves, { type DebitsValves } from './SectionDebitsValves'
import {
  ICONES_FICHES, SECTIONS_SANS_DEFICIENCES, deficiencesSousRapport, nbDeficiencesIdentification, useFicheIdentification, estVisible, progressionFiche, progressionSection, titreSousRapport,
  useFichesGicleur,
  type ChampFiche, type Fiche, type Fiches, type Identification, type SectionFiche, type SousRapport, type Valeur,
} from '@/lib/gicleurFiches'

// Onglet « Inspection » du rapport gicleur : une carte par fiche (système
// sous eau, sous air…), chacune découpée en sections repliables reprises de
// l'Excel d'inspection. Chaque champ s'enregistre seul (PATCH fusionné côté
// serveur), y compris hors ligne via la file de résilience.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const RED = '#e11324'
const VERT = '#0d6b4f'

const CLASSE_CHAMP = 'w-full border-2 border-[#0a0b0d] bg-white rounded-md px-3 py-2 text-sm font-semibold text-[#0a0b0d] placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:border-[#e11324] disabled:bg-gray-50 disabled:text-gray-500'

/** Valeur texte d'un champ (vide si ce n'est pas du texte). */
const texte = (v: Valeur | undefined): string => (typeof v === 'string' ? v : '')

const JAUNE = '#ca8a04'

/** Oui / S.O. / Non — mêmes couleurs partout : Oui vert, S.O. jaune, Non rouge. */
function optionsOuiNon(champ: ChampFiche, t: (cle: string) => string) {
  return [
    { v: 'oui', l: t('oui'), couleur: VERT },
    ...(champ.type === 'question' && champ.na ? [{ v: 'na', l: t('so_abbr'), couleur: JAUNE }] : []),
    { v: 'non', l: t('non'), couleur: RED },
  ]
}

type MajListe = (f: (liste: SousRapport[]) => SousRapport[]) => void

/** Champ qui s'enregistre à la perte du focus, seulement s'il a changé. */
function Saisie({ valeur, onSave, readOnly, placeholder, multiline, className = '', inputMode }: {
  valeur: string; onSave: (v: string) => void; readOnly: boolean; placeholder?: string; multiline?: boolean; className?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
}) {
  const [v, setV] = useState(valeur || '')
  // Resynchronise quand la valeur change ailleurs (rechargement, autre champ).
  const [precedente, setPrecedente] = useState(valeur)
  if (valeur !== precedente) { setPrecedente(valeur); setV(valeur || '') }
  const commit = () => { if (v !== (valeur || '')) onSave(v) }
  return multiline ? (
    <textarea value={v} onChange={e => setV(e.target.value)} onBlur={commit} disabled={readOnly}
      placeholder={placeholder} rows={3} className={`${CLASSE_CHAMP} ${className}`} />
  ) : (
    <input value={v} onChange={e => setV(e.target.value)} onBlur={commit} disabled={readOnly}
      placeholder={placeholder} inputMode={inputMode} className={`${CLASSE_CHAMP} ${className}`} />
  )
}

/** Choix segmenté — un second clic sur le choix actif l'efface. */
function Segments({ valeur, options, onChange, readOnly }: {
  valeur: string; options: { v: string; l: string; couleur: string }[]; onChange: (v: string) => void; readOnly: boolean
}) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5 flex-shrink-0">
      {options.map(o => {
        const actif = valeur === o.v
        return (
          <button key={o.v} type="button" disabled={readOnly} onClick={() => onChange(actif ? '' : o.v)}
            className="min-w-[52px] px-3 py-1.5 text-xs font-bold rounded-md transition-all disabled:cursor-not-allowed"
            style={actif
              ? { background: o.couleur, color: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }
              : { color: '#6b7280' }}>
            {o.l}
          </button>
        )
      })}
    </div>
  )
}

function Pastille({ children, couleur, fond }: { children: React.ReactNode; couleur: string; fond: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: couleur, background: fond }}>
      {children}
    </span>
  )
}

export default function FichesGicleur({ rapportId, sousRapports, majSousRapports, debitsValves, onDebitsValves, identification, onIdentification, entete, onEntete, readOnly, onErreur }: {
  rapportId: number
  sousRapports: SousRapport[]
  majSousRapports: MajListe
  /** Section optionnelle « Débits et valves » (null = non ajoutée). */
  debitsValves: DebitsValves | null
  onDebitsValves: (v: DebitsValves | null) => void
  /** Infos et identification du bâtiment (onglets « Client » et « Identification »). */
  identification: Identification
  onIdentification: (i: Identification) => void
  entete: EnteteIdentification
  onEntete: (champ: 'numero_job' | 'frequence_inspection', valeur: string) => void
  readOnly: boolean
  onErreur?: (msg: string) => void
}) {
  const t = useT()
  const langue = useLangue()
  const fiches = useFichesGicleur()
  // ?fiche=<id> (clic sur une fiche dans le tableau des rapports) : ouvre
  // directement cette fiche ; sinon la seule fiche du rapport.
  const [cible] = useState(() => (typeof window === 'undefined' ? 0 : Number(new URLSearchParams(window.location.search).get('fiche')) || 0))
  const [ouvertes, setOuvertes] = useState<number[]>(() => {
    if (sousRapports.some(s => s.id === cible)) return [cible]
    return sousRapports.length === 1 ? [sousRapports[0].id] : []
  })
  // Sections ouvertes, par fiche : {id de la fiche: [codes de section]}.
  const [sectionsOuvertes, setSectionsOuvertes] = useState<Record<number, string[]>>({})
  const [dvOuvert, setDvOuvert] = useState(false)
  const ficheIdent = useFicheIdentification()
  const [identOuverte, setIdentOuverte] = useState(false)
  const [sectionsIdent, setSectionsIdent] = useState<string[]>([])
  const basculerSectionIdent = (code: string) => setSectionsIdent(l => (l.includes(code) ? l.filter(c => c !== code) : [...l, code]))
  const basculerFiche = (id: number) => setOuvertes(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]))
  const basculerSection = (id: number, code: string) => setSectionsOuvertes(s => {
    const liste = s[id] || []
    return { ...s, [id]: liste.includes(code) ? liste.filter(c => c !== code) : [...liste, code] }
  })
  function toutOuvrir() {
    setOuvertes(sousRapports.map(s => s.id))
    setSectionsOuvertes(Object.fromEntries(sousRapports.map(s => [s.id, (fiches?.[s.type_fiche]?.sections || []).map(x => x.code)])))
    setDvOuvert(true)
    setIdentOuverte(true)
    setSectionsIdent((ficheIdent?.sections || []).map(s => s.code))
  }
  function toutFermer() {
    setOuvertes([])
    setSectionsOuvertes({})
    setDvOuvert(false)
    setIdentOuverte(false)
    setSectionsIdent([])
  }
  const [ajout, setAjout] = useState(false)
  const [aSupprimer, setASupprimer] = useState<SousRapport | null>(null)
  const [etat, setEtat] = useState<'idle' | 'saving' | 'saved'>('idle')

  async function patch(sr: SousRapport, corps: Record<string, unknown>) {
    setEtat('saving')
    const res = await resilientMutate('PATCH', `${API_URL}/api/sous-rapports-gicleur/${sr.id}/`, corps)
    if (!res.ok) { setEtat('idle'); onErreur?.(t('erreur_sauvegarde')); return }
    setEtat('saved')
    setTimeout(() => setEtat('idle'), 1500)
  }

  /** Mise à jour optimiste d'une réponse ou d'une précision, puis envoi. */
  function majValeur(sr: SousRapport, cle: 'reponses' | 'remarques', code: string, valeur: Valeur) {
    const vide = valeur === '' || valeur === null || (Array.isArray(valeur) && valeur.length === 0)
    majSousRapports(liste => liste.map(x => {
      if (x.id !== sr.id) return x
      const suite: Record<string, Valeur> = { ...(x[cle] || {}) }
      if (vide) delete suite[code]
      else suite[code] = valeur
      return { ...x, [cle]: suite }
    }))
    patch(sr, { [cle]: { [code]: vide ? '' : valeur } })
  }

  function majNumero(sr: SousRapport, numero: string) {
    majSousRapports(liste => liste.map(x => (x.id === sr.id ? { ...x, numero_systeme: numero } : x)))
    patch(sr, { numero_systeme: numero })
  }

  /** Ajoute la section optionnelle « Débits et valves » au rapport. */
  async function ajouterDebitsValves() {
    const vide: DebitsValves = { lignes: [{}], deficiences: '' }
    onDebitsValves(vide)
    const res = await resilientMutate('PATCH', `${API_URL}/api/rapports-gicleurs/${rapportId}/`, { debits_valves: vide })
    if (!res.ok) onErreur?.(t('erreur_sauvegarde'))
  }

  /** Une réponse ou une déficience de l'identification : mise à jour
   *  optimiste, puis PATCH fusionné sur le rapport. */
  async function majIdentification(cle: 'reponses' | 'remarques', code: string, valeur: Valeur) {
    const vide = valeur === '' || (Array.isArray(valeur) && valeur.length === 0)
    const suite: Record<string, Valeur> = { ...(identification[cle] || {}) }
    if (vide) delete suite[code]
    else suite[code] = valeur
    onIdentification({ ...identification, [cle]: suite } as Identification)
    setEtat('saving')
    const res = await resilientMutate('PATCH', `${API_URL}/api/rapports-gicleurs/${rapportId}/`,
      { identification: { [cle]: { [code]: vide ? '' : valeur } } })
    if (!res.ok) { setEtat('idle'); onErreur?.(t('erreur_sauvegarde')); return }
    setEtat('saved')
    setTimeout(() => setEtat('idle'), 1500)
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return
    const sr = aSupprimer
    setASupprimer(null)
    majSousRapports(liste => liste.filter(x => x.id !== sr.id))
    const res = await resilientMutate('DELETE', `${API_URL}/api/sous-rapports-gicleur/${sr.id}/`)
    if (!res.ok) onErreur?.(t('erreur_sauvegarde'))
  }

  useEffect(() => {
    if (fiches && cible) document.getElementById(`fiche-${cible}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [fiches, cible])

  if (!fiches) {
    return <div className="h-40 rounded-lg bg-white border border-gray-100 animate-pulse" />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold flex items-center gap-2" style={{ color: NAVY }}>
            <i className="ti ti-clipboard-list" /> {t('gic_fiches_titre')}
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{sousRapports.length}</span>
          </h2>
        </div>
        {etat !== 'idle' && (
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: etat === 'saved' ? VERT : '#9ca3af' }}>
            <i className={`ti ${etat === 'saved' ? 'ti-check' : 'ti-loader-2 animate-spin'}`} />
            {etat === 'saved' ? t('enregistre') : t('enregistrement_en_cours')}
          </span>
        )}
      </div>

      <BarreOutils onToutOuvrir={toutOuvrir} onToutFermer={toutFermer}>
          {!readOnly && !debitsValves && (
            <button type="button" onClick={ajouterDebitsValves}
              className="h-9 flex items-center gap-2 px-4 rounded-md text-sm font-bold border-2 border-[#0a0b0d] bg-white hover:bg-gray-50 transition-colors"
              style={{ color: NAVY }}>
              <i className="ti ti-gauge text-base" /> {t('dv_titre')}
            </button>
          )}
          {!readOnly && <BoutonPrincipal onClick={() => setAjout(v => !v)}>{t('gic_ajouter_fiche')}</BoutonPrincipal>}
      </BarreOutils>

      {ficheIdent && (
        <CarteIdentification fiche={ficheIdent} identification={identification} entete={entete} onEntete={onEntete}
          majValeur={majIdentification} rapportId={rapportId} langue={langue} readOnly={readOnly}
          ouverte={identOuverte} basculer={() => setIdentOuverte(o => !o)}
          sectionsOuvertes={sectionsIdent} basculerSection={basculerSectionIdent} />
      )}

      {ajout && !readOnly && (
        <AjoutFiche fiches={fiches} rapportId={rapportId} existants={sousRapports}
          onAnnuler={() => setAjout(false)}
          onCree={sr => { majSousRapports(liste => [...liste, sr]); setAjout(false); setOuvertes(l => [...l, sr.id]) }}
          onErreur={onErreur} />
      )}

      {sousRapports.length === 0 && !ajout && !debitsValves && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 px-6 py-12 text-center">
          <span className="inline-flex w-14 h-14 rounded-full bg-gray-50 items-center justify-center">
            <i className="ti ti-droplets text-2xl text-gray-300" />
          </span>
          <p className="text-sm font-bold mt-3" style={{ color: NAVY }}>{t('gic_aucune_fiche')}</p>
          <p className="text-xs text-gray-400 mt-1">{t('gic_aucune_fiche_desc')}</p>
        </div>
      )}

      {sousRapports.map(sr => (
        <CarteFiche key={sr.id} sr={sr} fiche={fiches[sr.type_fiche]} fiches={fiches} langue={langue}
          rapportId={rapportId} readOnly={readOnly}
          ouverte={ouvertes.includes(sr.id)} basculer={() => basculerFiche(sr.id)}
          sectionsOuvertes={sectionsOuvertes[sr.id] || []} basculerSection={code => basculerSection(sr.id, code)}
          majValeur={majValeur} majNumero={majNumero} supprimer={() => setASupprimer(sr)} />
      ))}

      {debitsValves && (
        <SectionDebitsValves rapportId={rapportId} valeur={debitsValves} onChange={onDebitsValves}
          readOnly={readOnly} onErreur={onErreur} ouvert={dvOuvert} basculer={() => setDvOuvert(o => !o)} />
      )}

      {aSupprimer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setASupprimer(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-trash text-lg" style={{ color: RED }} />
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: NAVY }}>{t('gic_supprimer_fiche_titre')}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {titreSousRapport(fiches, aSupprimer, langue)} — {t('gic_supprimer_fiche_texte')}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setASupprimer(null)}
                className="px-4 py-2 text-xs font-bold rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">{t('annuler')}</button>
              <button type="button" onClick={confirmerSuppression}
                className="px-4 py-2 text-xs font-bold rounded-md text-white" style={{ background: RED }}>{t('supprimer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Choix des fiches — même composant à la création du rapport et ici. */
export function ChoixTypesFiches({ fiches, valeurs, onChange }: {
  fiches: Fiches; valeurs: Record<string, number>; onChange: (v: Record<string, number>) => void
}) {
  const langue = useLangue()
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Object.entries(fiches).map(([code, fiche]) => {
        const n = valeurs[code] || 0
        const regler = (k: number) => onChange({ ...valeurs, [code]: Math.max(0, Math.min(20, k)) })
        return (
          <div key={code} className="flex items-center gap-3 p-3 rounded-lg border-2 transition-colors bg-white"
            style={{ borderColor: n ? RED : NAVY, background: n ? '#fff7f7' : '#fff' }}>
            <button type="button" onClick={() => regler(n ? 0 : 1)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: n ? RED : '#f1f5f9' }}>
                <i className={`ti ${ICONES_FICHES[code] || 'ti-file-text'} text-lg`} style={{ color: n ? '#fff' : NAVY }} />
              </span>
              <span className="text-sm font-bold truncate" style={{ color: NAVY }}>{fiche[langue]}</span>
            </button>
            <div className="flex items-center rounded-md border-2 border-[#0a0b0d] bg-white flex-shrink-0">
              <button type="button" onClick={() => regler(n - 1)} className="w-8 h-8 text-gray-500 hover:text-[#0a0b0d]" aria-label="−">
                <i className="ti ti-minus text-sm" />
              </button>
              <span className="w-6 text-center text-sm font-extrabold" style={{ color: NAVY }}>{n}</span>
              <button type="button" onClick={() => regler(n + 1)} className="w-8 h-8 text-gray-500 hover:text-[#0a0b0d]" aria-label="+">
                <i className="ti ti-plus text-sm" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Liste des fiches à créer à partir des quantités choisies : numérotées
 *  1, 2, 3… par type quand il y en a plusieurs. */
export function fichesDepuisQuantites(valeurs: Record<string, number>, depart: Record<string, number> = {}) {
  const out: { type_fiche: string; numero_systeme: string }[] = []
  for (const [code, n] of Object.entries(valeurs)) {
    const base = depart[code] || 0
    for (let i = 1; i <= n; i++) {
      out.push({ type_fiche: code, numero_systeme: base + n > 1 ? String(base + i) : '' })
    }
  }
  return out
}

function AjoutFiche({ fiches, rapportId, existants, onAnnuler, onCree, onErreur }: {
  fiches: Fiches; rapportId: number; existants: SousRapport[]
  onAnnuler: () => void; onCree: (sr: SousRapport) => void; onErreur?: (msg: string) => void
}) {
  const t = useT()
  const [valeurs, setValeurs] = useState<Record<string, number>>({})
  const [envoi, setEnvoi] = useState(false)
  const total = Object.values(valeurs).reduce((a, b) => a + b, 0)

  async function ajouter() {
    const deja: Record<string, number> = {}
    existants.forEach(s => { deja[s.type_fiche] = (deja[s.type_fiche] || 0) + 1 })
    setEnvoi(true)
    for (const corps of fichesDepuisQuantites(valeurs, deja)) {
      const res = await fetch(`${API_URL}/api/rapports-gicleurs/${rapportId}/sous-rapports/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: JSON.stringify(corps),
      }).catch(() => null)
      if (!res || !res.ok) { onErreur?.(t('erreur_sauvegarde')); break }
      onCree(await res.json())
    }
    setEnvoi(false)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 flex flex-col gap-4">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>{t('gic_choisir_fiches')}</p>
      <ChoixTypesFiches fiches={fiches} valeurs={valeurs} onChange={setValeurs} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onAnnuler}
          className="px-4 py-2 text-xs font-bold rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">{t('annuler')}</button>
        <BoutonPrincipal onClick={ajouter} disabled={!total || envoi}>{t('ajouter')}</BoutonPrincipal>
      </div>
    </div>
  )
}

function CarteFiche({ sr, fiche, fiches, langue, rapportId, readOnly, ouverte, basculer, sectionsOuvertes, basculerSection, majValeur, majNumero, supprimer }: {
  sr: SousRapport; fiche: Fiche | undefined; fiches: Fiches; langue: 'fr' | 'en'; rapportId: number; readOnly: boolean
  ouverte: boolean; basculer: () => void
  sectionsOuvertes: string[]; basculerSection: (code: string) => void
  majValeur: (sr: SousRapport, cle: 'reponses' | 'remarques', code: string, valeur: Valeur) => void
  majNumero: (sr: SousRapport, numero: string) => void
  supprimer: () => void
}) {
  const t = useT()
  const [telechargement, setTelechargement] = useState(false)
  if (!fiche) return null

  const deficiences = deficiencesSousRapport(fiche, sr)
  const { repondus, total } = progressionFiche(fiche, sr.reponses)
  const pct = total ? Math.round((repondus / total) * 100) : 0

  return (
    <section id={`fiche-${sr.id}`} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden scroll-mt-4"
      style={{ borderLeft: `4px solid ${deficiences.length ? RED : pct === 100 ? VERT : NAVY}` }}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button type="button" onClick={basculer} aria-expanded={ouverte} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
            <i className={`ti ${ICONES_FICHES[sr.type_fiche] || 'ti-file-text'} text-xl text-white`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold truncate" style={{ color: NAVY }}>{titreSousRapport(fiches, sr, langue)}</span>
            <span className="flex items-center gap-2 mt-1.5">
              <span className="h-1.5 w-28 sm:w-40 rounded-full bg-gray-100 overflow-hidden">
                <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? VERT : NAVY }} />
              </span>
              <span className="text-[11px] font-semibold text-gray-400">{repondus}/{total}</span>
            </span>
          </span>
        </button>
        <span className="hidden sm:flex">
          {deficiences.length > 0
            ? <Pastille couleur={RED} fond="#fee2e2"><i className="ti ti-alert-triangle" />{deficiences.length} {t('deficience_s')}</Pastille>
            : pct === 100 && <Pastille couleur={VERT} fond="#dcfce7"><i className="ti ti-circle-check" />{t('gic_conforme')}</Pastille>}
        </span>
        <button type="button" title={t('gic_telecharger_fiche')} disabled={telechargement}
          onClick={async () => {
            setTelechargement(true)
            await downloadHtml(`${API_URL}/api/rapports-gicleurs/${rapportId}/telecharger/?sous_rapport=${sr.id}`)
            setTelechargement(false)
          }}
          className="w-9 h-9 flex items-center justify-center rounded-md text-gray-400 hover:text-[#0a0b0d] hover:bg-gray-100 transition-colors flex-shrink-0 disabled:opacity-50">
          <i className={`ti ${telechargement ? 'ti-loader-2 animate-spin' : 'ti-file-download'}`} />
        </button>
        {!readOnly && (
          <button type="button" onClick={supprimer} title={t('supprimer')}
            className="w-9 h-9 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
            <i className="ti ti-trash" />
          </button>
        )}
        <button type="button" onClick={basculer} className="w-9 h-9 flex items-center justify-center flex-shrink-0" aria-label={fiche[langue]}>
          <i className="ti ti-chevron-down text-xl transition-transform" style={{ color: NAVY, transform: ouverte ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>

      {ouverte && (
        <div className="border-t border-gray-100 bg-slate-50/60 p-3 sm:p-4 flex flex-col gap-3">
          <div className="bg-white rounded-lg border border-gray-100 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 sm:w-40 flex-shrink-0">{t('gic_numero_systeme')}</label>
            <Saisie valeur={sr.numero_systeme} onSave={v => majNumero(sr, v.trim())} readOnly={readOnly} className="sm:max-w-xs" placeholder="1" />
          </div>
          {fiche.sections.map((s, i) => (
            <BlocSection key={s.code} numero={i + 1} section={s} sr={sr} langue={langue} rapportId={rapportId} readOnly={readOnly}
              ouvert={sectionsOuvertes.includes(s.code)} basculer={() => basculerSection(s.code)}
              majValeur={(cle, code, v) => majValeur(sr, cle, code, v)} />
          ))}
        </div>
      )}
    </section>
  )
}

/** Infos du rapport déjà connues ailleurs (client, bâtiment, techniciens…),
 *  affichées en tête de l'identification comme dans l'onglet « Client » de l'Excel. */
export type EnteteIdentification = {
  client: string; adresse: string; contact: string; infosContact: string
  inspecteurs: string; date: string; numeroJob: string; frequence: string
}

const TYPES_INSPECTION: { v: string; cle: string }[] = [
  { v: 'annuelle', cle: 'gic_type_annuelle' },
  { v: 'semestrielle', cle: 'gic_type_semestrielle' },
  { v: 'trimestrielle', cle: 'gic_type_trimestrielle' },
  { v: 'mensuelle', cle: 'gic_type_mensuelle' },
  { v: 'bimensuelle', cle: 'gic_type_bimensuelle' },
]

/** « Infos et identification du bâtiment » (onglets « Client » et
 *  « Identification » de l'Excel) : partie du rapport, en tête de
 *  l'inspection. Les infos du bâtiment sont reprises du rapport précédent. */
function CarteIdentification({ fiche, identification, entete, onEntete, majValeur, rapportId, langue, readOnly, ouverte, basculer, sectionsOuvertes, basculerSection }: {
  fiche: Fiche; identification: Identification; entete: EnteteIdentification
  onEntete: (champ: 'numero_job' | 'frequence_inspection', valeur: string) => void
  majValeur: (cle: 'reponses' | 'remarques', code: string, valeur: Valeur) => void
  rapportId: number; langue: 'fr' | 'en'; readOnly: boolean
  ouverte: boolean; basculer: () => void
  sectionsOuvertes: string[]; basculerSection: (code: string) => void
}) {
  const t = useT()
  const nbDef = nbDeficiencesIdentification(identification)
  // Même forme qu'une fiche pour réutiliser les sections (BlocSection).
  const pseudo: SousRapport = {
    id: 0, type_fiche: 'identification', numero_systeme: '', ordre: 0,
    reponses: identification.reponses || {}, remarques: identification.remarques || {},
  }
  const infos: [string, string][] = [
    [t('client'), entete.client], [t('adresse'), entete.adresse], [t('gic_contact'), entete.contact],
    [t('gic_infos_contact'), entete.infosContact], [t('gic_inspecteur'), entete.inspecteurs], [t('date_inspection'), entete.date],
  ]

  return (
    <section className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden"
      style={{ borderLeft: `4px solid ${nbDef ? RED : NAVY}` }}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button type="button" onClick={basculer} aria-expanded={ouverte} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: NAVY }}>
            <i className="ti ti-building text-xl text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold truncate" style={{ color: NAVY }}>{fiche[langue]}</span>
            <span className="block text-[11px] font-semibold text-gray-400 mt-0.5 truncate">{entete.adresse}</span>
          </span>
        </button>
        {nbDef > 0 && (
          <span className="hidden sm:flex">
            <Pastille couleur={RED} fond="#fee2e2"><i className="ti ti-alert-triangle" />{nbDef} {t('deficience_s')}</Pastille>
          </span>
        )}
        <button type="button" onClick={basculer} className="w-9 h-9 flex items-center justify-center flex-shrink-0" aria-label={fiche[langue]}>
          <i className="ti ti-chevron-down text-xl transition-transform" style={{ color: NAVY, transform: ouverte ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>

      {ouverte && (
        <div className="border-t border-gray-100 bg-slate-50/60 p-3 sm:p-4 flex flex-col gap-3">
          {/* Infos de l'inspection (onglet « Client » de l'Excel). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-300 border-2 border-[#0a0b0d] rounded-lg overflow-hidden">
            {infos.map(([libelle, valeur]) => (
              <div key={libelle} className="bg-white px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="text-sm font-bold flex-shrink-0" style={{ color: NAVY }}>{libelle}</span>
                <span className="text-sm text-gray-600 sm:text-right flex-1 min-w-0 break-words">{valeur || '—'}</span>
              </div>
            ))}
            <div className="bg-white px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-sm font-bold flex-shrink-0" style={{ color: NAVY }}>{t('gic_bon_de_travail')}</span>
              <div className="flex-1"><Saisie valeur={entete.numeroJob} readOnly={readOnly} className="py-1.5" onSave={v => onEntete('numero_job', v.trim())} /></div>
            </div>
            <div className="bg-white px-3 py-2.5 flex flex-col gap-2">
              <span className="text-sm font-bold" style={{ color: NAVY }}>{t('gic_type_inspection')}</span>
              <div className="flex flex-wrap gap-1.5">
                {TYPES_INSPECTION.map(o => {
                  const actif = entete.frequence === o.v
                  return (
                    <button key={o.v} type="button" disabled={readOnly} onClick={() => onEntete('frequence_inspection', actif ? '' : o.v)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border-2 text-xs font-bold disabled:cursor-not-allowed"
                      style={actif ? { background: NAVY, borderColor: NAVY, color: '#fff' } : { borderColor: NAVY, color: NAVY, background: '#fff' }}>
                      {actif && <i className="ti ti-check text-[11px]" />}{t(o.cle)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {fiche.sections.map((s, i) => (
            <BlocSection key={s.code} numero={i + 1} section={s} sr={pseudo} langue={langue} rapportId={rapportId} readOnly={readOnly}
              ouvert={sectionsOuvertes.includes(s.code)} basculer={() => basculerSection(s.code)} majValeur={majValeur}
              filtrePhotos={{ sous_rapport: 'aucune', section_fiche: s.code }} />
          ))}
        </div>
      )}
    </section>
  )
}

function BlocSection({ numero, section, sr, langue, rapportId, readOnly, ouvert, basculer, majValeur, filtrePhotos }: {
  numero: number; section: SectionFiche; sr: SousRapport; langue: 'fr' | 'en'; rapportId: number; readOnly: boolean
  ouvert: boolean; basculer: () => void
  majValeur: (cle: 'reponses' | 'remarques', code: string, valeur: Valeur) => void
  /** Photos d'une section du rapport (hors fiche) — sinon celles de la fiche. */
  filtrePhotos?: Record<string, string>
}) {
  const t = useT()
  const reponses = sr.reponses || {}
  const champs = section.champs.filter(c => estVisible(c, reponses))
  const { repondus, total } = progressionSection(section, reponses)
  const aDeficiences = !!(sr.remarques?.[section.code] || '').trim()
  const complete = total > 0 && repondus === total

  // Les champs de valeur (texte, durée, choix) sont regroupés en grille ;
  // questions, listes et notes occupent toute la largeur.
  const blocs: (ChampFiche | ChampFiche[])[] = []
  for (const c of champs) {
    const enGrille = c.type === 'texte' || c.type === 'duree' || (c.type === 'choix' && !c.multiple)
    const dernier = blocs[blocs.length - 1]
    if (enGrille && Array.isArray(dernier)) dernier.push(c)
    else blocs.push(enGrille ? [c] : c)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
      <button type="button" onClick={basculer} aria-expanded={ouvert}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 transition-colors"
          style={{ background: complete && !aDeficiences ? VERT : ouvert ? RED : NAVY }}>
          {complete && !aDeficiences ? <i className="ti ti-check text-xs" /> : numero}
        </span>
        <span className="flex-1 text-sm font-bold" style={{ color: NAVY }}>{section[langue]}</span>
        {aDeficiences && <Pastille couleur={RED} fond="#fee2e2"><i className="ti ti-alert-triangle" />{t('onglet_deficiences')}</Pastille>}
        {total > 0 && <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap">{repondus}/{total}</span>}
        <i className="ti ti-chevron-down text-lg transition-transform flex-shrink-0" style={{ color: NAVY, transform: ouvert ? 'rotate(180deg)' : 'none' }} />
      </button>

      {ouvert && (
        <div className="border-t border-gray-100 px-4 py-4 flex flex-col gap-3">
          {section.disposition === 'tableau' && (
            <TableauSection champs={champs} sr={sr} langue={langue} readOnly={readOnly} majValeur={majValeur} />
          )}

          {section.disposition !== 'tableau' && blocs.map((b, i) => Array.isArray(b) ? (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {b.map(c => (
                <div key={c.code} className={c.plein ? 'sm:col-span-2' : ''}>
                  <ChampValeur champ={c} valeur={reponses[c.code]} langue={langue} readOnly={readOnly}
                    onChange={v => majValeur('reponses', c.code, v)} />
                </div>
              ))}
            </div>
          ) : (
            <LigneChamp key={b.code} champ={b} sr={sr} langue={langue} readOnly={readOnly} majValeur={majValeur} />
          ))}

          {(section[`note_${langue}`] || section.note_fr) && (
            <p className="text-sm font-semibold italic" style={{ color: NAVY }}>
              <i className="ti ti-signature mr-1.5" />{section[`note_${langue}`] || section.note_fr}
            </p>
          )}

          {!SECTIONS_SANS_DEFICIENCES.includes(section.code) && (
            <div className="mt-1 rounded-lg border-2 p-3 flex flex-col gap-1.5" style={{ borderColor: aDeficiences ? RED : '#e5e7eb', background: aDeficiences ? '#fff7f7' : '#fff' }}>
              <label className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: aDeficiences ? RED : '#6b7280' }}>
                <i className="ti ti-alert-triangle" /> {t('gic_deficiences_section')}
              </label>
              <Saisie multiline valeur={sr.remarques?.[section.code] || ''} readOnly={readOnly}
                placeholder={t('gic_deficiences_placeholder')} onSave={v => majValeur('remarques', section.code, v.trim())} />
            </div>
          )}

          {!SECTIONS_SANS_DEFICIENCES.includes(section.code) && (
            <div className="mt-1">
              <SectionPhotos photosUrl={`${API_URL}/api/rapports-gicleurs/${rapportId}/photos/`} readOnly={readOnly}
                filtre={filtrePhotos ?? { sous_rapport: String(sr.id), section_fiche: section.code }}
                titre={`${t('gic_photos')} — ${section[langue]}`} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Section présentée comme dans l'Excel : tableau à deux colonnes, chaque
 *  case = intitulé + réponse sur la même ligne. Un champ `plein` ou un
 *  choix multiple prend toute la ligne. Une colonne sur téléphone. */
function TableauSection({ champs, sr, langue, readOnly, majValeur }: {
  champs: ChampFiche[]; sr: SousRapport; langue: 'fr' | 'en'; readOnly: boolean
  majValeur: (cle: 'reponses' | 'remarques', code: string, valeur: Valeur) => void
}) {
  // Cases vides pour garder la grille alignée avant une ligne pleine et à la fin.
  const cases: (ChampFiche | null)[] = []
  let colonne = 0
  for (const c of champs) {
    const pleine = !!c.plein || (c.type === 'choix' && !!c.multiple) || c.type === 'liste' || c.type === 'texte_long'
    if (pleine && colonne === 1) { cases.push(null); colonne = 0 }
    cases.push(c)
    colonne = pleine ? 0 : (colonne + 1) % 2
  }
  if (colonne === 1) cases.push(null)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-300 border-2 border-[#0a0b0d] rounded-lg overflow-hidden">
      {cases.map((c, i) => c === null ? (
        <div key={`vide-${i}`} className="hidden sm:block bg-white" />
      ) : (
        <div key={c.code}
          className={`bg-white px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${c.plein || (c.type === 'choix' && c.multiple) ? 'sm:col-span-2' : ''}`}>
          <span className="text-sm font-bold sm:max-w-[48%] flex-shrink-0" style={{ color: NAVY }}>{c[langue]}</span>
          <div className="flex-1 min-w-0 flex sm:justify-end">
            <ControleCase champ={c} sr={sr} langue={langue} readOnly={readOnly} majValeur={majValeur} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Réponse d'une case du tableau : Oui/Non(/S.O.), texte avec unité, durée ou choix. */
function ControleCase({ champ, sr, langue, readOnly, majValeur }: {
  champ: ChampFiche; sr: SousRapport; langue: 'fr' | 'en'; readOnly: boolean
  majValeur: (cle: 'reponses' | 'remarques', code: string, valeur: Valeur) => void
}) {
  const t = useT()
  const reponses = sr.reponses || {}
  const valeur = reponses[champ.code]
  const maj = (v: Valeur) => majValeur('reponses', champ.code, v)

  if (champ.type === 'question' || champ.type === 'oui_non') {
    return <Segments valeur={texte(valeur)} options={optionsOuiNon(champ, t)} readOnly={readOnly} onChange={maj} />
  }
  if (champ.type === 'choix') {
    return <Puces champ={champ} valeur={valeur} langue={langue} readOnly={readOnly} onChange={maj} />
  }
  if (champ.type === 'duree') {
    const d: { min?: string; sec?: string } = valeur && typeof valeur === 'object' && !Array.isArray(valeur) ? valeur : {}
    const majDuree = (k: 'min' | 'sec', v: string) => {
      const suite = { ...d, [k]: v }
      if (!suite.min) delete suite.min
      if (!suite.sec) delete suite.sec
      maj(Object.keys(suite).length ? suite : '')
    }
    return (
      <div className="flex items-center gap-2 w-full sm:max-w-[240px]">
        <div className="relative flex-1">
          <Saisie valeur={d.min || ''} onSave={v => majDuree('min', v.trim())} readOnly={readOnly} inputMode="numeric" className="pr-10 py-1.5" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{t('gic_min')}</span>
        </div>
        <div className="relative flex-1">
          <Saisie valeur={d.sec || ''} onSave={v => majDuree('sec', v.trim())} readOnly={readOnly} inputMode="numeric" className="pr-8 py-1.5" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{t('gic_sec')}</span>
        </div>
      </div>
    )
  }
  // texte (avec unité éventuelle)
  return (
    <div className="relative w-full">
      <Saisie valeur={texte(valeur)} onSave={v => maj(v.trim())} readOnly={readOnly}
        inputMode={champ.unite ? 'decimal' : 'text'} className={`py-1.5 ${champ.unite ? 'pr-16' : ''}`} />
      {champ.unite && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{champ.unite}</span>}
    </div>
  )
}

/** Libellé + champ de valeur (texte, durée, choix simple). */
function ChampValeur({ champ, valeur, langue, readOnly, onChange }: {
  champ: ChampFiche; valeur: Valeur | undefined; langue: 'fr' | 'en'; readOnly: boolean; onChange: (v: Valeur) => void
}) {
  const t = useT()
  const etiquette = (
    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">{champ[langue]}</label>
  )
  if (champ.type === 'duree') {
    const d: { min?: string; sec?: string } = valeur && typeof valeur === 'object' && !Array.isArray(valeur) ? valeur : {}
    const maj = (k: 'min' | 'sec', v: string) => {
      const suite = { ...d, [k]: v }
      if (!suite.min) delete suite.min
      if (!suite.sec) delete suite.sec
      onChange(Object.keys(suite).length ? suite : '')
    }
    return (
      <div>
        {etiquette}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Saisie valeur={d.min || ''} onSave={v => maj('min', v.trim())} readOnly={readOnly} inputMode="numeric" className="pr-12" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{t('gic_min')}</span>
          </div>
          <div className="relative flex-1">
            <Saisie valeur={d.sec || ''} onSave={v => maj('sec', v.trim())} readOnly={readOnly} inputMode="numeric" className="pr-10" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{t('gic_sec')}</span>
          </div>
        </div>
      </div>
    )
  }
  if (champ.type === 'choix') {
    return (
      <div>
        {etiquette}
        <Puces champ={champ} valeur={valeur} langue={langue} readOnly={readOnly} onChange={onChange} />
      </div>
    )
  }
  return (
    <div>
      {etiquette}
      <div className="relative">
        <Saisie valeur={texte(valeur)} onSave={v => onChange(v.trim())} readOnly={readOnly}
          inputMode={champ.unite ? 'decimal' : 'text'} className={champ.unite ? 'pr-16' : ''} />
        {champ.unite && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{champ.unite}</span>}
      </div>
    </div>
  )
}

/** Options en puces (choix simple ou multiple). */
function Puces({ champ, valeur, langue, readOnly, onChange }: {
  champ: ChampFiche; valeur: Valeur | undefined; langue: 'fr' | 'en'; readOnly: boolean; onChange: (v: Valeur) => void
}) {
  const choisies: string[] = Array.isArray(valeur) ? valeur : (texte(valeur) ? [texte(valeur)] : [])
  const basculer = (v: string) => {
    if (champ.multiple) onChange(choisies.includes(v) ? choisies.filter(x => x !== v) : [...choisies, v])
    else onChange(choisies.includes(v) ? '' : v)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {(champ.options || []).map(o => {
        const actif = choisies.includes(o.v)
        return (
          <button key={o.v} type="button" disabled={readOnly} onClick={() => basculer(o.v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-colors disabled:cursor-not-allowed"
            style={actif ? { background: NAVY, borderColor: NAVY, color: '#fff' } : { borderColor: NAVY, color: NAVY, background: '#fff' }}>
            {actif && <i className="ti ti-check text-[11px]" />}
            {o[langue]}
          </button>
        )
      })}
    </div>
  )
}

/** Champ sur toute la largeur : question, Oui/Non, choix multiple, liste, notes. */
function LigneChamp({ champ, sr, langue, readOnly, majValeur }: {
  champ: ChampFiche; sr: SousRapport; langue: 'fr' | 'en'; readOnly: boolean
  majValeur: (cle: 'reponses' | 'remarques', code: string, valeur: Valeur) => void
}) {
  const t = useT()
  const reponses = sr.reponses || {}
  const valeur = reponses[champ.code]

  if (champ.type === 'question' || champ.type === 'oui_non') {
    const estQuestion = champ.type === 'question'
    const options = optionsOuiNon(champ, t)
    return (
      <div className="rounded-lg border border-gray-100 px-3 py-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <p className={`flex-1 text-sm ${estQuestion ? 'font-semibold' : 'font-bold'}`} style={{ color: NAVY }}>{champ[langue]}</p>
          <Segments valeur={texte(valeur)} options={options} readOnly={readOnly} onChange={v => majValeur('reponses', champ.code, v)} />
        </div>
        {champ.complement && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-semibold text-gray-500">{champ.complement[langue]}</span>
            <div className="relative w-36">
              <Saisie valeur={texte(reponses[champ.complement.code])} readOnly={readOnly} inputMode="decimal" className="pr-14 py-1.5"
                onSave={v => majValeur('reponses', champ.complement!.code, v.trim())} />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">{champ.complement.unite}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (champ.type === 'choix') {
    return (
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{champ[langue]}</label>
        <Puces champ={champ} valeur={valeur} langue={langue} readOnly={readOnly} onChange={v => majValeur('reponses', champ.code, v)} />
      </div>
    )
  }

  if (champ.type === 'liste') {
    const lignes: string[] = Array.isArray(valeur) ? valeur : []
    const enregistrer = (suite: string[]) => majValeur('reponses', champ.code, suite)
    return (
      <div className="flex flex-col gap-2">
        {lignes.length === 0 && <p className="text-xs text-gray-400">{t('gic_aucun_emplacement')}</p>}
        {lignes.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-black flex-shrink-0" style={{ color: NAVY }}>{i + 1}</span>
            <Saisie valeur={l} readOnly={readOnly} placeholder={champ[langue]}
              onSave={v => enregistrer(lignes.map((x, j) => (j === i ? v.trim() : x)))} />
            {!readOnly && (
              <button type="button" onClick={() => enregistrer(lignes.filter((_, j) => j !== i))} title={t('supprimer')}
                className="w-9 h-9 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0">
                <i className="ti ti-x" />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button type="button" onClick={() => enregistrer([...lignes, ''])}
            className="self-start inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md border border-dashed border-gray-300 hover:border-[#0a0b0d]"
            style={{ color: NAVY }}>
            <i className="ti ti-plus" /> {t('gic_ajouter_emplacement')}
          </button>
        )}
      </div>
    )
  }

  // texte_long
  return (
    <Saisie multiline valeur={texte(valeur)} readOnly={readOnly} placeholder={t('gic_notes_placeholder')}
      onSave={v => majValeur('reponses', champ.code, v.trim())} />
  )
}
