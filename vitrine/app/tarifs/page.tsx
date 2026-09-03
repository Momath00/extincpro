import type { Metadata } from "next";
import { TarifsContent } from "@/components/TarifsContent";

export const metadata: Metadata = {
  title: "Tarifs — Un module par système, abonnement annuel",
  description:
    "ExtincPro se souscrit module par module (inspection sécurité incendie, extincteurs, éclairage d'urgence, gicleurs), par abonnement annuel, avec 1 mois d'essai gratuit et sans carte de crédit.",
  alternates: { canonical: "/tarifs" },
};

export default function TarifsPage() {
  return <TarifsContent />;
}
