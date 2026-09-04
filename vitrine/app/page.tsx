import type { Metadata } from "next";
import { HomeContent } from "@/components/HomeContent";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${site.name} — Logiciel d'inspection et de conformité incendie`,
  description: site.description,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <HomeContent />;
}
