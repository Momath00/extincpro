'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const RED = '#0f172a'
const ACCENT = '#dc2626'

const NAV_GROUPS = [
  {
    label: 'Général',
    items: [{ href: '/super-admin', label: 'Tableau de bord', icon: 'ti-layout-dashboard' }],
  },
  {
    label: 'Plateforme',
    items: [
      { href: '/super-admin/organisations', label: 'Organisations', icon: 'ti-building-skyscraper' },
    ],
  },
]

export default function SuperAdminSidebar({ user, onClose }: { user: any; onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_username')
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-full" style={{ background: RED }}>
      <div className="relative px-5 pt-7 pb-6 text-center flex-shrink-0">
        {onClose && (
          <button onClick={onClose} className="absolute top-3 right-3 text-white/50 hover:text-white md:hidden">
            <i className="ti ti-x text-lg" />
          </button>
        )}
        <div className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: ACCENT }}>
          <i className="ti ti-shield-lock text-white text-2xl" />
        </div>
        <p className="text-white text-sm font-bold tracking-wide">EXTINCPRO</p>
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mt-0.5">Super admin</p>
      </div>

      <nav className="flex-1 px-3 pb-4 flex flex-col gap-6 overflow-y-auto border-t border-white/10 pt-6">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/35">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onClose?.()}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
                    style={{
                      background: active ? ACCENT : 'transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                      boxShadow: active ? '0 2px 8px rgba(220,38,38,0.35)' : 'none',
                    }}
                  >
                    <i className={`ti ${item.icon} text-base`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-5 pt-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: ACCENT }}>
            {user?.username?.[0]?.toUpperCase() || 'S'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.username}</p>
            <p className="text-white/40 text-[10px]">Super admin</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <i className="ti ti-logout" /> Se déconnecter
        </button>
      </div>
    </div>
  )
}
