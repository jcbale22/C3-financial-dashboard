import { Info } from 'lucide-react'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)

export default function KPICard({ label, value, subtext, positive, negative, loading, icon: Icon, tooltip }) {
  const valueColor =
    positive === true ? 'text-emerald-500' :
    negative === true ? 'text-rose-500' :
    'text-skin-fg'

  const iconClass =
    positive === true ? 'bg-emerald-500/10 text-emerald-500' :
    negative === true ? 'bg-rose-500/10 text-rose-500' :
    'bg-sky-500/10 text-sky-500'

  return (
    <div className="bg-skin-surface2 rounded-xl border border-skin-border p-5 flex flex-col gap-3 shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-skin-muted">{label}</p>
          {tooltip && (
            <div className="relative group">
              <Info size={11} className="text-skin-muted/50 hover:text-skin-muted cursor-default transition-colors" />
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-skin-surface border border-skin-border shadow-lg px-3 py-2 text-xs text-skin-fg leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-skin-border" />
              </div>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-1.5 rounded-lg ${iconClass}`}>
            <Icon size={14} />
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-36 bg-skin-border rounded animate-pulse" />
      ) : (
        <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{fmt(value)}</p>
      )}
      {subtext && <p className="text-xs text-skin-muted">{subtext}</p>}
    </div>
  )
}
