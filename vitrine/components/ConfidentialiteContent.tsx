"use client";

import { Container } from "@/components/ui";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";

export function ConfidentialiteContent() {
  const t = useT();
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">
            {t("nav_confidentialite")}
          </h1>
          <p className="mt-4 text-sm text-text-muted">
            {t("derniere_mise_a_jour")}
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-text-muted">
            <div>
              <h2 className="text-base font-semibold text-ink">{t("donnees_recueillies_titre")}</h2>
              <p className="mt-2">
                {t("donnees_recueillies_texte")}
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink">{t("utilisation_donnees_titre")}</h2>
              <p className="mt-2">
                {t("utilisation_donnees_texte_a")} {site.legalName} {t("utilisation_donnees_texte_b")}
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink">{t("vos_droits_titre")}</h2>
              <p className="mt-2">
                {t("vos_droits_texte")} {site.email}.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
