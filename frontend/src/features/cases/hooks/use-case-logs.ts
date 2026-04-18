import { useQuery } from '@tanstack/react-query'

import { caseApi } from '../api'
import type { CaseLog } from '../types'

export const caseLogsQueryKey = (caseId: number | string) => ['case', caseId, 'logs'] as const

export function useCaseLogs(caseId: number | string) {
  return useQuery<CaseLog[]>({
    queryKey: caseLogsQueryKey(caseId),
    queryFn: () => caseApi.listLogs(caseId),
    enabled: !!caseId,
    staleTime: 60 * 1000,
  })
}

export default useCaseLogs
