"use client";

import { Container, Kicker, PrimaryButton, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";
import { useLangue, useT } from "@/lib/i18n";

const values = [
  {
    title: { fr: "Terrain d'abord", en: "Field first" },
    desc: {
      fr: "Notre plateforme est conçue pour être utilisée sur le terrain, par les techniciens, pas seulement au bureau.",
      en: "Our platform is designed to be used in the field, by technicians, not just at the office.",
    },
  },
  {
    title: { fr: "Conformité sans effort", en: "Effortless compliance" },
    desc: {
      fr: "La conformité de vos clients doit être une conséquence naturelle de votre travail, pas une tâche administrative en plus.",
      en: "Your clients' compliance should be a natural consequence of your work, not an extra administrative task.",
    },
  },
  {
    title: { fr: "Clarté pour tous", en: "Clarity for everyone" },
    desc: {
      fr: "Chaque rôle — technicien, superviseur, client, administrateur — voit une information claire, adaptée à ses besoins.",
      en: "Every role — technician, supervisor, client, administrator — sees clear information, tailored to their needs.",
    },
  },
];

export function AProposContent() {
  const t = useT();
  const langue = useLangue();

  return (
    <>
      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{t("nav_a_propos")}</Kicker>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
              {t("apropos_hero_titre")}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/60">
              {site.name} {t("apropos_hero_texte")}
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-paper py-24 sm:py-28">
        <Container>
          <SectionHeading
            align="center"
            kicker={t("apropos_approche_kicker")}
            title={t("apropos_approche_titre")}
            description={t("apropos_approche_desc")}
          />
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {values.map((v) => (
              <div key={v.title.fr} className="rounded-xl border border-line bg-paper-2 p-6">
                <h3 className="text-base font-semibold text-ink">{v.title[langue]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{v.desc[langue]}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-paper-2 py-24 sm:py-28">
        <Container>
          <div className="relative overflow-hidden rounded-2xl bg-ink px-8 py-16 text-center sm:px-16">
            <div className="glow-red absolute inset-0" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold text-balance text-white sm:text-4xl">
                {t("apropos_cta_titre")}
              </h2>
              <p className="mt-4 text-lg text-white/60">
                {t("apropos_cta_texte")}
              </p>
              <div className="mt-8">
                <PrimaryButton href="/contact">{t("nous_contacter")}</PrimaryButton>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
