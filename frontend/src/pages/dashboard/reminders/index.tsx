/**
 * Reminders Page
 * 重要日期提醒管理页面
 *
 * @module pages/dashboard/reminders
 *
 * Requirements: 1.1 - 用户访问 /admin/reminders 页面展示提醒列表
 */

import { ReminderList } from '@/features/reminders'

export default function RemindersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">重要日期提醒</h1>
        <p className="text-muted-foreground text-sm mt-1">管理案件和合同的重要时间节点提醒</p>
      </div>

      <ReminderList />
    </div>
  )
}
