import type { Metadata } from "next";
import { Container, Kicker, PrimaryButton, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Tarifs — Un module par système, abonnement annuel",
  description:
    "ExtincPro se souscrit module par module (inspection sécurité incendie, extincteurs, éclairage d'urgence, gicleurs), par abonnement annuel, avec 1 mois d'essai gratuit et sans carte de crédit.",
  alternates: { canonical: "/tarifs" },
};

const modules = [
  {
    name: "Module Inspection sécurité incendie",
    desc: "Inspection générale de sécurité incendie de vos bâtiments.",
    highlight: true,
    features: [
      "Inspection complète par bâtiment",
      "Rapports d'inspection illimités",
      "Suivi de conformité réglementaire",
      "Portail client inclus",
      "Accès mobile terrain",
    ],
  },
  {
    name: "Module Extincteurs",
    desc: "Inspection, entretien et conformité de vos extincteurs.",
    highlight: false,
    features: [
      "Rapports d'inspection illimités",
      "Photos et notes par appareil",
      "Historique complet par extincteur",
      "Portail client inclus",
      "Accès mobile terrain",
    ],
  },
  {
    name: "Module Éclairage d'urgence",
    desc: "Vérification périodique de vos blocs d'éclairage d'urgence.",
    highlight: false,
    features: [
      "Tests d'autonomie planifiés",
      "Rapports d'inspection illimités",
      "Suivi de conformité par bâtiment",
      "Portail client inclus",
      "Accès mobile terrain",
    ],
  },
  {
    name: "Module Gicleurs",
    desc: "Suivi des inspections de vos systèmes de gicleurs.",
    highlight: false,
    features: [
      "Inspections planifiées",
      "Rapports d'inspection illimités",
      "Suivi de conformité par bâtiment",
      "Portail client inclus",
      "Accès mobile terrain",
    ],
  },
];

export default function TarifsPage() {
  return (
    <>
      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>Tarifs</Kicker>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
              Un module par système, un abonnement annuel
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/60">
              {site.name}{" "}se souscrit module par module — inspection
              sécurité incendie, extincteurs, éclairage d&apos;urgence,
              gicleurs — selon ce que votre entreprise inspecte réellement.
              Chaque module est facturé annuellement, avec 1 mois
              d&apos;essai gratuit, sans carte de crédit.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-paper py-24 sm:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((mod) => (
              <div
                key={mod.name}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  mod.highlight
                    ? "border-red bg-ink text-white shadow-xl shadow-red/10"
                    : "border-line bg-paper-2 text-ink"
                }`}
              >
                <h2 className={`text-xl font-bold ${mod.highlight ? "text-white" : "text-ink"}`}>
                  {mod.name}
                </h2>
                <p className={`mt-2 text-sm ${mod.highlight ? "text-white/60" : "text-text-muted"}`}>
                  {mod.desc}
                </p>
                <div className="mt-6">
                  <span className={`text-sm font-medium ${mod.highlight ? "text-white/50" : "text-text-muted"}`}>
                    Facturation annuelle
                  </span>
                  <div className={`mt-1 text-sm font-semibold ${mod.highlight ? "text-red-bright" : "text-red"}`}>
                    1 mois d&apos;essai gratuit
                  </div>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {mod.features.map((feature) => (
                    <li
                      key={feature}
                      className={`flex items-start gap-3 text-sm ${
                        mod.highlight ? "text-white/70" : "text-text-muted"
                      }`}
                    >
                      <svg
                        className={`mt-0.5 h-4 w-4 shrink-0 ${mod.highlight ? "text-red-bright" : "text-red"}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <PrimaryButton href="/contact" className="w-full">
                    Démarrer l&apos;essai gratuit
                  </PrimaryButton>
                </div>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-text-muted">
            Vous pouvez combiner plusieurs modules sous un seul abonnement.
            Contactez-nous pour recevoir une soumission adaptée au nombre de
            bâtiments et d&apos;utilisateurs de votre entreprise.
          </p>
        </Container>
      </section>

      <section className="border-t border-line bg-paper-2 py-24 sm:py-28">
        <Container>
          <SectionHeading align="center" kicker="Questions fréquentes" title="Tout savoir sur l'abonnement" />
          <div className="mx-auto mt-12 max-w-3xl divide-y divide-line">
            {[
              {
                q: "Pourquoi un abonnement annuel plutôt que mensuel ?",
                a: "L'abonnement annuel simplifie la gestion budgétaire de nos clients et nous permet d'offrir un tarif plus avantageux, sans surprises en cours d'année.",
              },
              {
                q: "Comment fonctionne l'essai gratuit d'un mois ?",
                a: "Vous avez accès au module choisi pendant 1 mois, sans carte de crédit. Vous pouvez inviter votre équipe et tester la plateforme sur vos vrais bâtiments avant de vous engager.",
              },
              {
                q: "Puis-je activer plusieurs modules ?",
                a: "Oui. La plupart de nos clients combinent plusieurs modules (extincteurs, éclairage d'urgence, gicleurs) sous un seul abonnement annuel et un seul accès.",
              },
            ].map((item) => (
              <div key={item.q} className="py-6">
                <h3 className="text-base font-semibold text-ink">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
