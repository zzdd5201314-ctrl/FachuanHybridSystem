/** 工作台状态管理 (Zustand) */

import { create } from 'zustand'
import type {
  WorkbenchSession,
  WorkbenchMessage,
  LLMModel,
  AgentType,
  ApprovalState,
  SSEEvent,
  StreamingMessage,
  ToolCallState,
} from '../types'
import * as api from '../api'

const FAVORITE_MODEL_KEY = 'workbench_favorite_model'

function loadFavoriteModel(): string {
  try {
    return localStorage.getItem(FAVORITE_MODEL_KEY) || ''
  } catch {
    return ''
  }
}

interface WorkbenchState {
  // 会话
  sessions: WorkbenchSession[]
  currentSession: WorkbenchSession | null
  messages: WorkbenchMessage[]

  // 模型
  models: LLMModel[]
  selectedModel: string
  favoriteModel: string
  modelsLoading: boolean

  // Agent
  selectedAgent: AgentType

  // 流式状态
  isStreaming: boolean
  streamingMessage: StreamingMessage | null

  // 审批
  pendingApproval: ApprovalState | null

  // Actions
  setSelectedModel: (model: string) => void
  setFavoriteModel: (model: string) => void
  setSelectedAgent: (agent: AgentType) => void
  fetchModels: () => Promise<void>
  fetchSessions: () => Promise<void>
  createSession: (title?: string) => Promise<WorkbenchSession>
  setCurrentSession: (session: WorkbenchSession | null) => void
  fetchMessages: (sessionId: number) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  handleSSEEvent: (event: SSEEvent) => void
  respondApproval: (approved: boolean) => Promise<void>
  reset: () => void
}

export const useWorkbenchStore = create<WorkbenchState>()((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  models: [],
  selectedModel: '',
  favoriteModel: loadFavoriteModel(),
  modelsLoading: false,
  selectedAgent: 'triage',
  isStreaming: false,
  streamingMessage: null,
  pendingApproval: null,

  setSelectedModel: (model) => set({ selectedModel: model }),

  setFavoriteModel: (model) => {
    try {
      if (model) {
        localStorage.setItem(FAVORITE_MODEL_KEY, model)
      } else {
        localStorage.removeItem(FAVORITE_MODEL_KEY)
      }
    } catch { /* ignore */ }
    set({ favoriteModel: model })
  },

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),

  fetchModels: async () => {
    set({ modelsLoading: true })
    try {
      const res = await api.fetchModels()
      const { selectedModel, favoriteModel } = get()
      let model = selectedModel
      if (!model) {
        model = favoriteModel && res.models.some((m) => m.id === favoriteModel)
          ? favoriteModel
          : res.default_model
      }
      set({ models: res.models, selectedModel: model, modelsLoading: false })
    } catch {
      set({ modelsLoading: false })
    }
  },

  fetchSessions: async () => {
    try {
      const res = await api.listSessions()
      set({ sessions: res.items })
    } catch { /* ignore */ }
  },

  createSession: async (title) => {
    const { selectedModel } = get()
    const session = await api.createSession(title, selectedModel)
    set((state) => ({ sessions: [session, ...state.sessions], currentSession: session, messages: [] }))
    return session
  },

  setCurrentSession: (session) => {
    set({ currentSession: session, messages: [] })
    if (session) {
      get().fetchMessages(session.id)
    }
  },

  fetchMessages: async (sessionId) => {
    try {
      const res = await api.listMessages(sessionId)
      set({ messages: res.items })
    } catch { /* ignore */ }
  },

  sendMessage: async (content) => {
    const { currentSession, selectedModel, selectedAgent } = get()
    if (!currentSession) return

    // 添加用户消息到本地
    const userMsg: WorkbenchMessage = {
      id: Date.now(),
      role: 'user',
      content,
      llm_model: '',
      tool_call_id: '',
      tool_name: '',
      tool_input: {},
      tool_output: {},
      metadata: {},
      created_at: new Date().toISOString(),
    }
    set((state) => ({ messages: [...state.messages, userMsg] }))

    // 开始流式请求
    set({
      isStreaming: true,
      streamingMessage: { role: 'assistant', content: '', toolCalls: [], handoffs: [] },
    })

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002/api/v1'
      const token = localStorage.getItem('access_token')
      const url = `${baseUrl}/workbench/sessions/${currentSession.id}/messages/stream`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content,
          llm_model: selectedModel,
          agent_type: selectedAgent,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const event = JSON.parse(data) as SSEEvent
            get().handleSSEEvent(event)
          } catch { /* skip malformed */ }
        }
      }

      // 流结束 - 将 streamingMessage 转为正式消息
      const { streamingMessage } = get()
      if (streamingMessage && streamingMessage.content) {
        const assistantMsg: WorkbenchMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: streamingMessage.content,
          llm_model: streamingMessage.model || '',
          tool_call_id: '',
          tool_name: '',
          tool_input: {},
          tool_output: {},
          metadata: {},
          created_at: new Date().toISOString(),
        }
        set((state) => ({ messages: [...state.messages, assistantMsg] }))
      }
    } catch (err) {
      const errorMsg: WorkbenchMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `请求失败: ${err instanceof Error ? err.message : '未知错误'}`,
        llm_model: '',
        tool_call_id: '',
        tool_name: '',
        tool_input: {},
        tool_output: {},
        metadata: {},
        created_at: new Date().toISOString(),
      }
      set((state) => ({ messages: [...state.messages, errorMsg] }))
    } finally {
      set({ isStreaming: false, streamingMessage: null })
    }
  },

  handleSSEEvent: (event) => {
    set((state) => {
      const sm = state.streamingMessage
      if (!sm) return state

      switch (event.type) {
        case 'meta':
          return { streamingMessage: { ...sm, model: event.model } }

        case 'delta':
          return {
            streamingMessage: {
              ...sm,
              content: sm.content + (event.content || ''),
            },
          }

        case 'tool_call': {
          const tc: ToolCallState = {
            toolCallId: event.tool_call_id || '',
            name: event.name || event.tool_name || '',
            arguments: event.arguments || event.tool_input || {},
            status: 'running',
          }
          return {
            streamingMessage: {
              ...sm,
              toolCalls: [...sm.toolCalls, tc],
            },
          }
        }

        case 'tool_result': {
          const toolCallId = event.tool_call_id || ''
          return {
            streamingMessage: {
              ...sm,
              toolCalls: sm.toolCalls.map((tc) =>
                tc.toolCallId === toolCallId
                  ? {
                      ...tc,
                      result: event.result ?? event.tool_output,
                      success: event.success,
                      status: event.success === false ? 'error' as const : 'success' as const,
                    }
                  : tc,
              ),
            },
          }
        }

        case 'handoff':
          return {
            streamingMessage: {
              ...sm,
              handoffs: [
                ...sm.handoffs,
                { from: event.from_agent || '', to: event.to_agent || '' },
              ],
            },
          }

        case 'approval_request':
          return {
            pendingApproval: {
              approvalId: event.approval_id || '',
              toolName: event.tool_name || '',
              toolArgs: event.tool_input || {},
            },
          }

        case 'error':
          return {
            streamingMessage: {
              ...sm,
              content: sm.content + `\n\n错误: ${event.message || '未知错误'}`,
            },
          }

        default:
          return state
      }
    })
  },

  respondApproval: async (approved) => {
    const { pendingApproval } = get()
    if (!pendingApproval) return

    try {
      await api.respondApproval(pendingApproval.approvalId, approved)
      set({ pendingApproval: null })
    } catch { /* ignore */ }
  },

  reset: () =>
    set({
      currentSession: null,
      messages: [],
      isStreaming: false,
      streamingMessage: null,
      pendingApproval: null,
    }),
}))
