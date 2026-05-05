import { useState, useCallback } from 'react'
import { formatDate } from '@/lib/date'
import {
  Search, Plus, Eye, Link2, RotateCcw, LinkIcon,
  CheckCircle2, XCircle, Clock, AlertTriangle,
} from 'lucide-react'
import { useQueryClient, useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCourtSmsList } from '../hooks/use-court-sms'
import { courtSmsApi, type CourtSMSDetail } from '../api/court-sms'
import { caseApi } from '@/features/cases/api'
import { generatePath } from '@/routes/paths'

// ============================================================================
// Constants
// ============================================================================

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理', parsing: '解析中', downloading: '下载中',
  download_failed: '下载失败', matching: '匹配中', pending_manual: '待人工处理',
  renaming: '重命名中', notifying: '通知中', completed: '已完成', failed: '处理失败',
}

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default', pending_manual: 'secondary', download_failed: 'destructive', failed: 'destructive',
}

const SMS_TYPE_LABELS: Record<string, string> = {
  document_delivery: '文书送达', info_notification: '信息通知', filing_notification: '立案通知',
}

const STATUS_FILTERS = ['all', 'completed', 'pending_manual', 'download_failed', 'failed'] as const

// ============================================================================
// Sub-components
// ============================================================================

/** 通知结果渲染 */
function NotificationResults({ results }: { results: Record<string, unknown> | null }) {
  if (!results || Object.keys(results).length === 0) {
    return <span className="text-muted-foreground text-xs">无通知记录</span>
  }

  return (
    <div className="space-y-2">
      {Object.entries(results).map(([platform, result]) => {
        const r = result as Record<string, unknown>
        const success = Boolean(r.success ?? r.status === 'sent')
        const sentAt = (r.sent_at ?? r.timestamp) as string | undefined
        const error = (r.error ?? r.error_message) as string | undefined
        const chatId = (r.chat_id ?? r.channel) as string | undefined

        return (
          <div key={platform} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
            {success ? (
              <CheckCircle2 className="size-4 text-green-500 mt-0.5 shrink-0" />
            ) : error ? (
              <XCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
            ) : (
              <Clock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-xs">{platform}</div>
              {chatId && <div className="text-muted-foreground text-xs">群组: {chatId}</div>}
              {sentAt && <div className="text-muted-foreground text-xs">时间: {formatDate(sentAt)}</div>}
              {error && <div className="text-destructive text-xs mt-0.5">{error}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 案件搜索与关联对话框 */
function AssignCaseDialog({
  open,
  onOpenChange,
  smsId,
  smsContent,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  smsId: number | null
  smsContent: string
  onSuccess: () => void
}) {
  const [query, setQuery] = useState('')
  const [assigning, setAssigning] = useState<number | null>(null)

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['case-search', query],
    queryFn: () => caseApi.search(query, 15),
    enabled: open && query.length >= 1,
    staleTime: 10_000,
  })

  const cases = searchResults ?? []

  const handleAssign = async (caseId: number) => {
    if (!smsId) return
    setAssigning(caseId)
    try {
      await courtSmsApi.assignCase(smsId, caseId)
      onSuccess()
      onOpenChange(false)
    } catch (e) {
      console.error('Assign case failed:', e)
    } finally {
      setAssigning(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>关联案件</DialogTitle>
          <DialogDescription>搜索并选择要关联的案件</DialogDescription>
        </DialogHeader>

        {smsContent && (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground line-clamp-2">
            {smsContent}
          </div>
        )}

        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="输入案件名称、案号或当事人搜索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {isFetching && query.length >= 1 && (
            <div className="py-6 text-center text-muted-foreground text-sm">搜索中...</div>
          )}
          {!isFetching && query.length >= 1 && cases.length === 0 && (
            <div className="py-6 text-center text-muted-foreground text-sm">未找到匹配案件</div>
          )}
          {!isFetching && query.length < 1 && (
            <div className="py-6 text-center text-muted-foreground text-sm">输入关键词开始搜索</div>
          )}
          {cases.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{c.name}</div>
                {c.case_numbers && c.case_numbers.length > 0 && (
                  <div className="text-muted-foreground text-xs mt-0.5">
                    {c.case_numbers[0].number}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="ml-3 shrink-0"
                disabled={assigning === c.id}
                onClick={() => handleAssign(c.id)}
              >
                {assigning === c.id ? '关联中...' : '关联'}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CourtSmsTool() {
  // Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [smsTypeFilter, setSmsTypeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Submit dialog state
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitContent, setSubmitContent] = useState('')
  const [submitReceivedAt, setSubmitReceivedAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<CourtSMSDetail | null>(null)

  // Assign case dialog state
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSmsId, setAssignSmsId] = useState<number | null>(null)
  const [assignSmsContent, setAssignSmsContent] = useState('')

  const queryClient = useQueryClient()
  const { data, isLoading } = useCourtSmsList({
    status: statusFilter === 'all' ? undefined : statusFilter,
    sms_type: smsTypeFilter === 'all' ? undefined : smsTypeFilter,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })
  const items = data?.items ?? []

  const filtered = search
    ? items.filter((sms) =>
        sms.content.toLowerCase().includes(search.toLowerCase()) ||
        (sms.case_name && sms.case_name.toLowerCase().includes(search.toLowerCase()))
      )
    : items

  const handleSubmit = async () => {
    if (!submitContent.trim()) return
    setSubmitting(true)
    try {
      await courtSmsApi.submit(
        submitContent.trim(),
        submitReceivedAt || undefined,
      )
      setSubmitOpen(false)
      setSubmitContent('')
      setSubmitReceivedAt('')
      queryClient.invalidateQueries({ queryKey: ['court-sms'] })
    } catch (e) {
      console.error('Submit failed:', e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleView = async (id: number) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const data = await courtSmsApi.get(id)
      setDetail(data)
    } catch (e) {
      console.error('Fetch detail failed:', e)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRetry = async (id: number) => {
    if (!window.confirm('确定重新处理此短信？')) return
    try {
      await courtSmsApi.retry(id)
      queryClient.invalidateQueries({ queryKey: ['court-sms'] })
    } catch (e) {
      console.error('Retry failed:', e)
    }
  }

  const handleOpenAssign = useCallback((id: number, content: string) => {
    setAssignSmsId(id)
    setAssignSmsContent(content)
    setAssignOpen(true)
  }, [])

  const handleAssignSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['court-sms'] })
    // Also refresh detail if open
    if (detail && assignSmsId === detail.id) {
      courtSmsApi.get(detail.id).then(setDetail).catch(console.error)
    }
  }, [queryClient, detail, assignSmsId])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">法院短信</h1>
          <p className="text-muted-foreground text-sm mt-1">自动解析法院送达短信，关联案件并下载文书</p>
        </div>
        <Button size="sm" onClick={() => setSubmitOpen(true)}>
          <Plus className="mr-1.5 size-4" />提交短信
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="搜索内容或案件名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* SMS Type filter */}
        <Select value={smsTypeFilter} onValueChange={setSmsTypeFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="短信类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {Object.entries(SMS_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date from */}
        <div className="flex items-center gap-1.5">
          <Label htmlFor="date-from" className="text-xs text-muted-foreground whitespace-nowrap">从</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-[140px]"
          />
        </div>

        {/* Date to */}
        <div className="flex items-center gap-1.5">
          <Label htmlFor="date-to" className="text-xs text-muted-foreground whitespace-nowrap">至</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-[140px]"
          />
        </div>

        {/* Clear filters */}
        {(smsTypeFilter !== 'all' || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => { setSmsTypeFilter('all'); setDateFrom(''); setDateTo('') }}
          >
            清除筛选
          </Button>
        )}
      </div>

      {/* Status filter buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            variant={s === statusFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className="h-8 text-xs"
          >
            {s === 'all' ? '全部' : STATUS_LABELS[s] ?? s}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">ID</TableHead>
              <TableHead className="w-[90px]">状态</TableHead>
              <TableHead className="w-[90px]">类型</TableHead>
              <TableHead>短信内容</TableHead>
              <TableHead className="w-[160px]">关联案件</TableHead>
              <TableHead className="w-[60px]">文书</TableHead>
              <TableHead className="w-[120px]">收到时间</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><div className="bg-muted h-4 w-20 animate-pulse rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-sm">
                  没有短信记录
                </TableCell>
              </TableRow>
            ) : filtered.map((sms) => {
              const statusLabel = STATUS_LABELS[sms.status] ?? sms.status
              const variant = STATUS_BADGE_VARIANT[sms.status] ?? 'outline'

              return (
                <TableRow key={sms.id}>
                  <TableCell className="text-muted-foreground text-sm">{sms.id}</TableCell>
                  <TableCell>
                    <Badge variant={variant} className="text-xs">{statusLabel}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {sms.sms_type ? (SMS_TYPE_LABELS[sms.sms_type] ?? sms.sms_type) : '-'}
                  </TableCell>
                  <TableCell className="text-sm max-w-[400px] truncate" title={sms.content}>
                    {sms.content}
                  </TableCell>
                  <TableCell className="text-sm truncate max-w-[160px]" title={sms.case_name ?? undefined}>
                    {sms.case_name || (
                      sms.status === 'pending_manual' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-primary"
                          onClick={() => handleOpenAssign(sms.id, sms.content)}
                        >
                          <LinkIcon className="size-3 mr-0.5" />手动关联
                        </Button>
                      ) : '-'
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {sms.has_documents ? <span className="text-green-600">有</span> : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(sms.received_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleView(sms.id)}
                      >
                        <Eye className="size-3 mr-0.5" />查看
                      </Button>
                      {sms.status === 'pending_manual' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleOpenAssign(sms.id, sms.content)}
                        >
                          <LinkIcon className="size-3" />
                        </Button>
                      )}
                      {(sms.status === 'failed' || sms.status === 'download_failed') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleRetry(sms.id)}
                        >
                          <RotateCcw className="size-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Submit Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提交短信</DialogTitle>
            <DialogDescription>粘贴法院短信内容，系统将自动解析并处理</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sms-content">短信内容</Label>
              <Textarea
                id="sms-content"
                placeholder="粘贴短信内容..."
                value={submitContent}
                onChange={(e) => setSubmitContent(e.target.value)}
                rows={6}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="received-at">收到时间（可选）</Label>
              <Input
                id="received-at"
                type="datetime-local"
                value={submitReceivedAt}
                onChange={(e) => setSubmitReceivedAt(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-muted-foreground text-xs mt-1">留空则使用当前时间</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!submitContent.trim() || submitting}>
              {submitting ? '提交中...' : '提交'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>短信详情 #{detail?.id}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-muted h-4 w-full animate-pulse rounded" />
              ))}
            </div>
          ) : detail && (
            <div className="space-y-4">
              {/* Status + Type badges */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={STATUS_BADGE_VARIANT[detail.status] ?? 'outline'} className="text-xs">
                  {STATUS_LABELS[detail.status] ?? detail.status}
                </Badge>
                {detail.sms_type && (
                  <Badge variant="outline" className="text-xs">
                    {SMS_TYPE_LABELS[detail.sms_type] ?? detail.sms_type}
                  </Badge>
                )}
                {detail.status === 'pending_manual' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={() => {
                      setDetailOpen(false)
                      handleOpenAssign(detail.id, detail.content)
                    }}
                  >
                    <LinkIcon className="size-3 mr-1" />关联案件
                  </Button>
                )}
              </div>

              {/* SMS Content */}
              <div className="rounded-md bg-muted p-4">
                <div className="text-xs text-muted-foreground mb-1">短信内容</div>
                <div className="text-sm whitespace-pre-wrap">{detail.content}</div>
              </div>

              {/* Case info */}
              {detail.case && (
                <div className="rounded-md bg-muted p-4">
                  <div className="text-xs text-muted-foreground mb-1">关联案件</div>
                  <a
                    href={generatePath.caseDetail(String(detail.case.id))}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {detail.case.name}
                  </a>
                </div>
              )}

              {/* Case numbers */}
              {detail.case_numbers.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">案号</div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.case_numbers.map((cn, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{cn}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Party names */}
              {detail.party_names.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">当事人</div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.party_names.map((pn, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{pn}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              {detail.documents.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">文书</div>
                  <div className="space-y-1.5">
                    {detail.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                        <Link2 className="size-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="truncate block">{doc.name}</span>
                          {doc.source && (
                            <span className="text-muted-foreground text-xs">{doc.source}</span>
                          )}
                        </div>
                        {doc.download_url && (
                          <a
                            href={doc.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary text-xs hover:underline shrink-0"
                          >
                            下载
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download links */}
              {detail.download_links.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">下载链接</div>
                  <div className="space-y-1">
                    {detail.download_links.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-primary hover:underline truncate"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Error message */}
              {detail.error_message && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="size-3.5 text-destructive" />
                    <span className="text-xs text-destructive font-medium">错误信息</span>
                  </div>
                  <div className="text-xs text-destructive">{detail.error_message}</div>
                </div>
              )}

              {/* Notification results */}
              {(detail.notification_results || detail.feishu_sent_at) && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">通知状态</div>
                  {detail.notification_results ? (
                    <NotificationResults results={detail.notification_results} />
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      {detail.feishu_sent_at ? (
                        <>
                          <CheckCircle2 className="size-4 text-green-500" />
                          <span>飞书已通知 {formatDate(detail.feishu_sent_at)}</span>
                        </>
                      ) : detail.feishu_error ? (
                        <>
                          <XCircle className="size-4 text-red-500" />
                          <span className="text-destructive">飞书通知失败: {detail.feishu_error}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">未通知</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t">
                <div>收到时间: {formatDate(detail.received_at)}</div>
                <div>创建时间: {formatDate(detail.created_at)}</div>
                {detail.updated_at && <div>更新时间: {formatDate(detail.updated_at)}</div>}
                {detail.retry_count > 0 && <div>重试次数: {detail.retry_count}</div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Case Dialog */}
      <AssignCaseDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        smsId={assignSmsId}
        smsContent={assignSmsContent}
        onSuccess={handleAssignSuccess}
      />
    </div>
  )
}
