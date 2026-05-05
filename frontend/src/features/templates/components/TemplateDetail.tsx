import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Download, Edit, FileWarning } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InfoGrid } from '@/components/shared/InfoGrid'
import { EmptyState } from '@/components/shared/EmptyState'
import { PATHS } from '@/routes/paths'
import { useTemplate } from '../hooks/use-template'
import {
  TEMPLATE_TYPE_LABELS, CONTRACT_SUB_TYPE_LABELS, CASE_SUB_TYPE_LABELS, ARCHIVE_SUB_TYPE_LABELS,
  type TemplateType,
} from '../types'

function getSubTypeLabel(t: { template_type: string; contract_sub_type: string | null; case_sub_type: string | null; archive_sub_type: string | null }): string {
  if (t.template_type === 'contract' && t.contract_sub_type) return CONTRACT_SUB_TYPE_LABELS[t.contract_sub_type] || t.contract_sub_type
  if (t.template_type === 'case' && t.case_sub_type) return CASE_SUB_TYPE_LABELS[t.case_sub_type] || t.case_sub_type
  if (t.template_type === 'archive' && t.archive_sub_type) return ARCHIVE_SUB_TYPE_LABELS[t.archive_sub_type] || t.archive_sub_type
  return '-'
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><div className="bg-muted h-6 w-48 animate-pulse rounded" /><div className="bg-muted h-4 w-32 animate-pulse rounded" /></div>
        <div className="flex gap-2"><div className="bg-muted h-9 w-20 animate-pulse rounded" /></div>
      </div>
      <div className="bg-muted h-10 w-full max-w-2xl animate-pulse rounded" />
      <div className="bg-muted h-64 w-full animate-pulse rounded-lg" />
    </div>
  )
}

export function TemplateDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const templateId = Number(id)
  const { data: template, isLoading, error } = useTemplate(templateId)

  const handleBack = () => navigate(PATHS.ADMIN_TEMPLATES)

  if (isLoading) return <DetailSkeleton />

  if (error || !template) return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <FileWarning className="text-muted-foreground mb-4 size-16 opacity-50" />
      <h2 className="mb-2 text-xl font-semibold">模板不存在</h2>
      <p className="text-muted-foreground mb-6">您访问的模板可能已被删除或不存在</p>
      <Button onClick={handleBack} variant="outline"><ArrowLeft className="mr-2 size-4" />返回列表</Button>
    </div>
  )

  const typeKey = template.template_type as TemplateType
  const typeLabel = TEMPLATE_TYPE_LABELS[typeKey] ?? template.template_type
  const subTypeLabel = getSubTypeLabel(template)

  const basicInfoItems = [
    { label: '模板名称', value: template.name },
    { label: '模板类型', value: typeLabel },
    { label: '子类型', value: subTypeLabel },
    { label: '状态', value: template.is_active ? '启用' : '停用' },
    { label: '创建时间', value: template.created_at },
    { label: '最后更新', value: template.updated_at },
  ]

  const scopeItems = [
    { label: '案件类型', value: template.case_types?.length ? template.case_types.join('、') : '-' },
    { label: '案件阶段', value: template.case_stages?.length ? template.case_stages.join('、') : '-' },
    { label: '合同类型', value: template.contract_types?.length ? template.contract_types.join('、') : '-' },
    { label: '诉讼地位', value: template.legal_statuses?.length ? template.legal_statuses.join('、') : '-' },
    { label: '匹配模式', value: template.legal_status_match_mode || '-' },
    { label: '适用机构', value: template.applicable_institutions?.length ? template.applicable_institutions.join('、') : '-' },
  ]

  const placeholders = template.placeholders ?? []
  const undefinedPH = template.undefined_placeholders ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{template.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs rounded-full">{typeLabel}</Badge>
            {template.is_active
              ? <Badge variant="default" className="text-xs rounded-full">启用</Badge>
              : <Badge variant="secondary" className="text-xs rounded-full">停用</Badge>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleBack}><ArrowLeft className="mr-1.5 size-4" />返回</Button>
          <Button variant="outline" size="sm"><Download className="mr-1.5 size-4" />下载</Button>
          <Button size="sm"><Edit className="mr-1.5 size-4" />编辑</Button>
        </div>
      </div>

      <Separator />

      {/* Tabs - 4 tabs matching v4 */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto" variant="line">
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="scope">适用范围</TabsTrigger>
          <TabsTrigger value="placeholders">占位符</TabsTrigger>
          <TabsTrigger value="file">文件信息</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <InfoGrid items={basicInfoItems} />
        </TabsContent>

        <TabsContent value="scope" className="mt-4">
          <InfoGrid items={scopeItems} />
          {!template.case_types?.length && !template.contract_types?.length && !template.legal_statuses?.length && (
            <p className="text-muted-foreground text-sm mt-4">此模板为通用模板，不限定适用范围</p>
          )}
        </TabsContent>

        <TabsContent value="placeholders" className="mt-4">
          {placeholders.length === 0 ? (
            <EmptyState icon="file" title="暂无占位符" description="模板中暂未检测到占位符" />
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-muted-foreground text-sm">共 <strong>{placeholders.length}</strong> 个占位符</span>
                {undefinedPH.length > 0 && (
                  <span className="text-status-red text-sm">{undefinedPH.length} 个未定义</span>
                )}
              </div>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {placeholders.map((ph) => {
                  const isUndefined = undefinedPH.includes(ph)
                  return (
                    <div
                      key={ph}
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                        isUndefined
                          ? 'border border-status-red bg-status-red-bg text-status-red'
                          : 'border border-border bg-muted'
                      }`}
                    >
                      <code className="font-mono text-xs">{ph}</code>
                      {isUndefined
                        ? <span className="text-[10px] text-status-red bg-status-red-bg px-1.5 py-0.5 rounded-full">未定义</span>
                        : <span className="text-status-green text-xs">✓</span>}
                    </div>
                  )
                })}
              </div>
              {undefinedPH.length > 0 && (
                <div className="mt-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                  有 {undefinedPH.length} 个占位符尚未在系统中定义，生成文书时将无法自动填充。
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="file" className="mt-4">
          {template.file ? (
            <InfoGrid items={[
              { label: '文件来源', value: '上传文件' },
              { label: '文件名', value: template.file.name || '-' },
              { label: '文件大小', value: template.file.size ? `${Math.round(template.file.size / 1024)} KB` : '-' },
            ]} />
          ) : template.file_path ? (
            <InfoGrid items={[
              { label: '文件来源', value: '路径引用' },
              { label: '文件路径', value: template.file_path },
            ]} />
          ) : (
            <EmptyState icon="file" title="未设置文件" description="此模板尚未配置文件" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TemplateDetail
