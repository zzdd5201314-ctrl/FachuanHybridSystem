import type { CaseLog } from './types'

export type CaseLogAttachmentFilter = 'all' | 'with' | 'without'

export interface CaseLogFilterOptions {
  stageFilter: string
  attachmentFilter: CaseLogAttachmentFilter
  keyword: string
}

export function matchesCaseLogFilters(
  log: CaseLog,
  stageFilter: string,
  attachmentFilter: CaseLogAttachmentFilter,
  keyword: string,
) {
  if (stageFilter && log.stage !== stageFilter) return false

  const hasAttachments = (log.attachments ?? []).length > 0
  if (attachmentFilter === 'with' && !hasAttachments) return false
  if (attachmentFilter === 'without' && hasAttachments) return false

  if (keyword) {
    const haystack = [log.content, log.note ?? ''].join('\n').toLowerCase()
    if (!haystack.includes(keyword.toLowerCase())) return false
  }

  return true
}

export function getVisibleCaseLogs(logs: readonly CaseLog[], filters: CaseLogFilterOptions): CaseLog[] {
  const stageFilter = filters.stageFilter === 'all' ? '' : filters.stageFilter
  const keyword = filters.keyword.trim()

  return logs.filter((log) =>
    matchesCaseLogFilters(log, stageFilter, filters.attachmentFilter, keyword),
  )
}
