import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, ExternalLink, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client'
import Section from '../components/Section'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v ?? 0)

const STATUS_LABEL = { N: 'Not Cleared', C: 'Cleared' }
const STATUS_COLOR = {
  N: 'text-amber-500 bg-amber-500/10',
  C: 'text-sky-500 bg-sky-500/10',
}

const LOOKBACKS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
]

function pad(n) { return String(n).padStart(2, '0') }
function daysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function TxnRow({ txn, showStatus }) {
  return (
    <tr className="border-b border-skin-border hover:bg-skin-surface2 transition-colors">
      <td className="py-2.5 pr-4 text-sm text-skin-muted tabular-nums whitespace-nowrap">{txn.date}</td>
      <td className="py-2.5 pr-4 text-sm text-skin-fg font-medium">{txn.payee}</td>
      <td className="py-2.5 pr-4 text-xs text-skin-muted">{txn.type}</td>
      <td className="py-2.5 pr-4 text-sm tabular-nums text-right font-semibold text-skin-fg whitespace-nowrap">
        {fmt(txn.amount)}
      </td>
      <td className="py-2.5 pr-4 text-xs text-skin-muted max-w-xs truncate">
        {txn.accounts.join(', ') || '—'}
      </td>
      {showStatus && (
        <td className="py-2.5 pr-4">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[txn.reconcile_status] ?? 'text-skin-muted bg-skin-surface2'}`}>
            {STATUS_LABEL[txn.reconcile_status] ?? txn.reconcile_status}
          </span>
        </td>
      )}
      {txn.memo && (
        <td className="py-2.5 pr-4 text-xs text-skin-muted italic max-w-xs truncate" title={txn.memo}>
          {txn.memo}
        </td>
      )}
      <td className="py-2.5 whitespace-nowrap">
        <a
          href={txn.qbo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-skin-primary hover:underline"
        >
          <ExternalLink size={11} />
          Open in QBO
        </a>
      </td>
    </tr>
  )
}

function TxnTable({ rows, showStatus, loading }) {
  if (loading) return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-10 rounded bg-skin-surface2 animate-pulse" />
      ))}
    </div>
  )

  if (!rows?.length) return (
    <div className="flex items-center gap-2 text-emerald-500 text-sm py-2">
      <CheckCircle2 size={15} />
      All clear — nothing needs attention here.
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-skin-muted border-b border-skin-border">
            <th className="text-left pb-3 pr-4 font-semibold">Date</th>
            <th className="text-left pb-3 pr-4 font-semibold">Payee</th>
            <th className="text-left pb-3 pr-4 font-semibold">Type</th>
            <th className="text-right pb-3 pr-4 font-semibold">Amount</th>
            <th className="text-left pb-3 pr-4 font-semibold">Account</th>
            {showStatus && <th className="text-left pb-3 pr-4 font-semibold">Status</th>}
            <th className="text-left pb-3 pr-4 font-semibold">Memo</th>
            <th className="text-left pb-3 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <TxnRow key={`${t.type}-${t.id}`} txn={t} showStatus={showStatus} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ReviewPage() {
  const [lookback, setLookback] = useState(365)

  const startDate = daysAgo(lookback)
  const endDate = today()

  const { data, isLoading } = useQuery({
    queryKey: ['review', startDate, endDate],
    queryFn: () => api.getReviewItems(startDate, endDate),
  })

  const uncatCount  = data?.uncategorized?.length ?? 0
  const unreconCount = data?.unreconciled?.length ?? 0

  return (
    <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">

      {/* Lookback selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-skin-muted mr-1">Showing</span>
        {LOOKBACKS.map((w) => (
          <button
            key={w.days}
            onClick={() => setLookback(w.days)}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors shadow-sm ${
              lookback === w.days
                ? 'bg-skin-primary text-skin-bg'
                : 'bg-skin-surface border border-skin-border text-skin-muted hover:text-skin-fg'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <Section
        title={`Uncategorized Transactions${uncatCount ? ` — ${uncatCount} item${uncatCount !== 1 ? 's' : ''}` : ''}`}
        icon={AlertTriangle}
      >
        <p className="text-xs text-skin-muted mb-4">
          Expenses posted to "Ask My Accountant" or an uncategorized account — these need a cost center assigned before they appear in budget tracking.
        </p>
        <TxnTable rows={data?.uncategorized} showStatus={false} loading={isLoading} />
      </Section>

      <Section
        title={`Unreconciled Transactions${unreconCount ? ` — ${unreconCount} item${unreconCount !== 1 ? 's' : ''}` : ''}`}
        icon={Clock}
      >
        <p className="text-xs text-skin-muted mb-4">
          Transactions that have been categorized but haven't been reconciled against a bank statement yet.
          <span className="ml-2 inline-flex gap-2">
            <span className="text-amber-500 font-medium">Not Cleared</span> = not yet matched to bank.
            <span className="text-sky-500 font-medium">Cleared</span> = matched to bank but not formally reconciled.
          </span>
        </p>
        <TxnTable rows={data?.unreconciled} showStatus loading={isLoading} />
      </Section>

    </main>
  )
}
