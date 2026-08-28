import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: `Politique de confidentialité de ${site.name}.`,
  alternates: { canonical: "/confidentialite" },
  robots: { index: false, follow: true },
};

export default function ConfidentialitePage() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">
            Politique de confidentialité
          </h1>
          <p className="mt-4 text-sm text-text-muted">
            Dernière mise à jour : à compléter avant la mise en production.
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-text-muted">
            <div>
              <h2 className="text-base font-semibold text-ink">Données recueillies</h2>
              <p className="mt-2">
                Lorsque vous remplissez le formulaire de contact de ce site,
                nous recueillons votre nom, votre entreprise, votre courriel,
                votre téléphone et le contenu de votre message, dans le seul
                but de répondre à votre demande.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink">Utilisation des données</h2>
              <p className="mt-2">
                Ces informations sont utilisées uniquement par l&apos;équipe
                de {site.legalName} pour vous contacter au sujet de votre
                demande d&apos;essai gratuit ou de démonstration. Elles ne
                sont ni vendues ni partagées avec des tiers à des fins
                commerciales.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink">Vos droits</h2>
              <p className="mt-2">
                Vous pouvez en tout temps demander l&apos;accès, la
                correction ou la suppression de vos données en nous écrivant
                à {site.email}.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
