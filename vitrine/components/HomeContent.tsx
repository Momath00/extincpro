"use client";

import Image from "next/image";
import { Container, Kicker, PrimaryButton, SecondaryButton, SectionHeading } from "@/components/ui";
import { ProductPreview } from "@/components/ProductPreview";
import { Partners } from "@/components/Partners";
import { site } from "@/lib/site";
import { useLangue, useT } from "@/lib/i18n";

const systems = [
  {
    title: { fr: "Inspection incendie", en: "Fire inspection" },
    desc: {
      fr: "Inspection générale de sécurité incendie de vos bâtiments, en un seul système.",
      en: "General fire safety inspection of your buildings, in a single system.",
    },
  },
  {
    title: { fr: "Inspection extincteur", en: "Fire extinguisher inspection" },
    desc: {
      fr: "Inspection, entretien et conformité de chaque extincteur, bâtiment par bâtiment.",
      en: "Inspection, maintenance, and compliance for every extinguisher, building by building.",
    },
  },
  {
    title: { fr: "Éclairage d'urgence", en: "Emergency lighting" },
    desc: {
      fr: "Vérification périodique des blocs d'éclairage d'urgence et de leur autonomie.",
      en: "Periodic verification of emergency lighting units and their battery life.",
    },
  },
  {
    title: { fr: "Système de cuisine", en: "Kitchen suppression system" },
    desc: {
      fr: "Vérification du système d'extinction de cuisine — schéma d'installation, hottes et appareils protégés.",
      en: "Kitchen fire suppression system verification — installation diagram, hoods, and protected appliances.",
    },
  },
];

const calendrierPoints = [
  {
    title: { fr: "Préavis adapté à la taille du bâtiment", en: "Advance notice matched to building size" },
    desc: {
      fr: "Un courriel automatique part au client ET au superviseur avant la date de prochaine inspection — 30, 45 ou 60 jours d'avance selon la taille du bâtiment, pour laisser le temps de coordonner une grosse visite.",
      en: "An automatic email goes out to both the client and the supervisor before the next inspection date — 30, 45, or 60 days ahead depending on the building's size, leaving enough time to coordinate a larger visit.",
    },
  },
  {
    title: { fr: "Retards signalés automatiquement", en: "Overdue sites flagged automatically" },
    desc: {
      fr: "Une adresse dont l'échéance est passée sans qu'une nouvelle inspection soit faite reste visible et signalée dans le calendrier, jusqu'à ce qu'elle soit traitée.",
      en: "A site whose deadline has passed without a new inspection stays visible and flagged on the calendar until it's dealt with.",
    },
  },
  {
    title: { fr: "Client avisé à chaque changement", en: "Client notified on every change" },
    desc: {
      fr: "Dès qu'une visite est planifiée, le client reçoit un courriel de confirmation — et si la date change ensuite, un nouveau courriel l'en informe automatiquement.",
      en: "As soon as a visit is scheduled, the client gets a confirmation email — and if the date changes afterward, a new email lets them know automatically.",
    },
  },
]

const planificationPoints = [
  {
    title: { fr: "Organisation par secteur géographique", en: "Organization by geographic sector" },
    desc: {
      fr: "Vos bâtiments sont regroupés par zone (ex. Secteur Nord, Centre-ville, etc.). Résultat : les techniciens planifient leurs visites par quartier plutôt qu'au hasard, ce qui réduit les déplacements inutiles et permet de couvrir plusieurs adresses en une seule tournée — moins de délais, moins de frais de déplacement répercutés.",
      en: "Your buildings are grouped by zone (e.g. North Sector, Downtown, etc.). The result: technicians plan their visits by neighborhood instead of at random, cutting wasted travel and covering several addresses in a single route — fewer delays, fewer travel costs passed on to you.",
    },
  },
  {
    title: { fr: "Assignation d'équipe par secteur", en: "Team assignment by sector" },
    desc: {
      fr: "Un ou plusieurs techniciens peuvent être assignés à tout un secteur en un seul geste, avec la possibilité de diviser le travail entre eux si le volume l'exige (un technicien par portion du secteur). Des visites mieux coordonnées, et une meilleure capacité à absorber les pics de demande sans retard.",
      en: "One or more technicians can be assigned to an entire sector in a single action, with the option to split the work between them when volume requires it (one technician per portion of the sector). Better-coordinated visits, and a stronger ability to absorb demand spikes without delay.",
    },
  },
  {
    title: { fr: "Préavis de rappel adapté à la taille de chaque bâtiment", en: "Reminder notice matched to each building's size" },
    desc: {
      fr: "Fini le rappel uniforme à 30 jours pour tout le monde : plus un bâtiment est grand, plus le préavis est long — jusqu'à 60 jours pour vos plus gros immeubles. Le temps nécessaire pour préparer l'accès et l'identification de vos extincteurs avant notre passage, sans surprise de dernière minute.",
      en: "No more one-size-fits-all 30-day reminder: the larger the building, the longer the notice — up to 60 days for your biggest properties. Enough time to prepare access and identification of your extinguishers before the visit, with no last-minute surprises.",
    },
  },
  {
    title: { fr: "Continuité automatique d'une année à l'autre", en: "Automatic continuity from year to year" },
    desc: {
      fr: "Dès qu'un rapport d'inspection est fermé, la visite de l'an prochain est automatiquement inscrite au calendrier — rien à redemander. La liste de vos équipements est conservée d'une année à l'autre pour éviter toute ressaisie inutile, mais chaque appareil est réévalué à neuf à chaque visite : aucun état ni remarque n'est reporté d'une année sur l'autre.",
      en: "As soon as an inspection report is closed, next year's visit is automatically added to the calendar — nothing to ask for again. Your equipment list carries over from year to year to avoid needless re-entry, but every device is freshly reassessed at each visit: no status or note ever carries over from one year to the next.",
    },
  },
]

const roles = [
  {
    title: { fr: "Technicien", en: "Technician" },
    desc: {
      fr: "Effectue les inspections sur le terrain, remplit les rapports et prend les photos directement depuis son mobile.",
      en: "Performs field inspections, fills in reports, and takes photos directly from their mobile device.",
    },
  },
  {
    title: { fr: "Superviseur", en: "Supervisor" },
    desc: {
      fr: "Supervise les équipes, les bâtiments et les clients. Valide les rapports et suit la conformité en temps réel.",
      en: "Oversees teams, buildings, and clients. Validates reports and tracks compliance in real time.",
    },
  },
  {
    title: { fr: "Client / citoyen", en: "Client / citizen" },
    desc: {
      fr: "Consulte l'historique de conformité de ses bâtiments et télécharge ses rapports en tout temps.",
      en: "Views the compliance history of their buildings and downloads their reports at any time.",
    },
  },
];

const features = [
  {
    title: { fr: "Rapports d'inspection numériques", en: "Digital inspection reports" },
    desc: {
      fr: "Fini le papier : chaque extincteur est inspecté, photographié et rapporté en quelques clics, avec horodatage.",
      en: "No more paper: every extinguisher is inspected, photographed, and reported in a few clicks, with a timestamp.",
    },
  },
  {
    title: { fr: "Conformité centralisée", en: "Centralized compliance" },
    desc: {
      fr: "Un portrait clair de la conformité de chaque bâtiment, mis à jour automatiquement à chaque inspection.",
      en: "A clear picture of each building's compliance, automatically updated with every inspection.",
    },
  },
  {
    title: { fr: "Multi-organisations", en: "Multi-organization" },
    desc: {
      fr: "Gérez plusieurs clients, équipes et sites depuis une seule plateforme, avec des accès adaptés à chaque rôle.",
      en: "Manage multiple clients, teams, and sites from a single platform, with access tailored to each role.",
    },
  },
  {
    title: { fr: "Historique et traçabilité", en: "History and traceability" },
    desc: {
      fr: "Chaque extincteur conserve son historique complet — inspections, correctifs, remplacements.",
      en: "Every extinguisher keeps its complete history — inspections, fixes, replacements.",
    },
  },
  {
    title: { fr: "Accès mobile terrain", en: "Mobile field access" },
    desc: {
      fr: "Les techniciens travaillent directement depuis leur téléphone ou tablette, même sur le site du client.",
      en: "Technicians work directly from their phone or tablet, even on the client's site.",
    },
  },
  {
    title: { fr: "Rapports exportables", en: "Exportable reports" },
    desc: {
      fr: "Générez des rapports clairs et professionnels à remettre à vos clients ou aux autorités.",
      en: "Generate clear, professional reports to hand to your clients or authorities.",
    },
  },
  {
    title: { fr: "Interface bilingue", en: "Bilingual interface" },
    desc: {
      fr: "Basculez l'interface de votre équipe entre français et anglais en un clic, par organisation.",
      en: "Switch your team's interface between French and English in one click, per organization.",
    },
  },
  {
    title: { fr: "Planification par secteur", en: "Planning by sector" },
    desc: {
      fr: "Regroupez vos bâtiments par zone géographique et planifiez une tournée entière en un seul geste, au lieu d'un déplacement par adresse.",
      en: "Group your buildings by geographic zone and schedule an entire route in a single action, instead of one trip per address.",
    },
  },
  {
    title: { fr: "Équipes flexibles", en: "Flexible team assignment" },
    desc: {
      fr: "Assignez un ou plusieurs techniciens à un secteur, avec la possibilité de diviser la route entre eux au besoin.",
      en: "Assign one or more technicians to a sector, with the option to split the route between them as needed.",
    },
  },
];

const stats = [
  { value: { fr: "100 %", en: "100%" }, label: { fr: "Rapports numérisés", en: "Digitized reports" } },
  { value: { fr: "24/7", en: "24/7" }, label: { fr: "Accès à vos données", en: "Access to your data" } },
  { value: { fr: "1 mois", en: "1 month" }, label: { fr: "D'essai gratuit", en: "Free trial" } },
  { value: { fr: "Annuel", en: "Annual" }, label: { fr: "Abonnement simple", en: "Simple subscription" } },
];

export function HomeContent() {
  const t = useT();
  const langue = useLangue();

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink">
        <div className="bg-grid absolute inset-0" />
        <div className="glow-red absolute inset-0" />
        <Container className="relative py-24 sm:py-32 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <Kicker>{t("hero_kicker")}</Kicker>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
              {t("hero_titre")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60">
              {site.name} {t("hero_texte")}
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-white/50">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
              </svg>
              {t("hero_bilingue")}
            </div>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <PrimaryButton href="/contact">{t("hero_essai_btn")}</PrimaryButton>
              <SecondaryButton href="/services" dark>
                {t("decouvrir_plateforme")}
              </SecondaryButton>
            </div>
            <p className="mt-5 text-xs text-white/35">
              {t("abonnement_annuel_note")}
            </p>
          </div>
        </Container>

        <Container className="relative pb-24 sm:pb-32">
          <ProductPreview />
        </Container>
      </section>

      {/* SYSTEMS COVERED */}
      <section className="bg-paper py-20 sm:py-24">
        <Container>
          <SectionHeading
            kicker={t("systemes_couverts_kicker")}
            title={t("systemes_titre")}
            description={t("systemes_desc")}
            align="center"
          />
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {systems.map((sys) => (
              <div key={sys.title.fr} className="rounded-xl border border-line bg-paper-2 p-6 text-center">
                <h3 className="text-base font-semibold text-ink">{sys.title[langue]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{sys.desc[langue]}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* SYSTÈME DE CUISINE */}
      <section className="border-t border-line bg-paper py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker={t("cuisine_kicker")}
            title={t("cuisine_titre")}
            description={t("cuisine_desc")}
            align="center"
          />
          <div className="mt-14">
            <Image
              src="/captures/systeme-cuisine.png"
              alt={t("cuisine_alt")}
              width={1528}
              height={1029}
              className="mx-auto h-auto w-full max-w-4xl rounded-lg border border-line shadow-xl shadow-ink/5"
            />
          </div>
        </Container>
      </section>

      {/* CALENDRIER & RAPPELS */}
      <section className="border-t border-line bg-paper py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker={t("calendrier_kicker")}
            title={t("calendrier_titre")}
            description={t("calendrier_desc")}
            align="center"
          />
          <div className="mt-14">
            <Image
              src="/captures/calendrier-rappels.png"
              alt={t("calendrier_alt")}
              width={1711}
              height={919}
              className="mx-auto h-auto w-full max-w-4xl rounded-lg border border-line shadow-xl shadow-ink/5"
            />
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {calendrierPoints.map((p) => (
              <div key={p.title.fr}>
                <div className="h-px w-10 bg-red" />
                <h3 className="mt-4 text-lg font-semibold text-ink">{p.title[langue]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{p.desc[langue]}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* PLANIFICATION PAR SECTEUR */}
      <section className="border-t border-line bg-paper-2 py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker={t("planification_kicker")}
            title={t("planification_titre")}
            description={t("planification_desc")}
            align="center"
          />
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {planificationPoints.map((p) => (
              <div key={p.title.fr} className="rounded-2xl border border-line bg-paper p-8">
                <div className="h-px w-10 bg-red" />
                <h3 className="mt-4 text-lg font-semibold text-ink">{p.title[langue]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{p.desc[langue]}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ROLES */}
      <section className="bg-paper py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker={t("roles_kicker")}
            title={t("roles_titre")}
            description={t("roles_desc")}
            align="center"
          />
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {roles.map((role) => (
              <div
                key={role.title.fr}
                className="rounded-xl border border-line bg-paper-2 p-6 transition-shadow hover:shadow-lg hover:shadow-ink/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red/10 text-sm font-bold text-red">
                  {role.title[langue].charAt(0)}
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">{role.title[langue]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{role.desc[langue]}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* DETECTION */}
      <section className="border-t border-line bg-paper py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker={t("detection_kicker")}
            title={t("detection_titre")}
            description={t("detection_desc")}
            align="center"
          />
          <div className="mt-14">
            <Image
              src="/captures/dispositifs-live.png"
              alt={t("detection_alt")}
              width={1528}
              height={1029}
              className="mx-auto h-auto w-full max-w-4xl"
            />
          </div>
        </Container>
      </section>

      {/* FEATURES */}
      <section className="border-t border-line bg-paper-2 py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker={t("fonctionnalites_kicker")}
            title={t("fonctionnalites_titre")}
            description={t("fonctionnalites_desc")}
            align="center"
          />
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title.fr}>
                <div className="h-px w-10 bg-red" />
                <h3 className="mt-4 text-lg font-semibold text-ink">{f.title[langue]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{f.desc[langue]}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* DOCUMENTS */}
      <section className="bg-ink py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker={t("documents_kicker")}
            title={t("documents_titre")}
            description={t("documents_desc")}
            align="center"
            dark
          />
          <div className="mt-16 flex justify-center">
            <div className="flex w-full max-w-2xl flex-col items-center">
              <Image
                src="/captures/certificat.png"
                alt={t("cert_verif_alt")}
                width={1536}
                height={1024}
                className="h-auto w-full rounded-lg shadow-2xl shadow-black/40"
              />
              <p className="mt-4 text-sm font-medium text-white/60">{t("cert_verif_label")}</p>
            </div>
          </div>
        </Container>
      </section>

      {/* STATS BAND */}
      <section className="border-t border-white/10 bg-ink py-16">
        <Container>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label.fr} className="text-center">
                <div className="text-3xl font-bold text-white sm:text-4xl">{stat.value[langue]}</div>
                <div className="mt-2 text-xs uppercase tracking-wider text-white/40">
                  {stat.label[langue]}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Partners />

      {/* CTA */}
      <section className="bg-paper py-24 sm:py-28">
        <Container>
          <div className="relative overflow-hidden rounded-2xl bg-ink px-8 py-16 text-center sm:px-16">
            <div className="glow-red absolute inset-0" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold text-balance text-white sm:text-4xl">
                {t("cta_titre")}
              </h2>
              <p className="mt-4 text-lg text-white/60">
                {t("cta_texte")}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <PrimaryButton href="/contact">{t("demarrer_essai_gratuit")}</PrimaryButton>
                <SecondaryButton href="/tarifs" dark>
                  {t("voir_les_tarifs")}
                </SecondaryButton>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
