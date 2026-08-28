import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: `Mentions légales de ${site.name}.`,
  alternates: { canonical: "/mentions-legales" },
  robots: { index: false, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">Mentions légales</h1>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-text-muted">
            <div>
              <h2 className="text-base font-semibold text-ink">Éditeur du site</h2>
              <p className="mt-2">
                {site.legalName} — {site.address}
                <br />
                Téléphone : {site.phone}
                <br />
                Courriel : {site.email}
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink">Hébergement</h2>
              <p className="mt-2">
                Les informations d&apos;hébergement du site seront précisées
                ici après la mise en production.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink">Propriété intellectuelle</h2>
              <p className="mt-2">
                L&apos;ensemble du contenu de ce site (textes, logos,
                éléments graphiques) est la propriété de {site.legalName},
                sauf mention contraire, et ne peut être reproduit sans
                autorisation préalable.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
