/** 对话输入框组件（含 Agent 选择器） */

import { useState, useRef, useEffect } from 'react'
import { Send, Square, Bot, Briefcase, FileText, Search, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useWorkbenchStore } from '../stores/workbench-store'
import type { AgentType } from '../types'
import { AGENT_OPTIONS } from '../types'

const AGENT_ICONS: Record<AgentType, typeof Bot> = {
  triage: Bot,
  case: Briefcase,
  contract: FileText,
  research: Search,
  general: HelpCircle,
}

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { isStreaming, selectedAgent, setSelectedAgent } = useWorkbenchStore()

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  const handleSubmit = () => {
    const trimmed = content.trim()
    if (!trimmed || disabled || isStreaming) return
    onSend(trimmed)
    setContent('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t p-4 space-y-2">
      {/* Agent 选择器 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">助手:</span>
        {AGENT_OPTIONS.map((agent) => {
          const Icon = AGENT_ICONS[agent.type]
          return (
            <Badge
              key={agent.type}
              variant={selectedAgent === agent.type ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer text-[11px] gap-1 transition-colors',
                selectedAgent !== agent.type && 'hover:bg-accent',
              )}
              onClick={() => setSelectedAgent(agent.type)}
              title={agent.description}
            >
              <Icon className="size-3" />
              {agent.name}
            </Badge>
          )
        })}
      </div>

      {/* 输入框 */}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
          disabled={disabled}
          className="min-h-[44px] max-h-[160px] resize-none"
          rows={1}
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={() => useWorkbenchStore.getState().reset()}
            className="shrink-0"
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!content.trim() || disabled}
            className="shrink-0"
          >
            <Send className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
