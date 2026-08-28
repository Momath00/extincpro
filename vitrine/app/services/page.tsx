import type { Metadata } from "next";
import { Container, Kicker, PrimaryButton, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services — Logiciel d'inspection incendie complet",
  description:
    "Inspection terrain, rapports numériques, conformité centralisée et gestion multi-organisations : découvrez tout ce que le logiciel ExtincPro gère pour vos extincteurs, votre éclairage d'urgence et vos gicleurs.",
  alternates: { canonical: "/services" },
};

const systemesCouverts = [
  { title: "Inspection incendie", desc: "Inspection générale de sécurité incendie de vos bâtiments." },
  { title: "Inspection extincteur", desc: "Inspection, entretien, recharge et remplacement, suivis pour chaque appareil." },
  { title: "Éclairage d'urgence", desc: "Test périodique des blocs d'éclairage et de leur autonomie réglementaire." },
  { title: "Gicleurs", desc: "Suivi des inspections de systèmes de gicleurs et de leur conformité." },
];

const modules = [
  {
    title: "Inspection terrain",
    subtitle: "Technicien",
    points: [
      "Inspection guidée extincteur par extincteur",
      "Photos et notes attachées à chaque rapport",
      "Fonctionne sur mobile et tablette, sur le site du client",
      "Détection automatique des anomalies à corriger",
    ],
  },
  {
    title: "Supervision et conformité",
    subtitle: "Superviseur",
    points: [
      "Vue d'ensemble des bâtiments, clients et équipes",
      "Validation des rapports soumis par les techniciens",
      "Suivi en temps réel du taux de conformité",
      "Planification des inspections à venir",
    ],
  },
  {
    title: "Portail client",
    subtitle: "Citoyen / client",
    points: [
      "Historique complet de conformité par bâtiment",
      "Téléchargement des rapports en tout temps",
      "Visibilité claire, sans appel ni courriel nécessaire",
    ],
  },
  {
    title: "Administration multi-organisations",
    subtitle: "Super-admin",
    points: [
      "Gestion de plusieurs organisations clientes",
      "Contrôle des accès et des rôles",
      "Configuration globale de la plateforme",
      "Vue consolidée sur l'ensemble du réseau",
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>Services</Kicker>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
              Un logiciel complet, de l&apos;inspection à la conformité
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/60">
              {site.name}{" "}couvre l&apos;ensemble du cycle d&apos;inspection de
              vos systèmes de sécurité incendie — extincteurs, éclairage
              d&apos;urgence et gicleurs : inspection, rapport, correction,
              conformité et communication client, dans une seule application.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-paper py-20 sm:py-24">
        <Container>
          <SectionHeading
            kicker="Systèmes couverts"
            title="Quatre systèmes, un seul logiciel"
            align="center"
          />
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {systemesCouverts.map((sys) => (
              <div key={sys.title} className="rounded-xl border border-line bg-paper-2 p-6 text-center">
                <h3 className="text-base font-semibold text-ink">{sys.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{sys.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-paper py-24 sm:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {modules.map((mod) => (
              <div key={mod.title} className="rounded-2xl border border-line bg-paper-2 p-8">
                <span className="text-xs font-semibold uppercase tracking-wider text-red">
                  {mod.subtitle}
                </span>
                <h2 className="mt-2 text-2xl font-bold text-ink">{mod.title}</h2>
                <ul className="mt-6 space-y-3">
                  {mod.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-text-muted">
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
                      <span>{point}</span>
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
            kicker="Conformité"
            title="Des rapports professionnels, prêts à être remis"
            description="Chaque inspection génère un rapport clair et structuré — utilisable pour vos clients, vos assureurs ou les autorités compétentes."
          />
          <div className="mt-12 flex justify-center">
            <PrimaryButton href="/contact">Demander une démo</PrimaryButton>
          </div>
        </Container>
      </section>
    </>
  );
}
