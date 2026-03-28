import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v ?? 0)

function ProgressBar({ pct }) {
  const fill = Math.min(pct ?? 0, 100)   // bar maxes out at full when over budget
  const color =
    pct == null ? 'bg-skin-border' :
    pct > 110   ? 'bg-rose-500' :
    pct > 100   ? 'bg-amber-400' :
                  'bg-emerald-500'
  return (
    <div className="w-full bg-skin-border rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${fill}%` }} />
    </div>
  )
}

// Detect income accounts by account number range 40000–49999 OR literal "income" category
function isIncomeAccount(name) {
  const base = (name || '').replace(/:.+$/, '').trim()
  const firstWord = base.split(/\s+/)[0]
  if (/^\d{5}$/.test(firstWord)) {
    const n = parseInt(firstWord, 10)
    if (n >= 40000 && n <= 49999) return true
  }
  if (/^income$/i.test(base) || /^\d+\s+income$/i.test(base)) return true
  return false
}

function displayCategory(cat) {
  if (/^income$/i.test(cat)) return 'Income'
  if (/^unbudgeted/i.test(cat)) return 'Unbudgeted Expenses'
  return cat
}

function calcTotals(budget, actual) {
  return {
    variance: actual - budget,
    percent_of_budget: budget > 0 ? Math.round((actual / budget) * 1000) / 10 : null,
  }
}

function groupRows(rows) {
  const groups = {}        // top-level cost centers
  const incomeChildren = []
  const unbudgetedChildren = []

  for (const row of rows) {
    const name = row.account_name || ''
    const segments = name.split(':').map((s) => s.trim()).filter(Boolean)
    const lastSeg = segments[segments.length - 1] || name

    // ── Income ────────────────────────────────────────────────────────
    if (isIncomeAccount(name)) {
      incomeChildren.push({ ...row, displayName: lastSeg })
      continue
    }

    const topKey = segments[0] || name

    if (segments.length <= 1) {
      // Standalone account (no colon hierarchy)
      if ((row.budget ?? 0) > 0) {
        if (!groups[topKey]) groups[topKey] = { category: topKey, budget: 0, actual: 0, subgroups: {}, children: [] }
        groups[topKey].budget += row.budget ?? 0
        groups[topKey].actual += row.actual ?? 0
      } else if ((row.actual ?? 0) > 0) {
        unbudgetedChildren.push({ ...row, displayName: name })
      }
      continue
    }

    // Has colon hierarchy — ensure top-level group exists
    if (!groups[topKey]) groups[topKey] = { category: topKey, budget: 0, actual: 0, subgroups: {}, children: [] }
    groups[topKey].budget += row.budget ?? 0
    groups[topKey].actual += row.actual ?? 0

    // Always route through subgroups keyed on segments[1].
    // 2-level rows (the parent account itself) contribute budget/actual to the subgroup
    // but don't add a child entry — they ARE the subgroup header.
    // 3-level+ rows add a child entry under that same subgroup key.
    const midKey = segments[1]
    if (!groups[topKey].subgroups[midKey]) {
      groups[topKey].subgroups[midKey] = { category: midKey, budget: 0, actual: 0, children: [] }
    }
    groups[topKey].subgroups[midKey].budget += row.budget ?? 0
    groups[topKey].subgroups[midKey].actual += row.actual ?? 0
    if (segments.length >= 3) {
      groups[topKey].subgroups[midKey].children.push({ ...row, displayName: lastSeg })
    }
  }

  // Post-process: any group with zero total budget → flatten to unbudgeted
  for (const key of Object.keys(groups)) {
    const g = groups[key]
    if (g.budget === 0) {
      for (const child of g.children) {
        if ((child.actual ?? 0) > 0) unbudgetedChildren.push(child)
      }
      for (const sg of Object.values(g.subgroups)) {
        for (const child of sg.children) {
          if ((child.actual ?? 0) > 0) unbudgetedChildren.push(child)
        }
      }
      delete groups[key]
    }
  }

  const result = []

  // 1. Income at top
  if (incomeChildren.length > 0) {
    const budget = incomeChildren.reduce((s, r) => s + (r.budget ?? 0), 0)
    const actual = incomeChildren.reduce((s, r) => s + (r.actual ?? 0), 0)
    result.push({
      category: 'Income',
      budget, actual,
      ...calcTotals(budget, actual),
      subgroups: [],
      children: incomeChildren,
    })
  }

  // 2. Expense cost centers alphabetically
  Object.values(groups)
    .map((g) => {
      const allSubs = Object.values(g.subgroups)
        .map((sg) => ({ ...sg, ...calcTotals(sg.budget, sg.actual) }))
        .sort((a, b) => a.category.localeCompare(b.category))
      // Subgroups with children → collapsible mid-tier rows
      const subgroups = allSubs.filter((sg) => sg.children.length > 0)
      // Subgroups with no children → the parent account had direct budget; render as leaf
      const flatChildren = allSubs
        .filter((sg) => sg.children.length === 0)
        .map((sg) => ({ ...sg, displayName: sg.category, account_id: sg.category }))
      return { ...g, ...calcTotals(g.budget, g.actual), subgroups, children: [...flatChildren, ...g.children] }
    })
    .sort((a, b) => a.category.localeCompare(b.category))
    .forEach((g) => result.push(g))

  // 3. Unbudgeted at bottom
  if (unbudgetedChildren.length > 0) {
    const actual = unbudgetedChildren.reduce((s, r) => s + (r.actual ?? 0), 0)
    result.push({
      category: 'Unbudgeted Expenses',
      budget: 0, actual,
      ...calcTotals(0, actual),
      subgroups: [],
      children: unbudgetedChildren,
    })
  }

  return result
}

function VarianceCell({ value, budget, isIncome = false }) {
  // For income: positive variance (earned more than budgeted) is good → green
  // For expenses: positive variance (spent more than budgeted) is bad → red
  const positive = isIncome ? value > 0 : value < 0
  const negative = isIncome ? value < 0 : (value > 0 && budget > 0)
  return (
    <span className={`font-semibold tabular-nums ${negative ? 'text-rose-500' : positive ? 'text-emerald-500' : 'text-skin-muted'}`}>
      {value > 0 ? '+' : ''}{fmt(value)}
    </span>
  )
}

function PctCell({ pct }) {
  return (
    <div className="flex items-center gap-2">
      <ProgressBar pct={pct} />
      <span className="text-xs text-skin-muted w-12 shrink-0 text-right tabular-nums">
        {pct != null ? `${pct}%` : '—'}
      </span>
    </div>
  )
}

// Leaf row — individual account line
function LeafRow({ child, indent, isIncome = false }) {
  const pl = indent === 2 ? 'pl-16' : 'pl-9'
  return (
    <tr className="border-b border-skin-border hover:bg-skin-surface2 transition-colors">
      <td className={`py-2 pr-4 ${pl} text-skin-muted text-sm uppercase tracking-wide`}>{child.displayName}</td>
      <td className="py-2 pr-4 text-right text-skin-muted text-sm tabular-nums">{fmt(child.budget)}</td>
      <td className="py-2 pr-4 text-right text-skin-fg text-sm tabular-nums">{fmt(child.actual)}</td>
      <td className="py-2 pr-4 text-right text-sm"><VarianceCell value={child.variance} budget={child.budget} isIncome={isIncome} /></td>
      <td className="py-2 w-36"><PctCell pct={child.percent_of_budget} /></td>
    </tr>
  )
}

// Sub-group row (middle tier) — collapsible, shows aggregated totals
function SubgroupRow({ subgroup, isIncome = false }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="border-b border-skin-border cursor-pointer hover:bg-skin-surface2 transition-colors"
      >
        <td className="py-2 pr-4 pl-9">
          <div className="flex items-center gap-2">
            <ChevronRight
              size={11}
              className={`text-skin-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
            />
            <span className="font-medium text-skin-fg text-sm uppercase tracking-wide">{subgroup.category}</span>
            <span className="text-xs text-skin-muted">({subgroup.children.length})</span>
          </div>
        </td>
        <td className="py-2 pr-4 text-right text-skin-muted text-sm tabular-nums">{fmt(subgroup.budget)}</td>
        <td className="py-2 pr-4 text-right text-skin-fg text-sm tabular-nums">{fmt(subgroup.actual)}</td>
        <td className="py-2 pr-4 text-right text-sm"><VarianceCell value={subgroup.variance} budget={subgroup.budget} isIncome={isIncome} /></td>
        <td className="py-2 w-36"><PctCell pct={subgroup.percent_of_budget} /></td>
      </tr>
      {open && subgroup.children.map((child) => (
        <LeafRow key={child.account_id} child={child} indent={2} isIncome={isIncome} />
      ))}
    </>
  )
}

// Top-level category row — collapses to show subgroups + direct children
function CategoryRow({ group }) {
  const [open, setOpen] = useState(false)
  const hasChildren = group.subgroups.length > 0 || group.children.length > 0
  const isIncome = group.category === 'Income'

  return (
    <>
      <tr
        onClick={() => hasChildren && setOpen((o) => !o)}
        className={`border-b border-skin-border transition-colors ${hasChildren ? 'cursor-pointer hover:bg-skin-surface2' : ''}`}
      >
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <ChevronRight
                size={13}
                className={`text-skin-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
              />
            ) : (
              <span className="w-[13px] shrink-0" />
            )}
            <span className="font-semibold text-skin-fg uppercase tracking-wide">{displayCategory(group.category)}</span>
            {hasChildren && (
              <span className="text-xs text-skin-muted">
                ({group.subgroups.length + group.children.length})
              </span>
            )}
          </div>
        </td>
        <td className="py-3 pr-4 text-right text-skin-muted tabular-nums">{fmt(group.budget)}</td>
        <td className="py-3 pr-4 text-right text-skin-fg font-medium tabular-nums">{fmt(group.actual)}</td>
        <td className="py-3 pr-4 text-right"><VarianceCell value={group.variance} budget={group.budget} isIncome={isIncome} /></td>
        <td className="py-3 w-36"><PctCell pct={group.percent_of_budget} /></td>
      </tr>

      {open && group.subgroups.map((sg) => (
        <SubgroupRow key={sg.category} subgroup={sg} isIncome={isIncome} />
      ))}
      {open && group.children.map((child) => (
        <LeafRow key={child.account_id} child={child} indent={1} isIncome={isIncome} />
      ))}
    </>
  )
}

export default function BudgetVsActuals({ data, loading }) {
  if (loading) return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-skin-surface2 animate-pulse" />)}
    </div>
  )

  const rows = (data?.rows ?? []).filter((r) => r.budget > 0 || r.actual > 0)
  if (!rows.length) return <p className="text-skin-muted text-sm">No budget data for this period.</p>

  const groups = groupRows(rows)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-skin-muted border-b border-skin-border">
            <th className="text-left pb-3 font-semibold pr-4">Cost Center</th>
            <th className="text-right pb-3 font-semibold pr-4">Budget</th>
            <th className="text-right pb-3 font-semibold pr-4">Actual</th>
            <th className="text-right pb-3 font-semibold pr-4">Variance</th>
            <th className="text-left pb-3 font-semibold w-36">% Used</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => <CategoryRow key={g.category} group={g} />)}
        </tbody>
      </table>
    </div>
  )
}
