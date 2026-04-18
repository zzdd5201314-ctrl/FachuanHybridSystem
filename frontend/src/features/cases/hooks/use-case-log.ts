import { useQuery } from '@tanstack/react-query'

import { caseApi } from '../api'
import type { CaseLog } from '../types'

export const caseLogQueryKey = (logId: number | string) => ['case-log', logId] as const

export function useCaseLog(logId: number | string) {
  return useQuery<CaseLog>({
    queryKey: caseLogQueryKey(logId),
    queryFn: () => caseApi.getLog(logId),
    enabled: !!logId,
    staleTime: 60 * 1000,
  })
}

export default useCaseLog
