import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Edit, Trash2, Copy, FileWarning, User, Building2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PATHS, generatePath } from '@/routes/paths'
import { InfoGrid } from '@/components/shared/InfoGrid'
import { EmptyState } from '@/components/shared/EmptyState'

import { useClient } from '../hooks/use-client'
import { useClientMutations } from '../hooks/use-client-mutations'
import { PropertyClueList } from './PropertyClueList'
import { IdentityDocManager } from './IdentityDocManager'
import { CLIENT_TYPE_LABELS } from '../types'
import { formatClientText } from '../utils/format-client-text'
import type { ClientType } from '../types'

export interface ClientDetailProps { clientId: string }

function getIdNumberLabel(ct: ClientType) {
  return ct === 'natural' ? '身份证号' : '统一社会信用代码'
}

function getLegalRepLabel(ct: ClientType) {
  return ct === 'non_legal_org' ? '负责人' : '法定代表人'
}

export function ClientDetail({ clientId }: ClientDetailProps) {
  const navigate = useNavigate()
  const { data: client, isLoading, error } = useClient(clientId)
  const { deleteClient } = useClientMutations()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleEdit = useCallback(() => navigate(generatePath.clientEdit(clientId)), [navigate, clientId])
  const handleBack = useCallback(() => navigate(PATHS.ADMIN_CLIENTS), [navigate])
  const handleCopy = useCallback(() => {
    if (!client) return
    navigator.clipboard.writeText(formatClientText(client))
    toast.success('已复制当事人信息')
  }, [client])
  const handleDelete = useCallback(async () => {
    try {
      await deleteClient.mutateAsync(clientId)
      toast.success('当事人已删除')
      navigate(PATHS.ADMIN_CLIENTS)
    } catch { toast.error('删除失败') }
  }, [deleteClient, clientId, navigate])

  if (isLoading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><div className="bg-muted h-6 w-40 animate-pulse rounded" /><div className="bg-muted h-4 w-24 animate-pulse rounded" /></div>
        <div className="flex gap-2"><div className="bg-muted h-9 w-20 animate-pulse rounded" /></div>
      </div>
      <div className="bg-muted h-10 w-full max-w-md animate-pulse rounded" />
      <div className="bg-muted h-64 w-full animate-pulse rounded-lg" />
    </div>
  )

  if (error || !client) return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <FileWarning className="text-muted-foreground mb-4 size-16 opacity-50" />
      <h2 className="mb-2 text-xl font-semibold">当事人不存在</h2>
      <p className="text-muted-foreground mb-6">您访问的当事人可能已被删除或不存在</p>
      <Button onClick={handleBack} variant="outline"><ArrowLeft className="mr-2 size-4" />返回列表</Button>
    </div>
  )

  const TypeIcon = client.client_type === 'natural' ? User : Building2
  const showLegalRep = client.client_type !== 'natural'

  const basicInfoItems = [
    { label: '姓名', value: client.name },
    { label: getIdNumberLabel(client.client_type), value: client.id_number },
    { label: '手机号', value: client.phone },
    { label: '地址', value: client.address },
    ...(showLegalRep ? [{ label: getLegalRepLabel(client.client_type), value: client.legal_representative }] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{client.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={client.client_type === 'natural' ? 'default' : 'secondary'} className="text-xs rounded-full">
              {CLIENT_TYPE_LABELS[client.client_type]}
            </Badge>
            {client.is_our_client && <Badge variant="outline" className="text-xs rounded-full">我方当事人</Badge>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleBack}><ArrowLeft className="mr-1.5 size-4" />返回</Button>
          <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="mr-1.5 size-4" />复制</Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-status-red border-status-red hover:bg-status-red-bg"><Trash2 className="mr-1.5 size-4" />删除</Button>
          <Button size="sm" onClick={handleEdit}><Edit className="mr-1.5 size-4" />编辑</Button>
        </div>
      </div>

      <Separator />

      {/* 4-Tab Layout matching v4 */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto" variant="line">
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="docs">证件管理</TabsTrigger>
          <TabsTrigger value="clues">财产线索</TabsTrigger>
          <TabsTrigger value="related">关联案件/合同</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <InfoGrid items={basicInfoItems} />
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <IdentityDocManager clientId={clientId} clientType={client.client_type} docs={client.identity_docs} />
        </TabsContent>

        <TabsContent value="clues" className="mt-4">
          <PropertyClueList clientId={client.id} />
        </TabsContent>

        <TabsContent value="related" className="mt-4">
          <EmptyState icon="case" title="关联案件/合同" description="该当事人关联的案件和合同将在此显示" />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除当事人</AlertDialogTitle>
            <AlertDialogDescription>删除「{client.name}」后，其关联数据将一并删除，且无法恢复。</AlertDialogDescription>
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

export default ClientDetail
