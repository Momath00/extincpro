import type { Metadata } from "next";
import { MentionsLegalesContent } from "@/components/MentionsLegalesContent";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: `Mentions légales de ${site.name}.`,
  alternates: { canonical: "/mentions-legales" },
  robots: { index: false, follow: true },
};

export default function MentionsLegalesPage() {
  return <MentionsLegalesContent />;
}
