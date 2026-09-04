import type { Metadata } from "next";
import { AProposContent } from "@/components/AProposContent";

export const metadata: Metadata = {
  title: "À propos — Notre mission",
  description:
    "ExtincPro modernise l'inspection et la conformité des extincteurs pour les entreprises de sécurité incendie. Découvrez notre mission et notre approche.",
  alternates: { canonical: "/a-propos" },
};

export default function AProposPage() {
  return <AProposContent />;
}
