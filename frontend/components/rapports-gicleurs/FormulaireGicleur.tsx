'use client'

import { createContext, Fragment, useContext, useEffect, useState } from 'react'
import { useLangue, useT } from '@/lib/i18n'
import { resilientMutate } from '@/lib/offline/resilientFetch'

// Formulaire d'inspection gicleur — mise en page reprise section par section
// du rapport gicleur de Préventex (components/rapports-gicleurs/*.tsx) :
// accordéon, tableaux à en-tête bleu, Oui / S/O / Non en bloc segmenté,
// cases à cocher pour l'alimentation (3) et les avertisseurs (8),
// Départ/Arrêt du compresseur (11d), points bas insérés au point i) (11).

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0a0b0d'
const ORANGE = '#e11324'
// Même fond d'en-tête de tableau que les autres rapports (ex. TableExtincteurs).
const FOND_ENTETE = `linear-gradient(135deg, ${NAVY}, #232733)`

// Même découpage que SECTIONS dans securiteincendie/inspections/gicleur_checklist.py.
export const SECTIONS_GICLEUR: { code: string; fr: string; en: string }[] = [
  { code: '1', fr: "Identification de l'équipement", en: 'Equipment identification' },
  { code: '2', fr: 'Soupapes de commande', en: 'Control valves' },
  { code: '3', fr: 'Alimentation en eau (essais hydrauliques)', en: 'Water supply (hydraulic tests)' },
  { code: '4', fr: 'Général', en: 'General' },
  { code: '5', fr: 'Raccords-pompiers', en: 'Fire department connections' },
  { code: '6', fr: 'Gicleurs', en: 'Sprinklers' },
  { code: '7', fr: 'Chute à déchets', en: 'Waste chute' },
  { code: '8', fr: 'Avertisseurs', en: 'Alarms' },
  { code: '9', fr: 'Tuyauterie, manomètres, pompes de surpression', en: 'Piping, gauges, jockey pumps' },
  { code: '10', fr: 'Installation spéciale', en: 'Special installation' },
  { code: '11', fr: 'Installation sous air', en: 'Dry-pipe installation' },
]

const CATEGORIES_SOUPAPE: Record<string, { fr: string; en: string }> = {
  ville: { fr: 'Soupapes de commande de la ville', en: 'City control valves' },
  alimentation: { fr: "Soupapes de commande d'alimentation", en: 'Supply control valves' },
  pompe: { fr: 'Soupapes de commande de pompe', en: 'Pump control valves' },
  secteur: { fr: 'Soupapes de commande de secteur', en: 'Sectional control valves' },
  principale: { fr: 'Soupapes de commande principales', en: 'Main control valves' },
}

// Champ texte affiché à côté du choix Oui / S/O / Non (valeur dans valeur_texte).
const CHAMP_TEXTE_COMPLEMENTAIRE: Record<string, { fr: string; en: string }> = {
  '6m': { fr: 'Si non, combien y en a-t-il ?', en: 'If not, how many are there?' },
  '11j': { fr: 'DATE', en: 'DATE' },
  '11k': { fr: 'DATE', en: 'DATE' },
}

// Items affichés comme simples cases à cocher (reponse = 'oui' ou vide) —
// jamais comptés dans l'avancement ni comme non-conformité.
export const CODES_CASES_A_COCHER = ['3b', '3c', '3d', '8c1', '8c2', '8d']
// Items rendus ailleurs que dans la liste générique de leur section.
const CODES_HORS_LISTE = ['11d1', '11d2']

export const TYPES_SYSTEME: { value: string; fr: string; en: string }[] = [
  { value: 'eau', fr: 'Sous eau (wet-pipe)', en: 'Wet-pipe' },
  { value: 'air', fr: 'Sous air (dry-pipe)', en: 'Dry-pipe' },
  { value: 'deluge', fr: 'Déluge', en: 'Deluge' },
  { value: 'preaction', fr: 'Préaction', en: 'Pre-action' },
  { value: 'combine', fr: 'Combiné', en: 'Combined' },
]

const FREQUENCES: { value: string; fr: string; en: string }[] = [
  { value: 'annuelle', fr: 'Annuelle', en: 'Annual' },
  { value: 'semestrielle', fr: 'Semestrielle', en: 'Semi-annual' },
  { value: 'trimestrielle', fr: 'Trimestrielle', en: 'Quarterly' },
  { value: 'mensuelle', fr: 'Mensuelle', en: 'Monthly' },
]

const CHAMPS_IDENTIFICATION: { champ: string; cle: string }[] = [
  { champ: 'systeme', cle: 'gic_id_systeme' },
  { champ: 'zone_protegee', cle: 'gic_id_zone_protegee' },
  { champ: 'marque', cle: 'gic_id_marque' },
  { champ: 'modele', cle: 'gic_id_modele' },
  { champ: 'annee', cle: 'gic_id_annee' },
  { champ: 'diametre', cle: 'gic_id_diametre' },
  { champ: 'lieu_robinet_essai', cle: 'gic_id_lieu_robinet_essai' },
  { champ: 'pompe_surpression', cle: 'gic_id_pompe_surpression' },
  { champ: 'compresseur_air', cle: 'gic_id_compresseur_air' },
  { champ: 'plaque_signaletique', cle: 'gic_id_plaque_signaletique' },
  { champ: 'identification_complete', cle: 'gic_id_identification_complete' },
]

const CHAMPS_DRAIN: { champ: string; cle: string }[] = [
  { champ: 'localisation_drain', cle: 'gic_localisation_drain_principal' },
  { champ: 'dimension_tuyau', cle: 'gic_dimension_du_tuyau' },
  { champ: 'pression_statique', cle: 'gic_statique' },
  { champ: 'pression_residuelle', cle: 'gic_residuelle' },
  { champ: 'pression_apres', cle: 'gic_apres' },
]

const CLASSE_CHAMP = 'border border-[#0a0b0d] bg-white rounded-md px-2 py-1.5 text-sm font-bold text-[#0a0b0d] focus:outline-none focus:border-[#e11324] disabled:bg-gray-50 disabled:text-gray-500'
const CLASSE_BOUTON_SUPPRIMER = 'w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors'
const CLASSE_ENTETE = 'px-3 py-2 text-left text-xs text-white font-bold whitespace-nowrap'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token')
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

function paires<T>(items: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2))
  return out
}

/** Champ texte qui s'enregistre à la perte du focus, seulement s'il a changé. */
function ChampTexte({
  valeur, onSave, readOnly, placeholder, multiline, className = 'w-full',
}: {
  valeur: string; onSave: (v: string) => void; readOnly: boolean; placeholder?: string; multiline?: boolean; className?: string
}) {
  const [v, setV] = useState(valeur || '')
  useEffect(() => { setV(valeur || '') }, [valeur])
  const commit = () => { if (v !== (valeur || '')) onSave(v) }
  return multiline ? (
    <textarea value={v} onChange={e => setV(e.target.value)} onBlur={commit} disabled={readOnly}
      placeholder={placeholder} rows={3} className={`${CLASSE_CHAMP} ${className}`} />
  ) : (
    <input value={v} onChange={e => setV(e.target.value)} onBlur={commit} disabled={readOnly}
      placeholder={placeholder} className={`${CLASSE_CHAMP} ${className}`} />
  )
}

/** Oui / S/O / Non en bloc segmenté (vert / jaune / rouge) — un second clic sur le choix actif l'efface. */
function ChoixReponse({ valeur, onChange, readOnly }: { valeur: string; onChange: (v: string) => void; readOnly: boolean }) {
  const t = useT()
  const options = [
    { v: 'oui', label: t('oui'), couleur: '#0d6b4f' },
    { v: 'na', label: t('so_abbr'), couleur: '#ca8a04' },
    { v: 'non', label: t('non'), couleur: '#dc2626' },
  ]
  return (
    <div className="flex rounded-md overflow-hidden border border-[#0a0b0d] divide-x divide-[#0a0b0d] flex-shrink-0">
      {options.map(o => (
        <button
          key={o.v}
          type="button"
          disabled={readOnly}
          onClick={() => onChange(valeur === o.v ? '' : o.v)}
          className="px-3 py-1 text-xs font-bold transition-colors disabled:cursor-not-allowed"
          style={{ background: valeur === o.v ? o.couleur : '#fff', color: valeur === o.v ? '#fff' : NAVY }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Deux choix exclusifs en bloc (ex. Départ/Arrêt, Non/Oui). */
function Bascule({ valeur, options, onChange, readOnly, arrondi = 'rounded-full', largeur = 'w-48' }: {
  valeur: string; options: { v: string; l: string; couleur: string }[]; onChange: (v: string) => void; readOnly: boolean; arrondi?: string; largeur?: string
}) {
  return (
    <div className={`flex ${largeur} ${arrondi} overflow-hidden border border-[#0a0b0d] divide-x divide-[#0a0b0d] flex-shrink-0`}>
      {options.map(o => (
        <button
          key={o.v}
          type="button"
          disabled={readOnly}
          onClick={() => onChange(valeur === o.v ? '' : o.v)}
          className="flex-1 px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed"
          style={{ background: valeur === o.v ? o.couleur : '#fff', color: valeur === o.v ? '#fff' : NAVY }}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function Lettre({ l }: { l: string }) {
  return <span className="font-bold mr-1" style={{ color: ORANGE }}>{l})</span>
}

// Accordéon (même comportement que le rapport gicleur de Préventex) : toutes
// les sections sont repliées par défaut, un clic en ouvre une et referme celle
// qui était ouverte.
const AccordeonContext = createContext<{ ouvert: string | null; basculer: (id: string) => void }>({
  ouvert: null, basculer: () => {},
})

function Carte({ id, titre, numero, badge, children }: {
  id: string; titre: string; numero?: string; badge?: React.ReactNode; children: React.ReactNode
}) {
  const { ouvert, basculer } = useContext(AccordeonContext)
  const estOuvert = ouvert === id
  return (
    <section className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => basculer(id)}
        aria-expanded={estOuvert}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 transition-colors"
          style={{ background: estOuvert ? ORANGE : NAVY }}
        >
          {numero ?? <i className="ti ti-file-text text-xs" />}
        </span>
        <span className="flex-1 text-sm font-bold" style={{ color: NAVY }}>{titre}</span>
        {badge}
        <i className="ti ti-chevron-down text-xl text-[#0a0b0d] transition-transform flex-shrink-0"
          style={{ transform: estOuvert ? 'rotate(180deg)' : 'none' }} />
      </button>
      {estOuvert && <div className="border-t border-gray-100 p-4 sm:p-5 flex flex-col gap-4">{children}</div>}
    </section>
  )
}

function BoutonAjouter({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="text-xs font-bold px-3 py-1.5 rounded-md border border-[#0a0b0d] hover:bg-gray-50 flex items-center gap-1 transition-colors disabled:opacity-40"
      style={{ color: NAVY }}>
      <i className="ti ti-plus" /> {label}
    </button>
  )
}

function SousTitre({ children, droite }: { children: React.ReactNode; droite?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <p className="text-xs font-bold" style={{ color: NAVY }}>{children}</p>
      {droite}
    </div>
  )
}

export default function FormulaireGicleur({
  rapport, readOnly, onErreur,
}: { rapport: any; readOnly: boolean; onErreur?: (msg: string) => void }) {
  const t = useT()
  const langue = useLangue()
  const [r, setR] = useState<any>(rapport)
  const [etat, setEtat] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<{ liste: string; endpoint: string; id: number } | null>(null)
  const [nouveaux, setNouveaux] = useState<Record<string, string>>({})
  const basculer = (id: string) => setOuvert(prev => (prev === id ? null : id))

  useEffect(() => { setR(rapport) }, [rapport])

  function signalerErreur() {
    setEtat('idle')
    onErreur?.(t('erreur_sauvegarde'))
  }

  function enregistre() {
    setEtat('saved')
    setTimeout(() => setEtat('idle'), 1500)
  }

  async function patch(url: string, body: any): Promise<boolean> {
    setEtat('saving')
    const res = await resilientMutate('PATCH', `${API_URL}${url}`, body)
    if (!res.ok) { signalerErreur(); return false }
    enregistre()
    return true
  }

  /** Met à jour une ligne d'une liste du rapport (optimiste) puis l'enregistre. */
  function majLigne(liste: string, endpoint: string, id: number, champs: Record<string, any>) {
    setR((prev: any) => ({ ...prev, [liste]: prev[liste].map((l: any) => l.id === id ? { ...l, ...champs } : l) }))
    patch(`/api/${endpoint}/${id}/`, champs)
  }

  const majQuestion = (id: number, champs: Record<string, any>) => majLigne('reponses_checklist', 'gicleur-checklist', id, champs)

  function majRapport(champs: Record<string, any>) {
    setR((prev: any) => ({ ...prev, ...champs }))
    patch(`/api/rapports-gicleurs/${r.id}/`, champs)
  }

  async function ajouterLigne(liste: string, action: string, body: any = {}): Promise<boolean> {
    setEtat('saving')
    const res = await fetch(`${API_URL}/api/rapports-gicleurs/${r.id}/${action}/`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    }).catch(() => null)
    if (!res || !res.ok) { signalerErreur(); return false }
    const ligne = await res.json()
    setR((prev: any) => ({ ...prev, [liste]: [...prev[liste], ligne] }))
    enregistre()
    return true
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return
    const { liste, endpoint, id } = aSupprimer
    setASupprimer(null)
    setR((prev: any) => ({ ...prev, [liste]: prev[liste].filter((l: any) => l.id !== id) }))
    const res = await resilientMutate('DELETE', `${API_URL}/api/${endpoint}/${id}/`)
    if (!res.ok) signalerErreur()
  }

  const boutonSupprimer = (liste: string, endpoint: string, id: number) => !readOnly && (
    <button type="button" onClick={() => setASupprimer({ liste, endpoint, id })} className={CLASSE_BOUTON_SUPPRIMER} title={t('supprimer')}>
      <i className="ti ti-trash text-base" />
    </button>
  )

  async function enregistrerCommentaire(section: string, texte: string) {
    setEtat('saving')
    const res = await fetch(`${API_URL}/api/rapports-gicleurs/${r.id}/commentaires-sections/`, {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify({ section, texte }),
    }).catch(() => null)
    if (!res || !res.ok) { signalerErreur(); return }
    const data = await res.json()
    setR((prev: any) => ({ ...prev, commentaires_sections: data }))
    enregistre()
  }

  const commentaireDe = (section: string) =>
    (r.commentaires_sections || []).find((c: any) => c.section === section)?.texte || ''

  const renderCommentaire = (section: string) => {
    if (readOnly && !commentaireDe(section)) return null
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: NAVY }}>
          <i className="ti ti-message-2" /> {t('commentaire')}
        </span>
        <ChampTexte multiline valeur={commentaireDe(section)} onSave={v => enregistrerCommentaire(section, v)} readOnly={readOnly}
          placeholder={t('gic_commentaire_placeholder')} />
      </div>
    )
  }

  const item = (code: string) => (r.reponses_checklist || []).find((q: any) => q.code_item === code)
  const libelle = (q: any) => (langue === 'en' ? (q.label_en || q.label) : q.label)
  const questions = (section: string) => (r.reponses_checklist || []).filter((q: any) => q.section === section)
  const estQuestionChoix = (q: any) => q.type_reponse === 'choix' && !CODES_CASES_A_COCHER.includes(q.code_item)
  const questionsChoix = (r.reponses_checklist || []).filter(estQuestionChoix)
  const nbRepondues = questionsChoix.filter((q: any) => q.reponse).length

  /** Une ligne de question (même rendu que SectionChecklistBloc de Préventex). */
  const renderLigneQuestion = (q: any, section: string) => {
    const lettre = q.code_item.slice(section.length) || q.code_item
    const complement = CHAMP_TEXTE_COMPLEMENTAIRE[q.code_item]
    const departArret = q.code_item === '11d'
    return (
      <div key={q.id} className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
        style={q.reponse === 'non' ? { background: '#fef2f2' } : undefined}>
        <span className="text-sm font-bold flex-1 min-w-[220px]" style={{ color: NAVY }}>
          <Lettre l={lettre} />{libelle(q)}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {departArret && (
            <>
              <Bascule readOnly={readOnly} valeur={q.valeur_texte}
                options={[{ v: 'marche', l: t('gic_depart'), couleur: '#16a34a' }, { v: 'arret', l: t('gic_arret'), couleur: ORANGE }]}
                onChange={v => majQuestion(q.id, { valeur_texte: v })} />
              {['11d1', '11d2'].map(code => {
                const compagnon = item(code)
                return compagnon && (
                  <ChampTexte key={code} valeur={compagnon.valeur_texte} readOnly={readOnly} className="w-28 text-xs"
                    placeholder={code === '11d1' ? t('gic_heure_depart') : t('gic_heure_arret')}
                    onSave={v => majQuestion(compagnon.id, { valeur_texte: v })} />
                )
              })}
            </>
          )}
          {q.type_reponse === 'choix' && (
            <ChoixReponse valeur={q.reponse} readOnly={readOnly} onChange={v => majQuestion(q.id, { reponse: v })} />
          )}
          {!departArret && (q.type_reponse === 'texte' || complement) && (
            <ChampTexte valeur={q.valeur_texte} readOnly={readOnly} className="w-44 text-xs"
              placeholder={complement ? complement[langue] : t('gic_detail')}
              onSave={v => majQuestion(q.id, { valeur_texte: v })} />
          )}
        </div>
      </div>
    )
  }

  const renderQuestions = (section: string, filtre: (q: any) => boolean = () => true) => {
    const liste = questions(section).filter((q: any) =>
      !CODES_CASES_A_COCHER.includes(q.code_item) && !CODES_HORS_LISTE.includes(q.code_item) && filtre(q))
    if (!liste.length) return null
    return (
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
        {liste.map((q: any) => renderLigneQuestion(q, section))}
      </div>
    )
  }

  /** Case à cocher simple (reponse = 'oui' ou vide). */
  const renderCase = (code: string, label?: string) => {
    const q = item(code)
    if (!q) return null
    return (
      <label key={code} className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: NAVY }}>
        <input type="checkbox" checked={q.reponse === 'oui'} disabled={readOnly}
          onChange={e => majQuestion(q.id, { reponse: e.target.checked ? 'oui' : '' })}
          className="w-4 h-4 accent-[#e11324]" />
        {label ?? libelle(q)}
      </label>
    )
  }

  const titreSection = (code: string) => SECTIONS_GICLEUR.find(s => s.code === code)?.[langue] || code

  /** Pastilles affichées sur la section repliée : avancement, « Non », commentaire. */
  const badgeSection = (code: string) => {
    const choix = questions(code).filter(estQuestionChoix).filter((q: any) => q.code_item !== '8e')
    const repondues = choix.filter((q: any) => q.reponse).length
    const non = choix.filter((q: any) => q.reponse === 'non').length
      + (code === '2' ? (r.soupapes_commande || []).filter((x: any) => [x.ouvertes, x.protegees, x.identifiees].includes('non')).length : 0)
    const commentaire = commentaireDe(code).trim()
    return (
      <span className="flex items-center gap-1.5 flex-shrink-0">
        {commentaire && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800" title={commentaire}>
            <i className="ti ti-message-2" /> {t('commentaire')}
          </span>
        )}
        {non > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">{non} {t('non')}</span>
        )}
        {choix.length > 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={repondues === choix.length ? { background: '#dcfce7', color: '#166534' } : { background: '#f1f5f9', color: '#64748b' }}>
            {repondues}/{choix.length}
          </span>
        )}
      </span>
    )
  }

  /** Liste libre (14, 15, 16) — même rendu que ListeTexteLibre de Préventex. */
  const renderListeLibre = (liste: string, action: string, endpoint: string, numero: string, titre: string) => {
    const nouveau = nouveaux[liste] || ''
    const ajouter = async () => {
      if (!nouveau.trim()) return
      if (await ajouterLigne(liste, action, { texte: nouveau.trim() })) setNouveaux(prev => ({ ...prev, [liste]: '' }))
    }
    return (
      <Carte id={liste} numero={numero} titre={titre}>
        {(r[liste] || []).length === 0 && <p className="text-xs text-gray-400 italic">{t('gic_aucun_element')}</p>}
        {(r[liste] || []).length > 0 && (
          <ul className="flex flex-col gap-2">
            {(r[liste] || []).map((l: any) => (
              <li key={l.id} className="flex items-center gap-2 text-sm font-bold bg-gray-50 rounded-md px-3 py-2" style={{ color: NAVY }}>
                <i className="ti ti-point-filled text-[8px] flex-shrink-0" style={{ color: ORANGE }} />
                <span className="flex-1">{l.texte}</span>
                {boutonSupprimer(liste, endpoint, l.id)}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <div className="flex gap-2">
            <input
              type="text"
              value={nouveau}
              onChange={e => setNouveaux(prev => ({ ...prev, [liste]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouter() } }}
              placeholder={t('gic_ajouter_element')}
              className={`flex-1 ${CLASSE_CHAMP}`}
            />
            <button type="button" onClick={ajouter} disabled={!nouveau.trim()}
              className="text-xs font-bold text-white px-4 py-1.5 rounded-md disabled:opacity-40" style={{ background: ORANGE }}>
              {t('gic_ajouter')}
            </button>
          </div>
        )}
      </Carte>
    )
  }

  const essais = r.essais_ecoulement || []
  const section11 = questions('11')

  return (
    <div className="flex flex-col gap-5">
      {/* Barre d'état : progression + enregistrement */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur rounded-md border border-gray-100 px-4 py-2.5 flex items-center gap-4 flex-wrap text-xs">
        <span className="font-bold" style={{ color: NAVY }}>
          {nbRepondues} / {questionsChoix.length} {t('gic_questions_repondues')}
        </span>
        <div className="flex-1 min-w-[80px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${questionsChoix.length ? (nbRepondues / questionsChoix.length) * 100 : 0}%`, background: ORANGE }} />
        </div>
        <span className="text-gray-400 w-24 text-right">
          {etat === 'saving' ? t('enregistrement_en_cours') : etat === 'saved' ? `✓ ${t('enregistre')}` : ''}
        </span>
      </div>

      {/* Fréquence des inspections — barre de boutons au-dessus des sections, comme dans Préventex */}
      <div className="bg-white border border-gray-100 rounded-md px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>{t('gic_frequence')}</span>
        <div className="flex items-center gap-2 flex-wrap">
          {FREQUENCES.map(f => (
            <button
              key={f.value}
              type="button"
              disabled={readOnly}
              onClick={() => majRapport({ frequence_inspection: r.frequence_inspection === f.value ? '' : f.value })}
              className="text-xs font-bold px-3 py-1.5 rounded-md border transition-colors disabled:cursor-not-allowed"
              style={
                r.frequence_inspection === f.value
                  ? { background: ORANGE, borderColor: ORANGE, color: '#fff' }
                  : { background: '#fff', borderColor: NAVY, color: NAVY }
              }
            >
              {f[langue]}
            </button>
          ))}
        </div>
      </div>

      <AccordeonContext.Provider value={{ ouvert, basculer }}>
      <div className="flex flex-col gap-3">
      {/* Informations générales */}
      <Carte id="infos" titre={t('informations_systeme_cuisine')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            ['gic_local_gicleur', 'local_gicleur'],
          ] as const).map(([cle, champ]) => (
            <div key={champ}>
              <label className="text-[11px] font-bold uppercase tracking-widest mb-1 block" style={{ color: NAVY }}>{t(cle)}</label>
              <ChampTexte valeur={r[champ]} readOnly={readOnly} onSave={v => majRapport({ [champ]: v })} />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest mb-1 block" style={{ color: NAVY }}>{t('gic_type_systeme')}</label>
            <select value={r.type_systeme || ''} disabled={readOnly} onChange={e => majRapport({ type_systeme: e.target.value })}
              className={`w-full ${CLASSE_CHAMP}`}>
              <option value="">—</option>
              {TYPES_SYSTEME.map(o => <option key={o.value} value={o.value}>{o[langue]}</option>)}
            </select>
          </div>
          {([
            ['gic_identification_systeme', 'identification_systeme'],
            ['gic_compagnie_installatrice', 'compagnie_installatrice'],
          ] as const).map(([cle, champ]) => (
            <div key={champ}>
              <label className="text-[11px] font-bold uppercase tracking-widest mb-1 block" style={{ color: NAVY }}>{t(cle)}</label>
              <ChampTexte valeur={r[champ]} readOnly={readOnly} onSave={v => majRapport({ [champ]: v })} />
            </div>
          ))}
        </div>
      </Carte>

      {/* 1. Identification — tableau, une ligne par système */}
      <Carte id="1" numero="1" titre={titreSection('1')} badge={badgeSection('1')}>
        {!readOnly && (
          <div className="flex justify-end">
            <BoutonAjouter label={t('gic_ajouter_ligne')} onClick={() => ajouterLigne('identifications_systemes', 'identifications-systemes')} />
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: FOND_ENTETE }}>
                <th className={CLASSE_ENTETE}>{t('gic_numero_court')}</th>
                {CHAMPS_IDENTIFICATION.map(c => <th key={c.champ} className={CLASSE_ENTETE}>{t(c.cle)}</th>)}
                {!readOnly && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {(r.identifications_systemes || []).map((ident: any) => (
                <tr key={ident.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-bold" style={{ color: NAVY }}>{ident.numero}</td>
                  {CHAMPS_IDENTIFICATION.map(c => (
                    <td key={c.champ} className="px-2 py-2">
                      <ChampTexte valeur={ident[c.champ]} readOnly={readOnly} className="w-32 text-xs"
                        onSave={v => majLigne('identifications_systemes', 'gicleur-identifications', ident.id, { [c.champ]: v })} />
                    </td>
                  ))}
                  {!readOnly && <td className="px-2 py-2">{boutonSupprimer('identifications_systemes', 'gicleur-identifications', ident.id)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {renderCommentaire('1')}
      </Carte>

      {/* 2. Soupapes de commande */}
      <Carte id="2" numero="2" titre={titreSection('2')} badge={badgeSection('2')}>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: FOND_ENTETE }}>
                <th className={CLASSE_ENTETE}>{t('gic_categorie')}</th>
                <th className={CLASSE_ENTETE}>{t('gic_nombre')}</th>
                <th className={CLASSE_ENTETE}>{t('gic_type')}</th>
                <th className={CLASSE_ENTETE}>{t('gic_ouvertes')}</th>
                <th className={CLASSE_ENTETE}>{t('gic_protegees')}</th>
                <th className={CLASSE_ENTETE}>{t('gic_identifiees')}</th>
                <th className={CLASSE_ENTETE}>{t('gic_condition')}</th>
                <th className={CLASSE_ENTETE}>{t('gic_localisation')}</th>
              </tr>
            </thead>
            <tbody>
              {(r.soupapes_commande || []).map((s: any) => {
                const maj = (champs: any) => majLigne('soupapes_commande', 'gicleur-soupapes', s.id, champs)
                return (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: NAVY }}>{CATEGORIES_SOUPAPE[s.categorie]?.[langue] || s.categorie}</td>
                    <td className="px-2 py-2"><ChampTexte valeur={s.nombre} readOnly={readOnly} className="w-24 text-xs" onSave={v => maj({ nombre: v })} /></td>
                    <td className="px-2 py-2"><ChampTexte valeur={s.type_texte} readOnly={readOnly} className="w-28 text-xs" onSave={v => maj({ type_texte: v })} /></td>
                    {(['ouvertes', 'protegees', 'identifiees'] as const).map(champ => (
                      <td key={champ} className="px-2 py-2">
                        <select value={s[champ] || ''} disabled={readOnly} onChange={e => maj({ [champ]: e.target.value })}
                          className={`${CLASSE_CHAMP} text-xs`}
                          style={s[champ] === 'non' ? { color: '#dc2626' } : undefined}>
                          <option value="">—</option>
                          <option value="oui">{t('oui')}</option>
                          <option value="non">{t('non')}</option>
                        </select>
                      </td>
                    ))}
                    <td className="px-2 py-2"><ChampTexte valeur={s.condition} readOnly={readOnly} className="w-28 text-xs" onSave={v => maj({ condition: v })} /></td>
                    <td className="px-2 py-2"><ChampTexte valeur={s.localisation} readOnly={readOnly} className="w-28 text-xs" onSave={v => maj({ localisation: v })} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {renderQuestions('2')}
        {renderCommentaire('2')}
      </Carte>

      {/* 3. Alimentation en eau — même mise en page que TableEssaisEcoulement de Préventex */}
      <Carte id="3" numero="3" titre={titreSection('3')} badge={badgeSection('3')}>
        {renderQuestions('3')}

        {/* Alimentation — cases à cocher simples, sur une seule ligne */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-gray-200 rounded-lg px-3 py-2.5">
          {['3b', '3c', '3d'].map(code => renderCase(code))}
        </div>

        {/* Pression du système — pairée comme sur le formulaire (1 & 2, 3 & 4…) */}
        <div>
          <SousTitre>{t('gic_pression_du_systeme')}</SousTitre>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <tbody>
                {paires(essais).map((paire: any[], i) => (
                  <tr key={i} className="border-t border-gray-100 first:border-t-0">
                    {paire.map((e: any) => (
                      <Fragment key={e.id}>
                        <td className="px-3 py-1.5 font-bold whitespace-nowrap" style={{ color: NAVY }}>{t('gic_pression_du_systeme')} {e.ordre})</td>
                        <td className="px-2 py-1.5">
                          <ChampTexte valeur={e.pression_systeme} readOnly={readOnly} className="w-24 text-xs"
                            onSave={v => majLigne('essais_ecoulement', 'gicleur-essais', e.id, { pression_systeme: v })} />
                        </td>
                        <td className="px-2 py-1.5 font-bold" style={{ color: NAVY }}>lbs</td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pompe de surpression — Départ/Arrêt + heure, même pairage */}
        <div>
          <SousTitre>{t('gic_pompe_surpression')}</SousTitre>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <tbody>
                {paires(essais).map((paire: any[], i) => (
                  <tr key={i} className="border-t border-gray-100 first:border-t-0">
                    {paire.map((e: any) => (
                      <Fragment key={e.id}>
                        <td className="px-3 py-1.5 font-bold whitespace-nowrap" style={{ color: NAVY }}>{e.ordre})</td>
                        <td className="px-2 py-1.5">
                          <Bascule readOnly={readOnly} valeur={e.etat_marche_arret} largeur="w-40"
                            options={[{ v: 'marche', l: t('gic_depart'), couleur: '#16a34a' }, { v: 'arret', l: t('gic_arret'), couleur: ORANGE }]}
                            onChange={v => majLigne('essais_ecoulement', 'gicleur-essais', e.id, { etat_marche_arret: v })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <ChampTexte valeur={e.heure_marche_arret} readOnly={readOnly} className="w-24 text-xs" placeholder={t('gic_heure')}
                            onSave={v => majLigne('essais_ecoulement', 'gicleur-essais', e.id, { heure_marche_arret: v })} />
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drain principal */}
        <div>
          <SousTitre>{t('gic_drain_principal')}</SousTitre>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: FOND_ENTETE }}>
                  <th rowSpan={2} className={`${CLASSE_ENTETE} align-bottom border-r border-white/20`}>#</th>
                  <th rowSpan={2} className={`${CLASSE_ENTETE} align-bottom border-r border-white/20`}>{t('gic_localisation_drain_principal')}</th>
                  <th rowSpan={2} className={`${CLASSE_ENTETE} align-bottom border-r border-white/20`}>{t('gic_dimension_du_tuyau')}</th>
                  <th colSpan={3} className="px-3 py-1 text-center text-xs text-white font-bold border-b border-white/20">{t('gic_pression')}</th>
                  {!readOnly && <th rowSpan={2} className="px-2 py-2" />}
                </tr>
                <tr style={{ background: FOND_ENTETE }}>
                  <th className={CLASSE_ENTETE}>{t('gic_statique')}</th>
                  <th className={CLASSE_ENTETE}>{t('gic_residuelle')}</th>
                  <th className={CLASSE_ENTETE}>{t('gic_apres')}</th>
                </tr>
              </thead>
              <tbody>
                {essais.map((e: any) => (
                  <tr key={e.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-bold" style={{ color: NAVY }}>{e.ordre}</td>
                    {CHAMPS_DRAIN.map(c => (
                      <td key={c.champ} className="px-2 py-2">
                        <ChampTexte valeur={e[c.champ]} readOnly={readOnly} className="w-28 text-xs"
                          onSave={v => majLigne('essais_ecoulement', 'gicleur-essais', e.id, { [c.champ]: v })} />
                      </td>
                    ))}
                    {!readOnly && <td className="px-2 py-2">{boutonSupprimer('essais_ecoulement', 'gicleur-essais', e.id)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!readOnly && (
          <div><BoutonAjouter label={t('gic_ajouter_point_essai')} onClick={() => ajouterLigne('essais_ecoulement', 'essais-ecoulement')} /></div>
        )}
        {renderCommentaire('3')}
      </Carte>

      {/* 4 à 7 — questions seulement */}
      {['4', '5', '6', '7'].map(code => (
        <Carte key={code} id={code} numero={code} titre={titreSection(code)} badge={badgeSection(code)}>
          {renderQuestions(code)}
          {renderCommentaire(code)}
        </Carte>
      ))}

      {/* 8. Avertisseurs — même mise en page que SectionAvertisseurs de Préventex */}
      <Carte id="8" numero="8" titre={titreSection('8')} badge={badgeSection('8')}>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {['8a', '8b'].map(code => item(code) && renderLigneQuestion(item(code), '8'))}

          {item('8c') && (
            <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
              style={item('8c').reponse === 'non' ? { background: '#fef2f2' } : undefined}>
              <span className="text-sm font-bold" style={{ color: NAVY }}><Lettre l="c" />{libelle(item('8c'))}</span>
              <div className="flex items-center gap-4 flex-wrap">
                {renderCase('8c1')}
                {renderCase('8c2')}
                <ChoixReponse valeur={item('8c').reponse} readOnly={readOnly} onChange={v => majQuestion(item('8c').id, { reponse: v })} />
              </div>
            </div>
          )}

          <div className="px-4 py-2.5 flex items-center gap-6 flex-wrap">
            <span className="text-sm font-bold" style={{ color: NAVY }}><Lettre l="d" />{t('gic_8d_question')}</span>
            {renderCase('8d', t('gic_entree_principale'))}
            {item('8d2') && (
              <span className="text-sm font-bold flex items-center gap-2" style={{ color: NAVY }}>
                {libelle(item('8d2'))}
                <ChampTexte valeur={item('8d2').valeur_texte} readOnly={readOnly} className="w-40 text-xs"
                  onSave={v => majQuestion(item('8d2').id, { valeur_texte: v })} />
              </span>
            )}
          </div>

          {item('8e') && (
            <div className="px-4 py-2.5 flex items-center gap-6 flex-wrap">
              <span className="text-sm font-bold" style={{ color: NAVY }}><Lettre l="e" />{libelle(item('8e'))}</span>
              <Bascule readOnly={readOnly} valeur={item('8e').reponse} arrondi="rounded-md" largeur="w-32"
                options={[{ v: 'non', l: t('non'), couleur: NAVY }, { v: 'oui', l: t('oui'), couleur: NAVY }]}
                onChange={v => majQuestion(item('8e').id, { reponse: v })} />
              {item('8e1') && (
                <span className="text-sm font-bold flex items-center gap-2" style={{ color: NAVY }}>
                  {libelle(item('8e1'))}
                  <ChampTexte valeur={item('8e1').valeur_texte} readOnly={readOnly} className="w-44 text-xs"
                    onSave={v => majQuestion(item('8e1').id, { valeur_texte: v })} />
                </span>
              )}
            </div>
          )}

          <div className="px-4 py-2.5 flex items-center gap-6 flex-wrap">
            {item('8f') && (
              <span className="text-sm font-bold flex items-center gap-2" style={{ color: NAVY }}>
                <Lettre l="f" />{libelle(item('8f'))}
                <ChampTexte valeur={item('8f').valeur_texte} readOnly={readOnly} className="w-40 text-xs"
                  onSave={v => majQuestion(item('8f').id, { valeur_texte: v })} />
              </span>
            )}
            {item('8f2') && (
              <span className="text-sm font-bold flex items-center gap-2" style={{ color: NAVY }}>
                {libelle(item('8f2'))}
                <ChampTexte valeur={item('8f2').valeur_texte} readOnly={readOnly} className="w-40 text-xs"
                  onSave={v => majQuestion(item('8f2').id, { valeur_texte: v })} />
              </span>
            )}
          </div>

          {item('8g') && renderLigneQuestion(item('8g'), '8')}
        </div>
        {renderCommentaire('8')}
      </Carte>

      {/* 9 — questions seulement */}
      <Carte id="9" numero="9" titre={titreSection('9')} badge={badgeSection('9')}>
        {renderQuestions('9')}
        {renderCommentaire('9')}
      </Carte>

      {/* 10. Installation spéciale */}
      <Carte id="10" numero="10" titre={titreSection('10')} badge={badgeSection('10')}>
        {renderQuestions('10')}
        <div className="text-sm font-bold flex flex-col gap-1 px-1" style={{ color: NAVY }}>
          <p>{t('gic_10_degre')}</p>
          <p>{t('gic_10_localisation')}</p>
        </div>
        <div>
          <SousTitre droite={!readOnly && <BoutonAjouter label={t('gic_ajouter_ligne')} onClick={() => ajouterLigne('installations_speciales', 'installations-speciales')} />}>
            {t('gic_detail_antigel')}
          </SousTitre>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: FOND_ENTETE }}>
                  <th className={CLASSE_ENTETE}>#</th>
                  <th className={CLASSE_ENTETE}>{t('gic_degre_temperature')}</th>
                  <th className={CLASSE_ENTETE}>{t('gic_localisation')}</th>
                  {!readOnly && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {(r.installations_speciales || []).map((i: any) => (
                  <tr key={i.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-bold" style={{ color: NAVY }}>{i.ordre}</td>
                    <td className="px-2 py-2">
                      <ChampTexte valeur={i.degre_temperature} readOnly={readOnly} className="w-44 text-xs"
                        onSave={v => majLigne('installations_speciales', 'gicleur-installations', i.id, { degre_temperature: v })} />
                    </td>
                    <td className="px-2 py-2">
                      <ChampTexte valeur={i.localisation} readOnly={readOnly} className="w-44 text-xs"
                        onSave={v => majLigne('installations_speciales', 'gicleur-installations', i.id, { localisation: v })} />
                    </td>
                    {!readOnly && <td className="px-2 py-2">{boutonSupprimer('installations_speciales', 'gicleur-installations', i.id)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {renderCommentaire('10')}
      </Carte>

      {/* 11. Installation sous air — a) à h), puis i) points bas, puis j) à o) */}
      <Carte id="11" numero="11" titre={titreSection('11')} badge={badgeSection('11')}>
        {renderQuestions('11', (q: any) => q.code_item <= '11h')}
        <div>
          <SousTitre droite={!readOnly && <BoutonAjouter label={t('gic_ajouter_ligne')} onClick={() => ajouterLigne('points_bas', 'points-bas')} />}>
            <Lettre l="i" />{t('gic_points_bas')}
          </SousTitre>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {(r.points_bas || []).map((p: any) => (
              <div key={p.id} className="px-3 py-2 flex items-center gap-2">
                <span className="text-xs font-bold w-6 flex-shrink-0" style={{ color: NAVY }}>{p.position}</span>
                <ChampTexte valeur={p.description} readOnly={readOnly} className="flex-1 min-w-[140px] text-xs" placeholder={t('gic_localisation')}
                  onSave={v => majLigne('points_bas', 'gicleur-points-bas', p.id, { description: v })} />
                {boutonSupprimer('points_bas', 'gicleur-points-bas', p.id)}
              </div>
            ))}
          </div>
        </div>
        {section11.some((q: any) => q.code_item > '11h') && renderQuestions('11', (q: any) => q.code_item > '11h')}
        {renderCommentaire('11')}
      </Carte>

      <Carte id="modifications" numero="12" titre={t('gic_modifications_recentes')}>
        <ChampTexte multiline valeur={r.recommandations} readOnly={readOnly} onSave={v => majRapport({ recommandations: v })} />
      </Carte>

      <Carte id="ajustements" numero="13" titre={t('gic_ajustements')}>
        <ChampTexte multiline valeur={r.ajustements_effectues} readOnly={readOnly} onSave={v => majRapport({ ajustements_effectues: v })} />
      </Carte>

      {renderListeLibre('reponses_negatives', 'reponses-negatives', 'gicleur-reponses-negatives', '14', t('gic_reponses_negatives'))}

      {renderListeLibre('ameliorations', 'ameliorations', 'gicleur-ameliorations', '15', t('gic_ameliorations'))}

      {renderListeLibre('valves_etage_supervise', 'valves-etage-supervise', 'gicleur-valves-etage', '16', t('gic_valves_etage'))}
      </div>
      </AccordeonContext.Provider>

      {aSupprimer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setASupprimer(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-trash text-red-500 text-xl" />
            </div>
            <p className="text-sm font-bold mb-5" style={{ color: NAVY }}>{t('gic_confirmer_suppression_ligne')}</p>
            <div className="flex gap-2">
              <button onClick={() => setASupprimer(null)} className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200" style={{ color: NAVY }}>{t('annuler')}</button>
              <button onClick={confirmerSuppression} className="flex-1 py-2.5 rounded-md text-sm font-bold text-white bg-red-500">{t('supprimer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
