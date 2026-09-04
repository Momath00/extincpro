"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";

const NAV_KEYS: Record<string, string> = {
  "/": "nav_accueil",
  "/services": "nav_services",
  "/tarifs": "nav_tarifs",
  "/a-propos": "nav_a_propos",
  "/contact": "nav_contact",
};

const LEGAL_NAV_KEYS: Record<string, string> = {
  "/mentions-legales": "nav_mentions_legales",
  "/confidentialite": "nav_confidentialite",
};

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-white/10 bg-ink text-white/70">
      <div className="container-px mx-auto max-w-7xl py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              {t("footer_tagline")}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">{t("navigation_titre")}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {site.nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-white/55 hover:text-white">
                    {t(NAV_KEYS[item.href] ?? item.href)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">{t("plateforme_titre")}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/contact" className="text-white/55 hover:text-white">
                  {t("demander_une_demo")}
                </Link>
              </li>
              <li>
                <Link href="/tarifs" className="text-white/55 hover:text-white">
                  {t("voir_les_tarifs")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">{t("contact_titre")}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href={`tel:${site.phoneHref}`} className="text-white/55 hover:text-white">
                  {site.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`} className="text-white/55 hover:text-white">
                  {site.email}
                </a>
              </li>
              <li className="text-white/55">{site.address}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {site.legalName}. {t("tous_droits_reserves")}</p>
          <div className="flex gap-5">
            {site.legalNav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white/70">
                {t(LEGAL_NAV_KEYS[item.href] ?? item.href)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
