import { useMutation, useQueryClient } from '@tanstack/react-query'

import { caseApi } from '../api'
import type { CaseLog, CaseLogAttachment } from '../types'
import { caseQueryKey } from './use-case'
import { caseLogQueryKey } from './use-case-log'
import { caseLogsQueryKey } from './use-case-logs'

interface CreateLogParams {
  case_id: number
  content: string
  stage?: string | null
  note?: string | null
  logged_at?: string | null
  log_type?: string | null
  source?: string | null
  is_pinned?: boolean
}

interface UpdateLogParams {
  id: number | string
  data: {
    case_id?: number
    content?: string
    stage?: string | null
    note?: string | null
    logged_at?: string | null
    log_type?: string | null
    source?: string | null
    is_pinned?: boolean
  }
}

interface UploadAttachmentsParams {
  logId: number | string
  files: File[]
}

export function useLogMutations(caseId: number | string, logId?: number | string) {
  const queryClient = useQueryClient()

  const invalidateCase = () => {
    queryClient.invalidateQueries({ queryKey: caseQueryKey(caseId) })
    queryClient.invalidateQueries({ queryKey: caseLogsQueryKey(caseId) })
    if (logId) {
      queryClient.invalidateQueries({ queryKey: caseLogQueryKey(logId) })
    }
  }

  const createLog = useMutation<CaseLog, Error, CreateLogParams>({
    mutationFn: (data) => caseApi.createLog(data),
    onSuccess: invalidateCase,
  })

  const updateLog = useMutation<CaseLog, Error, UpdateLogParams>({
    mutationFn: ({ id, data }) => caseApi.updateLog(id, data),
    onSuccess: invalidateCase,
  })

  const deleteLog = useMutation<void, Error, number | string>({
    mutationFn: (id) => caseApi.deleteLog(id),
    onSuccess: invalidateCase,
  })

  const uploadAttachments = useMutation<CaseLogAttachment[], Error, UploadAttachmentsParams>({
    mutationFn: ({ logId, files }) => caseApi.uploadLogAttachments(logId, files),
    onSuccess: invalidateCase,
  })

  const deleteAttachment = useMutation<void, Error, number | string>({
    mutationFn: (attachmentId) => caseApi.deleteLogAttachment(attachmentId),
    onSuccess: invalidateCase,
  })

  return { createLog, updateLog, deleteLog, uploadAttachments, deleteAttachment }
}

export default useLogMutations
