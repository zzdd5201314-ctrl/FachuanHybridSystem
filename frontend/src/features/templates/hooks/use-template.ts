import { useQuery } from '@tanstack/react-query'
import { templateApi } from '../api'
import type { Template } from '../types'

export function useTemplate(id: number) {
  return useQuery<Template>({
    queryKey: ['templates', id],
    queryFn: () => templateApi.get(id) as Promise<Template>,
    enabled: !!id,
  })
}
