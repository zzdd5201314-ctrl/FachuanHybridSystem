/** 消息列表组件 */

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWorkbenchChat } from '../hooks/use-workbench-chat'
import { MessageBubble, StreamingBubble } from './MessageBubble'

export function MessageList() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { messages, streamingMessage, isStreaming } = useWorkbenchChat()

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 120
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    if (isAtBottom) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [messages, streamingMessage])

  const isEmpty = messages.length === 0 && !isStreaming

  if (isEmpty) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        <div className="text-center space-y-2">
          <div className="text-4xl">💬</div>
          <p>开始对话吧</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="space-y-4 p-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && streamingMessage && <StreamingBubble message={streamingMessage} />}
      </div>
    </ScrollArea>
  )
}
