import Link from "next/link";
import { Logo } from "./Logo";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink text-white/70">
      <div className="container-px mx-auto max-w-7xl py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              Le logiciel qui gère l&apos;inspection, les rapports et la
              conformité de vos systèmes de sécurité incendie — du terrain
              jusqu&apos;à la direction.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Navigation</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {site.nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-white/55 hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Plateforme</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/contact" className="text-white/55 hover:text-white">
                  Demander une démo
                </Link>
              </li>
              <li>
                <Link href="/tarifs" className="text-white/55 hover:text-white">
                  Voir les tarifs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Contact</h3>
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
          <p>© {new Date().getFullYear()} {site.legalName}. Tous droits réservés.</p>
          <div className="flex gap-5">
            {site.legalNav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white/70">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
