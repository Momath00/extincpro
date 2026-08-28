import type { Metadata } from "next";
import Image from "next/image";
import { Container, Kicker, PrimaryButton, SecondaryButton, SectionHeading } from "@/components/ui";
import { ProductPreview } from "@/components/ProductPreview";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${site.name} — Logiciel d'inspection et de conformité incendie`,
  description: site.description,
  alternates: { canonical: "/" },
};

const systems = [
  { title: "Inspection sécurité incendie", desc: "Inspection générale de sécurité incendie de vos bâtiments, en un seul système." },
  { title: "Extincteurs", desc: "Inspection, entretien et conformité de chaque extincteur, bâtiment par bâtiment." },
  { title: "Éclairage d'urgence", desc: "Vérification périodique des blocs d'éclairage d'urgence et de leur autonomie." },
  { title: "Gicleurs", desc: "Suivi des inspections de systèmes de gicleurs et de leur conformité réglementaire." },
];

const roles = [
  {
    title: "Technicien",
    desc: "Effectue les inspections sur le terrain, remplit les rapports et prend les photos directement depuis son mobile.",
  },
  {
    title: "Superviseur",
    desc: "Supervise les équipes, les bâtiments et les clients. Valide les rapports et suit la conformité en temps réel.",
  },
  {
    title: "Client / citoyen",
    desc: "Consulte l'historique de conformité de ses bâtiments et télécharge ses rapports en tout temps.",
  },
];

const features = [
  {
    title: "Rapports d'inspection numériques",
    desc: "Fini le papier : chaque extincteur est inspecté, photographié et rapporté en quelques clics, avec horodatage.",
  },
  {
    title: "Conformité centralisée",
    desc: "Un portrait clair de la conformité de chaque bâtiment, mis à jour automatiquement à chaque inspection.",
  },
  {
    title: "Multi-organisations",
    desc: "Gérez plusieurs clients, équipes et sites depuis une seule plateforme, avec des accès adaptés à chaque rôle.",
  },
  {
    title: "Historique et traçabilité",
    desc: "Chaque extincteur conserve son historique complet — inspections, correctifs, remplacements.",
  },
  {
    title: "Accès mobile terrain",
    desc: "Les techniciens travaillent directement depuis leur téléphone ou tablette, même sur le site du client.",
  },
  {
    title: "Rapports exportables",
    desc: "Générez des rapports clairs et professionnels à remettre à vos clients ou aux autorités.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink">
        <div className="bg-grid absolute inset-0" />
        <div className="glow-red absolute inset-0" />
        <Container className="relative py-24 sm:py-32 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <Kicker>Logiciel de sécurité incendie</Kicker>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
              La plateforme qui relie le terrain, la conformité et vos clients
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60">
              {site.name}{" "}centralise l&apos;inspection, les rapports et la
              conformité de vos systèmes de sécurité incendie — extincteurs,
              éclairage d&apos;urgence et gicleurs — du technicien sur le
              terrain jusqu&apos;à la direction.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <PrimaryButton href="/contact">Essai gratuit — 1 mois</PrimaryButton>
              <SecondaryButton href="/services" dark>
                Découvrir la plateforme
              </SecondaryButton>
            </div>
            <p className="mt-5 text-xs text-white/35">
              Abonnement annuel · Aucune carte de crédit requise pour l&apos;essai
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
            kicker="Systèmes couverts"
            title="Un seul système pour tous vos équipements de sécurité incendie"
            description="L'application ExtincPro couvre l'ensemble des équipements que votre entreprise inspecte, sous un seul logiciel."
            align="center"
          />
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {systems.map((sys) => (
              <div key={sys.title} className="rounded-xl border border-line bg-paper-2 p-6 text-center">
                <h3 className="text-base font-semibold text-ink">{sys.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{sys.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ROLES */}
      <section className="bg-paper py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker="Une plateforme, trois rôles"
            title="Chaque personne voit exactement ce dont elle a besoin"
            description="De l'inspection terrain jusqu'au client final, ExtincPro adapte l'interface et les accès à chaque rôle de votre entreprise."
            align="center"
          />
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {roles.map((role) => (
              <div
                key={role.title}
                className="rounded-xl border border-line bg-paper-2 p-6 transition-shadow hover:shadow-lg hover:shadow-ink/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red/10 text-sm font-bold text-red">
                  {role.title.charAt(0)}
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">{role.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{role.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* DETECTION */}
      <section className="border-t border-line bg-paper py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker="Détection des anomalies"
            title="Chaque défaut est détecté et résumé automatiquement"
            description="Dispositifs défectueux, éléments non inspectés : ExtincPro les repère et les regroupe dans un résumé clair, pour que rien ne soit oublié avant la fermeture d'un rapport."
            align="center"
          />
          <div className="mt-14">
            <Image
              src="/captures/dispositifs-live.png"
              alt="Détection automatique des anomalies sur un rapport d'inspection ExtincPro"
              width={1296}
              height={634}
              className="mx-auto h-auto w-full max-w-4xl"
            />
          </div>
        </Container>
      </section>

      {/* FEATURES */}
      <section className="border-t border-line bg-paper-2 py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker="Fonctionnalités"
            title="Tout ce qu'il faut pour piloter la conformité incendie"
            description="ExtincPro remplace les feuilles Excel et le papier par une plateforme unique, pensée pour les équipes terrain et la direction."
            align="center"
          />
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <div className="h-px w-10 bg-red" />
                <h3 className="mt-4 text-lg font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* DOCUMENTS */}
      <section className="bg-ink py-24 sm:py-28">
        <Container>
          <SectionHeading
            kicker="Rapports &amp; certificats"
            title="Des documents professionnels, générés automatiquement"
            description="Chaque inspection fermée génère instantanément un rapport détaillé et un certificat de vérification, prêts à être remis à vos clients."
            align="center"
            dark
          />
          <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-3">
            <div className="flex flex-col items-center">
              <Image
                src="/captures/certificat.png"
                alt="Certificat de vérification généré par ExtincPro"
                width={1080}
                height={531}
                className="h-auto w-full"
              />
              <p className="mt-3 text-sm font-medium text-white/60">Certificat de vérification</p>
            </div>
            <div className="flex flex-col items-center">
              <Image
                src="/captures/rapport-extincteur.png"
                alt="Rapport de vérification des extincteurs généré par ExtincPro"
                width={1080}
                height={346}
                className="h-auto w-full"
              />
              <p className="mt-3 text-sm font-medium text-white/60">Rapport — extincteurs</p>
            </div>
            <div className="flex flex-col items-center">
              <Image
                src="/captures/dispositifs-pdf.png"
                alt="Détail des dispositifs du réseau incendie généré par ExtincPro"
                width={1080}
                height={532}
                className="h-auto w-full"
              />
              <p className="mt-3 text-sm font-medium text-white/60">Rapport — sécurité incendie</p>
            </div>
          </div>
        </Container>
      </section>

      {/* STATS BAND */}
      <section className="border-t border-white/10 bg-ink py-16">
        <Container>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { value: "100 %", label: "Rapports numérisés" },
              { value: "24/7", label: "Accès à vos données" },
              { value: "1 mois", label: "D'essai gratuit" },
              { value: "Annuel", label: "Abonnement simple" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-white sm:text-4xl">{stat.value}</div>
                <div className="mt-2 text-xs uppercase tracking-wider text-white/40">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="bg-paper py-24 sm:py-28">
        <Container>
          <div className="relative overflow-hidden rounded-2xl bg-ink px-8 py-16 text-center sm:px-16">
            <div className="glow-red absolute inset-0" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold text-balance text-white sm:text-4xl">
                Prêt à moderniser vos inspections d&apos;extincteurs ?
              </h2>
              <p className="mt-4 text-lg text-white/60">
                Essayez ExtincPro gratuitement pendant 1 mois. Aucune carte de
                crédit requise.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <PrimaryButton href="/contact">Démarrer l&apos;essai gratuit</PrimaryButton>
                <SecondaryButton href="/tarifs" dark>
                  Voir les tarifs
                </SecondaryButton>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
