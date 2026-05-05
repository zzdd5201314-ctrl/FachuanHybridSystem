import { useQuery } from '@tanstack/react-query'
import { templateApi } from '../api'
import type { Template } from '../types'

export function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => templateApi.list() as Promise<Template[]>,
    staleTime: 60 * 1000,
  })
}
