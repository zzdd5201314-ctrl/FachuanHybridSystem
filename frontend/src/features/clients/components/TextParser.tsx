/**
 * TextParser - 智能解析组件（文本粘贴 + 图片上传/粘贴）
 * 默认收起，点击标题展开
 */

import { useState, useCallback, useRef } from 'react'
import {
  FileText, Loader2, CheckCircle2, Wand2, Image, X, ChevronDown,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { clientApi } from '../api'
import type { ClientInput } from '../types'

interface Props {
  onParsed: (data: Partial<ClientInput>) => void
}

const FIELD_LABELS: Record<string, string> = {
  name: '姓名/公司名称',
  id_number: '身份证号/统一社会信用代码',
  phone: '联系方式',
  address: '地址',
  legal_representative: '法定代表人',
  legal_representative_id_number: '法定代表人身份证号',
  client_type: '当事人类型',
}

export function TextParser({ onParsed }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [result, setResult] = useState<Record<string, string> | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleParseText = useCallback(async () => {
    const t = text.trim()
    if (!t) { toast.error('请输入文本内容'); return }
    setIsParsing(true)
    setResult(null)
    try {
      const res = await clientApi.parseText(t)
      if (res.success && res.client) {
        setResult(res.client)
      } else {
        toast.error(res.error || '未能解析出有效信息')
      }
    } catch {
      toast.error('解析失败，请重试')
    } finally {
      setIsParsing(false)
    }
  }, [text])

  const handleRecognizeImage = useCallback(async (file: File) => {
    setIsRecognizing(true)
    setResult(null)
    try {
      const res = await clientApi.recognizeIdentityDoc(file)
      if (res.success && res.extracted_data) {
        const r: Record<string, string> = {}
        if (res.extracted_data.name) r.name = res.extracted_data.name
        if (res.extracted_data.id_number) r.id_number = res.extracted_data.id_number
        if (res.extracted_data.address) r.address = res.extracted_data.address
        if (res.extracted_data.legal_representative) r.legal_representative = res.extracted_data.legal_representative
        setResult(r)
        toast.success('识别成功，请确认结果')
      } else {
        toast.error(res.error || '识别失败，请重试')
      }
    } catch {
      toast.error('识别失败，请检查网络')
    } finally {
      setIsRecognizing(false)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    handleRecognizeImage(file)
    e.target.value = ''
  }, [handleRecognizeImage])

  const clearImage = useCallback(() => {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
  }, [imagePreview])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          setImageFile(file)
          setImagePreview(URL.createObjectURL(file))
          handleRecognizeImage(file)
        }
        return
      }
    }
  }, [handleRecognizeImage])

  const handleApply = useCallback(() => {
    if (!result) return
    const data: Partial<ClientInput> = {}
    if (result.name) data.name = result.name
    if (result.id_number) data.id_number = result.id_number
    if (result.phone) data.phone = result.phone
    if (result.address) data.address = result.address
    if (result.legal_representative) data.legal_representative = result.legal_representative
    if (result.legal_representative_id_number) data.legal_representative_id_number = result.legal_representative_id_number
    if (result.client_type) data.client_type = result.client_type as ClientInput['client_type']
    onParsed(data)
    toast.success('已填充到表单')
    setResult(null)
  }, [result, onParsed])

  const isLoading = isParsing || isRecognizing

  return (
    <div className="rounded-md border">
      {/* 标题栏 — 始终可见，点击展开/收起 */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Wand2 className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-medium">智能解析</span>
        <span className="text-muted-foreground text-xs">粘贴文本或上传证件图片，AI 自动提取</span>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="ml-auto text-muted-foreground"
        >
          <ChevronDown className="size-4" />
        </motion.div>
      </button>

      {/* 内容区 */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t px-3 py-3">
              {/* 文本输入区 */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={handlePaste}
                rows={3}
                disabled={isLoading}
                className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                placeholder="粘贴当事人信息文本，或粘贴/拖入身份证、营业执照图片..."
              />

              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">
                  支持文本提取 / 图片 OCR 识别
                </p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={isLoading}
                    className="h-7 text-xs"
                  >
                    <Image className="mr-1 size-3" />上传图片
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleParseText}
                    disabled={isLoading || !text.trim()}
                    className="h-7 text-xs"
                  >
                    {isParsing ? <Loader2 className="mr-1 size-3 animate-spin" /> : <FileText className="mr-1 size-3" />}
                    解析文本
                  </Button>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* 图片预览 */}
              <AnimatePresence>
                {imageFile && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5 rounded border px-2.5 py-2"
                  >
                    {imagePreview && (
                      <img src={imagePreview} alt="预览" className="size-10 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{imageFile.name}</p>
                      <p className="text-muted-foreground text-xs">{(imageFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    {isRecognizing ? (
                      <Loader2 className="text-muted-foreground size-4 animate-spin" />
                    ) : (
                      <Button variant="ghost" size="icon" className="size-7" onClick={clearImage}>
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 解析/识别结果 */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-2.5 rounded-md border p-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-green-600" />
                      <span className="text-sm font-medium">解析成功</span>
                    </div>
                    <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                      {Object.entries(result).filter(([, v]) => v).map(([key, value]) => (
                        <div key={key} className="flex items-baseline gap-1.5 text-sm">
                          <span className="text-muted-foreground shrink-0 text-xs">{FIELD_LABELS[key] || key}</span>
                          <span className="font-medium truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-1.5 border-t pt-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setResult(null)}>取消</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={handleApply}>
                        <CheckCircle2 className="mr-1 size-3" />确认填充
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
