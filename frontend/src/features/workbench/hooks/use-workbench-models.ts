/** 工作台模型列表 Hook */

import { useQuery } from '@tanstack/react-query'
import { fetchModels } from '../api'

export function useWorkbenchModels() {
  return useQuery({
    queryKey: ['workbench-models'],
    queryFn: fetchModels,
    staleTime: 5 * 60 * 1000,
  })
}
