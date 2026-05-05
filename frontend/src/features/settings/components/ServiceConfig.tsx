import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Save, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PATHS } from '@/routes/paths'

const CONFIG_SCHEMAS: Record<string, { title: string; description: string; fields: { key: string; label: string; secret?: boolean; placeholder?: string }[] }> = {
  feishu: {
    title: '飞书配置',
    description: 'App ID、App Secret、默认负责人等飞书集成参数',
    fields: [
      { key: 'app_id', label: 'App ID', placeholder: 'cli_xxxxx' },
      { key: 'app_secret', label: 'App Secret', secret: true },
      { key: 'default_owner', label: '默认负责人', placeholder: '用户 open_id' },
      { key: 'webhook_url', label: 'Webhook 地址', placeholder: 'https://open.feishu.cn/...' },
    ],
  },
  dingtalk: {
    title: '钉钉配置',
    description: 'App Key、App Secret、Agent ID 等钉钉集成参数',
    fields: [
      { key: 'app_key', label: 'App Key' },
      { key: 'app_secret', label: 'App Secret', secret: true },
      { key: 'agent_id', label: 'Agent ID' },
    ],
  },
  wechat_work: {
    title: '企业微信配置',
    description: 'Corp ID、Agent ID、Secret 等企业微信集成参数',
    fields: [
      { key: 'corp_id', label: 'Corp ID' },
      { key: 'agent_id', label: 'Agent ID' },
      { key: 'secret', label: 'Secret', secret: true },
      { key: 'token', label: 'Token' },
      { key: 'encoding_aes_key', label: 'EncodingAESKey', secret: true },
    ],
  },
  telegram: {
    title: 'Telegram 配置',
    description: 'Bot Token、超级群组 ID 等 Telegram 集成参数',
    fields: [
      { key: 'bot_token', label: 'Bot Token', secret: true },
      { key: 'super_group_id', label: '超级群组 ID', placeholder: '-100xxxxxxx' },
    ],
  },
  email: {
    title: '邮件配置',
    description: 'SMTP 服务器、端口、账号密码、发件人名称等',
    fields: [
      { key: 'smtp_host', label: 'SMTP 服务器', placeholder: 'smtp.example.com' },
      { key: 'smtp_port', label: '端口', placeholder: '465' },
      { key: 'smtp_user', label: '账号' },
      { key: 'smtp_password', label: '密码', secret: true },
      { key: 'from_name', label: '发件人名称', placeholder: '法穿AI' },
      { key: 'use_ssl', label: '使用 SSL (true/false)', placeholder: 'true' },
    ],
  },
  court_sms: {
    title: '法院短信配置',
    description: '法院短信平台的接口参数配置',
    fields: [
      { key: 'api_url', label: 'API 地址' },
      { key: 'api_key', label: 'API Key', secret: true },
      { key: 'court_code', label: '法院代码' },
    ],
  },
  ai: {
    title: 'AI 服务配置',
    description: 'SiliconFlow API Key、默认模型、Ollama 等 AI 接口参数',
    fields: [
      { key: 'siliconflow_api_key', label: 'SiliconFlow API Key', secret: true },
      { key: 'default_model', label: '默认模型', placeholder: 'Qwen/Qwen2.5-7B-Instruct' },
      { key: 'ollama_base_url', label: 'Ollama 地址', placeholder: 'http://localhost:11434' },
      { key: 'ollama_model', label: 'Ollama 模型', placeholder: 'qwen2.5:7b' },
    ],
  },
  ocr: {
    title: 'OCR 服务配置',
    description: 'PaddleOCR 的 API 地址、模型类型、Token 等参数',
    fields: [
      { key: 'api_url', label: 'API 地址', placeholder: 'http://localhost:8080' },
      { key: 'model_type', label: '模型类型', placeholder: 'paddle' },
      { key: 'token', label: 'Token', secret: true },
    ],
  },
  enterprise_data: {
    title: '企业数据配置',
    description: '天眼查等企业信息查询接口的 API Key',
    fields: [
      { key: 'tianyancha_api_key', label: '天眼查 API Key', secret: true },
    ],
  },
  scraper: {
    title: '爬虫配置',
    description: '加密密钥、无头模式等网页爬取相关参数',
    fields: [
      { key: 'encryption_key', label: '加密密钥', secret: true },
      { key: 'headless', label: '无头模式 (true/false)', placeholder: 'true' },
      { key: 'user_agent', label: 'User Agent' },
    ],
  },
}

export function ServiceConfig() {
  const navigate = useNavigate()
  const { category } = useParams<{ category: string }>()
  const schema = CONFIG_SCHEMAS[category ?? '']

  const [values, setValues] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  if (!schema) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(PATHS.ADMIN_SETTINGS)} className="gap-1">
          <ArrowLeft className="size-4" />
          返回设置
        </Button>
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground text-sm">未找到配置类别：{category}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(PATHS.ADMIN_SETTINGS)} className="gap-1">
          <ArrowLeft className="size-4" />
          返回设置
        </Button>
        <div className="w-px h-5 bg-border" />
        <h1 className="text-xl font-semibold">{schema.title}</h1>
        <Badge variant="outline" className="text-[11px]">{category}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">{schema.description}</p>

      <Card>
        <CardHeader className="py-3 px-4 border-b border-border">
          <CardTitle className="text-[13px] font-semibold">配置参数</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-4 space-y-4">
          {schema.fields.map((field) => {
            const isSecret = field.secret
            const showKey = `show_${field.key}`
            return (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <div className="relative">
                  <Input
                    type={isSecret && !showSecrets[showKey] ? 'password' : 'text'}
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder ?? `请输入${field.label}`}
                    className={isSecret ? 'pr-10' : ''}
                  />
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => setShowSecrets((prev) => ({ ...prev, [showKey]: !prev[showKey] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets[showKey] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          <div className="flex justify-end pt-2">
            <Button size="sm">
              <Save className="mr-1.5 size-4" />
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ServiceConfig
