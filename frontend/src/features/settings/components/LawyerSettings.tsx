import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/routes/paths'
import { useAuthStore } from '@/stores/auth'
import { LawyerForm } from '@/features/organization/components/LawyerForm'

export function LawyerSettings() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

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
        <h1 className="text-xl font-semibold">律师设置</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        编辑个人资料、头像、执业证号、身份证号及专业领域
      </p>
      <LawyerForm lawyerId={user?.id} mode="edit" />
    </div>
  )
}

export default LawyerSettings
