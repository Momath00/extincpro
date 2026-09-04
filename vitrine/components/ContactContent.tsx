"use client";

import { Container, Kicker } from "@/components/ui";
import { ContactForm } from "@/components/ContactForm";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";

export function ContactContent() {
  const t = useT();

  const info = [
    { label: t("telephone_label_vitrine"), value: site.phone, href: `tel:${site.phoneHref}` },
    { label: t("courriel_label"), value: site.email, href: `mailto:${site.email}` },
    { label: t("region_desservie_label"), value: site.address, href: undefined },
  ];

  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Kicker>{t("nav_contact")}</Kicker>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance text-ink sm:text-4xl">
              {t("contact_hero_titre")}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-text-muted">
              {t("contact_hero_texte")}
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
