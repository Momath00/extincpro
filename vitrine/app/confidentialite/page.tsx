import type { Metadata } from "next";
import { ConfidentialiteContent } from "@/components/ConfidentialiteContent";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: `Politique de confidentialité de ${site.name}.`,
  alternates: { canonical: "/confidentialite" },
  robots: { index: false, follow: true },
};

export default function ConfidentialitePage() {
  return <ConfidentialiteContent />;
}
