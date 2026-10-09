import type { Metadata } from "next";
import { ContactContent } from "@/components/ContactContent";

export const metadata: Metadata = {
  title: "Contact — Réservez votre démonstration",
  description:
    "Contactez l'équipe ExtincPro pour réserver une démonstration personnalisée de la plateforme d'inspection d'extincteurs.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <ContactContent />;
}
