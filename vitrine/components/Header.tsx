"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { site } from "@/lib/site";
import { useT } from "@/lib/i18n";
import { LangueToggle } from "./LangueToggle";

const NAV_KEYS: Record<string, string> = {
  "/": "nav_accueil",
  "/services": "nav_services",
  "/tarifs": "nav_tarifs",
  "/a-propos": "nav_a_propos",
  "/contact": "nav_contact",
};

export function Header() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink">
      <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between lg:h-20">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex">
          {site.nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium tracking-wide transition-colors ${
                  active ? "text-white" : "text-white/65 hover:text-white"
                }`}
              >
                {t(NAV_KEYS[item.href] ?? item.href)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LangueToggle />
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-md bg-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-bright"
          >
            {t("essai_gratuit_1_mois")}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t("ouvrir_menu")}
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-md text-white lg:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-ink lg:hidden">
          <nav className="container-px mx-auto flex max-w-7xl flex-col gap-1 py-4">
            {site.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/5 hover:text-white"
              >
                {t(NAV_KEYS[item.href] ?? item.href)}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-3 border-t border-white/10 px-3 pt-4">
              <LangueToggle />
              <Link
                href="/contact"
                className="rounded-md bg-red py-2.5 text-center text-sm font-semibold text-white"
              >
                {t("essai_gratuit_1_mois")}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
