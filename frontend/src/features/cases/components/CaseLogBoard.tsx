import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, ExternalLink, FileText, Loader2, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { generatePath, PATHS } from '@/routes/paths'

import { useCase } from '../hooks/use-case'
import { useCaseLogs } from '../hooks/use-case-logs'
import { useLogMutations } from '../hooks/use-log-mutations'
import {
  CASE_STAGE_LABELS,
  CASE_STATUS_LABELS,
  type CaseLog,
  type CaseStage,
  type CaseStatus,
} from '../types'

type AttachmentFilter = 'all' | 'with' | 'without'

interface CaseLogBoardProps {
  caseId: string
}

function getCaseNumbersText(caseNumbers: { number: string }[] | undefined): string {
  if (!caseNumbers || caseNumbers.length === 0) return '未录入案号'
  return caseNumbers.map((item) => item.number).filter(Boolean).join(' / ')
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function sortLogs(logs: CaseLog[]): CaseLog[] {
  return [...logs].sort((left, right) => {
    const leftTime = new Date(left.logged_at || left.created_at).getTime()
    const rightTime = new Date(right.logged_at || right.created_at).getTime()
    return leftTime - rightTime
  })
}

function matchesLogFilters(log: CaseLog, stageFilter: string, attachmentFilter: AttachmentFilter, keyword: string) {
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

function EmptyBoard({ createUrl, hasFilters }: { createUrl: string; hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center">
      <div className="bg-muted mb-4 flex size-12 items-center justify-center rounded-full">
        <FileText className="text-muted-foreground size-6" />
      </div>
      <p className="text-sm font-medium">
        {hasFilters ? '没有符合当前筛选条件的日志' : '这个案件还没有日志'}
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        {hasFilters ? '调整右侧过滤器后再试试。' : '点击新增日志，录入这个案件的第一条日志。'}
      </p>
      <Button className="mt-4" asChild>
        <Link to={createUrl}>
          <Plus className="mr-2 size-4" />
          新增日志
        </Link>
      </Button>
    </div>
  )
}

function LogActionMenu({
  caseId,
  log,
  onDeleteRequest,
}: {
  caseId: string
  log: CaseLog
  onDeleteRequest: (log: CaseLog) => void
}) {
  const navigate = useNavigate()

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            动作
            <MoreHorizontal className="ml-2 size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => navigate(generatePath.caseLogEdit(caseId, String(log.id)))}
          >
            修改日志
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onDeleteRequest(log)}>
            <Trash2 className="size-4" />
            删除日志
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function CaseLogBoard({ caseId }: CaseLogBoardProps) {
  const navigate = useNavigate()
  const { data: caseData, isLoading: caseLoading } = useCase(caseId)
  const { data: logs = [], isLoading: logsLoading } = useCaseLogs(caseId)
  const mutations = useLogMutations(caseId)

  const [stageFilter, setStageFilter] = useState<string>('all')
  const [attachmentFilter, setAttachmentFilter] = useState<AttachmentFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CaseLog | null>(null)

  const sortedLogs = useMemo(() => sortLogs(logs), [logs])
  const filteredLogs = useMemo(
    () =>
      sortedLogs.filter((log) =>
        matchesLogFilters(log, stageFilter === 'all' ? '' : stageFilter, attachmentFilter, keyword.trim()),
      ),
    [attachmentFilter, keyword, sortedLogs, stageFilter],
  )

  if (caseLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate(PATHS.ADMIN_LOGS)}>
          <ArrowLeft className="mr-2 size-4" />
          返回日志列表
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            未找到对应案件，无法打开日志台账。
          </CardContent>
        </Card>
      </div>
    )
  }

  const createUrl = generatePath.caseLogNew(String(caseData.id))
  const statusKey = caseData.status as CaseStatus | null
  const statusLabel = statusKey
    ? (CASE_STATUS_LABELS[statusKey]?.zh ?? caseData.status)
    : '未设置'
  const caseNumbersText = getCaseNumbersText(caseData.case_numbers)
  const hasFilters = stageFilter !== 'all' || attachmentFilter !== 'all' || keyword.trim().length > 0

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <Button variant="ghost" className="w-fit px-0" onClick={() => navigate(PATHS.ADMIN_LOGS)}>
              <ArrowLeft className="mr-2 size-4" />
              返回日志列表
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{caseData.name}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{caseNumbersText}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusKey === 'active' ? 'default' : 'secondary'}>{statusLabel}</Badge>
              {caseData.current_stage && (
                <Badge variant="outline">
                  {CASE_STAGE_LABELS[caseData.current_stage as CaseStage]?.zh ?? caseData.current_stage}
                </Badge>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>日志台账</CardTitle>
              <CardDescription>点击某一条日志即可进入修改页面，右侧可以按阶段、附件和关键词筛选。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild>
                    <Link to={generatePath.caseDetail(String(caseData.id))}>
                      <ExternalLink className="mr-2 size-4" />
                      打开案件详情
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link to={createUrl}>
                      <Plus className="mr-2 size-4" />
                      新增日志
                    </Link>
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm">
                  当前显示 <span className="text-foreground font-medium">{filteredLogs.length}</span> / {sortedLogs.length} 条日志
                </p>
              </div>

              {logsLoading && sortedLogs.length === 0 ? (
                <div className="flex min-h-[240px] items-center justify-center">
                  <Loader2 className="text-muted-foreground size-8 animate-spin" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <EmptyBoard createUrl={createUrl} hasFilters={hasFilters} />
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table className="min-w-[1120px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">序号</TableHead>
                        <TableHead className="w-44">阶段</TableHead>
                        <TableHead className="w-[340px]">日志内容</TableHead>
                        <TableHead className="w-56">时间</TableHead>
                        <TableHead className="w-[260px]">备注</TableHead>
                        <TableHead className="w-[240px]">附件</TableHead>
                        <TableHead className="w-[120px] text-right">动作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log, index) => {
                        const editUrl = generatePath.caseLogEdit(String(caseData.id), String(log.id))

                        return (
                          <TableRow
                            key={log.id}
                            className="cursor-pointer align-top transition-colors hover:bg-muted/50"
                            onClick={() => navigate(editUrl)}
                          >
                            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                            <TableCell>
                              {log.stage ? (
                                CASE_STAGE_LABELS[log.stage as CaseStage]?.zh ?? log.stage
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-pre-wrap text-sm leading-6">
                              {log.content || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDateTime(log.logged_at || log.created_at)}
                            </TableCell>
                            <TableCell className="whitespace-pre-wrap text-sm leading-6">
                              {log.note || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                {(log.attachments ?? []).length === 0 ? (
                                  <span className="text-muted-foreground text-sm">-</span>
                                ) : (
                                  log.attachments.map((attachment) => (
                                    <a
                                      key={attachment.id}
                                      href={attachment.media_url ?? attachment.file_path ?? '#'}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                      className="block truncate text-sm text-primary hover:underline"
                                    >
                                      {attachment.file_path?.split('/').pop() ?? `附件 ${attachment.id}`}
                                    </a>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <LogActionMenu
                                caseId={String(caseData.id)}
                                log={log}
                                onDeleteRequest={(target) => setDeleteTarget(target)}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">过滤器</CardTitle>
            <CardDescription>按阶段、附件和关键词快速定位日志。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">关键词</label>
              <div className="relative">
                <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索日志内容或备注"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">阶段</label>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部阶段" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部阶段</SelectItem>
                  {Object.entries(CASE_STAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label.zh}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">附件状态</label>
              <Select
                value={attachmentFilter}
                onValueChange={(value) => setAttachmentFilter(value as AttachmentFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部日志" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部日志</SelectItem>
                  <SelectItem value="with">仅有附件</SelectItem>
                  <SelectItem value="without">仅无附件</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setStageFilter('all')
                setAttachmentFilter('all')
                setKeyword('')
              }}
            >
              清空筛选
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这条日志？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，这条日志及其附件记录都将不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.deleteLog.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={mutations.deleteLog.isPending}
              onClick={async () => {
                if (!deleteTarget) return
                try {
                  await mutations.deleteLog.mutateAsync(deleteTarget.id)
                  toast.success('日志已删除')
                  setDeleteTarget(null)
                } catch (error) {
                  const message = error instanceof Error ? error.message : '删除日志失败'
                  toast.error(message)
                }
              }}
            >
              {mutations.deleteLog.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default CaseLogBoard
