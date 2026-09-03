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
    title: { fr: "Gicleurs", en: "Sprinklers" },
    desc: {
      fr: "Suivi des inspections de systèmes de gicleurs et de leur conformité réglementaire.",
      en: "Tracking of sprinkler system inspections and their regulatory compliance.",
    },
  },
];

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
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
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
