import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { site } from "@/lib/site";
import { LangueProvider } from "@/lib/i18n";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  keywords: [
    "plateforme incendie",
    "logiciel incendie",
    "inspection incendie",
    "inspection extincteur",
    "inspection sécurité incendie",
    "inspection extincteurs",
    "logiciel inspection extincteur",
    "inspection éclairage d'urgence",
    "inspection gicleurs",
    "conformité incendie",
    "gestion extincteurs Québec",
    "rapport extincteur",
    "logiciel sécurité incendie",
  ],
  authors: [{ name: site.name }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    images: [{ url: site.ogImage, width: 1200, height: 630, alt: site.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    images: [site.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: site.description,
  url: site.url,
  offers: {
    "@type": "Offer",
    priceCurrency: "CAD",
    category: "Abonnement annuel",
  },
  provider: {
    "@type": "Organization",
    name: site.legalName,
    url: site.url,
    telephone: site.phone,
    email: site.email,
    address: site.address,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr-CA">
      <body className={`${inter.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <LangueProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </LangueProvider>
      </body>
    </html>
  );
}
