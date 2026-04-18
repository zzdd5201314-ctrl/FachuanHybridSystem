import { useNavigate } from 'react-router'
import { ArrowRight, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { generatePath } from '@/routes/paths'

import type { CaseLog } from '../types'

export interface CaseLogSectionProps {
  logs: CaseLog[]
  editable?: boolean
  caseId?: number
}

function formatLatestTime(logs: CaseLog[]): string {
  if (logs.length === 0) return '还没有日志记录'
  const latest = [...logs]
    .sort((left, right) => {
      const leftTime = new Date(left.logged_at || left.created_at).getTime()
      const rightTime = new Date(right.logged_at || right.created_at).getTime()
      return rightTime - leftTime
    })[0]

  const date = new Date(latest.logged_at || latest.created_at)
  if (Number.isNaN(date.getTime())) return '已存在日志'

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function CaseLogSection({ logs, caseId }: CaseLogSectionProps) {
  const navigate = useNavigate()
  const count = logs.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>案件日志</CardTitle>
        <CardDescription>
          日志已改为在独立台账页维护，这里只保留入口，不再把所有日志堆在当前页面。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="bg-muted flex size-10 items-center justify-center rounded-full">
            <FileText className="text-muted-foreground size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">共 {count} 条日志</p>
            <p className="text-muted-foreground text-sm">最近一条：{formatLatestTime(logs)}</p>
          </div>
        </div>
        <Button
          onClick={() => caseId && navigate(generatePath.caseLogDetail(String(caseId)))}
          disabled={!caseId}
        >
          打开日志台账
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

export default CaseLogSection
