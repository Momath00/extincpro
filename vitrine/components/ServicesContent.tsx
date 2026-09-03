"use client";

import { Container, Kicker, PrimaryButton, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";
import { useLangue, useT } from "@/lib/i18n";

const systemesCouverts = [
  {
    title: { fr: "Inspection incendie", en: "Fire inspection" },
    desc: { fr: "Inspection générale de sécurité incendie de vos bâtiments.", en: "General fire safety inspection of your buildings." },
  },
  {
    title: { fr: "Inspection extincteur", en: "Fire extinguisher inspection" },
    desc: {
      fr: "Inspection, entretien, recharge et remplacement, suivis pour chaque appareil.",
      en: "Inspection, maintenance, recharge, and replacement, tracked for each device.",
    },
  },
  {
    title: { fr: "Éclairage d'urgence", en: "Emergency lighting" },
    desc: {
      fr: "Test périodique des blocs d'éclairage et de leur autonomie réglementaire.",
      en: "Periodic testing of lighting units and their regulatory battery life.",
    },
  },
  {
    title: { fr: "Gicleurs", en: "Sprinklers" },
    desc: {
      fr: "Suivi des inspections de systèmes de gicleurs et de leur conformité.",
      en: "Tracking of sprinkler system inspections and their compliance.",
    },
  },
];

const modules = [
  {
    title: { fr: "Inspection terrain", en: "Field inspection" },
    subtitle: { fr: "Technicien", en: "Technician" },
    points: [
      { fr: "Inspection guidée extincteur par extincteur", en: "Guided inspection, extinguisher by extinguisher" },
      { fr: "Photos et notes attachées à chaque rapport", en: "Photos and notes attached to every report" },
      { fr: "Fonctionne sur mobile et tablette, sur le site du client", en: "Works on mobile and tablet, on the client's site" },
      { fr: "Détection automatique des anomalies à corriger", en: "Automatic detection of anomalies to correct" },
    ],
  },
  {
    title: { fr: "Supervision et conformité", en: "Supervision and compliance" },
    subtitle: { fr: "Superviseur", en: "Supervisor" },
    points: [
      { fr: "Vue d'ensemble des bâtiments, clients et équipes", en: "Overview of buildings, clients, and teams" },
      { fr: "Validation des rapports soumis par les techniciens", en: "Validation of reports submitted by technicians" },
      { fr: "Suivi en temps réel du taux de conformité", en: "Real-time tracking of the compliance rate" },
      { fr: "Planification des inspections à venir", en: "Scheduling of upcoming inspections" },
    ],
  },
  {
    title: { fr: "Portail client", en: "Client portal" },
    subtitle: { fr: "Citoyen / client", en: "Citizen / client" },
    points: [
      { fr: "Historique complet de conformité par bâtiment", en: "Complete compliance history per building" },
      { fr: "Téléchargement des rapports en tout temps", en: "Download reports at any time" },
      { fr: "Visibilité claire, sans appel ni courriel nécessaire", en: "Clear visibility, no call or email needed" },
    ],
  },
  {
    title: { fr: "Administration multi-organisations", en: "Multi-organization administration" },
    subtitle: { fr: "Super-admin", en: "Super admin" },
    points: [
      { fr: "Gestion de plusieurs organisations clientes", en: "Management of multiple client organizations" },
      { fr: "Contrôle des accès et des rôles", en: "Control of access and roles" },
      { fr: "Configuration globale de la plateforme", en: "Global platform configuration" },
      { fr: "Vue consolidée sur l'ensemble du réseau", en: "Consolidated view across the whole network" },
    ],
  },
];

export function ServicesContent() {
  const t = useT();
  const langue = useLangue();

  return (
    <>
      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{t("nav_services")}</Kicker>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
              {t("services_hero_titre")}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/60">
              {site.name} {t("services_hero_texte")}
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-paper py-20 sm:py-24">
        <Container>
          <SectionHeading
            kicker={t("systemes_couverts_kicker")}
            title={t("services_systemes_titre")}
            align="center"
          />
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {systemesCouverts.map((sys) => (
              <div key={sys.title.fr} className="rounded-xl border border-line bg-paper-2 p-6 text-center">
                <h3 className="text-base font-semibold text-ink">{sys.title[langue]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{sys.desc[langue]}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-paper py-24 sm:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {modules.map((mod) => (
              <div key={mod.title.fr} className="rounded-2xl border border-line bg-paper-2 p-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-red">
                  {mod.subtitle[langue]}
                </span>
                <h2 className="mt-2 text-2xl font-bold text-ink">{mod.title[langue]}</h2>
                <ul className="mt-6 space-y-3">
                  {mod.points.map((point) => (
                    <li key={point.fr} className="flex items-start gap-3 text-sm text-text-muted">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-red"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{point[langue]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-paper-2 py-24 sm:py-28">
        <Container>
          <SectionHeading
            align="center"
            kicker={t("conformite_kicker")}
            title={t("services_rapports_titre")}
            description={t("services_rapports_desc")}
          />
          <div className="mt-12 flex justify-center">
            <PrimaryButton href="/contact">{t("demander_une_demo")}</PrimaryButton>
          </div>
        </Container>
      </section>
    </>
  );
}
