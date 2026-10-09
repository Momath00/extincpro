import type { Metadata } from "next";
import { TarifsContent } from "@/components/TarifsContent";

export const metadata: Metadata = {
  title: "Tarifs — Un module par système, abonnement annuel",
  description:
    "ExtincPro se souscrit module par module (système d'alarme, extincteurs & éclairage d'urgence, système de cuisine, gicleurs), par abonnement annuel payable en une fois ou par mois, avec une démonstration personnalisée avant de vous abonner.",
  alternates: { canonical: "/tarifs" },
};

export default function TarifsPage() {
  return <TarifsContent />;
}
