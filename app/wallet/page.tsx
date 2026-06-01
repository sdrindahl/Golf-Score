'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, Tooltip as PieTooltip, BarChart, Bar, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList } from 'recharts'
import { useAuth } from '@/lib/useAuth'
import PageWrapper from '@/components/PageWrapper'
import {
  getExpenses,
  filterByRange,
  totalsByCategory,
  grandTotal,
  EXPENSE_CATEGORIES,
  CATEGORY_EMOJI,
  CATEGORY_COLOR,
} from '@/lib/walletApi'
import { Expense, ExpenseCategory } from '@/types'

type Period = 'week' | 'month' | 'year'

type TrendPoint = {
  id: string
  label: string
  total: number
  isCurrent: boolean
}

type PieLabelProps = {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
}

function renderPieLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
}: PieLabelProps) {
  const pct = Math.round(percent * 100)
  if (pct <= 0) return ''

  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.56
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="12"
      fontWeight="700"
    >
      {`${pct}%`}
    </text>
  )
}

function getRangeForPeriod(period: Period): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  let from = new Date(now)

  if (period === 'week') {
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    from = new Date(now)
    from.setDate(now.getDate() + diff)
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
  } else {
    from = new Date(now.getFullYear(), 0, 1)
  }

  from.setHours(0, 0, 0, 0)
  return { from, to }
}

function buildTrendData(expenses: Expense[], period: Period): TrendPoint[] {
  const spendEntries = expenses.filter(e => e.amount > 0 && e.category !== 'Winnings')
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  if (period === 'week') {
    return Array.from({ length: 15 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() + index - 7)
      const key = date.toISOString().slice(0, 10)
      const total = spendEntries
        .filter(entry => entry.date === key)
        .reduce((sum, entry) => sum + entry.amount, 0)

      return {
        id: key,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total,
        isCurrent: key === today.toISOString().slice(0, 10),
      }
    })
  }

  if (period === 'month') {
    return Array.from({ length: 13 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() + index - 6, 1)
      const year = date.getFullYear()
      const month = date.getMonth()
      const total = spendEntries
        .filter(entry => {
          const entryDate = new Date(`${entry.date}T12:00:00`)
          return entryDate.getFullYear() === year && entryDate.getMonth() === month
        })
        .reduce((sum, entry) => sum + entry.amount, 0)

      return {
        id: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', " '"),
        total,
        isCurrent: year === today.getFullYear() && month === today.getMonth(),
      }
    })
  }

  return Array.from({ length: 9 }, (_, index) => {
    const year = today.getFullYear() + index - 4
    const total = spendEntries
      .filter(entry => new Date(`${entry.date}T12:00:00`).getFullYear() === year)
      .reduce((sum, entry) => sum + entry.amount, 0)

    return {
      id: String(year),
      label: String(year),
      total,
      isCurrent: year === today.getFullYear(),
    }
  })
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
}

const BREAKDOWN_LABELS: Record<ExpenseCategory, string> = {
  'Greens Fees': 'Greens Fees',
  'Equipment & Clothing': 'Equip & Cloth',
  'Food & Beverages': 'Food & Bev',
  'Winnings': 'Winnings',
  'Other': 'Other',
}

export default function WalletPage() {
  const router = useRouter()
  const auth = useAuth()
  const trendScrollRef = useRef<HTMLDivElement | null>(null)
  const trendSnapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTrendAutoSnappingRef = useRef(false)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [period, setPeriod] = useState<Period>('month')
  const [trendPeriod, setTrendPeriod] = useState<Period>('month')
  const [showTrendLeftFade, setShowTrendLeftFade] = useState(false)
  const [showTrendRightFade, setShowTrendRightFade] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadExpenses = useCallback(async () => {
    const user = auth.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }
    const data = await getExpenses(user.id)
    setExpenses(data)
    setLoading(false)
  }, [auth, router])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  const { from, to } = getRangeForPeriod(period)
  const filtered = filterByRange(expenses, from, to)
  const catTotals = totalsByCategory(filtered)

  const spendEntries = filtered.filter(e => e.amount > 0 && e.category !== 'Winnings')
  const totalSpend = grandTotal(spendEntries)
  const winningsTotal = catTotals.Winnings ?? 0

  const allSpendEntries = expenses.filter(e => e.amount > 0 && e.category !== 'Winnings')
  const breakdownSpendEntries = spendEntries.length > 0 ? spendEntries : allSpendEntries
  const breakdownTotals = totalsByCategory(breakdownSpendEntries)
  const breakdownSpendTotal = grandTotal(breakdownSpendEntries)

  const recentEntries = [...expenses]
    .sort((a, b) => {
      const aTs = new Date(`${a.date}T12:00:00`).getTime()
      const bTs = new Date(`${b.date}T12:00:00`).getTime()
      return bTs - aTs
    })
    .slice(0, 5)

  const pieData = EXPENSE_CATEGORIES
    .filter(c => breakdownTotals[c] > 0)
    .map(c => ({ name: c, value: breakdownTotals[c] }))

  const trendData = useMemo(() => buildTrendData(expenses, trendPeriod), [expenses, trendPeriod])
  const trendMax = Math.max(...trendData.map(point => point.total), 0)
  const trendTop = trendMax > 0 ? Math.ceil(trendMax / 100) * 100 : 100
  const trendPixelsPerBar = trendPeriod === 'month' ? 64 : trendPeriod === 'year' ? 76 : 70
  const trendChartWidth = Math.max(trendData.length * trendPixelsPerBar, 560)

  const updateTrendFades = useCallback(() => {
    const container = trendScrollRef.current
    if (!container) return

    const maxScrollLeft = container.scrollWidth - container.clientWidth
    setShowTrendLeftFade(container.scrollLeft > 8)
    setShowTrendRightFade(container.scrollLeft < maxScrollLeft - 8)
  }, [])

  const snapTrendToNearestBar = useCallback(() => {
    const container = trendScrollRef.current
    if (!container || trendData.length === 0) return

    const barWidth = trendChartWidth / trendData.length
    const viewportCenter = container.scrollLeft + container.clientWidth / 2
    const nearestIndex = Math.round((viewportCenter - barWidth / 2) / barWidth)
    const boundedIndex = Math.min(Math.max(nearestIndex, 0), trendData.length - 1)
    const targetLeft = Math.max(boundedIndex * barWidth - container.clientWidth / 2 + barWidth / 2, 0)

    if (Math.abs(container.scrollLeft - targetLeft) < 2) return

    isTrendAutoSnappingRef.current = true
    container.scrollTo({ left: targetLeft, behavior: 'auto' })
    window.setTimeout(() => {
      isTrendAutoSnappingRef.current = false
      updateTrendFades()
    }, 40)
  }, [trendChartWidth, trendData, updateTrendFades])

  useEffect(() => {
    const container = trendScrollRef.current
    const currentIndex = trendData.findIndex(point => point.isCurrent)
    if (!container || currentIndex < 0) return

    const barWidth = trendChartWidth / trendData.length
    const targetLeft = Math.max(currentIndex * barWidth - container.clientWidth / 2 + barWidth / 2, 0)
    container.scrollTo({ left: targetLeft, behavior: 'auto' })
    const animationFrame = requestAnimationFrame(updateTrendFades)

    return () => cancelAnimationFrame(animationFrame)
  }, [trendChartWidth, trendData, trendPeriod, updateTrendFades])

  useEffect(() => {
    return () => {
      if (trendSnapTimeoutRef.current) {
        clearTimeout(trendSnapTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    updateTrendFades()
    window.addEventListener('resize', updateTrendFades)

    return () => window.removeEventListener('resize', updateTrendFades)
  }, [updateTrendFades])

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

  const fmtCompact = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  const fmtTrendLabel = (n: number) => {
    if (n <= 0) return ''
    if (n >= 1000) return `$${Math.round(n / 1000)}k`
    return `$${Math.round(n)}`
  }

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const handleTrendScroll = () => {
    updateTrendFades()

    if (isTrendAutoSnappingRef.current) return

    if (trendSnapTimeoutRef.current) {
      clearTimeout(trendSnapTimeoutRef.current)
    }

    trendSnapTimeoutRef.current = setTimeout(() => {
      snapTrendToNearestBar()
    }, 40)
  }

  if (loading) {
    return (
      <PageWrapper title="">
        <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 bg-[#06110d] min-h-screen pb-24 pt-10">
          <div className="px-5 pb-6 text-white text-center">
            <h1 className="text-4xl font-bold tracking-tight">Golf Wallet</h1>
            <hr className="mt-4 border-t-2 border-black/80 w-3/4 mx-auto" />
          </div>
          <div className="flex justify-center items-center h-40">
            <p className="text-green-400">Loading...</p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="">
      <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 bg-[#06110d] min-h-screen pb-24 pt-10">
        <div className="px-5 pb-6 text-white text-center">
          <h1 className="text-4xl font-bold tracking-tight">Golf Wallet</h1>
          <hr className="mt-4 border-t-2 border-black/80 w-3/4 mx-auto" />
        </div>
        <section className="relative overflow-hidden bg-[#06110d] px-5 py-6 sm:px-6 sm:py-7 border-y border-green-900/70">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(34,197,94,0.25),transparent_45%),radial-gradient(circle_at_85%_85%,rgba(16,185,129,0.14),transparent_40%)]" />
          <div className="relative space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.24em] uppercase text-green-500">Total Spent</p>
                <p className="text-5xl leading-none font-black text-white mt-1">{fmt(totalSpend)}</p>
                {winningsTotal > 0 ? (
                  <p className="text-sm text-emerald-400 mt-2">Winnings this period: {fmt(winningsTotal)}</p>
                ) : (
                  <p className="text-sm text-green-400/80 mt-2">{PERIOD_LABELS[period]} wallet summary</p>
                )}
              </div>
              <button
                onClick={() => router.push('/wallet/add')}
                className="shrink-0 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold shadow-lg shadow-green-900/30 transition"
              >
                + Add Entry
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-green-900/80 bg-black/35 px-3 py-2">
                <p className="text-[11px] uppercase tracking-widest text-green-500">Winnings</p>
                <p className="text-xl font-bold text-emerald-400 mt-1">{fmtCompact(winningsTotal)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {(['week', 'month', 'year'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    period === p
                      ? 'bg-green-600 text-white shadow'
                      : 'bg-black/40 border border-green-900 text-green-300 hover:bg-green-900/40'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#06110d] px-4 py-4 sm:px-5 sm:py-5 border-b border-green-900/70">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(34,197,94,0.25),transparent_45%),radial-gradient(circle_at_85%_85%,rgba(16,185,129,0.14),transparent_40%)]" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-lg">Spending Breakdown</h2>
              <button
                onClick={() => router.push('/wallet/history')}
                className="text-sm text-green-400 hover:text-green-300 font-semibold transition"
              >
                View All ↗
              </button>
            </div>

            <div className="grid grid-cols-[168px_minmax(0,1fr)] sm:grid-cols-[210px_minmax(0,1fr)] md:grid-cols-[240px_1fr] gap-2 sm:gap-3 items-center">
              <div className="h-[168px] sm:h-[210px] md:h-[220px] flex items-center justify-center">
                {pieData.length > 0 ? (
                  <PieChart width={168} height={168}>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={66}
                      paddingAngle={1}
                      dataKey="value"
                      stroke="none"
                      isAnimationActive={false}
                      labelLine={false}
                      label={renderPieLabel}
                    >
                      {pieData.map(entry => (
                        <Cell key={entry.name} fill={CATEGORY_COLOR[entry.name as keyof typeof CATEGORY_COLOR]} />
                      ))}
                    </Pie>
                    <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fill="#d1d5db" fontSize="10" fontWeight="700">
                      Total
                    </text>
                    <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="13" fontWeight="800">
                      {fmt(breakdownSpendTotal)}
                    </text>
                    <PieTooltip
                      formatter={(value) => [fmt(Number(value)), '']}
                      contentStyle={{ background: '#0b120f', border: '1px solid #1b2b22', borderRadius: 8, color: '#fff' }}
                    />
                  </PieChart>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-green-400/80">No spend data yet</div>
                )}
              </div>

              <div className="space-y-1">
                {EXPENSE_CATEGORIES.filter(c => breakdownTotals[c] > 0).map(c => {
                  const pct = breakdownSpendTotal > 0 ? Math.round((breakdownTotals[c] / breakdownSpendTotal) * 100) : 0
                  return (
                    <div key={c} className="border-b border-green-950/80 last:border-b-0 py-1">
                      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs sm:text-sm">
                        <span className="min-w-0 truncate text-gray-200 font-medium flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLOR[c] }} />
                          {BREAKDOWN_LABELS[c]}
                        </span>
                        <span className="font-semibold text-gray-100">{fmt(breakdownTotals[c])}</span>
                        <span className="text-[11px] sm:text-xs font-semibold w-8 sm:w-9 text-right text-gray-400">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <div className="rounded-xl border border-green-950 bg-black/30 px-3 py-4 text-center text-sm text-green-400/80">
                    Add your first entry to see category insights.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#06110d] px-4 py-4 sm:px-5 sm:py-5 border-b border-green-900/70">
          <div className="rounded-2xl border border-green-950 bg-[#0b120f] px-3 py-3 sm:px-4 sm:py-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-white font-bold text-lg">Spending Trends</h2>
              <div className="inline-flex rounded-xl border border-green-950 bg-black/40 p-1">
                {(['week', 'month', 'year'] as Period[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setTrendPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      trendPeriod === p
                        ? 'bg-green-600 text-white shadow-[0_8px_20px_rgba(34,197,94,0.35)]'
                        : 'text-gray-400 hover:text-green-300'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              {showTrendLeftFade && <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#0b120f] to-transparent" />}
              {showTrendRightFade && <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#0b120f] to-transparent" />}
              <div
                ref={trendScrollRef}
                onScroll={handleTrendScroll}
                className="overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
              <div className="h-[240px] min-w-full" style={{ width: `${trendChartWidth}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 22, right: 8, left: -18, bottom: 0 }} barCategoryGap="24%">
                    <CartesianGrid vertical={false} stroke="#223127" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      minTickGap={0}
                      tick={{ fill: '#9ca3af', fontSize: trendPeriod === 'month' ? 10 : 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={44}
                      domain={[0, trendTop]}
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(34, 197, 94, 0.08)' }}
                      contentStyle={{ background: '#0b120f', border: '1px solid #1b2b22', borderRadius: 12, color: '#fff' }}
                      formatter={(value) => [fmt(Number(value)), 'Spend']}
                      labelStyle={{ color: '#d1d5db', fontWeight: 600 }}
                    />
                    <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={42} isAnimationActive={false}>
                      <LabelList
                        dataKey="total"
                        position="top"
                        offset={8}
                        formatter={(value) => fmtTrendLabel(Number(value))}
                        style={{ fill: '#d1d5db', fontSize: 11, fontWeight: 700 }}
                      />
                      {trendData.map(point => (
                        <Cell key={point.id} fill={point.isCurrent ? '#6bd43f' : '#4b8f3a'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#06110d] px-4 py-4 sm:px-5 sm:py-5 border-b border-green-900/70">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(34,197,94,0.25),transparent_45%),radial-gradient(circle_at_85%_85%,rgba(16,185,129,0.14),transparent_40%)]" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-green-300 font-bold text-lg">Recent Entries</h2>
              <button
                onClick={() => router.push('/wallet/history')}
                className="text-sm text-green-400 hover:text-green-300 font-semibold transition"
              >
                View All
              </button>
            </div>

            <div className="space-y-2">
              {recentEntries.length > 0 ? (
                recentEntries.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => router.push('/wallet/history')}
                    className="w-full rounded-2xl border border-green-950 bg-black/35 px-3 py-3 flex items-center justify-between gap-3 text-left hover:border-green-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="text-lg flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: `${CATEGORY_COLOR[entry.category]}33` }}
                      >
                        {CATEGORY_EMOJI[entry.category]}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{entry.category}</p>
                        <p className="text-green-600 text-xs">{formatDate(entry.date)}</p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${entry.category === 'Winnings' ? 'text-emerald-400' : 'text-white'}`}>
                      {fmt(entry.amount)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-green-950 bg-black/30 px-3 py-5 text-center text-sm text-green-400/80">
                  No entries yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </PageWrapper>
  )
}