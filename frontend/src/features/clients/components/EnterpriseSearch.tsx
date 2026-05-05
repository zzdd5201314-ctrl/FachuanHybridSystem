/**
 * EnterpriseSearch - 企业信息搜索预填组件
 * 默认展开，点击标题可收起
 */

import { useState, useCallback } from 'react'
import {
  Search, Building2, Loader2, AlertTriangle, ExternalLink, Sparkles, ChevronDown,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

import { clientApi } from '../api'
import type { EnterpriseCompany, EnterprisePrefillData, EnterpriseProfile } from '../types'

interface Props {
  onPrefill: (data: EnterprisePrefillData) => void
}

const PROVIDERS = [
  { value: 'tianyancha', label: '天眼查' },
]

export function EnterpriseSearch({ onPrefill }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [provider, setProvider] = useState('tianyancha')
  const [keyword, setKeyword] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingPrefill, setIsLoadingPrefill] = useState(false)
  const [companies, setCompanies] = useState<EnterpriseCompany[]>([])
  const [selectedCompany, setSelectedCompany] = useState<EnterpriseCompany | null>(null)
  const [profile, setProfile] = useState<EnterpriseProfile | null>(null)
  const [prefillData, setPrefillData] = useState<EnterprisePrefillData | null>(null)
  const [existingClient, setExistingClient] = useState<{ id: number; name: string } | null>(null)
  const [searchError, setSearchError] = useState('')

  const handleSearch = useCallback(async () => {
    const kw = keyword.trim()
    if (!kw) { setSearchError('请输入企业名称关键词'); return }
    setIsSearching(true)
    setSearchError('')
    setSelectedCompany(null)
    setProfile(null)
    setPrefillData(null)
    setExistingClient(null)
    try {
      const result = await clientApi.searchEnterprise(kw, provider)
      setCompanies(result.items)
      if (!result.items.length) setSearchError('暂未检索到匹配企业，可换关键词继续搜索')
    } catch {
      setSearchError('企业搜索失败，请重试')
      setCompanies([])
    } finally {
      setIsSearching(false)
    }
  }, [keyword, provider])

  const handleSelect = useCallback(async (company: EnterpriseCompany) => {
    setSelectedCompany(company)
    setIsLoadingPrefill(true)
    try {
      const result = await clientApi.getEnterprisePrefill(company.company_id, provider)
      setProfile(result.profile)
      setPrefillData(result.prefill)
      setExistingClient(result.existing_client)
    } catch {
      toast.error('企业详情加载失败')
    } finally {
      setIsLoadingPrefill(false)
    }
  }, [provider])

  const handleApply = useCallback(() => {
    if (!prefillData) return
    onPrefill(prefillData)
    toast.success('已自动填充企业信息')
  }, [prefillData, onPrefill])

  const handleReset = useCallback(() => {
    setSelectedCompany(null)
    setProfile(null)
    setPrefillData(null)
    setExistingClient(null)
  }, [])

  return (
    <div className="rounded-md border">
      {/* 标题栏 — 始终可见，点击展开/收起 */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Building2 className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-medium">企业信息搜索预填</span>
        <span className="text-muted-foreground text-xs">法人 / 非法人组织</span>
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
              {/* 搜索栏 */}
              <div className="flex gap-2">
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="输入企业名称关键词..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-8 flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching} size="sm" className="h-8 shrink-0">
                  {isSearching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                  <span className="ml-1 hidden sm:inline">搜索</span>
                </Button>
              </div>

              {searchError && (
                <p className="text-muted-foreground text-xs">{searchError}</p>
              )}

              {/* 搜索结果 */}
              <AnimatePresence mode="wait">
                {companies.length > 0 && !selectedCompany && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="max-h-48 space-y-1 overflow-y-auto"
                  >
                    {companies.map((c) => (
                      <button
                        key={c.company_id}
                        type="button"
                        className="hover:bg-muted/50 w-full rounded border px-2.5 py-1.5 text-left transition-colors"
                        onClick={() => handleSelect(c)}
                      >
                        <span className="text-sm font-medium">{c.company_name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {c.legal_person || '-'} · {c.status || '-'} · {c.registered_capital || '-'}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 加载中 */}
              {isLoadingPrefill && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="text-muted-foreground size-4 animate-spin" />
                </div>
              )}

              {/* 企业详情 + 预填 */}
              <AnimatePresence>
                {profile && prefillData && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3 rounded-md border p-3"
                  >
                    {existingClient && (
                      <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-200">该企业已存在对应当事人</p>
                          <a href={`/admin/clients/${existingClient.id}`} className="text-primary mt-0.5 inline-flex items-center gap-1 hover:underline">
                            查看「{existingClient.name}」<ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                      {([
                        ['企业名称', profile.company_name],
                        ['统一社会信用代码', profile.unified_social_credit_code],
                        ['法定代表人', profile.legal_person],
                        ['经营状态', profile.status],
                        ['成立日期', profile.establish_date],
                        ['注册资本', profile.registered_capital],
                        ['联系电话', profile.phone],
                        ['地址', profile.address],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="flex items-baseline gap-1.5 text-sm">
                          <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
                          <span className="font-medium truncate">{value || '-'}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t pt-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleReset}>
                        重新搜索
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={handleApply}>
                        <Sparkles className="mr-1 size-3" />一键填充
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
