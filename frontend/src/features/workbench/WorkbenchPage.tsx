/** 工作台页面 */

import { useEffect, useCallback, useState } from 'react'
import { Bot, Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useWorkbenchStore } from './stores/workbench-store'
import { useWorkbenchChat } from './hooks/use-workbench-chat'
import { MessageList } from './components/MessageList'
import { ChatInput } from './components/ChatInput'
import { ModelSelector } from './components/ModelSelector'
import { ApprovalDialog } from './components/ApprovalDialog'
import { deleteSession } from './api'

export function WorkbenchPage() {
  const {
    sessions,
    currentSession,
    fetchSessions,
    createSession,
    setCurrentSession,
    fetchModels,
    pendingApproval,
    respondApproval,
    isStreaming,
  } = useWorkbenchStore()

  const { sendMessage } = useWorkbenchChat()
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchSessions()
    fetchModels()
  }, [fetchSessions, fetchModels])

  const handleNewSession = useCallback(async () => {
    setIsCreating(true)
    try {
      await createSession()
    } finally {
      setIsCreating(false)
    }
  }, [createSession])

  const handleDeleteSession = useCallback(
    async (id: number) => {
      await deleteSession(id)
      if (currentSession?.id === id) {
        setCurrentSession(null)
      }
      fetchSessions()
    },
    [currentSession, setCurrentSession, fetchSessions],
  )

  const handleSend = useCallback(
    (content: string) => {
      if (!currentSession) return
      sendMessage(content)
    },
    [currentSession, sendMessage],
  )

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-lg border bg-card">
      {/* 侧边栏：会话列表 */}
      <div className="flex w-[240px] flex-col border-r bg-muted/30">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">会话</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleNewSession}
            disabled={isCreating}
            className="size-7"
          >
            {isCreating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setCurrentSession(session)}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-2.5 py-2 text-sm cursor-pointer hover:bg-accent',
                  currentSession?.id === session.id && 'bg-accent',
                )}
              >
                <Bot className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{session.title || '新会话'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteSession(session.id)
                  }}
                  className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                暂无会话
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 主区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部栏 */}
        <div className="flex items-center gap-4 border-b px-4 py-2">
          <div className="flex-1">
            <h2 className="text-sm font-medium">
              {currentSession?.title || '工作台'}
            </h2>
          </div>
          <div className="w-[200px]">
            <ModelSelector disabled={isStreaming} />
          </div>
        </div>

        {/* 消息列表 */}
        {currentSession ? (
          <>
            <MessageList />

            {/* 审批对话框 */}
            {pendingApproval && (
              <div className="px-4 pb-2">
                <ApprovalDialog
                  approval={pendingApproval}
                  onRespond={respondApproval}
                />
              </div>
            )}

            <ChatInput
              onSend={handleSend}
              disabled={!currentSession}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <Bot className="mx-auto size-12 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">欢迎使用工作台</p>
                <p className="text-xs mt-1">创建一个新会话开始对话</p>
              </div>
              <Button onClick={handleNewSession} disabled={isCreating}>
                {isCreating ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Plus className="size-4 mr-2" />
                )}
                新建会话
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkbenchPage
