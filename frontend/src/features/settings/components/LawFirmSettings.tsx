import { useNavigate } from 'react-router'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/routes/paths'
import { useLawFirms } from '@/features/organization/hooks/use-lawfirms'
import { LawFirmTable } from '@/features/organization/components/LawFirmTable'

export function LawFirmSettings() {
  const navigate = useNavigate()
  const { data: lawfirms, isLoading } = useLawFirms()

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* Description + Action */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          管理律所名称、地址、统一信用代码、联系方式等基本信息
        </p>
        <Button size="sm" onClick={() => navigate(PATHS.ADMIN_LAWFIRM_NEW)}>
          <Plus className="mr-1.5 size-4" />
          新建律所
        </Button>
      </div>

      {/* Table */}
      <LawFirmTable lawFirms={lawfirms ?? []} isLoading={isLoading} />
    </div>
  )
}

export default LawFirmSettings
