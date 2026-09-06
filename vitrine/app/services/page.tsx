import type { Metadata } from "next";
import { ServicesContent } from "@/components/ServicesContent";

export const metadata: Metadata = {
  title: "Services — Logiciel d'inspection incendie complet",
  description:
    "Inspection terrain, rapports numériques, conformité centralisée et gestion multi-organisations : découvrez tout ce que le logiciel ExtincPro gère pour vos extincteurs, votre éclairage d'urgence et votre système de cuisine.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return <ServicesContent />;
}
