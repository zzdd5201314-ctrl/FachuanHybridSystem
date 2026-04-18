import { z } from 'zod'

export const reminderFormSchema = z
  .object({
    reminder_type: z.string().min(1, '请选择提醒类型'),
    content: z.string().min(1, '请输入提醒事项').max(255, '提醒事项不能超过255字符'),
    due_at: z.date({ error: '请选择到期时间' }),
    contract_id: z.number().nullable().optional(),
    case_log_id: z.number().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => {
      const hasContract = data.contract_id != null && data.contract_id !== 0
      const hasCaseLog = data.case_log_id != null && data.case_log_id !== 0
      return hasContract !== hasCaseLog
    },
    {
      message: '必须且只能关联合同或案件日志之一',
      path: ['contract_id'],
    }
  )

export type ReminderFormData = z.infer<typeof reminderFormSchema>
