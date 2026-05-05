import { useNavigate } from 'react-router'
import { TemplateForm } from '@/features/templates'
import { PATHS } from '@/routes/paths'

export default function TemplateNewPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">新建文件模板</h1>
        <p className="text-muted-foreground text-sm mt-1">
          创建新的法律文书模板，支持上传 .docx 文件或引用模板库路径
        </p>
      </div>
      <TemplateForm
        onSubmit={(data) => {
          // TODO: call API to create template
          console.log('Create template:', data)
          navigate(PATHS.ADMIN_TEMPLATES)
        }}
      />
    </div>
  )
}
