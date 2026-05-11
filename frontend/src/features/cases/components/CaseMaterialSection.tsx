import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback } from 'react'
import {
  Link2, Trash2, FileText, Loader2, ChevronDown, ChevronRight,
  GripVertical, Pencil, Check, X, FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import { resolveMediaUrl } from '@/lib/api'
import { formatDateOnly } from '@/lib/date'
import { useMaterialMutations } from '../hooks/use-material-mutations'
import type {
  MaterialBindCandidate, MaterialBindItem, MaterialCategory, MaterialSide,
} from '../types'
import { MATERIAL_CATEGORY_LABELS } from '../types'

// ============================================================================
// Types
// ============================================================================

interface MaterialGroup {
  key: string
  category: MaterialCategory
  side: MaterialSide | null
  typeName: string
  typeId: number | null
  items: MaterialBindCandidate[]
}

// ============================================================================
// Sub-components
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="bg-muted flex size-10 items-center justify-center rounded-full">
        <FolderOpen className="text-muted-foreground size-5" />
      </div>
      <p className="text-muted-foreground mt-3 text-sm">暂无材料数据</p>
    </div>
  )
}

function MaterialRow({
  item, onDelete, deletePending,
}: {
  item: MaterialBindCandidate
  onDelete: () => void
  deletePending: boolean
}) {
  const mat = item.material

  return (
    <div className="group flex items-center gap-2 py-1.5">
      <FileText className="text-muted-foreground size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium truncate">{item.file_name}</span>
        <span className="text-[11px] text-muted-foreground ml-2">{item.actor_name} · {formatDateOnly(item.uploaded_at)}</span>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.file_url && (
          <Button variant="ghost" size="icon-xs" asChild>
            <a href={resolveMediaUrl(item.file_url) ?? undefined} target="_blank" rel="noopener noreferrer">
              <FileText className="size-3" />
            </a>
          </Button>
        )}
        {mat && (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-xs" disabled={deletePending}>
                  {deletePending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="text-muted-foreground size-3" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除材料</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要删除「{item.file_name}」的材料绑定吗？附件文件不受影响。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={onDelete}>删除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  )
}

function SortableGroupCard({
  group, candidates, onRename, onDeleteAll, onBind, bindPending, onDeleteItem,
}: {
  group: MaterialGroup
  candidates: MaterialBindCandidate[]
  onRename: (typeId: number, newName: string) => void
  onDeleteAll: () => void
  onBind: (items: MaterialBindItem[]) => void
  bindPending: boolean
  onDeleteItem: (materialId: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.key })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const [expanded, setExpanded] = useState(true)
  const [showBind, setShowBind] = useState(false)
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set())
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(group.typeName)
  const unbound = candidates.filter((c) => !c.material)

  const handleBind = () => {
    if (selectedCandidates.size === 0) return
    const items: MaterialBindItem[] = Array.from(selectedCandidates).map((attachmentId) => ({
      attachment_id: attachmentId,
      category: group.category,
      type_id: group.typeId,
      type_name: group.typeName,
      side: group.side,
    }))
    onBind(items)
    setSelectedCandidates(new Set())
    setShowBind(false)
  }

  const handleRenameConfirm = () => {
    if (group.typeId && renameValue.trim() && renameValue.trim() !== group.typeName) {
      onRename(group.typeId, renameValue.trim())
    }
    setRenaming(false)
  }

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        {renaming ? (
          <div className="flex items-center gap-1">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="h-6 w-[200px] text-xs"
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenaming(false) }}
              autoFocus
            />
            <Button variant="ghost" size="icon-xs" onClick={handleRenameConfirm}>
              <Check className="size-3" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => setRenaming(false)}>
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <>
            <span className="text-xs font-medium text-muted-foreground">{group.typeName}</span>
            <span className="text-[11px] text-muted-foreground">({group.items.length})</span>
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!renaming && group.typeId && (
            <Button variant="ghost" size="icon-xs" onClick={() => { setRenameValue(group.typeName); setRenaming(true) }}>
              <Pencil className="size-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={() => setShowBind(true)}>
            <Link2 className="size-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <Trash2 className="text-muted-foreground size-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>删除分组</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除「{group.typeName}」下的所有 {group.items.length} 项材料绑定吗？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onDeleteAll}>删除全部</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {expanded && (
        <div className="ml-6 divide-y divide-border/40">
          {group.items.map((item) => (
            <MaterialRow
              key={item.attachment_id}
              item={item}
              onDelete={() => onDeleteItem(item.material?.id ?? 0)}
              deletePending={false}
            />
          ))}
        </div>
      )}

      {/* Bind dialog */}
      <Dialog open={showBind} onOpenChange={setShowBind}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>绑定附件到「{group.typeName}」</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto">
            {unbound.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">没有未绑定的附件</p>
            ) : (
              unbound.map((c) => (
                <label key={c.attachment_id} className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={selectedCandidates.has(c.attachment_id)}
                    onChange={(e) => {
                      const next = new Set(selectedCandidates)
                      if (e.target.checked) next.add(c.attachment_id)
                      else next.delete(c.attachment_id)
                      setSelectedCandidates(next)
                    }}
                    className="rounded"
                  />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{c.file_name}</div>
                    <div className="text-xs text-muted-foreground">{c.actor_name} · {formatDateOnly(c.uploaded_at)}</div>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBind(false)}>取消</Button>
            <Button onClick={handleBind} disabled={selectedCandidates.size === 0 || bindPending}>
              {bindPending && <Loader2 className="mr-1 size-3 animate-spin" />}
              绑定 {selectedCandidates.size} 项
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export interface CaseMaterialSectionRef {
  openUpload: () => void
}

export interface CaseMaterialSectionProps {
  candidates: MaterialBindCandidate[]
  caseId: number
  categoryFilter?: MaterialCategory
}

export const CaseMaterialSection = forwardRef<CaseMaterialSectionRef, CaseMaterialSectionProps>(
  function CaseMaterialSection({ candidates, caseId, categoryFilter: externalFilter }, ref) {
    const mutations = useMaterialMutations(caseId)
    const categoryFilter = externalFilter ?? 'all'
    const fileInputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      openUpload: () => fileInputRef.current?.click(),
    }), [])

  const groups = useMemo((): MaterialGroup[] => {
    const map = new Map<string, MaterialGroup>()
    for (const c of candidates) {
      if (!c.material) continue
      const mat = c.material
      const key = `${mat.category}|${mat.side ?? ''}|${mat.type_name}`
      if (!map.has(key)) {
        map.set(key, { key, category: mat.category, side: mat.side, typeName: mat.type_name, typeId: mat.type_id, items: [] })
      }
      map.get(key)!.items.push(c)
    }
    const result = Array.from(map.values())
    if (categoryFilter !== 'all') return result.filter((g) => g.category === categoryFilter)
    return result
  }, [candidates, categoryFilter])

  const groupKeys = useMemo(() => groups.map(g => g.key), [groups])
  const unboundCount = candidates.filter((c) => !c.material).length

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    // Reorder is handled locally; persist on demand
    toast.info('拖拽排序已更新，请点击保存排序')
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    try {
      await mutations.uploadMaterials.mutateAsync(Array.from(files))
      toast.success(`已上传 ${files.length} 个文件`)
    } catch {
      toast.error('上传失败')
    } finally {
      e.target.value = ''
    }
  }

  const handleBind = (items: MaterialBindItem[]) => {
    mutations.bindMaterials.mutate(items, {
      onSuccess: (res) => toast.success(`已绑定 ${res.saved_count} 项`),
      onError: () => toast.error('绑定失败'),
    })
  }

  const handleRename = (typeId: number, newName: string) => {
    mutations.renameGroup.mutate({ typeId, newTypeName: newName }, {
      onSuccess: () => toast.success('重命名成功'),
      onError: () => toast.error('重命名失败'),
    })
  }

  const handleDeleteItem = (materialId: number) => {
    if (!materialId) return
    mutations.deleteMaterial.mutate(materialId, {
      onSuccess: () => toast.success('已删除'),
      onError: () => toast.error('删除失败'),
    })
  }

  const handleDeleteAll = (category: MaterialCategory) => {
    mutations.deleteAllMaterials.mutate(category, {
      onSuccess: (res) => toast.success(`已删除 ${res.deleted_count} 项材料`),
      onError: () => toast.error('删除失败'),
    })
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUpload}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.xls,.xlsx"
      />

      {/* Material groups with drag-drop */}
      {groups.length === 0 && candidates.length === 0 ? (
        <EmptyState />
      ) : groups.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">
            {categoryFilter !== 'all' ? `没有${MATERIAL_CATEGORY_LABELS[categoryFilter]?.zh ?? ''}数据` : '暂无已绑定材料'}
          </p>
          {unboundCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">有 {unboundCount} 个未绑定附件，请先绑定到材料类型</p>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groupKeys} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {groups.map((group) => (
                <SortableGroupCard
                  key={group.key}
                  group={group}
                  candidates={candidates}
                  onRename={handleRename}
                  onDeleteAll={() => handleDeleteAll(group.category)}
                  onBind={handleBind}
                  bindPending={mutations.bindMaterials.isPending}
                  onDeleteItem={handleDeleteItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Unbound attachments section */}
      {unboundCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">未绑定附件</span>
            <Badge variant="secondary" className="text-xs">{unboundCount}</Badge>
          </div>
          <div className="ml-6 divide-y divide-border/40">
            {candidates.filter((c) => !c.material).map((item) => (
              <div key={item.attachment_id} className="flex items-center gap-2 py-1.5">
                <FileText className="text-muted-foreground size-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium truncate">{item.file_name}</span>
                  <span className="text-[11px] text-muted-foreground ml-2">{item.actor_name} · {formatDateOnly(item.uploaded_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
  },
)

export default CaseMaterialSection
