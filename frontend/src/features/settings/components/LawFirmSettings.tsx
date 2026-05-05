import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/routes/paths'
import { useLawFirms } from '@/features/organization/hooks/use-lawfirms'
import { LawFirmForm } from '@/features/organization/components/LawFirmForm'

export function LawFirmSettings() {
  const navigate = useNavigate()
  const { data: lawfirms, isLoading } = useLawFirms()

  const lawFirm = lawfirms?.[0]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost" size="sm"
          onClick={() => navigate(PATHS.ADMIN_SETTINGS)}
          className="gap-1"
        >
          <ArrowLeft className="size-4" />
          返回设置
        </Button>
        <div className="w-px h-5 bg-border" />
        <h1 className="text-xl font-semibold">律所设置</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        管理律所名称、地址、统一信用代码、联系方式等基本信息
      </p>
      <LawFirmForm lawFirmId={lawFirm?.id} mode={lawFirm ? 'edit' : 'create'} />
    </div>
  )
}

export default LawFirmSettings
