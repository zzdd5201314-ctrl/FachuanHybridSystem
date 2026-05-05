export type TemplateType = 'contract' | 'case' | 'archive'

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  contract: '合同文件模板',
  case: '案件文件模板',
  archive: '归档文件模板',
}

export const CONTRACT_SUB_TYPE_LABELS: Record<string, string> = {
  contract: '合同模板',
  supplementary_agreement: '补充协议模板',
}

export const CASE_SUB_TYPE_LABELS: Record<string, string> = {
  pleading_materials: '诉状材料',
  evidence_materials: '证据材料',
  power_of_attorney_materials: '授权委托材料',
  property_preservation_materials: '财产保全材料',
  service_address_materials: '送达地址材料',
  refund_account_materials: '收款退费账户材料',
  application_materials: '申请材料',
  other_materials: '其他材料',
}

export const ARCHIVE_SUB_TYPE_LABELS: Record<string, string> = {
  case_cover: '案卷封面',
  closing_archive_register: '结案归档登记表',
  inner_catalog: '卷内目录',
  lawyer_work_log: '律师工作日志',
  service_quality_card: '办案服务质量监督卡',
  case_summary: '办案小结',
}

export interface Template {
  id: number
  name: string
  template_type: TemplateType
  contract_sub_type: string | null
  case_sub_type: string | null
  archive_sub_type: string | null
  file: { name: string; size: number } | null
  file_path: string
  case_types: string[]
  case_stages: string[]
  contract_types: string[]
  legal_statuses: string[]
  legal_status_match_mode: string
  applicable_institutions: string[]
  is_active: boolean
  placeholders: string[]
  undefined_placeholders: string[]
  created_at: string
  updated_at: string
}
