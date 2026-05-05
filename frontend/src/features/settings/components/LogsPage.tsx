import { useState, useMemo } from 'react'
import { Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Timeline } from '@/components/shared/Timeline'

// TODO: Replace with real API data
const MOCK_LOGS = [
  { id: 1, case_id: 1, case_name: '蓝鲸科技民事诉讼案', content: '案件已创建，关联合同：蓝鲸科技诉讼代理合同', actor: '陈律师', has_reminders: false, reminder_type: null as string | null, reminder_time: null as string | null, created_at: '2024-03-10 10:00' },
  { id: 2, case_id: 1, case_name: '蓝鲸科技民事诉讼案', content: '提交起诉状及证据材料至南山区人民法院', actor: '陈律师', has_reminders: true, reminder_type: '开庭', reminder_time: '2024-06-15 09:30', created_at: '2024-03-12 14:30' },
  { id: 3, case_id: 1, case_name: '蓝鲸科技民事诉讼案', content: '法院已立案，案号：（2024）粤0305民初1562号', actor: '系统', has_reminders: false, reminder_type: null, reminder_time: null, created_at: '2024-03-15 09:00' },
  { id: 4, case_id: 2, case_name: '深海世纪劳动仲裁案', content: '案件已创建，关联合同：深海世纪非诉法律服务合同', actor: '张律师', has_reminders: false, reminder_type: null, reminder_time: null, created_at: '2024-01-20 09:00' },
  { id: 5, case_id: 2, case_name: '深海世纪劳动仲裁案', content: '仲裁委已受理，案号：深劳人仲案[2024]892号', actor: '系统', has_reminders: true, reminder_type: '开庭', reminder_time: '2024-03-10 09:30', created_at: '2024-01-25 10:00' },
  { id: 6, case_id: 1, case_name: '蓝鲸科技民事诉讼案', content: '对方提交了反诉状，已转交当事人确认', actor: '陈律师', has_reminders: false, reminder_type: null, reminder_time: null, created_at: '2024-05-20 10:30' },
]

function relativeDate(dt: string): string {
  const now = new Date()
  const d = new Date(dt.replace(/ /, 'T'))
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return dt.slice(0, 10)
}

export function LogsPage() {
  const [search, setSearch] = useState('')
  const [caseFilter, setCaseFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')

  const filtered = useMemo(() => {
    return MOCK_LOGS.filter((log) => {
      if (search && !log.content.toLowerCase().includes(search.toLowerCase()) && !log.case_name.toLowerCase().includes(search.toLowerCase())) return false
      if (caseFilter && String(log.case_id) !== caseFilter) return false
      if (actorFilter && log.actor !== actorFilter) return false
      return true
    })
  }, [search, caseFilter, actorFilter])

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {}
    filtered.forEach((log) => {
      const dateKey = log.created_at.slice(0, 10)
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(log)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">日志</h1>
          <p className="text-muted-foreground text-sm mt-1">查看所有案件的操作日志和时间线</p>
        </div>
        <Button size="sm"><Plus className="mr-1.5 size-4" />添加日志</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input type="text" placeholder="搜索日志内容、案件名称..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={caseFilter}
          onChange={(e) => setCaseFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">全部案件</option>
          <option value="1">蓝鲸科技民事诉讼案</option>
          <option value="2">深海世纪劳动仲裁案</option>
        </select>
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">全部操作人</option>
          <option value="陈律师">陈律师</option>
          <option value="张律师">张律师</option>
          <option value="系统">系统</option>
        </select>
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground text-sm">暂无日志</div>
      ) : (
        <div className="rounded-lg border p-6">
          <Timeline
            groups={grouped.map(([dateKey, logs]) => ({
              date: `${dateKey} (${relativeDate(dateKey + ' 00:00:00')})`,
              items: logs.map((log) => ({
                id: log.id,
                date: log.created_at.slice(11),
                title: `${log.actor} - ${log.case_name}`,
                description: log.content,
                badge: log.has_reminders && log.reminder_type ? (
                  <Badge variant="outline" className="text-[11px] ml-2">
                    {log.reminder_type}{log.reminder_time ? ` · ${log.reminder_time}` : ''}
                  </Badge>
                ) : undefined,
              })),
            }))}
          />
        </div>
      )}
    </div>
  )
}

export default LogsPage
