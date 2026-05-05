import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PATHS } from '@/routes/paths'
import { useTeams } from '@/features/organization/hooks/use-teams'
import { useTeamMutations } from '@/features/organization/hooks/use-team-mutations'
import { useLawFirms } from '@/features/organization/hooks/use-lawfirms'
import { TeamTable } from '@/features/organization/components/TeamTable'
import { TeamFormDialog } from '@/features/organization/components/TeamFormDialog'
import type { Team } from '@/features/organization/types'

export function TeamSettings() {
  const navigate = useNavigate()
  const { data: teams, isLoading } = useTeams()
  const { data: lawFirms } = useLawFirms()
  const { deleteTeam } = useTeamMutations()

  const [showForm, setShowForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null)

  const handleEdit = (team: Team) => {
    setEditingTeam(team)
    setShowForm(true)
  }

  const handleDelete = (team: Team) => {
    setDeletingTeam(team)
  }

  const confirmDelete = async () => {
    if (!deletingTeam) return
    try {
      await deleteTeam.mutateAsync(deletingTeam.id)
      toast.success('团队已删除')
    } catch {
      toast.error('删除失败')
    } finally {
      setDeletingTeam(null)
    }
  }

  const handleFormClose = (open: boolean) => {
    setShowForm(open)
    if (!open) setEditingTeam(null)
  }

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
        <h1 className="text-xl font-semibold">团队设置</h1>
      </div>

      {/* Description + Action */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          创建和管理业务团队，配置团队负责人及成员
        </p>
        <Button size="sm" onClick={() => { setEditingTeam(null); setShowForm(true) }}>
          <Plus className="mr-1.5 size-4" />
          新建团队
        </Button>
      </div>

      {/* Table */}
      <TeamTable
        teams={teams ?? []}
        lawFirms={lawFirms ?? []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Create / Edit Dialog */}
      <TeamFormDialog
        open={showForm}
        onOpenChange={handleFormClose}
        team={editingTeam ?? undefined}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => { if (!open) setDeletingTeam(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除团队</AlertDialogTitle>
            <AlertDialogDescription>
              删除「{deletingTeam?.name}」后，相关数据将一并删除，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default TeamSettings
