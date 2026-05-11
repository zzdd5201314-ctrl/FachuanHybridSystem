import { useQuery } from '@tanstack/react-query'
import { templateApi } from '../api'

export function useTemplateLibraryFiles() {
  return useQuery({
    queryKey: ['template-library-files'],
    queryFn: () => templateApi.listLibraryFiles(),
    staleTime: 5 * 60 * 1000,
  })
}
