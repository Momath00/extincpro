import type { Metadata } from "next";
import { ContactContent } from "@/components/ContactContent";

export const metadata: Metadata = {
  title: "Contact — Démarrez votre essai gratuit",
  description:
    "Contactez l'équipe ExtincPro pour démarrer votre essai gratuit d'un mois ou obtenir une démo de la plateforme d'inspection d'extincteurs.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <ContactContent />;
}
