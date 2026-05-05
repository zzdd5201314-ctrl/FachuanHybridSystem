import { useQuery } from '@tanstack/react-query'
import { createApiClient } from '@/lib/api'
import type { Lawyer } from '../types'

const api = createApiClient({ prefixUrl: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002/api/v1'}/organization` })

export function useLawyers() {
  return useQuery<Lawyer[]>({
    queryKey: ['lawyers'],
    queryFn: () => api.get('lawyers').json<Lawyer[]>(),
    staleTime: 10 * 60 * 1000,
  })
}
