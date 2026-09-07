'use client'

import { useEffect } from 'react'
import { initTokenRefresh } from '@/lib/auth/tokenRefresh'

export default function TokenRefreshInit() {
  useEffect(() => {
    initTokenRefresh()
  }, [])

  return null
}
