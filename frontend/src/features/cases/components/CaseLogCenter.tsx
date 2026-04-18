import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FolderOpen, MoreHorizontal, Search, Trash2, X } from 'lucide-react'
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
import { generatePath } from '@/routes/paths'

import { caseApi } from '../api'
import { useCases } from '../hooks/use-cases'
import { useCaseSearch } from '../hooks/use-case-search'
import {
  CASE_STATUS_LABELS,
  SIMPLE_CASE_TYPE_LABELS,
  type Case,
  type CaseListParams,
  type CaseStatus,
  type SimpleCaseType,
} from '../types'

const PAGE_SIZE = 20

type ArchiveFilter = 'all' | 'active' | 'archived'

interface DeleteCaseTarget {
  id: number
  name: string
}

const CASE_TYPE_OPTIONS: { value: SimpleCaseType; label: string }[] = (
  Object.entries(SIMPLE_CASE_TYPE_LABELS) as [SimpleCaseType, { zh: string }][]
).map(([value, label]) => ({ value, label: label.zh }))

const CASE_STATUS_OPTIONS: { value: CaseStatus; label: string }[] = (
  Object.entries(CASE_STATUS_LABELS) as [CaseStatus, { zh: string }][]
).map(([value, label]) => ({ value, label: label.zh }))

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])

  return debounced
}

function getCaseNumberText(caseItem: { case_numbers?: { number: string }[] }) {
  const caseNumbers = caseItem.case_numbers ?? []
  if (caseNumbers.length === 0) return '未录入案号'
  return caseNumbers.map((item) => item.number).filter(Boolean).join(' / ')
}

function getLawyerText(caseItem: {
  assignments?: { lawyer_detail?: { real_name: string | null; username: string } }[]
}) {
  const assignments = caseItem.assignments ?? []
  const names = assignments
    .map((item) => item.lawyer_detail?.real_name || item.lawyer_detail?.username || '')
    .filter(Boolean)

  if (names.length === 0) return '未指派'
  return names.join(' / ')
}

function formatDate(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function matchesFilters(caseItem: Case, filters: CaseListParams, archiveFilter: ArchiveFilter) {
  if (filters.case_type && caseItem.case_type !== filters.case_type) return false
  if (filters.status && caseItem.status !== filters.status) return false
  if (archiveFilter === 'active' && caseItem.is_archived) return false
  if (archiveFilter === 'archived' && !caseItem.is_archived) return false
  return true
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell><div className="bg-muted h-4 w-12 animate-pulse rounded" /></TableCell>
          <TableCell><div className="bg-muted h-4 w-48 animate-pulse rounded" /></TableCell>
          <TableCell><div className="bg-muted h-4 w-40 animate-pulse rounded" /></TableCell>
          <TableCell><div className="bg-muted h-4 w-28 animate-pulse rounded" /></TableCell>
          <TableCell><div className="bg-muted h-4 w-20 animate-pulse rounded" /></TableCell>
          <TableCell><div className="bg-muted h-4 w-24 animate-pulse rounded" /></TableCell>
          <TableCell><div className="bg-muted h-4 w-16 animate-pulse rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <FolderOpen className="text-muted-foreground size-6" />
      </div>
      <p className="text-muted-foreground text-sm">
        {hasFilters ? '没有符合当前筛选条件的案件' : '暂无可查看的案件'}
      </p>
    </div>
  )
}

function CaseActionMenu({
  caseItem,
  onDeleteRequest,
}: {
  caseItem: Case
  onDeleteRequest: (target: DeleteCaseTarget) => void
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
          <DropdownMenuItem onClick={() => navigate(generatePath.caseLogDetail(String(caseItem.id)))}>
            打开日志台账
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(generatePath.caseDetail(String(caseItem.id)))}>
            打开案件详情
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDeleteRequest({ id: caseItem.id, name: caseItem.name })}
          >
            <Trash2 className="size-4" />
            删除案件
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function CaseLogCenter() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<CaseListParams>({})
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all')
  const [deleteTarget, setDeleteTarget] = useState<DeleteCaseTarget | null>(null)

  const debouncedSearch = useDebounce(search, 300)
  const isSearching = debouncedSearch.length >= 1

  const casesQuery = useCases(isSearching ? undefined : filters)
  const searchQuery = useCaseSearch(debouncedSearch)

  const deleteCase = useMutation({
    mutationFn: (caseId: number) => caseApi.delete(caseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cases'] })
      await queryClient.invalidateQueries({ queryKey: ['case'] })
      toast.success('案件已删除')
      setDeleteTarget(null)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '删除案件失败'
      toast.error(message)
    },
  })

  const rawCases = useMemo(
    () => (isSearching ? (searchQuery.data ?? []) : (casesQuery.data ?? [])),
    [casesQuery.data, isSearching, searchQuery.data],
  )

  const filteredCases = useMemo(
    () => rawCases.filter((caseItem) => matchesFilters(caseItem, filters, archiveFilter)),
    [archiveFilter, filters, rawCases],
  )

  const isLoading = isSearching ? searchQuery.isLoading : casesQuery.isLoading
  const total = filteredCases.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paginatedCases = useMemo(
    () => filteredCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredCases, page],
  )

  const hasFilters =
    !!filters.case_type || !!filters.status || archiveFilter !== 'all' || debouncedSearch.length > 0

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>日志</CardTitle>
              <CardDescription>
                这里只显示案件列表。点击某个案件后，再进入这个案件的全部日志台账。
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative sm:max-w-xs">
                <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="搜索案件名称或案号"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                  className="pl-9 pr-9"
                />
                {search && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setPage(1)
                    }}
                    className="absolute right-1 top-1/2 size-7 -translate-y-1/2 p-0 hover:bg-transparent"
                  >
                    <X className="text-muted-foreground hover:text-foreground size-4" />
                    <span className="sr-only">清空搜索</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead>案件名称</TableHead>
                    <TableHead className="w-[220px]">案号</TableHead>
                    <TableHead className="w-[160px]">经办律师</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[120px]">日期</TableHead>
                    <TableHead className="w-[120px] text-right">动作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableSkeleton />
                  ) : paginatedCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState hasFilters={hasFilters} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCases.map((caseItem) => {
                      const statusKey = caseItem.status as CaseStatus | null
                      const statusLabel = statusKey
                        ? (CASE_STATUS_LABELS[statusKey]?.zh ?? caseItem.status)
                        : '-'

                      return (
                        <TableRow
                          key={caseItem.id}
                          onClick={() => navigate(generatePath.caseLogDetail(String(caseItem.id)))}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                        >
                          <TableCell className="text-muted-foreground text-sm">{caseItem.id}</TableCell>
                          <TableCell className="max-w-[260px]">
                            <div className="flex items-center gap-2">
                              <span className="line-clamp-2 text-sm font-medium">{caseItem.name}</span>
                              {caseItem.is_archived && (
                                <Badge variant="secondary" className="shrink-0 text-xs">
                                  已归档
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {getCaseNumberText(caseItem)}
                          </TableCell>
                          <TableCell className="text-sm">{getLawyerText(caseItem)}</TableCell>
                          <TableCell>
                            {statusKey ? (
                              <Badge
                                variant={statusKey === 'active' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {statusLabel}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-sm">
                            {formatDate(caseItem.start_date)}
                          </TableCell>
                          <TableCell className="text-right">
                            <CaseActionMenu
                              caseItem={caseItem}
                              onDeleteRequest={(target) => setDeleteTarget(target)}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">
                  共 <span className="text-foreground font-medium">{total}</span> 条
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => current - 1)}
                    disabled={page <= 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={page >= totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">过滤器</CardTitle>
            <CardDescription>按案件状态、类型和归档状态快速筛选。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">案件类型</label>
              <Select
                value={filters.case_type ?? 'all'}
                onValueChange={(value) => {
                  setFilters((current) => ({
                    ...current,
                    case_type: value === 'all' ? undefined : (value as SimpleCaseType),
                  }))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {CASE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">案件状态</label>
              <Select
                value={filters.status ?? 'all'}
                onValueChange={(value) => {
                  setFilters((current) => ({
                    ...current,
                    status: value === 'all' ? undefined : value,
                  }))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {CASE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">归档状态</label>
              <Select
                value={archiveFilter}
                onValueChange={(value) => {
                  setArchiveFilter(value as ArchiveFilter)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部案件" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部案件</SelectItem>
                  <SelectItem value="active">仅未归档</SelectItem>
                  <SelectItem value="archived">仅已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setFilters({})
                setArchiveFilter('all')
                setPage(1)
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
            <AlertDialogTitle>确认删除案件？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `删除“${deleteTarget.name}”后，关联日志也会一起删除。这个操作无法撤销。`
                : '删除后无法恢复。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCase.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteCase.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteCase.mutate(deleteTarget.id)
                }
              }}
            >
              {deleteCase.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default CaseLogCenter
