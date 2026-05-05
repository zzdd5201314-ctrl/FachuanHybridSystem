import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft, Edit, Trash2, FileWarning,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PATHS, generatePath } from '@/routes/paths'
import { InfoGrid } from '@/components/shared/InfoGrid'
import { EmptyState } from '@/components/shared/EmptyState'

import { useCase } from '../hooks/use-case'
import { useCaseMutations } from '../hooks/use-case-mutations'
import { CasePartySection } from './CasePartySection'
import { CaseAssignmentSection } from './CaseAssignmentSection'
import { CaseLogSection } from './CaseLogSection'
import { AuthoritySection } from './AuthoritySection'

import {
  type CaseStatus, type CaseStage,
  SIMPLE_CASE_TYPE_LABELS, CASE_STATUS_LABELS, CASE_STAGE_LABELS,
} from '../types'

export interface CaseDetailProps { caseId: string }

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try { return format(new Date(dateStr), 'yyyy-MM-dd') } catch { return dateStr }
}

function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return '-'
  return `¥ ${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><div className="bg-muted h-6 w-40 animate-pulse rounded" /><div className="bg-muted h-4 w-24 animate-pulse rounded" /></div>
        <div className="flex gap-2"><div className="bg-muted h-9 w-20 animate-pulse rounded" /><div className="bg-muted h-9 w-20 animate-pulse rounded" /></div>
      </div>
      <div className="bg-muted h-10 w-full max-w-2xl animate-pulse rounded" />
      <div className="bg-muted h-64 w-full animate-pulse rounded-lg" />
    </div>
  )
}

export function CaseDetail({ caseId }: CaseDetailProps) {
  const navigate = useNavigate()
  const { data: caseData, isLoading, error } = useCase(caseId)
  const { deleteCase } = useCaseMutations()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleBack = useCallback(() => navigate(PATHS.ADMIN_CASES), [navigate])
  const handleEdit = useCallback(() => navigate(generatePath.caseEdit(caseId)), [navigate, caseId])

  const handleDelete = useCallback(async () => {
    try {
      await deleteCase.mutateAsync(caseId)
      toast.success('案件已删除')
      navigate(PATHS.ADMIN_CASES)
    } catch { toast.error('删除失败') }
  }, [deleteCase, caseId, navigate])

  if (isLoading) return <DetailSkeleton />

  if (error || !caseData) return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <FileWarning className="text-muted-foreground mb-4 size-16 opacity-50" />
      <h2 className="mb-2 text-xl font-semibold">案件不存在</h2>
      <p className="text-muted-foreground mb-6">您访问的案件可能已被删除或不存在</p>
      <Button onClick={handleBack} variant="outline"><ArrowLeft className="mr-2 size-4" />返回列表</Button>
    </div>
  )

  const statusKey = caseData.status as CaseStatus | null
  const statusLabel = statusKey ? (CASE_STATUS_LABELS[statusKey]?.zh ?? caseData.status) : null
  const typeLabel = caseData.case_type ? (SIMPLE_CASE_TYPE_LABELS[caseData.case_type]?.zh ?? caseData.case_type) : null
  const stageKey = caseData.current_stage as CaseStage | null
  const stageLabel = stageKey ? (CASE_STAGE_LABELS[stageKey]?.zh ?? caseData.current_stage) : null

  const basicInfoItems = [
    { label: '案件名称', value: caseData.name },
    { label: '案件类型', value: typeLabel },
    { label: '状态', value: statusLabel },
    { label: '立案日期', value: formatDate(caseData.start_date) },
    { label: '生效日期', value: formatDate(caseData.effective_date) },
    { label: '案由', value: caseData.cause_of_action },
    { label: '当前阶段', value: stageLabel },
    { label: '标的金额', value: formatAmount(caseData.target_amount) },
    { label: '保全金额', value: formatAmount(caseData.preservation_amount) },
    { label: '关联合同', value: caseData.contract_id ? `合同 #${caseData.contract_id}` : '-' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{caseData.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {statusKey && <Badge variant={statusKey === 'active' ? 'default' : 'secondary'} className="text-xs rounded-full">{statusLabel}</Badge>}
            {typeLabel && <Badge variant="outline" className="text-xs rounded-full">{typeLabel}</Badge>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleBack}><ArrowLeft className="mr-1.5 size-4" />返回</Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-status-red border-status-red hover:bg-status-red-bg"><Trash2 className="mr-1.5 size-4" />删除</Button>
          <Button size="sm" onClick={handleEdit}><Edit className="mr-1.5 size-4" />编辑</Button>
        </div>
      </div>

      <Separator />

      {/* Tabs - 9 tabs matching v4 */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto" variant="line">
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="authorities">案由/主管机关</TabsTrigger>
          <TabsTrigger value="chats">聊天记录</TabsTrigger>
          <TabsTrigger value="materials">案件材料</TabsTrigger>
          <TabsTrigger value="logs">日志/时间线</TabsTrigger>
          <TabsTrigger value="fees">诉讼费</TabsTrigger>
          <TabsTrigger value="hearing">开庭信息</TabsTrigger>
          <TabsTrigger value="documents">文书</TabsTrigger>
          <TabsTrigger value="archive">归档</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <InfoGrid items={basicInfoItems} />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <CasePartySection parties={caseData.parties ?? []} editable={false} />
            <CaseAssignmentSection assignments={caseData.assignments ?? []} editable={false} />
          </div>
        </TabsContent>

        <TabsContent value="authorities" className="mt-4">
          <AuthoritySection authorities={caseData.supervising_authorities ?? []} editable={false} />
        </TabsContent>

        <TabsContent value="chats" className="mt-4">
          <EmptyState icon="inbox" title="暂无聊天记录" description="关联的聊天记录将在此显示" />
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          <EmptyState icon="folder" title="暂无案件材料" description="上传的案件材料将在此显示" />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <CaseLogSection logs={caseData.logs ?? []} editable={false} />
        </TabsContent>

        <TabsContent value="fees" className="mt-4">
          <EmptyState icon="file" title="诉讼费计算" description="使用诉讼费计算器进行费用估算" />
        </TabsContent>

        <TabsContent value="hearing" className="mt-4">
          <EmptyState icon="case" title="暂无开庭信息" description="开庭信息将在此显示" />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <EmptyState icon="file" title="暂无文书" description="生成的诉讼文书将在此显示" />
        </TabsContent>

        <TabsContent value="archive" className="mt-4">
          <EmptyState icon="folder" title="归档清单" description="归档材料清单将在此显示" />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除案件</AlertDialogTitle>
            <AlertDialogDescription>删除「{caseData.name}」后，其关联数据将一并删除，且无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default CaseDetail
