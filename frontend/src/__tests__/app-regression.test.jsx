import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import App from '../App'
import { ThemeProvider } from '../context/ThemeContext'

const budgets = [
  { id: '1000000001', name: 'Budget_FY24_P&L', start_date: '2024-01-01', end_date: '2024-12-31', budget_type: 'ProfitAndLoss', active: true },
  { id: '1000000011', name: 'Budget_FY25_P&L', start_date: '2025-01-01', end_date: '2025-12-31', budget_type: 'ProfitAndLoss', active: true },
  { id: '1000000021', name: 'Budget_FY26_P&L', start_date: '2026-01-01', end_date: '2026-12-31', budget_type: 'ProfitAndLoss', active: true },
]

const profitLoss = {
  rows: [
    { type: 'section_header', depth: 0, label: 'Revenue', values: ['1,687,998'] },
    { type: 'section_summary', depth: 0, label: 'Total Revenue', values: ['1,687,998'] },
    { type: 'section_header', depth: 0, label: 'Expenses', values: ['1,215,407'] },
    { type: 'section_summary', depth: 0, label: 'Total Expenses', values: ['1,215,407'] },
    { type: 'section_summary', depth: 0, label: 'Net Income', values: ['472,591'] },
    { type: 'section_header', depth: 0, label: 'Net Income', values: ['472,591'] },
  ],
}

const monthlySummary = {
  months: ['Jan 2026', 'Feb 2026'],
  revenue: [100000, 120000],
  expenses: [80000, 90000],
}

const budgetVsActuals = {
  budget_name: 'Budget_FY26_P&L',
  start_period: '2026-01-01',
  end_period: '2026-12-31',
  rows: [
    { account_id: '105', account_name: '40000 Income:41000 Offering', budget: 1687998, actual: 752439.83, variance: -935558.17, percent_of_budget: 44.6, account_type: 'Income' },
    { account_id: '179', account_name: '50000 MINISTRY:51100 KIDS MINISTRY:51110 Curriculum', budget: 2000.04, actual: 446.69, variance: -1553.35, percent_of_budget: 22.3, account_type: 'Expense' },
    { account_id: '230', account_name: '60000 OPERATIONS:61000 TECHNOLOGY:61200 Equipment', budget: 5000.04, actual: 4604.35, variance: -395.69, percent_of_budget: 92.1, account_type: 'Expense' },
    { account_id: '156', account_name: '70000 CHURCH BUILDING:71000 Mortgage Interest Expense', budget: 140553, actual: 77547.58, variance: -63005.42, percent_of_budget: 55.2, account_type: 'Expense' },
  ],
}

const principal = { principal_paid: 0, breakdown: [] }
const review = { uncategorized: [], unreconciled: [] }
function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, media: '(prefers-color-scheme: dark)', addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = String(input)
    if (url.endsWith('/api/budget')) return new Response(JSON.stringify(budgets), { status: 200 })
    if (url.includes('/api/reports/profit-and-loss')) return new Response(JSON.stringify(profitLoss), { status: 200 })
    if (url.includes('/api/reports/monthly-summary')) return new Response(JSON.stringify(monthlySummary), { status: 200 })
    if (url.includes('/api/budget/vs-actuals')) return new Response(JSON.stringify(budgetVsActuals), { status: 200 })
    if (url.includes('/api/budget/principal-payments')) return new Response(JSON.stringify(principal), { status: 200 })
    if (url.includes('/api/review')) return new Response(JSON.stringify(review), { status: 200 })
    return new Response('{}', { status: 404 })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('dashboard regression suite', () => {
  it('defaults the overview FY selector to the current year when available', async () => {
    renderApp()

    const fySelect = await screen.findByDisplayValue('2026')
    expect(fySelect).toBeInTheDocument()
  })

  it('shows FY26 in Reports and keeps it selectable', async () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /reports/i }))
    await screen.findByText('Compare Periods')

    const selects = await screen.findAllByRole('combobox')
    const periodA = selects.find((select) => within(select).queryByRole('option', { name: '2024' }))
    expect(periodA).toBeTruthy()
    const options = within(periodA).getAllByRole('option').map((opt) => opt.textContent)
    expect(options).toEqual(['2024', '2025', '2026'])
    expect(periodA).toHaveDisplayValue('2026')
  })

  it('renders budget variance as surplus/deficit instead of false zero', async () => {
    renderApp()

    await waitFor(() => expect(screen.queryByText('$0')).not.toBeInTheDocument())

    const varianceTitle = await screen.findByText('Budget Variance')
    const card = varianceTitle.closest('div.bg-skin-surface2')
    expect(card).toBeTruthy()
    expect(card).toHaveTextContent('Surplus')
    expect(card).not.toHaveTextContent('$0')
  })

  it('hides principal payments when zero', async () => {
    renderApp()

    await waitFor(() => {
      expect(screen.queryByText('Principal Payments')).not.toBeInTheDocument()
    })
  })
})
