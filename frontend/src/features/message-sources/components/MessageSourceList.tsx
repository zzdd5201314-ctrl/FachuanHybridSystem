import { Plus, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { useMessageSources } from '../hooks/use-message-sources'
import {
  SOURCE_TYPE_LABELS, SYNC_STATUS_LABELS,
  type SourceType, type SyncStatus,
} from '../types'

function TableSkeleton() {
  return (
    <>{Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={i}>
        {[40, 120, 100, 140, 60, 80, 120, 100, 120].map((w, j) => (
          <TableCell key={j}><div className={`bg-muted h-4 w-${Math.round(w / 8)} animate-pulse rounded`} /></TableCell>
        ))}
      </TableRow>
    ))}</>
  )
}

export function MessageSourceList() {
  const { data: sources, isLoading } = useMessageSources()

  const sourceList = sources ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">消息来源</h1>
          <p className="text-muted-foreground text-sm mt-1">管理 IMAP 邮箱和一张网收件箱的消息同步配置</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><RefreshCw className="mr-1.5 size-4" />全部同步</Button>
          <Button size="sm"><Plus className="mr-1.5 size-4" />添加来源</Button>
        </div>
      </div>

      {/* Table */}
      {sourceList.length === 0 && !isLoading ? (
        <EmptyState
          icon="inbox"
          title="暂无消息来源"
          description="还没有配置消息来源，添加 IMAP 邮箱或一张网收件箱来开始同步消息"
          actionText="添加来源"
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">ID</TableHead>
                <TableHead>显示名称</TableHead>
                <TableHead className="w-[120px]">来源类型</TableHead>
                <TableHead className="w-[150px]">账号</TableHead>
                <TableHead className="w-[60px]">启用</TableHead>
                <TableHead className="w-[90px]">轮询间隔</TableHead>
                <TableHead className="w-[130px]">最后同步</TableHead>
                <TableHead className="w-[100px]">同步状态</TableHead>
                <TableHead className="w-[120px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton /> : sourceList.map((s) => {
                const typeKey = s.source_type as SourceType
                const syncKey = s.last_sync_status as SyncStatus
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground text-sm">{s.id}</TableCell>
                    <TableCell className="font-medium text-sm">{s.display_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{SOURCE_TYPE_LABELS[typeKey] ?? s.source_type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.credential_account}</TableCell>
                    <TableCell>
                      {s.is_enabled
                        ? <span className="text-status-green text-sm">●</span>
                        : <span className="text-muted-foreground text-sm">○</span>}
                    </TableCell>
                    <TableCell className="text-sm">{s.poll_interval_minutes} 分钟</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.last_sync_at || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={syncKey === 'success' ? 'default' : syncKey === 'failed' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {SYNC_STATUS_LABELS[syncKey] ?? s.last_sync_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs">同步</Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs">编辑</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export default MessageSourceList
