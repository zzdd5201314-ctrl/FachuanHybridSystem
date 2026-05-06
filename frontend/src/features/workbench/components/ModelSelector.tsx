/** 模型选择器组件（支持收藏） */

import { useState } from 'react'
import { Check, ChevronsUpDown, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useWorkbenchStore } from '../stores/workbench-store'

interface ModelSelectorProps {
  disabled?: boolean
}

export function ModelSelector({ disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const { models, modelsLoading, selectedModel, favoriteModel, setSelectedModel, setFavoriteModel } =
    useWorkbenchStore()

  if (modelsLoading) {
    return <Skeleton className="h-9 w-full" />
  }

  if (models.length === 0) {
    return (
      <div className="flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground">
        暂无可用模型
      </div>
    )
  }

  const selectedId = selectedModel || models[0]?.id || ''
  const selected = models.find((m) => m.id === selectedId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between h-9 font-normal"
        >
          <span className="truncate">
            {selected ? selected.name || selected.id : '选择模型...'}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <ScrollArea className="h-[240px]">
          <div className="p-1">
            {models.map((model) => {
              const isFav = favoriteModel === model.id
              return (
                <div
                  key={model.id}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-sm px-1 py-1.5 text-sm hover:bg-accent group',
                    selectedId === model.id && 'bg-accent',
                  )}
                >
                  <button
                    onClick={() => {
                      setSelectedModel(model.id)
                      setOpen(false)
                    }}
                    className="flex flex-1 items-center gap-2 min-w-0"
                  >
                    <Check
                      className={cn(
                        'size-4 shrink-0',
                        selectedId === model.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{model.name || model.id}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setFavoriteModel(isFav ? '' : model.id)
                    }}
                    className={cn(
                      'shrink-0 p-1 rounded-sm transition-colors',
                      isFav
                        ? 'text-yellow-500 hover:text-yellow-600'
                        : 'text-muted-foreground/30 hover:text-muted-foreground',
                    )}
                    title={isFav ? '取消收藏' : '收藏为默认模型'}
                  >
                    <Star className={cn('size-3.5', isFav && 'fill-current')} />
                  </button>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
