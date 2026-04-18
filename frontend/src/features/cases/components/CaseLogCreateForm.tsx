import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, Loader2, Paperclip, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { generatePath, PATHS } from '@/routes/paths'

import { useCase } from '../hooks/use-case'
import { useLogMutations } from '../hooks/use-log-mutations'
import { CASE_STAGE_LABELS } from '../types'

interface CaseLogCreateFormProps {
  caseId: string
}

function toLocalDateTimeInput(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toApiDateTime(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function CaseLogCreateForm({ caseId }: CaseLogCreateFormProps) {
  const navigate = useNavigate()
  const { data: caseData, isLoading } = useCase(caseId)
  const mutations = useLogMutations(caseId)

  const [stage, setStage] = useState('')
  const [content, setContent] = useState('')
  const [loggedAt, setLoggedAt] = useState(toLocalDateTimeInput(new Date()))
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const handleFileChange = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setFiles((current) => [...current, ...Array.from(fileList)])
  }

  const handleRemoveFile = (targetName: string) => {
    setFiles((current) => current.filter((file) => file.name !== targetName))
  }

  const handleSubmit = async () => {
    if (!caseData) return
    if (!content.trim()) {
      toast.error('请先填写日志内容')
      return
    }

    try {
      const created = await mutations.createLog.mutateAsync({
        case_id: caseData.id,
        content: content.trim(),
        stage: stage || null,
        note: note.trim() || '',
        logged_at: toApiDateTime(loggedAt),
      })

      if (files.length > 0) {
        await mutations.uploadAttachments.mutateAsync({
          logId: created.id,
          files,
        })
      }

      toast.success('日志已新增')
      navigate(generatePath.caseLogDetail(String(caseData.id)))
    } catch (error) {
      const message = error instanceof Error ? error.message : '新增日志失败'
      toast.error(message)
    }
  }

  if (isLoading) {
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
            未找到对应案件，无法新增日志。
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" className="w-fit px-0" asChild>
          <Link to={generatePath.caseLogDetail(String(caseData.id))}>
            <ArrowLeft className="mr-2 size-4" />
            返回案件日志
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">新增日志</h1>
          <p className="text-muted-foreground mt-1 text-sm">{caseData.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>日志内容</CardTitle>
          <CardDescription>填写阶段、内容、时间、备注和附件。阶段选择框已加宽，方便直接看清完整选项。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(320px,1.35fr)_minmax(240px,1fr)]">
            <div className="space-y-2">
              <label className="text-sm font-medium">阶段</label>
              <Select value={stage || '__empty__'} onValueChange={(value) => setStage(value === '__empty__' ? '' : value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="未设置" />
                </SelectTrigger>
                <SelectContent position="popper" className="min-w-[20rem]">
                  <SelectItem value="__empty__">未设置</SelectItem>
                  {Object.entries(CASE_STAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label.zh}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">时间</label>
              <Input
                type="datetime-local"
                value={loggedAt}
                onChange={(event) => setLoggedAt(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">日志内容</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="请输入日志内容"
              className="border-input bg-background min-h-[220px] w-full rounded-md border px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">备注</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="可选备注"
              className="border-input bg-background min-h-[140px] w-full rounded-md border px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">附件</label>
            <input
              type="file"
              multiple
              onChange={(event) => {
                handleFileChange(event.target.files)
                event.target.value = ''
              }}
              className="block w-full text-sm"
            />

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <Paperclip className="size-4 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveFile(file.name)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild>
              <Link to={generatePath.caseLogDetail(String(caseData.id))}>取消</Link>
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={mutations.createLog.isPending || mutations.uploadAttachments.isPending}
            >
              {mutations.createLog.isPending || mutations.uploadAttachments.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              保存日志
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CaseLogCreateForm
