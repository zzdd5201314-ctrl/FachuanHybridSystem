/** 工作台对话 Hook */

import { useCallback } from 'react'
import { useWorkbenchStore } from '../stores/workbench-store'

export function useWorkbenchChat() {
  const store = useWorkbenchStore()

  const sendMessage = useCallback(
    (content: string) => {
      store.sendMessage(content)
    },
    [store],
  )

  return {
    messages: store.messages,
    streamingMessage: store.streamingMessage,
    isStreaming: store.isStreaming,
    pendingApproval: store.pendingApproval,
    sendMessage,
    respondApproval: store.respondApproval,
  }
}
