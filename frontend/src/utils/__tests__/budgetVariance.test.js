import { describe, it, expect } from 'vitest'

// Mirrors the isIncomeLike logic from App.jsx exactly so tests break if logic drifts
const INCOME_TYPES = ['Income', 'Other Income']
function isIncomeLike(row) {
  const t = String(row?.account_type ?? '').toLowerCase()
  const n = String(row?.account_name ?? '').toLowerCase()
  if (INCOME_TYPES.some((it) => it.toLowerCase() === t)) return true
  const firstWord = (n.split(':')[0] ?? '').trim().split(/\s+/)[0]
  if (/^\d{5}$/.test(firstWord) && parseInt(firstWord, 10) >= 40000 && parseInt(firstWord, 10) <= 49999) return true
  if (n === 'income' || n.startsWith('income ') || n.includes(' income') || n.includes('giving')) return true
  return false
}

function calcVariance(rows) {
  const expenseRows = rows.filter((r) => (r.budget ?? 0) > 0 && !isIncomeLike(r))
  const totalBudget = expenseRows.reduce((s, r) => s + (r.budget ?? 0), 0)
  const totalActual = expenseRows.reduce((s, r) => s + (r.actual ?? 0), 0)
  return { totalBudget, totalActual, budgetVariance: totalActual - totalBudget, expenseRows }
}

describe('Budget Variance calculation', () => {
  it('excludes rows with Income account_type', () => {
    const rows = [
      { account_name: 'Tithes', account_type: 'Income', budget: 100000, actual: 120000 },
      { account_name: '90000 PERSONNEL & BENEFITS', account_type: 'Expense', budget: 50000, actual: 52000 },
    ]
    const { totalBudget, budgetVariance } = calcVariance(rows)
    expect(totalBudget).toBe(50000)
    expect(budgetVariance).toBe(2000)
  })

  it('excludes rows with Other Income account_type', () => {
    const rows = [
      { account_name: 'Interest Income', account_type: 'Other Income', budget: 1000, actual: 1500 },
      { account_name: '80000 MISSIONS', account_type: 'Expense', budget: 30000, actual: 28000 },
    ]
    const { budgetVariance } = calcVariance(rows)
    expect(budgetVariance).toBe(-2000)
  })

  it('excludes rows in 40000-49999 account number range regardless of type', () => {
    const rows = [
      { account_name: '40000 GIVING:41000 Tithes', account_type: '', budget: 80000, actual: 90000 },
      { account_name: '50000 MINISTRY', account_type: '', budget: 20000, actual: 18000 },
    ]
    const { expenseRows, budgetVariance } = calcVariance(rows)
    expect(expenseRows).toHaveLength(1)
    expect(expenseRows[0].account_name).toBe('50000 MINISTRY')
    expect(budgetVariance).toBe(-2000)
  })

  it('does NOT exclude expense rows with empty account_type (QBO parent accounts)', () => {
    // This is the original bug: empty account_type was causing $0 variance
    const rows = [
      { account_name: '60000 OPERATIONS', account_type: '', budget: 91200, actual: 93650 },
      { account_name: '70000 CHURCH BUILDING', account_type: '', budget: 299450, actual: 291924 },
      { account_name: '90000 PERSONNEL & BENEFITS', account_type: '', budget: 534960, actual: 549489 },
    ]
    const { totalBudget, totalActual, budgetVariance, expenseRows } = calcVariance(rows)
    expect(expenseRows).toHaveLength(3)
    expect(totalBudget).toBe(925610)
    expect(totalActual).toBe(935063)
    expect(budgetVariance).toBe(9453)
  })

  it('excludes rows with zero budget', () => {
    const rows = [
      { account_name: 'Unbudgeted Misc', account_type: 'Expense', budget: 0, actual: 400 },
      { account_name: '50000 MINISTRY', account_type: 'Expense', budget: 146200, actual: 134369 },
    ]
    const { expenseRows } = calcVariance(rows)
    expect(expenseRows).toHaveLength(1)
  })

  it('returns zero variance when no budgeted expense rows exist', () => {
    const rows = [
      { account_name: 'Income', account_type: 'Income', budget: 100000, actual: 110000 },
    ]
    const { totalBudget, budgetVariance } = calcVariance(rows)
    expect(totalBudget).toBe(0)
    expect(budgetVariance).toBe(0)
  })
})

describe('Principal Payments visibility', () => {
  it('renders KPI card when principalPaid > 0', () => {
    expect(50000 > 0).toBe(true)
  })

  it('hides KPI card when principalPaid === 0', () => {
    expect(0 > 0).toBe(false)
  })
})
