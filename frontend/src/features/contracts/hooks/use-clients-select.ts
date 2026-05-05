import { useQuery } from '@tanstack/react-query'
import { createApiClient } from '@/lib/api'

interface ClientOption { id: number; name: string; client_type: string; client_type_label: string; is_our_client: boolean }

const api = createApiClient({ prefixUrl: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002/api/v1'}/client` })

export function useClientsSelect() {
  return useQuery<ClientOption[]>({
    queryKey: ['clients-select'],
    queryFn: () => api.get('clients').json<ClientOption[]>(),
    staleTime: 10 * 60 * 1000,
  })
}
