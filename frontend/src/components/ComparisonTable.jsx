import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v ?? 0)

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

// Merge two sets of account rows by account_id, pairing up actuals
function mergeRows(rowsA, rowsB) {
  const mapA = new Map((rowsA ?? []).map((r) => [r.account_id, r]))
  const mapB = new Map((rowsB ?? []).map((r) => [r.account_id, r]))
  const allIds = new Set([...mapA.keys(), ...mapB.keys()])
  return [...allIds]
    .map((id) => {
      const a = mapA.get(id)
      const b = mapB.get(id)
      return {
        account_id: id,
        account_name: a?.account_name || b?.account_name || '',
        actualA: a?.actual ?? 0,
        actualB: b?.actual ?? 0,
      }
    })
    .filter((r) => r.actualA !== 0 || r.actualB !== 0)
}

function groupRows(rows) {
  const groups = {}
  const incomeChildren = []
  const otherChildren = []

  for (const row of rows) {
    const name = row.account_name || ''
    const segments = name.split(':').map((s) => s.trim()).filter(Boolean)
    const lastSeg = segments[segments.length - 1] || name

    if (isIncomeAccount(name)) {
      incomeChildren.push({ ...row, displayName: lastSeg })
      continue
    }

    const topKey = segments[0] || name

    if (segments.length <= 1) {
      otherChildren.push({ ...row, displayName: name })
      continue
    }

    if (!groups[topKey]) groups[topKey] = { category: topKey, actualA: 0, actualB: 0, subgroups: {}, children: [] }
    groups[topKey].actualA += row.actualA
    groups[topKey].actualB += row.actualB

    const midKey = segments[1]
    if (!groups[topKey].subgroups[midKey]) {
      groups[topKey].subgroups[midKey] = { category: midKey, actualA: 0, actualB: 0, children: [] }
    }
    groups[topKey].subgroups[midKey].actualA += row.actualA
    groups[topKey].subgroups[midKey].actualB += row.actualB
    if (segments.length >= 3) {
      groups[topKey].subgroups[midKey].children.push({ ...row, displayName: lastSeg })
    }
  }

  const result = []

  if (incomeChildren.length > 0) {
    result.push({
      category: 'Income',
      isIncome: true,
      actualA: incomeChildren.reduce((s, r) => s + r.actualA, 0),
      actualB: incomeChildren.reduce((s, r) => s + r.actualB, 0),
      subgroups: [],
      children: incomeChildren,
    })
  }

  Object.values(groups)
    .map((g) => {
      const allSubs = Object.values(g.subgroups).sort((a, b) => a.category.localeCompare(b.category))
      const subgroups = allSubs.filter((sg) => sg.children.length > 0)
      const flatChildren = allSubs
        .filter((sg) => sg.children.length === 0)
        .map((sg) => ({ ...sg, displayName: sg.category, account_id: sg.category }))
      return { ...g, isIncome: false, subgroups, children: [...flatChildren, ...g.children] }
    })
    .filter((g) => g.actualA !== 0 || g.actualB !== 0)
    .sort((a, b) => a.category.localeCompare(b.category))
    .forEach((g) => result.push(g))

  if (otherChildren.length > 0) {
    result.push({
      category: 'Other / Unallocated',
      isIncome: false,
      actualA: otherChildren.reduce((s, r) => s + r.actualA, 0),
      actualB: otherChildren.reduce((s, r) => s + r.actualB, 0),
      subgroups: [],
      children: otherChildren,
    })
  }

  return result
}

function deltaColor(delta, isIncome) {
  if (delta === 0) return 'text-skin-muted'
  const good = isIncome ? delta > 0 : delta < 0
  return good ? 'text-emerald-500' : 'text-rose-500'
}

function DeltaCell({ actualA, actualB, isIncome }) {
  const delta = actualB - actualA
  const pct = actualA !== 0 ? Math.round((delta / Math.abs(actualA)) * 1000) / 10 : null
  const cls = `tabular-nums text-right font-semibold ${deltaColor(delta, isIncome)}`
  return (
    <td className="py-2 pr-4 text-right">
      <div className={`text-sm ${cls}`}>{delta > 0 ? '+' : ''}{fmt(delta)}</div>
      {pct != null && (
        <div className={`text-xs opacity-70 ${deltaColor(delta, isIncome)}`}>
          {pct > 0 ? '+' : ''}{pct}%
        </div>
      )}
    </td>
  )
}

function LeafRow({ row, indent, isIncome }) {
  const pl = indent === 2 ? 'pl-16' : 'pl-9'
  return (
    <tr className="border-b border-skin-border hover:bg-skin-surface2 transition-colors">
      <td className={`py-2 pr-4 ${pl} text-skin-muted text-xs uppercase tracking-wide`}>{row.displayName}</td>
      <td className="py-2 pr-4 text-right text-skin-muted text-sm tabular-nums">{fmt(row.actualA)}</td>
      <td className="py-2 pr-4 text-right text-skin-fg text-sm tabular-nums">{fmt(row.actualB)}</td>
      <DeltaCell actualA={row.actualA} actualB={row.actualB} isIncome={isIncome} />
    </tr>
  )
}

function SubgroupRow({ sg, isIncome }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="border-b border-skin-border cursor-pointer hover:bg-skin-surface2 transition-colors"
      >
        <td className="py-2 pr-4 pl-9">
          <div className="flex items-center gap-2">
            <ChevronRight size={11} className={`text-skin-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
            <span className="font-medium text-skin-fg text-sm uppercase tracking-wide">{sg.category}</span>
            <span className="text-xs text-skin-muted">({sg.children.length})</span>
          </div>
        </td>
        <td className="py-2 pr-4 text-right text-skin-muted text-sm tabular-nums">{fmt(sg.actualA)}</td>
        <td className="py-2 pr-4 text-right text-skin-fg text-sm tabular-nums">{fmt(sg.actualB)}</td>
        <DeltaCell actualA={sg.actualA} actualB={sg.actualB} isIncome={isIncome} />
      </tr>
      {open && sg.children.map((child) => (
        <LeafRow key={child.account_id} row={child} indent={2} isIncome={isIncome} />
      ))}
    </>
  )
}

function GroupRow({ group }) {
  const [open, setOpen] = useState(false)
  const hasChildren = group.subgroups.length > 0 || group.children.length > 0
  return (
    <>
      <tr
        onClick={() => hasChildren && setOpen((o) => !o)}
        className={`border-b border-skin-border transition-colors ${hasChildren ? 'cursor-pointer hover:bg-skin-surface2' : ''}`}
      >
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <ChevronRight size={13} className={`text-skin-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
            ) : (
              <span className="w-[13px] shrink-0" />
            )}
            <span className="font-semibold text-skin-fg uppercase tracking-wide">{group.category}</span>
            {hasChildren && (
              <span className="text-xs text-skin-muted">({group.subgroups.length + group.children.length})</span>
            )}
          </div>
        </td>
        <td className="py-3 pr-4 text-right text-skin-muted tabular-nums font-medium">{fmt(group.actualA)}</td>
        <td className="py-3 pr-4 text-right text-skin-fg tabular-nums font-semibold">{fmt(group.actualB)}</td>
        <DeltaCell actualA={group.actualA} actualB={group.actualB} isIncome={group.isIncome} />
      </tr>
      {open && group.subgroups.map((sg) => (
        <SubgroupRow key={sg.category} sg={sg} isIncome={group.isIncome} />
      ))}
      {open && group.children.map((child) => (
        <LeafRow key={child.account_id} row={child} indent={1} isIncome={group.isIncome} />
      ))}
    </>
  )
}

export default function ComparisonTable({ rowsA, rowsB, labelA, labelB, loading }) {
  if (loading) return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded bg-skin-surface2 animate-pulse" />)}
    </div>
  )

  const merged = mergeRows(rowsA, rowsB)
  if (!merged.length) return <p className="text-skin-muted text-sm">No data for the selected periods.</p>

  const groups = groupRows(merged)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-skin-muted border-b border-skin-border">
            <th className="text-left pb-3 font-semibold pr-4">Account</th>
            <th className="text-right pb-3 font-semibold pr-4">{labelA}</th>
            <th className="text-right pb-3 font-semibold pr-4">{labelB}</th>
            <th className="text-right pb-3 font-semibold pr-4">Change</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => <GroupRow key={g.category} group={g} />)}
        </tbody>
      </table>
    </div>
  )
}
