/** 审批确认对话框 */

import { ShieldAlert, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApprovalState } from '../types'

interface ApprovalDialogProps {
  approval: ApprovalState
  onRespond: (approved: boolean) => void
}

export function ApprovalDialog({ approval, onRespond }: ApprovalDialogProps) {
  return (
    <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-5 text-amber-500" />
        <span className="font-medium text-sm">需要确认</span>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          系统请求执行高风险操作: <span className="font-medium text-foreground">{approval.toolName}</span>
        </p>
        {Object.keys(approval.toolArgs).length > 0 && (
          <pre className="mt-2 whitespace-pre-wrap break-words bg-background/50 rounded p-2 text-xs">
            {JSON.stringify(approval.toolArgs, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={() => onRespond(false)}>
          <X className="size-3.5 mr-1" />
          拒绝
        </Button>
        <Button size="sm" onClick={() => onRespond(true)}>
          <Check className="size-3.5 mr-1" />
          批准
        </Button>
      </div>
    </div>
  )
}
