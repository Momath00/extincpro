"use client";

import Image from "next/image";
import { Container, SectionHeading } from "@/components/ui";
import { useT } from "@/lib/i18n";

const partners = [
  {
    name: "Extincteurs Nationex",
    logo: "/partners/nationex.png",
    width: 593,
    height: 209,
  },
  {
    name: "Inspection Incendie",
    logo: "/partners/inspection-incendie.png",
    width: 766,
    height: 877,
  },
  {
    name: "MS Solution Informatique",
    logo: "/partners/ms-solution-informatique.png",
    width: 600,
    height: 600,
  },
  {
    name: "PubMS",
    logo: "/partners/pubms.png",
    width: 1109,
    height: 1172,
  },
];

export function Partners() {
  const t = useT();
  return (
    <section className="border-t border-line bg-paper py-20 sm:py-24">
      <Container>
        <SectionHeading
          kicker={t("partners_kicker")}
          title={t("partners_titre")}
          align="center"
        />
        <div className="mt-14 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="flex h-36 items-center justify-center rounded-xl border border-line bg-paper-2 p-6 transition-shadow hover:shadow-lg hover:shadow-ink/5"
            >
              <Image
                src={partner.logo}
                alt={partner.name}
                width={partner.width}
                height={partner.height}
                className="h-full max-h-24 w-auto max-w-full object-contain"
              />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
