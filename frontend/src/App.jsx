import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Wallet, Target,
  LayoutDashboard, BarChart3, BookOpen,
  Sun, Moon, FileBarChart, Settings, CalendarRange, RotateCcw, RefreshCw, ClipboardCheck,
} from 'lucide-react'
import { useTheme } from './context/ThemeContext'
import { api } from './api/client'
import { parseProfitLoss } from './utils/parseProfitLoss'
import Section from './components/Section'
import KPICard from './components/KPICard'
import MonthlyChart from './components/MonthlyChart'
import ExpenseDonut from './components/ExpenseDonut'
import BudgetVsActuals from './components/BudgetVsActuals'
import MonthRangePicker from './components/MonthRangePicker'
import ReportsPage from './pages/ReportsPage'
import ReviewPage from './pages/ReviewPage'

const AVAILABLE_YEARS = [2024, 2025]

// Last calendar day of a given month (1-based)
const lastDay = (year, month) => new Date(year, month, 0).getDate()

const pad = (n) => String(n).padStart(2, '0')

function NavItem({ icon: Icon, label, active, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
        ${active
          ? 'bg-skin-primary/10 text-skin-primary'
          : disabled
            ? 'text-skin-border cursor-not-allowed'
            : 'text-skin-muted hover:text-skin-fg hover:bg-skin-surface2'
        }`}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

export default function App() {
  const { dark, toggle } = useTheme()
  const [page, setPage]           = useState('overview')
  const [year, setYear]           = useState(2025)
  const [monthStart, setMonthStart] = useState(1)
  const [monthEnd,   setMonthEnd]   = useState(12)

  // Reset to full year whenever the fiscal year changes
  useEffect(() => {
    setMonthStart(1)
    setMonthEnd(12)
  }, [year])

  const startDate = `${year}-${pad(monthStart)}-01`
  const endDate   = `${year}-${pad(monthEnd)}-${lastDay(year, monthEnd)}`

  // Period label shown on KPI cards
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const periodLabel = monthStart === 1 && monthEnd === 12
    ? `FY ${year}`
    : monthStart === monthEnd
      ? `${MONTHS[monthStart - 1]} ${year}`
      : `${MONTHS[monthStart - 1]}–${MONTHS[monthEnd - 1]} ${year}`

  const handleMonthRange = (s, e) => {
    setMonthStart(s)
    setMonthEnd(e)
  }

  const { data: budgets } = useQuery({ queryKey: ['budgets'], queryFn: api.getBudgets })
  const activeBudget = budgets?.find((b) => b.start_date?.startsWith(String(year))) ?? budgets?.[0]

  const { data: pl, isLoading: plLoading } = useQuery({
    queryKey: ['pl', startDate, endDate],
    queryFn: () => api.getProfitLoss(startDate, endDate),
  })

  const { data: monthly, isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthly', startDate, endDate],
    queryFn: () => api.getMonthlySummary(startDate, endDate),
  })

  const { data: bva, isLoading: bvaLoading } = useQuery({
    queryKey: ['bva', startDate, endDate, activeBudget?.id],
    queryFn: () => api.getBudgetVsActuals(startDate, endDate, activeBudget.id),
    enabled: !!activeBudget,
  })

  const { totalRevenue, totalExpenses, netIncome, expenseCategories } = parseProfitLoss(pl)
  const totalBudget    = bva?.rows?.reduce((s, r) => s + (r.budget ?? 0), 0) ?? 0
  const totalActual    = bva?.rows?.reduce((s, r) => s + (r.actual ?? 0), 0) ?? 0
  const budgetVariance = totalActual - totalBudget

  return (
    <div className="min-h-screen bg-skin-bg text-skin-fg">

      {/* Accent bar */}
      <div className="h-[3px] bg-gradient-to-r from-indigo-500 via-blue-400 to-emerald-400" />

      {/* Nav bar */}
      <header className="bg-skin-surface border-b border-skin-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">

          {/* Top row — logo + controls */}
          <div className="flex items-center justify-between py-3 border-b border-skin-border">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="C3 Church"
                className={`h-20 w-auto transition-all duration-300 ${dark ? 'brightness-0 invert' : ''}`}
              />
              <div>
                <h1 className="text-2xl font-bold text-skin-fg leading-none tracking-tight">C3 Church</h1>
                <p className="text-sm text-skin-muted mt-1 tracking-wide uppercase">Financial Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-skin-muted font-medium">FY</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-skin-surface2 border border-skin-border text-skin-fg rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-skin-primary cursor-pointer shadow-sm"
              >
                {AVAILABLE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="relative group">
                <button
                  onClick={() => window.location.reload()}
                  className="p-2 rounded-lg border border-skin-border bg-skin-surface2 text-skin-muted hover:text-skin-fg transition-colors shadow-sm"
                >
                  <RefreshCw size={14} />
                </button>
                <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-36 rounded-lg bg-skin-surface border border-skin-border shadow-lg px-3 py-2 text-xs text-skin-fg leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 text-center">
                  Refresh data from QuickBooks
                  <div className="absolute top-full right-3 border-4 border-transparent border-t-skin-border" />
                </div>
              </div>
              <div className="relative group">
                <button
                  onClick={toggle}
                  className="p-2 rounded-lg border border-skin-border bg-skin-surface2 text-skin-muted hover:text-skin-fg transition-colors shadow-sm"
                >
                  {dark ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-32 rounded-lg bg-skin-surface border border-skin-border shadow-lg px-3 py-2 text-xs text-skin-fg leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 text-center">
                  {dark ? 'Switch to light mode' : 'Switch to dark mode'}
                  <div className="absolute top-full right-3 border-4 border-transparent border-t-skin-border" />
                </div>
              </div>
            </div>
          </div>

          {/* Nav tabs */}
          <div className="flex items-center gap-1 py-2">
            <NavItem icon={LayoutDashboard} label="Overview" active={page === 'overview'} onClick={() => setPage('overview')} />
            <NavItem icon={FileBarChart}    label="Reports"  active={page === 'reports'}  onClick={() => setPage('reports')} />
            <NavItem icon={ClipboardCheck}  label="Review"   active={page === 'review'}   onClick={() => setPage('review')} />
            <NavItem icon={Settings}        label="Settings" disabled />
          </div>

        </div>
      </header>

      {/* Period filter bar — Overview only */}
      {page === 'overview' && (
        <div className="bg-skin-surface border-b border-skin-border">
          <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-3">
            <CalendarRange size={13} className="text-skin-muted shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-skin-muted">Period</span>
            <MonthRangePicker
              year={year}
              start={monthStart}
              end={monthEnd}
              onChange={handleMonthRange}
            />
            {(monthStart !== 1 || monthEnd !== 12) && (
              <button
                onClick={() => handleMonthRange(1, 12)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-skin-muted hover:text-skin-fg hover:bg-skin-surface2 transition-colors"
                title="Reset to full year"
              >
                <RotateCcw size={11} />
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Overview page */}
      {page === 'overview' && (
        <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">

          <Section title="Financial Overview" icon={LayoutDashboard}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KPICard label="Total Revenue"   value={totalRevenue}   subtext={periodLabel} positive loading={plLoading} icon={TrendingUp}
                tooltip="Total income for the period — tithes, offerings, and all other sources." />
              <KPICard label="Total Expenses"  value={totalExpenses}  subtext={periodLabel}           loading={plLoading} icon={TrendingDown}
                tooltip="Total spending across all cost centers for the period." />
              <KPICard label="Net Income"      value={netIncome}      subtext={netIncome >= 0 ? 'Surplus' : 'Deficit'} positive={netIncome >= 0} negative={netIncome < 0} loading={plLoading} icon={Wallet}
                tooltip="Revenue minus expenses. Green = surplus (more in than out). Red = deficit (spending exceeded income)." />
              <KPICard label="Budget Variance" value={budgetVariance} subtext={budgetVariance > 0 ? 'Over budget' : budgetVariance < 0 ? 'Under budget' : '—'} positive={budgetVariance <= 0} negative={budgetVariance > 0} loading={bvaLoading} icon={Target}
                tooltip="Actual vs budgeted spending. Green = under budget. Red = over budget." />
            </div>
          </Section>

          <Section title="Revenue & Expenses" icon={BarChart3}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-skin-muted mb-4">Monthly Breakdown</p>
                <MonthlyChart data={monthly} loading={monthlyLoading} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-skin-muted mb-4">By Category</p>
                <ExpenseDonut categories={expenseCategories} totalBudget={totalBudget} totalActual={totalActual} loading={plLoading} />
              </div>
            </div>
          </Section>

          <Section title={`Budget Tracking${activeBudget ? ` — ${activeBudget.name}` : ''}`} icon={BookOpen}>
            <BudgetVsActuals data={bva} loading={bvaLoading} />
          </Section>

        </main>
      )}

      {/* Reports page */}
      {page === 'reports' && <ReportsPage budgets={budgets} />}

      {/* Review page */}
      {page === 'review' && <ReviewPage />}
    </div>
  )
}
