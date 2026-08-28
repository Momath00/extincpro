import type { Metadata } from "next";
import { Container, Kicker, PrimaryButton, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "À propos — Notre mission",
  description:
    "ExtincPro modernise l'inspection et la conformité des extincteurs pour les entreprises de sécurité incendie. Découvrez notre mission et notre approche.",
  alternates: { canonical: "/a-propos" },
};

const values = [
  {
    title: "Terrain d'abord",
    desc: "Notre plateforme est conçue pour être utilisée sur le terrain, par les techniciens, pas seulement au bureau.",
  },
  {
    title: "Conformité sans effort",
    desc: "La conformité de vos clients doit être une conséquence naturelle de votre travail, pas une tâche administrative en plus.",
  },
  {
    title: "Clarté pour tous",
    desc: "Chaque rôle — technicien, superviseur, client, administrateur — voit une information claire, adaptée à ses besoins.",
  },
];

export default function AProposPage() {
  return (
    <>
      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>À propos</Kicker>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
              Moderniser l&apos;inspection des extincteurs, une entreprise à la fois
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/60">
              {site.name}{" "}est né d&apos;un constat simple : les entreprises de
              sécurité incendie gèrent encore leurs inspections avec du
              papier ou des feuilles de calcul dispersées. Nous construisons
              la plateforme qui centralise tout, du terrain jusqu&apos;à la
              direction.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-paper py-24 sm:py-28">
        <Container>
          <SectionHeading
            align="center"
            kicker="Notre approche"
            title="Une plateforme pensée pour le métier"
            description="Chaque décision de conception part du terrain : ce dont un technicien a réellement besoin, ce qu'un superviseur doit voir, ce qu'un client attend."
          />
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {values.map((v) => (
              <div key={v.title} className="rounded-xl border border-line bg-paper-2 p-6">
                <h3 className="text-base font-semibold text-ink">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{v.desc}</p>
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
                Discutons de vos besoins
              </h2>
              <p className="mt-4 text-lg text-white/60">
                Notre équipe vous présente la plateforme et répond à vos
                questions, sans engagement.
              </p>
              <div className="mt-8">
                <PrimaryButton href="/contact">Nous contacter</PrimaryButton>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
