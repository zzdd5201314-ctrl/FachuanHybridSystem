/**
 * CaseContactSection - 案件工作人员联系方式区块
 */

import { forwardRef, useImperativeHandle, useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import { useContactMutations } from '../hooks/use-contact-mutations'
import { CONTACT_ROLE_LABELS } from '../types'
import type { CaseContact, ContactRole } from '../types'
import { CASE_STAGE_LABELS } from '@/features/cases/types'
import type { CaseStage } from '@/features/cases/types'

export interface CaseContactSectionRef {
  openDialog: () => void
}

export interface CaseContactSectionProps {
  contacts: CaseContact[]
  editable?: boolean
  caseId?: number
  onContactClick?: (contact: CaseContact) => void
}

export const CaseContactSection = forwardRef<CaseContactSectionRef, CaseContactSectionProps>(
  function CaseContactSection({ contacts, editable, caseId, onContactClick }, ref) {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [form, setForm] = useState({
      name: '',
      role: '' as ContactRole | '',
      phone: '',
      address: '',
      stage: '',
      authority_id: '',
      note: '',
    })

    const mutations = useContactMutations(caseId ?? 0)

    useImperativeHandle(ref, () => ({ openDialog: () => setDialogOpen(true) }), [])

    const resetForm = () => {
      setForm({ name: '', role: '', phone: '', address: '', stage: '', authority_id: '', note: '' })
    }

    const handleAdd = () => {
      if (!caseId || !form.name || !form.role) return
      mutations.createContact.mutate(
        {
          case_id: caseId,
          name: form.name,
          role: form.role as ContactRole,
          phone: form.phone || null,
          address: form.address || null,
          stage: form.stage || null,
          authority_id: form.authority_id ? Number(form.authority_id) : null,
          note: form.note || null,
        },
        {
          onSuccess: () => {
            toast.success('工作人员已添加')
            setDialogOpen(false)
            resetForm()
          },
          onError: () => toast.error('添加失败'),
        },
      )
    }

    const handleDelete = (id: number) => {
      mutations.deleteContact.mutate(id, {
        onSuccess: () => toast.success('已删除'),
        onError: () => toast.error('删除失败'),
      })
    }

    return (
      <div className="space-y-2">
        {contacts.length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无工作人员信息</p>
        ) : (
          <div className="divide-y divide-border/40">
            {contacts.map((contact) => {
              const stageLabel = contact.stage
                ? (CASE_STAGE_LABELS[contact.stage as CaseStage]?.zh ?? contact.stage)
                : null
              return (
                <div key={contact.id} className={`group flex items-start gap-2 py-1.5 ${onContactClick ? 'cursor-pointer hover:bg-muted/30 -mx-1 px-1 rounded' : ''}`}>
                  <div
                    className="min-w-0 flex-1"
                    onClick={onContactClick ? () => onContactClick(contact) : undefined}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-medium">{contact.name}</span>
                      <span className="text-[11px] text-muted-foreground">{contact.role_display || contact.role}</span>
                      {stageLabel && <span className="text-[11px] text-muted-foreground">· {stageLabel}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      {contact.phone && <span>{contact.phone}</span>}
                      {contact.address && <span className="truncate max-w-[200px]">{contact.address}</span>}
                      {contact.authority_name && <span>{contact.authority_name}</span>}
                      {contact.note && <span className="truncate max-w-[150px]">{contact.note}</span>}
                    </div>
                  </div>
                  {editable && caseId && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-xs">
                            <Trash2 className="text-muted-foreground size-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除工作人员「{contact.name}」吗？
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => handleDelete(contact.id)}>
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>添加工作人员</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">姓名 *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="输入姓名"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">角色 *</label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as ContactRole }))}>
                  <SelectTrigger><SelectValue placeholder="选择角色" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label.zh}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">阶段</label>
                <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                  <SelectTrigger><SelectValue placeholder="选择阶段（可选）" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CASE_STAGE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label.zh}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">电话</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="联系电话"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">收件地址</label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="邮寄送达地址"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">备注</label>
                <Input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="如：派出法庭名称等"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>取消</Button>
              <Button onClick={handleAdd} disabled={!form.name || !form.role || mutations.createContact.isPending}>
                {mutations.createContact.isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  },
)

export default CaseContactSection
