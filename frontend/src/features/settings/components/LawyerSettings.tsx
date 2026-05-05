import { useNavigate } from 'react-router'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/routes/paths'
import { useLawyers } from '@/features/organization/hooks/use-lawyers'
import { LawyerTable } from '@/features/organization/components/LawyerTable'

export function LawyerSettings() {
  const navigate = useNavigate()
  const { data: lawyers, isLoading } = useLawyers()

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
        <h1 className="text-xl font-semibold">律师设置</h1>
      </div>

      {/* Description + Action */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          管理律师账号、执业证号、所属律所及权限
        </p>
        <Button size="sm" onClick={() => navigate(PATHS.ADMIN_LAWYER_NEW)}>
          <Plus className="mr-1.5 size-4" />
          新建律师
        </Button>
      </div>

      {/* Table */}
      <LawyerTable lawyers={lawyers ?? []} isLoading={isLoading} />
    </div>
  )
}

export default LawyerSettings
