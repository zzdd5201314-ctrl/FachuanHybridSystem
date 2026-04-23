import { describe, expect, it } from 'vitest'

import { getVisibleCaseLogs } from '../log-list'
import type { CaseLog } from '../types'

function buildLog(overrides: Partial<CaseLog>): CaseLog {
  return {
    id: 1,
    case: 1,
    case_name: 'Test Case',
    contract_id: null,
    contract_name: null,
    stage: null,
    note: null,
    logged_at: null,
    log_type: null,
    source: null,
    is_pinned: false,
    content: 'default content',
    actor: 1,
    actor_detail: {
      id: 1,
      username: 'tester',
      real_name: 'Tester',
      phone: null,
    },
    attachments: [],
    reminders: [],
    created_at: '2026-04-20T10:00:00Z',
    updated_at: '2026-04-20T10:00:00Z',
    ...overrides,
  }
}

describe('getVisibleCaseLogs', () => {
  it('preserves backend order when no filters are applied', () => {
    const logs = [
      buildLog({ id: 7, is_pinned: true, logged_at: '2026-04-22T10:00:00Z' }),
      buildLog({ id: 5, stage: 'first_trial', logged_at: '2026-04-21T09:00:00Z' }),
      buildLog({ id: 3, stage: 'enforcement', logged_at: '2026-04-20T08:00:00Z' }),
    ]

    const visibleLogs = getVisibleCaseLogs(logs, {
      stageFilter: 'all',
      attachmentFilter: 'all',
      keyword: '',
    })

    expect(visibleLogs.map((log) => log.id)).toEqual([7, 5, 3])
  })

  it('filters matching logs without reordering the remaining items', () => {
    const logs = [
      buildLog({
        id: 9,
        stage: 'first_trial',
        content: '庭审准备已完成',
        attachments: [
          { id: 1, log: 9, file_path: '/files/a.pdf', media_url: null, uploaded_at: '2026-04-22T10:00:00Z' },
        ],
      }),
      buildLog({
        id: 6,
        stage: 'enforcement',
        content: '执行线索待补充',
      }),
      buildLog({
        id: 4,
        stage: 'first_trial',
        content: '庭审记录补录',
        attachments: [
          { id: 2, log: 4, file_path: '/files/b.pdf', media_url: null, uploaded_at: '2026-04-22T11:00:00Z' },
        ],
      }),
    ]

    const visibleLogs = getVisibleCaseLogs(logs, {
      stageFilter: 'first_trial',
      attachmentFilter: 'with',
      keyword: '庭审',
    })

    expect(visibleLogs.map((log) => log.id)).toEqual([9, 4])
  })
})
