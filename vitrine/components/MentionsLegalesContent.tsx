"use client";

import { Container } from "@/components/ui";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";

export function MentionsLegalesContent() {
  const t = useT();
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">{t("nav_mentions_legales")}</h1>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-text-muted">
            <div>
              <h2 className="text-base font-semibold text-ink">{t("editeur_du_site")}</h2>
              <p className="mt-2">
                {site.legalName} — {site.address}
                <br />
                {t("telephone_deux_points")} {site.phone}
                <br />
                {t("courriel_deux_points")} {site.email}
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink">{t("hebergement_titre")}</h2>
              <p className="mt-2">
                {t("hebergement_texte")}
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink">{t("propriete_intellectuelle_titre")}</h2>
              <p className="mt-2">
                {t("propriete_intellectuelle_texte_a")} {site.legalName}
                {t("propriete_intellectuelle_texte_b")}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
