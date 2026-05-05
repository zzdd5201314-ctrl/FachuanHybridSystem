import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PATHS } from '@/routes/paths'
import { useTeams } from '@/features/organization/hooks/use-teams'
import { TeamFormDialog } from '@/features/organization/components/TeamFormDialog'

const TEAM_TYPE_LABELS: Record<string, string> = {
  lawyer: '律师团队',
  biz: '业务团队',
}

export function TeamSettings() {
  const navigate = useNavigate()
  const { data: teams, isLoading } = useTeams()
  const [showForm, setShowForm] = useState(false)

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
        <h1 className="text-xl font-semibold">团队设置</h1>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          创建和管理业务团队，配置团队负责人及成员
        </p>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 size-4" />
          新建团队
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-60" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : teams && teams.length > 0 ? (
        <div className="grid gap-3">
          {teams.map((team) => (
            <Card key={team.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                    <Users className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{team.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {TEAM_TYPE_LABELS[team.team_type] ?? team.team_type}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {TEAM_TYPE_LABELS[team.team_type] ?? team.team_type}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Users className="mx-auto size-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">暂无团队</p>
            <p className="text-muted-foreground/70 text-xs mt-1">点击上方按钮创建第一个团队</p>
          </CardContent>
        </Card>
      )}

      <TeamFormDialog open={showForm} onOpenChange={setShowForm} />
    </div>
  )
}

export default TeamSettings
