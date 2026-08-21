'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const NAV_LINKS = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#a-propos', label: 'À propos' },
  { href: '#contact', label: 'Contact' },
]

export default function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <header
      className={`sticky top-0 z-50 bg-white border-b ${
        scrolled ? 'border-gray-200 shadow-sm' : 'border-gray-100'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <img
            src="/logo.svg"
            alt="Extincteurs Nationex"
            className="w-auto h-9"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-bold">
          {NAV_LINKS.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="py-1 text-[#0f172a] hover:text-[#dc2626]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-bold text-white bg-[#dc2626] px-5 py-2.5 rounded-md hover:bg-[#e35c0f]"
          >
            Se connecter
          </Link>
        </div>

        <button
          className="md:hidden relative w-9 h-9 flex flex-col items-center justify-center gap-1.5"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          {open ? (
            <i className="ti ti-x text-xl text-[#0f172a]" />
          ) : (
            <>
              <span className="block w-6 h-0.5 bg-[#0f172a]" />
              <span className="block w-6 h-0.5 bg-[#0f172a]" />
              <span className="block w-6 h-0.5 bg-[#0f172a]" />
            </>
          )}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <nav className="flex flex-col px-4 py-4 gap-1">
            {NAV_LINKS.map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-bold text-[#0f172a] border-b border-gray-100 last:border-b-0"
              >
                {item.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="text-center text-sm font-bold text-white bg-[#dc2626] rounded-md py-2.5"
              >
                Se connecter
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
