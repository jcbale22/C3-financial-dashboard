import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitCompareArrows, TrendingUp, TrendingDown, Wallet, Link2, Unlink2, RotateCcw } from 'lucide-react'
import { api } from '../api/client'
import { parseProfitLoss } from '../utils/parseProfitLoss'
import MonthRangePicker from '../components/MonthRangePicker'
import ComparisonTable from '../components/ComparisonTable'
import Section from '../components/Section'

const AVAILABLE_YEARS = [2024, 2025]
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const pad = (n) => String(n).padStart(2, '0')
const lastDay = (year, month) => new Date(year, month, 0).getDate()
const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v ?? 0)

function periodLabel(year, start, end) {
  if (start === 1 && end === 12) return `FY ${year}`
  if (start === end) return `${MONTHS[start - 1]} ${year}`
  return `${MONTHS[start - 1]}–${MONTHS[end - 1]} ${year}`
}

function toDates(year, start, end) {
  return {
    start: `${year}-${pad(start)}-01`,
    end:   `${year}-${pad(end)}-${lastDay(year, end)}`,
  }
}

function PeriodSelector({ label, year, start, end, onYearChange, onRangeChange }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs font-bold uppercase tracking-wider text-skin-muted w-16 shrink-0">{label}</span>
      <select
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className="bg-skin-surface2 border border-skin-border text-skin-fg rounded px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-skin-primary cursor-pointer"
      >
        {AVAILABLE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <MonthRangePicker year={year} start={start} end={end} onChange={onRangeChange} />
    </div>
  )
}

function KPIComparison({ label, icon: Icon, valueA, valueB, labelA, labelB, isIncome = false }) {
  const delta = valueB - valueA
  const pct   = valueA !== 0 ? (delta / Math.abs(valueA)) * 100 : null
  const good  = isIncome ? delta >= 0 : delta <= 0
  const color = delta === 0 ? 'text-skin-muted' : good ? 'text-emerald-500' : 'text-rose-500'

  return (
    <div className="bg-skin-surface rounded-xl border border-skin-border p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-skin-muted" />
        <p className="text-xs font-semibold uppercase tracking-wider text-skin-muted">{label}</p>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-baseline gap-4">
          <span className="text-xs text-skin-muted truncate">{labelA}</span>
          <span className="text-sm font-semibold text-skin-fg tabular-nums shrink-0">{fmt(valueA)}</span>
        </div>
        <div className="flex justify-between items-baseline gap-4">
          <span className="text-xs text-skin-muted truncate">{labelB}</span>
          <span className="text-sm font-bold text-skin-fg tabular-nums shrink-0">{fmt(valueB)}</span>
        </div>
      </div>
      <div className={`pt-2 border-t border-skin-border flex justify-between items-center ${color}`}>
        <span className="text-xs font-medium">Change</span>
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums">{delta > 0 ? '+' : ''}{fmt(delta)}</div>
          {pct != null && (
            <div className="text-xs opacity-75">{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage({ budgets }) {
  const [periodA, setPeriodA] = useState({ year: 2024, start: 1, end: 12 })
  const [periodB, setPeriodB] = useState({ year: 2025, start: 1, end: 12 })
  const [syncMonths, setSyncMonths] = useState(true)

  // Reset month range when year changes for each period
  useEffect(() => { setPeriodA((p) => ({ ...p, start: 1, end: 12 })) }, [periodA.year])
  useEffect(() => { setPeriodB((p) => ({ ...p, start: 1, end: 12 })) }, [periodB.year])

  const handleRangeA = (s, e) => {
    setPeriodA((p) => ({ ...p, start: s, end: e }))
    if (syncMonths) setPeriodB((p) => ({ ...p, start: s, end: e }))
  }
  const handleRangeB = (s, e) => {
    setPeriodB((p) => ({ ...p, start: s, end: e }))
    if (syncMonths) setPeriodA((p) => ({ ...p, start: s, end: e }))
  }

  const budgetA = budgets?.find((b) => b.start_date?.startsWith(String(periodA.year))) ?? budgets?.[0]
  const budgetB = budgets?.find((b) => b.start_date?.startsWith(String(periodB.year))) ?? budgets?.[0]

  const datesA = toDates(periodA.year, periodA.start, periodA.end)
  const datesB = toDates(periodB.year, periodB.start, periodB.end)

  const labelA = periodLabel(periodA.year, periodA.start, periodA.end)
  const labelB = periodLabel(periodB.year, periodB.start, periodB.end)

  const { data: plA,  isLoading: plALoading  } = useQuery({
    queryKey: ['pl', datesA.start, datesA.end],
    queryFn:  () => api.getProfitLoss(datesA.start, datesA.end),
  })
  const { data: plB,  isLoading: plBLoading  } = useQuery({
    queryKey: ['pl', datesB.start, datesB.end],
    queryFn:  () => api.getProfitLoss(datesB.start, datesB.end),
  })
  const { data: bvaA, isLoading: bvaALoading } = useQuery({
    queryKey: ['bva', datesA.start, datesA.end, budgetA?.id],
    queryFn:  () => api.getBudgetVsActuals(datesA.start, datesA.end, budgetA.id),
    enabled:  !!budgetA,
  })
  const { data: bvaB, isLoading: bvaBLoading } = useQuery({
    queryKey: ['bva', datesB.start, datesB.end, budgetB?.id],
    queryFn:  () => api.getBudgetVsActuals(datesB.start, datesB.end, budgetB.id),
    enabled:  !!budgetB,
  })

  const summaryA = parseProfitLoss(plA)
  const summaryB = parseProfitLoss(plB)

  return (
    <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">

      {/* Period selectors */}
      <Section title="Compare Periods" icon={GitCompareArrows}>
        <div className="space-y-2">
          <PeriodSelector
            label="Period A"
            year={periodA.year}
            start={periodA.start}
            end={periodA.end}
            onYearChange={(y) => setPeriodA((p) => ({ ...p, year: y }))}
            onRangeChange={handleRangeA}
          />
          <div className="flex items-center gap-2 pl-[4.75rem]">
            <button
              onClick={() => setSyncMonths((v) => !v)}
              title={syncMonths ? 'Months are synced — click to unlock' : 'Months are independent — click to sync'}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors border ${
                syncMonths
                  ? 'bg-skin-primary/10 border-skin-primary/30 text-skin-primary'
                  : 'bg-skin-surface2 border-skin-border text-skin-muted hover:text-skin-fg'
              }`}
            >
              {syncMonths ? <Link2 size={11} /> : <Unlink2 size={11} />}
              {syncMonths ? 'Months synced' : 'Months independent'}
            </button>
            <button
              onClick={() => { setPeriodA({ year: 2024, start: 1, end: 12 }); setPeriodB({ year: 2025, start: 1, end: 12 }); setSyncMonths(true) }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-skin-muted hover:text-skin-fg hover:bg-skin-surface2 transition-colors border border-transparent"
              title="Reset to defaults"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
          <PeriodSelector
            label="Period B"
            year={periodB.year}
            start={periodB.start}
            end={periodB.end}
            onYearChange={(y) => setPeriodB((p) => ({ ...p, year: y }))}
            onRangeChange={handleRangeB}
          />
        </div>
      </Section>

      {/* KPI summary */}
      <Section title="Summary" icon={TrendingUp}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPIComparison
            label="Total Revenue"
            icon={TrendingUp}
            valueA={summaryA.totalRevenue}
            valueB={summaryB.totalRevenue}
            labelA={labelA} labelB={labelB}
            isIncome
          />
          <KPIComparison
            label="Total Expenses"
            icon={TrendingDown}
            valueA={summaryA.totalExpenses}
            valueB={summaryB.totalExpenses}
            labelA={labelA} labelB={labelB}
          />
          <KPIComparison
            label="Net Income"
            icon={Wallet}
            valueA={summaryA.netIncome}
            valueB={summaryB.netIncome}
            labelA={labelA} labelB={labelB}
            isIncome
          />
        </div>
      </Section>

      {/* Account breakdown comparison */}
      <Section title="Account Breakdown" icon={GitCompareArrows}>
        <ComparisonTable
          rowsA={bvaA?.rows}
          rowsB={bvaB?.rows}
          labelA={labelA}
          labelB={labelB}
          loading={bvaALoading || bvaBLoading}
        />
      </Section>

    </main>
  )
}
