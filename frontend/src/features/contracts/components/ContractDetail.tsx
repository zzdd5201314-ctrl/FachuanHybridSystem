import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft, Edit, Trash2, FileWarning, User, Users,
} from 'lucide-react'
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

import { useContract } from '../hooks/use-contract'
import { useContractMutations } from '../hooks/use-contract-mutations'
import { PaymentList } from './PaymentList'
import { SupplementaryAgreementList } from './SupplementaryAgreementList'
import { FolderBindingManager } from './FolderBindingManager'
import {
  FEE_MODE_LABELS, CONTRACT_STATUS_LABELS, CASE_TYPE_LABELS,
  type FeeMode, type ContractStatus, type CaseType,
} from '../types'

export interface ContractDetailProps { contractId: string }

function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return '-'
  return `¥ ${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><div className="bg-muted h-6 w-48 animate-pulse rounded" /><div className="bg-muted h-4 w-24 animate-pulse rounded" /></div>
        <div className="flex gap-2"><div className="bg-muted h-9 w-20 animate-pulse rounded" /><div className="bg-muted h-9 w-20 animate-pulse rounded" /></div>
      </div>
      <div className="bg-muted h-10 w-full max-w-2xl animate-pulse rounded" />
      <div className="bg-muted h-64 w-full animate-pulse rounded-lg" />
    </div>
  )
}

export function ContractDetail({ contractId }: ContractDetailProps) {
  const navigate = useNavigate()
  const { data: contract, isLoading, error } = useContract(contractId)
  const { deleteContract } = useContractMutations()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleBack = useCallback(() => navigate(PATHS.ADMIN_CONTRACTS), [navigate])
  const handleEdit = useCallback(() => navigate(generatePath.contractEdit(contractId)), [navigate, contractId])

  const handleDelete = useCallback(async () => {
    try {
      await deleteContract.mutateAsync(contractId)
      toast.success('合同已删除')
      navigate(PATHS.ADMIN_CONTRACTS)
    } catch { toast.error('删除失败') }
  }, [deleteContract, contractId, navigate])

  if (isLoading) return <DetailSkeleton />

  if (error || !contract) return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <FileWarning className="text-muted-foreground mb-4 size-16 opacity-50" />
      <h2 className="mb-2 text-xl font-semibold">合同不存在</h2>
      <p className="text-muted-foreground mb-6">您访问的合同可能已被删除或不存在</p>
      <Button onClick={handleBack} variant="outline"><ArrowLeft className="mr-2 size-4" />返回列表</Button>
    </div>
  )

  const statusKey = contract.status as ContractStatus
  const statusLabel = CONTRACT_STATUS_LABELS[statusKey] ?? contract.status
  const typeLabel = CASE_TYPE_LABELS[contract.case_type as CaseType] ?? contract.case_type
  const feeLabel = FEE_MODE_LABELS[contract.fee_mode as FeeMode] ?? contract.fee_mode

  const basicInfoItems = [
    { label: '合同名称', value: contract.name },
    { label: '案件类型', value: typeLabel },
    { label: '状态', value: statusLabel },
    { label: '是否建档', value: contract.is_filed ? '是' : '否' },
    { label: '指定日期', value: contract.specified_date || '-' },
    { label: '合同期限', value: `${contract.start_date || '-'} ~ ${contract.end_date || '-'}` },
    { label: '代理阶段', value: contract.representation_stages.length > 0 ? contract.representation_stages.join('、') : '-' },
    { label: '收费模式', value: feeLabel },
    { label: '固定/前期金额', value: formatAmount(contract.fixed_amount) },
    { label: '风险比例', value: contract.risk_rate != null ? `${contract.risk_rate}%` : '-' },
    { label: '自定义条款', value: contract.custom_terms || '-' },
  ]

  const financeItems = [
    { label: '已收款', value: formatAmount(contract.total_received) },
    { label: '已开票', value: formatAmount(contract.total_invoiced) },
    { label: '未收款', value: formatAmount(contract.unpaid_amount) },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{contract.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={statusKey === 'active' ? 'default' : 'secondary'} className="text-xs rounded-full">{statusLabel}</Badge>
            <Badge variant="outline" className="text-xs rounded-full">{typeLabel}</Badge>
            {contract.is_filed && <Badge variant="secondary" className="text-xs rounded-full">已建档</Badge>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleBack}><ArrowLeft className="mr-1.5 size-4" />返回</Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-status-red border-status-red hover:bg-status-red-bg"><Trash2 className="mr-1.5 size-4" />删除</Button>
          <Button size="sm" onClick={handleEdit}><Edit className="mr-1.5 size-4" />编辑</Button>
        </div>
      </div>

      <Separator />

      {/* Tabs - 6 tabs matching v4 */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto" variant="line">
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="parties">当事人/律师</TabsTrigger>
          <TabsTrigger value="fees">收费/财务</TabsTrigger>
          <TabsTrigger value="filing">立案/OA</TabsTrigger>
          <TabsTrigger value="documents">文书/提醒</TabsTrigger>
          <TabsTrigger value="archive">归档清单</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <InfoGrid items={basicInfoItems} />
          {contract.cases.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3">关联案件</h3>
              <div className="space-y-2">
                {contract.cases.map((cs) => (
                  <div key={cs.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{cs.name}</span>
                      {cs.status_label && <Badge variant="outline" className="text-xs shrink-0">{cs.status_label}</Badge>}
                    </div>
                    {cs.target_amount != null && <span className="text-muted-foreground shrink-0">¥{cs.target_amount.toLocaleString()}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="parties" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Users className="size-4" />当事人</h3>
              {contract.contract_parties.length === 0 ? (
                <p className="text-muted-foreground text-sm">未添加当事人</p>
              ) : (
                <div className="space-y-2">
                  {contract.contract_parties.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <span className="font-medium">{p.client_detail.name}</span>
                      <Badge variant="outline" className="text-xs">{p.role_label}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><User className="size-4" />指派律师</h3>
              {contract.assignments.length === 0 ? (
                <p className="text-muted-foreground text-sm">未指派律师</p>
              ) : (
                <div className="space-y-2">
                  {contract.assignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <span className="font-medium">{a.lawyer_name}</span>
                      {a.is_primary && <Badge className="text-xs">主办</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {contract.supplementary_agreements.length > 0 && (
            <div className="mt-6">
              <SupplementaryAgreementList contractId={contract.id} agreements={contract.supplementary_agreements} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="fees" className="mt-4">
          <InfoGrid items={financeItems} columns={3} />
          <div className="mt-6">
            <PaymentList contractId={contract.id} payments={contract.payments} />
          </div>
        </TabsContent>

        <TabsContent value="filing" className="mt-4">
          <EmptyState icon="file" title="立案/OA" description="立案信息和 OA 对接状态将在此显示" />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {contract.reminders.length > 0 ? (
            <div className="space-y-2">
              {contract.reminders.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span className="font-medium">{r.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{r.due_date || '-'}</span>
                    <Badge variant="outline" className="text-xs">{r.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="file" title="文书/提醒" description="文书生成和提醒事项将在此显示" />
          )}
        </TabsContent>

        <TabsContent value="archive" className="mt-4">
          <FolderBindingManager contractId={contract.id} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除合同</AlertDialogTitle>
            <AlertDialogDescription>删除「{contract.name}」后，其关联数据将一并删除，且无法恢复。</AlertDialogDescription>
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

export default ContractDetail
