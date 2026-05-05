/**
 * useClients Hook
 * 当事人列表查询 hook（前端客户端分页）
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query'

import { clientApi } from '../api'
import type { Client, ClientType } from '../types'

export interface UseClientsParams {
  page?: number
  pageSize?: number
  search?: string
  clientType?: ClientType
  isOurClient?: boolean
}

interface ClientListResult {
  items: Client[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export const clientsQueryKey = (params: UseClientsParams) => [
  'clients', { search: params.search ?? '', clientType: params.clientType ?? null, isOurClient: params.isOurClient ?? null },
] as const

export function useClients(params: UseClientsParams = {}) {
  const { page = 1, pageSize = 20, search, clientType, isOurClient } = params

  return useQuery<ClientListResult>({
    queryKey: [...clientsQueryKey(params), page, pageSize],
    queryFn: async () => {
      const all = await clientApi.list({
        search: search || undefined,
        client_type: clientType,
        is_our_client: isOurClient,
      })
      const total = all.length
      const totalPages = Math.ceil(total / pageSize) || 1
      const start = (page - 1) * pageSize
      return {
        items: all.slice(start, start + pageSize),
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
      }
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

export default useClients
