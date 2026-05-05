/**
 * useAuthMutations Hooks
 * 使用 TanStack Query 封装认证操作 mutations
 *
 * Requirements:
 * - 2.1: 用户提交正确的用户名和密码时验证凭证并创建会话
 * - 1.1: 用户提交注册表单时验证用户名唯一性
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { authApi } from '../api'
import type { LoginRequest, RegisterRequest } from '../types'
import { useAuthStore } from '@/stores/auth'

/**
 * 登录 Mutation Hook
 *
 * 封装登录 API 调用，成功后自动更新 Auth Store 状态。
 *
 * Validates: Requirement 2.1
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const loginMutation = useLoginMutation()
 *
 *   const handleSubmit = (data: LoginRequest) => {
 *     loginMutation.mutate(data, {
 *       onSuccess: () => navigate('/dashboard'),
 *       onError: (error) => toast.error(error.message),
 *     })
 *   }
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {loginMutation.isPending && <Spinner />}
 *     </form>
 *   )
 * }
 * ```
 */
export function useLoginMutation() {
  const queryClient = useQueryClient()
  const login = useAuthStore((state) => state.login)

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (response) => {
      // 更新 Auth Store 状态
      login(response.user)
      // 使相关查询失效，确保数据一致性
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })
}

/**
 * 注册 Mutation Hook
 *
 * 封装注册 API 调用，处理首位用户自动登录逻辑。
 * - 首位用户注册成功后自动登录
 * - 后续用户注册成功后返回待审批状态
 *
 * Validates: Requirement 1.1
 *
 * @example
 * ```tsx
 * function RegisterForm() {
 *   const registerMutation = useRegisterMutation()
 *
 *   const handleSubmit = (data: RegisterRequest) => {
 *     registerMutation.mutate(data, {
 *       onSuccess: (response) => {
 *         if (response.requires_approval) {
 *           // 显示等待审批页面
 *           setShowPendingApproval(true)
 *         } else {
 *           // 首位用户，自动跳转到 dashboard
 *           navigate('/dashboard')
 *         }
 *       },
 *       onError: (error) => toast.error(error.message),
 *     })
 *   }
 *
 *   return <form onSubmit={handleSubmit}>...</form>
 * }
 * ```
 */
export function useRegisterMutation() {
  const queryClient = useQueryClient()
  const login = useAuthStore((state) => state.login)

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const response = await authApi.register(data)

      // 注册失败时抛出错误，让 onError 处理
      if (!response.success) {
        throw new Error(response.message || '注册失败')
      }

      // 首位用户注册成功后尝试自动登录
      if (!response.requires_approval && response.user?.is_active) {
        try {
          await authApi.autoLogin(data.username, data.password)
          login(response.user)
          queryClient.invalidateQueries({ queryKey: ['currentUser'] })
        } catch {
          // 自动登录失败不影响注册结果，用户可手动登录
        }
      }

      return response
    },
  })
}

/**
 * 登出 Mutation Hook
 *
 * 封装登出 API 调用，成功后清除 Auth Store 状态。
 *
 * @example
 * ```tsx
 * function UserMenu() {
 *   const logoutMutation = useLogoutMutation()
 *
 *   const handleLogout = () => {
 *     logoutMutation.mutate(undefined, {
 *       onSuccess: () => navigate('/login'),
 *     })
 *   }
 *
 *   return (
 *     <button onClick={handleLogout} disabled={logoutMutation.isPending}>
 *       {logoutMutation.isPending ? '登出中...' : '登出'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient()
  const logout = useAuthStore((state) => state.logout)

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // 清除 Auth Store 状态
      logout()
      // 清除所有缓存的查询数据
      queryClient.clear()
    },
  })
}

export default {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
}
