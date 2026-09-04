'use client'

import type { Langue } from '@/lib/i18n'

export default function LangueToggleAuth({ langue, onChange }: { langue: Langue; onChange: (l: Langue) => void }) {
  return (
    <div className="fixed top-4 right-4 flex gap-1 p-1 rounded-md border border-white/10 bg-white/5 backdrop-blur-sm z-10">
      {([
        { key: 'fr', label: 'FR' },
        { key: 'en', label: 'EN' },
      ] as { key: Langue; label: string }[]).map(l => (
        <button
          key={l.key}
          type="button"
          onClick={() => onChange(l.key)}
          className="px-2.5 py-1 rounded text-[11px] font-bold transition-colors"
          style={{
            background: langue === l.key ? '#e11324' : 'transparent',
            color: langue === l.key ? '#fff' : 'rgba(255,255,255,0.5)',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
