/** 消息气泡组件 */

import { useState } from 'react'
import { Bot, User, AlertCircle, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkbenchMessage, StreamingMessage, ToolCallState } from '../types'

interface MessageBubbleProps {
  message: WorkbenchMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool'

  if (isTool) {
    return <ToolMessage message={message} />
  }

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full',
            isSystem ? 'bg-destructive/10' : 'bg-primary/10',
          )}
        >
          {isSystem ? (
            <AlertCircle className="size-4 text-destructive" />
          ) : (
            <Bot className="size-4 text-primary" />
          )}
        </div>
      )}

      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSystem
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted',
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        {message.llm_model && (
          <div className="mt-1 text-[10px] opacity-50">{message.llm_model}</div>
        )}
      </div>

      {isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <User className="size-4 text-primary-foreground" />
        </div>
      )}
    </div>
  )
}

/** 工具消息（可折叠详情） */
function ToolMessage({ message }: { message: WorkbenchMessage }) {
  const [expanded, setExpanded] = useState(false)
  const hasError = message.metadata?.success === false

  return (
    <div className="flex gap-3 justify-start pl-11">
      <div className="max-w-[80%] rounded-lg border border-border bg-muted/50 text-sm">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 rounded-lg transition-colors"
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {hasError ? (
            <XCircle className="size-3.5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
          )}
          <span className="font-medium text-xs">{message.tool_name || '工具调用'}</span>
        </button>
        {expanded && (
          <div className="border-t border-border px-3 py-2 space-y-2 text-xs">
            {Object.keys(message.tool_input).length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">输入</div>
                <pre className="whitespace-pre-wrap break-words bg-background/50 rounded p-2 text-[11px]">
                  {JSON.stringify(message.tool_input, null, 2)}
                </pre>
              </div>
            )}
            {Object.keys(message.tool_output).length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">输出</div>
                <pre className="whitespace-pre-wrap break-words bg-background/50 rounded p-2 text-[11px]">
                  {JSON.stringify(message.tool_output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** 流式消息气泡 */
export function StreamingBubble({ message }: { message: StreamingMessage }) {
  return (
    <div className="flex gap-3 justify-start">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bot className="size-4 text-primary animate-pulse" />
      </div>
      <div className="max-w-[80%] rounded-lg bg-muted px-4 py-2.5 text-sm space-y-2">
        {/* Agent Handoff 徽章 */}
        {message.handoffs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.handoffs.map((h, i) => (
              <HandoffBadge key={i} from={h.from} to={h.to} />
            ))}
          </div>
        )}

        {/* 工具调用状态 */}
        {message.toolCalls.length > 0 && (
          <div className="space-y-1">
            {message.toolCalls.map((tc) => (
              <ToolCallIndicator key={tc.toolCallId} toolCall={tc} />
            ))}
          </div>
        )}

        {/* 文本内容 */}
        {message.content && (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}

        {/* 流式光标 */}
        <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />

        {/* 模型标签 */}
        {message.model && (
          <div className="text-[10px] text-muted-foreground">{message.model}</div>
        )}
      </div>
    </div>
  )
}

/** 工具调用状态指示器 */
function ToolCallIndicator({ toolCall }: { toolCall: ToolCallState }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 rounded px-2 py-1.5">
      {toolCall.status === 'running' && <Loader2 className="size-3 animate-spin" />}
      {toolCall.status === 'success' && <CheckCircle2 className="size-3 text-green-500" />}
      {toolCall.status === 'error' && <XCircle className="size-3 text-destructive" />}
      {toolCall.status === 'pending' && <Loader2 className="size-3 opacity-30" />}
      <span className="font-medium">{toolCall.name}</span>
    </div>
  )
}

/** Agent 切换徽章 */
function HandoffBadge({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full px-2 py-0.5">
      <ArrowRight className="size-3" />
      <span>{from}</span>
      <ArrowRight className="size-3" />
      <span>{to}</span>
    </div>
  )
}
