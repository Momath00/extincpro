import type { Metadata } from "next";
import { Container, Kicker } from "@/components/ui";
import { ContactForm } from "@/components/ContactForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact — Démarrez votre essai gratuit",
  description:
    "Contactez l'équipe ExtincPro pour démarrer votre essai gratuit d'un mois ou obtenir une démo de la plateforme d'inspection d'extincteurs.",
  alternates: { canonical: "/contact" },
};

const info = [
  {
    label: "Téléphone",
    value: site.phone,
    href: `tel:${site.phoneHref}`,
  },
  {
    label: "Courriel",
    value: site.email,
    href: `mailto:${site.email}`,
  },
  {
    label: "Région desservie",
    value: site.address,
    href: undefined,
  },
];

export default function ContactPage() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Kicker>Contact</Kicker>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance text-ink sm:text-4xl">
              Démarrez votre essai gratuit d&apos;un mois
            </h1>
            <p className="mt-4 text-base leading-relaxed text-text-muted">
              Écrivez-nous ou appelez-nous pour discuter de vos besoins.
              Notre équipe vous présente la plateforme et configure votre
              essai gratuit, sans engagement et sans carte de crédit.
            </p>

            <dl className="mt-10 space-y-6">
              {info.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-lg font-medium text-ink">
                    {item.href ? (
                      <a href={item.href} className="hover:text-red">
                        {item.value}
                      </a>
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-line bg-paper-2 p-6 sm:p-10">
              <ContactForm />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
