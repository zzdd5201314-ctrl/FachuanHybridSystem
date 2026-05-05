import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Users, FileText, Briefcase, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PATHS } from '@/routes/paths'
import { clientApi } from '@/features/clients/api'
import { contractApi } from '@/features/contracts/api'
import { caseApi } from '@/features/cases/api'

function useDashboardStats() {
  const clientsQuery = useQuery({
    queryKey: ['dashboard-clients-count'],
    queryFn: () => clientApi.list(),
    staleTime: 60_000,
  })

  const contractsQuery = useQuery({
    queryKey: ['dashboard-contracts-count'],
    queryFn: () => contractApi.list(),
    staleTime: 60_000,
  })

  const casesQuery = useQuery({
    queryKey: ['dashboard-cases-count'],
    queryFn: () => caseApi.list(),
    staleTime: 60_000,
  })

  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

  const financeQuery = useQuery({
    queryKey: ['dashboard-finance', startDate, endDate],
    queryFn: () => contractApi.getFinanceStats({ start_date: startDate, end_date: endDate }),
    staleTime: 60_000,
  })

  return {
    clientCount: clientsQuery.data?.length ?? 0,
    contractCount: contractsQuery.data?.length ?? 0,
    caseCount: casesQuery.data?.length ?? 0,
    monthlyFee: financeQuery.data?.total_received_all ?? 0,
    isLoading: clientsQuery.isLoading || contractsQuery.isLoading || casesQuery.isLoading || financeQuery.isLoading,
  }
}

function CalendarCard() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const dayHeaders = ['日', '一', '二', '三', '四', '五', '六']

  const days = []
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold">日历</CardTitle>
        <span className="text-xs text-muted-foreground">
          {year}年{month + 1}月
        </span>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-7 gap-0.5">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">
              {d}
            </div>
          ))}
          {days.map((d, i) =>
            d === null ? (
              <div key={`empty-${i}`} className="min-h-[40px]" />
            ) : (
              <div
                key={d}
                className={`min-h-[40px] flex items-center justify-center text-xs rounded-md transition-colors ${
                  d === today.getDate()
                    ? 'bg-foreground text-primary-foreground font-semibold'
                    : 'hover:bg-muted cursor-pointer'
                }`}
              >
                {d}
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { clientCount, contractCount, caseCount, monthlyFee, isLoading } = useDashboardStats()

  const stats = useMemo(() => [
    { label: '当事人总数', value: isLoading ? '-' : String(clientCount), icon: <Users className="w-5 h-5" />, path: PATHS.ADMIN_CLIENTS },
    { label: '合同总数', value: isLoading ? '-' : String(contractCount), icon: <FileText className="w-5 h-5" />, path: PATHS.ADMIN_CONTRACTS },
    { label: '在办案件', value: isLoading ? '-' : String(caseCount), icon: <Briefcase className="w-5 h-5" />, path: PATHS.ADMIN_CASES },
    { label: '本月律师费', value: isLoading ? '-' : `¥${monthlyFee.toLocaleString()}`, icon: <TrendingUp className="w-5 h-5" />, path: PATHS.ADMIN_CONTRACTS },
  ], [clientCount, contractCount, caseCount, monthlyFee, isLoading])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">仪表盘</h1>
        <p className="text-sm text-muted-foreground mt-1">欢迎回来。以下是今日概览。</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(stat.path)}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-muted-foreground">{stat.label}</span>
                <div className="text-muted-foreground">{stat.icon}</div>
              </div>
              <div className="text-2xl font-semibold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 日历 */}
      <CalendarCard />
    </div>
  )
}
