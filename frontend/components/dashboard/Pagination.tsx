'use client'

import { useT } from '@/lib/i18n'

const NAVY = '#0a0b0d'

function pagesAAfficher(page: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const liste = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const resultat: (number | '...')[] = []
  liste.forEach((p, i) => {
    if (i > 0 && p - (liste[i - 1] as number) > 1) resultat.push('...')
    resultat.push(p)
  })
  return resultat
}

/**
 * Pagination numérotée partagée par les listes de rapports (incendie,
 * extincteur, éclairage d'urgence, cuisine) — même composant, même
 * comportement partout, branché sur `count`/`page_size` retournés par
 * l'API (DRF PageNumberPagination).
 */
export default function Pagination({
  page,
  pageSize,
  count,
  onPageChange,
}: {
  page: number
  pageSize: number
  count: number
  onPageChange: (page: number) => void
}) {
  const t = useT()
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  if (totalPages <= 1) return null

  const debut = (page - 1) * pageSize + 1
  const fin = Math.min(page * pageSize, count)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-4">
      <p className="text-xs text-gray-400">
        {t('affichage')} <span className="font-semibold text-gray-600">{debut}–{fin}</span> {t('sur')} <span className="font-semibold text-gray-600">{count}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title={t('page_precedente')}
        >
          <i className="ti ti-chevron-left text-sm" />
        </button>
        {pagesAAfficher(page, totalPages).map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-300">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-colors"
              style={p === page ? { background: NAVY, color: '#fff' } : { color: '#6b7280' }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title={t('page_suivante')}
        >
          <i className="ti ti-chevron-right text-sm" />
        </button>
      </div>
    </div>
  )
}
